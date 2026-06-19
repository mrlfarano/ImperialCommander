import { mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import type { Task, TaskPriority, TaskStatus } from "../schemas/index.js";
import type { TaskRepository } from "../storage/index.js";

export type ExportFormat = "markdown" | "json" | "csv" | "board";

export interface ExportOptions {
  tag?: string;
  allTags?: boolean;
  format?: ExportFormat;
  output?: string;
}

export interface ProgressReport {
  total: number;
  completed: number;
  completionPercent: number;
  byStatus: Record<TaskStatus, number>;
  byPriority: Record<TaskPriority, number>;
  ready: number;
  blocked: number;
}

export interface ExportResult {
  format: ExportFormat;
  output?: string;
  content: string;
  progress: ProgressReport;
}

const statuses: TaskStatus[] = [
  "pending",
  "in-progress",
  "review",
  "done",
  "deferred",
  "cancelled",
];
const priorities: TaskPriority[] = ["high", "medium", "low"];

export async function exportTasks(
  repository: TaskRepository,
  options: ExportOptions = {},
): Promise<ExportResult> {
  const format = normalizeFormat(options.format ?? inferFormat(options.output));
  const tagged = await collectTaggedTasks(repository, options);
  const tasks = tagged.flatMap((entry) => entry.tasks);
  const progress = buildProgressReport(tasks);
  const content = renderExport(format, tagged, progress);

  if (options.output) {
    await mkdir(dirname(options.output), { recursive: true });
    await writeFile(options.output, content, "utf8");
  }

  return { format, output: options.output, content, progress };
}

export function buildProgressReport(tasks: Task[]): ProgressReport {
  const byStatus = Object.fromEntries(statuses.map((status) => [status, 0])) as Record<
    TaskStatus,
    number
  >;
  const byPriority = Object.fromEntries(priorities.map((priority) => [priority, 0])) as Record<
    TaskPriority,
    number
  >;
  const completed = tasks.filter((task) => task.status === "done").length;
  const completedIds = new Set(
    tasks.filter((task) => task.status === "done").map((task) => String(task.id)),
  );
  let ready = 0;
  let blocked = 0;

  for (const task of tasks) {
    byStatus[task.status] += 1;
    byPriority[task.priority] += 1;
    if (task.dependencies.every((dependency) => completedIds.has(String(dependency)))) {
      ready += 1;
    } else {
      blocked += 1;
    }
  }

  return {
    total: tasks.length,
    completed,
    completionPercent: tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100),
    byStatus,
    byPriority,
    ready,
    blocked,
  };
}

function renderExport(
  format: ExportFormat,
  tagged: Array<{ tag: string; tasks: Task[] }>,
  progress: ProgressReport,
): string {
  if (format === "json") {
    return `${JSON.stringify({ progress, tags: tagged }, null, 2)}\n`;
  }
  if (format === "csv") {
    return renderCsv(tagged);
  }
  if (format === "board") {
    return renderBoardMarkdown(tagged, progress);
  }
  return renderMarkdown(tagged, progress);
}

function renderMarkdown(
  tagged: Array<{ tag: string; tasks: Task[] }>,
  progress: ProgressReport,
): string {
  return [
    "# Task Export",
    "",
    "## Progress",
    `- Total: ${progress.total}`,
    `- Complete: ${progress.completed} (${progress.completionPercent}%)`,
    `- Ready: ${progress.ready}`,
    `- Blocked: ${progress.blocked}`,
    "",
    "## Tasks",
    ...tagged.flatMap((entry) => [
      `### ${entry.tag}`,
      ...entry.tasks.map(
        (task) => `- ${String(task.id)} [${task.status}] (${task.priority}) ${task.title}`,
      ),
      "",
    ]),
  ].join("\n");
}

function renderBoardMarkdown(
  tagged: Array<{ tag: string; tasks: Task[] }>,
  progress: ProgressReport,
): string {
  const lines = ["# Task Board Export", "", `Progress: ${progress.completionPercent}%`, ""];
  for (const status of statuses) {
    lines.push(`## ${status}`);
    for (const entry of tagged) {
      for (const task of entry.tasks.filter((task) => task.status === status)) {
        lines.push(`- ${String(task.id)} (${task.priority}) ${task.title} [${entry.tag}]`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

function renderCsv(tagged: Array<{ tag: string; tasks: Task[] }>): string {
  const rows = [["tag", "id", "status", "priority", "title", "dependencies", "subtasks"]];
  for (const entry of tagged) {
    for (const task of entry.tasks) {
      rows.push([
        entry.tag,
        String(task.id),
        task.status,
        task.priority,
        task.title,
        task.dependencies.map(String).join(" "),
        String(task.subtasks.length),
      ]);
    }
  }
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

async function collectTaggedTasks(
  repository: TaskRepository,
  options: ExportOptions,
): Promise<Array<{ tag: string; tasks: Task[] }>> {
  const tags = options.allTags ? await repository.listTags() : [options.tag ?? "master"];
  const tagged = [];
  for (const tag of tags) {
    tagged.push({ tag, tasks: await repository.findAll({ tag }) });
  }
  return tagged;
}

function normalizeFormat(format: ExportFormat): ExportFormat {
  return format;
}

function inferFormat(output?: string): ExportFormat {
  const ext = output ? extname(output).toLowerCase() : "";
  if (ext === ".json") {
    return "json";
  }
  if (ext === ".csv") {
    return "csv";
  }
  return "markdown";
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Task } from "../schemas/index.js";
import type { TaskRepository } from "../storage/index.js";

export interface GenerateOptions {
  outputDir: string;
  tag?: string;
  format?: "text" | "json";
}

export interface GenerateResult {
  generated: number;
  removed: number;
  outputDir: string;
}

const generatedPrefix = "task_";

export async function generateTaskFiles(
  repository: TaskRepository,
  options: GenerateOptions,
): Promise<GenerateResult> {
  const tasks = await repository.findAll({ tag: options.tag });
  await mkdir(options.outputDir, { recursive: true });
  const expected = new Set<string>();

  for (const task of tasks) {
    const filename = `${generatedPrefix}${String(task.id).padStart(3, "0")}.${options.format === "json" ? "json" : "md"}`;
    expected.add(filename);
    await writeFile(
      join(options.outputDir, filename),
      options.format === "json"
        ? `${JSON.stringify(task, null, 2)}\n`
        : renderTaskFile(task, options.tag),
      "utf8",
    );
  }

  let removed = 0;
  for (const file of await readdir(options.outputDir)) {
    if (file.startsWith(generatedPrefix) && !expected.has(file)) {
      await rm(join(options.outputDir, file), { force: true });
      removed += 1;
    }
  }

  return { generated: tasks.length, removed, outputDir: options.outputDir };
}

export async function syncReadme(
  repository: TaskRepository,
  readmePath: string,
  options: { tag?: string; withSubtasks?: boolean; status?: Task["status"] } = {},
): Promise<void> {
  const tasks = (await repository.findAll({ tag: options.tag })).filter(
    (task) => !options.status || task.status === options.status,
  );
  const block = renderReadmeBlock(tasks, options);
  const existing = await readOptional(readmePath);
  const next = replaceGeneratedBlock(existing ?? "# Tasks\n", block);
  await writeFile(readmePath, next, "utf8");
}

function renderTaskFile(task: Task, tag = "master"): string {
  return [
    `# Task ${String(task.id)}: ${task.title}`,
    "",
    "## Overview",
    task.description,
    "",
    "## Tag Context",
    tag,
    "",
    "## Implementation Details",
    task.details,
    "",
    "## Subtasks",
    task.subtasks.length === 0
      ? "None"
      : task.subtasks
          .map((subtask) => `- ${String(subtask.id)} [${subtask.status}] ${subtask.title}`)
          .join("\n"),
    "",
    "## Dependencies",
    task.dependencies.length === 0
      ? "None"
      : task.dependencies.map((id) => `- ${String(id)}`).join("\n"),
    "",
    "## Test Strategy",
    task.testStrategy,
  ].join("\n");
}

function renderReadmeBlock(
  tasks: Task[],
  options: { tag?: string; withSubtasks?: boolean },
): string {
  const lines = [
    "<!-- imperial-commander:start -->",
    `## Imperial Commander Tasks (${options.tag ?? "master"})`,
    ...tasks.map(
      (task) => `- [${task.status === "done" ? "x" : " "}] ${String(task.id)} ${task.title}`,
    ),
  ];

  if (options.withSubtasks) {
    for (const task of tasks) {
      for (const subtask of task.subtasks) {
        lines.push(
          `  - [${subtask.status === "done" ? "x" : " "}] ${String(task.id)}.${String(subtask.id)} ${subtask.title}`,
        );
      }
    }
  }

  lines.push("<!-- imperial-commander:end -->");
  return `${lines.join("\n")}\n`;
}

function replaceGeneratedBlock(existing: string, block: string): string {
  const pattern = /<!-- imperial-commander:start -->[\s\S]*?<!-- imperial-commander:end -->\n?/;
  if (pattern.test(existing)) {
    return existing.replace(pattern, block);
  }
  return `${existing.trimEnd()}\n\n${block}`;
}

async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

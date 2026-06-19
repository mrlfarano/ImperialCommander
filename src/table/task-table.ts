import type { ComplexityLevel, Task, TaskPriority, TaskStatus } from "../schemas/index.js";
import { searchTasks } from "../search/search.js";
import type { SearchOptions } from "../search/search.js";
import type { TaskRepository } from "../storage/index.js";
import { findNextTask } from "../tasks/lifecycle.js";

export interface TaskTableRow {
  id: string;
  tag: string;
  status: TaskStatus;
  priority: TaskPriority;
  title: string;
  complexityScore?: number;
  complexityLevel?: ComplexityLevel;
  dependencies: string[];
  blockedBy: string[];
  ready: boolean;
  subtasksDone: number;
  subtasksTotal: number;
}

export interface TaskTableFooter {
  total: number;
  done: number;
  percentDone: number;
  byStatus: Record<string, number>;
  byPriority: Record<TaskPriority, number>;
  byComplexity: Record<ComplexityLevel, number> & { unknown: number };
  avgComplexity: number | null;
  ready: number;
  blocked: number;
  next?: { id: string; title: string };
}

export interface TaskTableGroup {
  key: string;
  count: number;
  rows: TaskTableRow[];
}

export interface TaskTableData {
  tag: string;
  rows: TaskTableRow[];
  footer: TaskTableFooter;
  groups?: TaskTableGroup[];
}

export type TaskTableSort = "id" | "priority" | "status" | "title" | "complexity";

export interface BuildTaskTableOptions extends Omit<SearchOptions, "sort"> {
  minComplexity?: number;
  sort?: TaskTableSort;
  groupBy?: "status" | "priority" | "complexity" | "tag";
}

export async function buildTaskTable(
  repository: TaskRepository,
  options: BuildTaskTableOptions = {},
): Promise<TaskTableData> {
  const tag = options.tag ?? "master";
  const searchSort = options.sort === "complexity" ? undefined : options.sort;
  const results = await searchTasks(repository, { ...options, sort: searchSort });

  const doneByTag = await buildDoneSets(repository, new Set(results.map((result) => result.tag)));

  let rows = results.map((result) =>
    toRow(result.task, result.tag, doneByTag.get(result.tag) ?? new Set()),
  );

  if (options.minComplexity !== undefined) {
    const threshold = options.minComplexity;
    rows = rows.filter(
      (row) => row.complexityScore !== undefined && row.complexityScore >= threshold,
    );
  }

  if (options.sort === "complexity") {
    rows = [...rows].sort(
      (left, right) => (right.complexityScore ?? -1) - (left.complexityScore ?? -1),
    );
  }

  const next = await findNextTask(repository, { tag });

  return {
    tag,
    rows,
    footer: buildFooter(
      rows,
      next ? { id: String(next.task.id), title: next.task.title } : undefined,
    ),
    groups: options.groupBy ? groupRows(rows, options.groupBy) : undefined,
  };
}

async function buildDoneSets(
  repository: TaskRepository,
  tags: Set<string>,
): Promise<Map<string, Set<string>>> {
  const doneByTag = new Map<string, Set<string>>();
  for (const tag of tags) {
    const tasks = await repository.findAll({ tag });
    doneByTag.set(
      tag,
      new Set(tasks.filter((task) => task.status === "done").map((task) => String(task.id))),
    );
  }
  return doneByTag;
}

function toRow(task: Task, tag: string, done: Set<string>): TaskTableRow {
  const dependencies = task.dependencies.map(String);
  const blockedBy = dependencies.filter((id) => !done.has(id));
  return {
    id: String(task.id),
    tag,
    status: task.status,
    priority: task.priority,
    title: task.title,
    complexityScore: task.complexity?.score,
    complexityLevel: task.complexity?.level,
    dependencies,
    blockedBy,
    ready: blockedBy.length === 0,
    subtasksDone: task.subtasks.filter((subtask) => subtask.status === "done").length,
    subtasksTotal: task.subtasks.length,
  };
}

function buildFooter(
  rows: TaskTableRow[],
  next: { id: string; title: string } | undefined,
): TaskTableFooter {
  const byStatus: Record<string, number> = {};
  const byPriority: Record<TaskPriority, number> = { high: 0, medium: 0, low: 0 };
  const byComplexity: Record<ComplexityLevel, number> & { unknown: number } = {
    low: 0,
    medium: 0,
    high: 0,
    unknown: 0,
  };

  let scoreSum = 0;
  let scored = 0;
  let done = 0;
  let ready = 0;

  for (const row of rows) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    byPriority[row.priority] += 1;
    if (row.complexityLevel) {
      byComplexity[row.complexityLevel] += 1;
      scoreSum += row.complexityScore ?? 0;
      scored += 1;
    } else {
      byComplexity.unknown += 1;
    }
    if (row.status === "done") {
      done += 1;
    }
    if (row.ready && row.status !== "done") {
      ready += 1;
    }
  }

  const total = rows.length;
  return {
    total,
    done,
    percentDone: total === 0 ? 0 : Math.round((done / total) * 100),
    byStatus,
    byPriority,
    byComplexity,
    avgComplexity: scored === 0 ? null : Number((scoreSum / scored).toFixed(1)),
    ready,
    blocked: rows.filter((row) => !row.ready && row.status !== "done").length,
    next,
  };
}

function groupRows(
  rows: TaskTableRow[],
  groupBy: NonNullable<BuildTaskTableOptions["groupBy"]>,
): TaskTableGroup[] {
  const keyOf = (row: TaskTableRow): string => {
    if (groupBy === "status") return row.status;
    if (groupBy === "priority") return row.priority;
    if (groupBy === "tag") return row.tag;
    return row.complexityLevel ?? "none";
  };

  const buckets = new Map<string, TaskTableRow[]>();
  for (const row of rows) {
    const key = keyOf(row);
    buckets.set(key, [...(buckets.get(key) ?? []), row]);
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, groupRows]) => ({ key, count: groupRows.length, rows: groupRows }));
}

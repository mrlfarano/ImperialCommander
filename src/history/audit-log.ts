import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { type ProjectPathOptions, resolveProjectConfigDir } from "../config/paths.js";
import type { Task } from "../schemas/index.js";
import type { StorageChangeEvent, StorageChangeOperation } from "../storage/change-events.js";
import type { TaskStore } from "../storage/task-store.js";

export const HISTORY_LOG_FILE_NAME = "history.json";
export const DEFAULT_HISTORY_LIMIT = 500;

export interface HistoryOptions extends ProjectPathOptions {
  historyPath?: string;
  storePath?: string;
  limit?: number;
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  operation: StorageChangeOperation;
  tag?: string;
  taskIds: Array<Task["id"]>;
  before?: TaskStore;
  after?: TaskStore;
  reversible: boolean;
  source: StorageChangeEvent["source"];
  metadata?: Record<string, unknown>;
}

export function resolveHistoryPath(options: HistoryOptions = {}): string {
  return (
    options.historyPath ??
    (options.storePath
      ? join(dirname(options.storePath), HISTORY_LOG_FILE_NAME)
      : join(resolveProjectConfigDir(options), HISTORY_LOG_FILE_NAME))
  );
}

export async function readHistory(options: HistoryOptions = {}): Promise<HistoryEntry[]> {
  try {
    const raw = await readFile(resolveHistoryPath(options), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isHistoryEntry) : [];
  } catch {
    return [];
  }
}

export async function appendHistoryEntry(
  event: StorageChangeEvent,
  options: HistoryOptions = {},
): Promise<HistoryEntry> {
  const entry: HistoryEntry = {
    id: event.id,
    timestamp: event.timestamp,
    operation: event.operation,
    tag: event.tag,
    taskIds: event.taskIds,
    before: event.before,
    after: event.after,
    reversible: event.reversible && event.before !== undefined,
    source: event.source,
    metadata: event.metadata,
  };
  const limit = Math.max(1, options.limit ?? DEFAULT_HISTORY_LIMIT);
  const entries = [...(await readHistory(options)), entry].slice(-limit);
  const historyPath = resolveHistoryPath(options);
  await mkdir(dirname(historyPath), { recursive: true });
  await writeFile(historyPath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
  return entry;
}

export async function clearHistory(options: HistoryOptions = {}): Promise<void> {
  const historyPath = resolveHistoryPath(options);
  await mkdir(dirname(historyPath), { recursive: true });
  await writeFile(historyPath, "[]\n", "utf8");
}

export function filterHistory(
  entries: HistoryEntry[],
  filters: { tag?: string; operation?: string; id?: string; limit?: number } = {},
): HistoryEntry[] {
  const filtered = entries.filter((entry) => {
    if (filters.tag && entry.tag !== filters.tag) {
      return false;
    }

    if (filters.operation && entry.operation !== filters.operation) {
      return false;
    }

    if (filters.id && !entry.taskIds.some((taskId) => String(taskId) === filters.id)) {
      return false;
    }

    return true;
  });

  return filtered.slice(-(filters.limit ?? filtered.length)).reverse();
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as HistoryEntry).id === "string" &&
    typeof (value as HistoryEntry).timestamp === "string" &&
    typeof (value as HistoryEntry).operation === "string" &&
    Array.isArray((value as HistoryEntry).taskIds)
  );
}

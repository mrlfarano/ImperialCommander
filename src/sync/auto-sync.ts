import { dirname, resolve, sep } from "node:path";
import { getConfig } from "../config/config-manager.js";
import { DEFAULT_CONFIG_DIR_NAME } from "../config/paths.js";
import type { StorageChangeEvent, TaskRepository, TaskStoreOptions } from "../storage/index.js";
import { DEFAULT_TASK_TAG } from "../storage/index.js";
import { runExternalSync } from "./sync.js";

interface AutoSyncOptions extends TaskStoreOptions {
  currentTag?: string;
}

interface PendingSync {
  repository: TaskRepository;
  projectRoot: string;
  tag: string;
}

const pending = new Map<string, PendingSync>();
const timers = new Map<string, NodeJS.Timeout>();
const autoSyncOperations = new Set([
  "task.created",
  "task.updated",
  "task.removed",
  "task.moved",
  "tag.created",
  "tag.removed",
  "undo.applied",
]);

export function queueHermesKanbanAutoSync(
  repository: TaskRepository,
  options: AutoSyncOptions,
  event: StorageChangeEvent,
): void {
  if (!autoSyncOperations.has(event.operation)) {
    return;
  }

  const projectRoot = resolveAutoSyncProjectRoot(options);
  if (!projectRoot) {
    return;
  }

  const tag = event.tag ?? options.currentTag ?? DEFAULT_TASK_TAG;
  const key = `${projectRoot}\u0000${tag}`;
  pending.set(key, { repository, projectRoot, tag });

  const existing = timers.get(key);
  if (existing) {
    clearTimeout(existing);
  }

  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      void flushOne(key).catch(() => {
        // Auto-sync is best-effort and must never break the originating write.
      });
    }, 50),
  );
}

export async function flushHermesKanbanAutoSyncs(): Promise<void> {
  const keys = Array.from(pending.keys());
  for (const key of keys) {
    const timer = timers.get(key);
    if (timer) {
      clearTimeout(timer);
      timers.delete(key);
    }
    await flushOne(key);
  }
}

async function flushOne(key: string): Promise<void> {
  const item = pending.get(key);
  if (!item) {
    return;
  }
  pending.delete(key);

  const config = await getConfig({
    projectRoot: item.projectRoot,
    forceReload: true,
    suppressWarnings: true,
  });
  const hermesKanban = config.integrations.hermesKanban;

  if (!hermesKanban.enabled || !hermesKanban.autoSync) {
    return;
  }

  await runExternalSync(item.repository, {
    provider: "hermes-kanban",
    projectRoot: item.projectRoot,
    tag: item.tag,
    dryRun: false,
    board: hermesKanban.board,
    scope: hermesKanban.scope,
    assignee: hermesKanban.assignee ?? undefined,
    goal: hermesKanban.goal,
    hermesCommand: hermesKanban.hermesCommand,
  });
}

function resolveAutoSyncProjectRoot(options: AutoSyncOptions): string | undefined {
  if (options.projectRoot) {
    return resolve(options.projectRoot);
  }

  if (!options.storePath) {
    return undefined;
  }

  const absolute = resolve(options.storePath);
  const parts = absolute.split(sep);
  const configIndex = parts.lastIndexOf(DEFAULT_CONFIG_DIR_NAME);
  if (configIndex <= 0) {
    return undefined;
  }

  return parts.slice(0, configIndex).join(sep) || sep;
}

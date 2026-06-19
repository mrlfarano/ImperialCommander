import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { type ProjectPathOptions, resolveProjectConfigDir } from "../config/paths.js";
import { type Task, type TaskEntityId, TaskSchema } from "../schemas/index.js";

export const DEFAULT_TASK_TAG = "master";
export const TASK_STORE_DIR_NAME = "tasks";
export const TASK_STORE_FILE_NAME = "tasks.json";

export interface TaskTagMetadata {
  created: string;
  updated: string;
  description: string;
}

export interface TaskTagStore {
  tasks: Task[];
  metadata: TaskTagMetadata;
}

export type TaskStore = Record<string, TaskTagStore>;

export interface TaskStoreOptions extends ProjectPathOptions {
  storePath?: string;
  now?: Date;
}

export interface LoadTaskStoreResult {
  store: TaskStore;
  migrated: boolean;
  corrupt: boolean;
}

export interface SaveTagOptions extends TaskStoreOptions {
  description?: string;
}

export interface ResolveTagOptions {
  explicitTag?: string;
  currentTag?: string | null;
  defaultTag?: string;
}

const metadataSchema = z
  .object({
    created: z.string().datetime(),
    updated: z.string().datetime(),
    description: z.string(),
  })
  .strict();

const tagStoreSchema = z
  .object({
    tasks: z.array(TaskSchema),
    metadata: metadataSchema,
  })
  .strict();

const taskStoreSchema = z.record(z.string().min(1), tagStoreSchema);
const legacyTaskListSchema = z.array(TaskSchema);

export class TaskStoreValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Task store validation failed:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
    this.name = "TaskStoreValidationError";
    this.issues = issues;
  }
}

export function resolveTaskStorePath(options: TaskStoreOptions = {}): string {
  return (
    options.storePath ??
    join(resolveProjectConfigDir(options), TASK_STORE_DIR_NAME, TASK_STORE_FILE_NAME)
  );
}

export function resolveTaskTag({
  explicitTag,
  currentTag,
  defaultTag = DEFAULT_TASK_TAG,
}: ResolveTagOptions = {}): string {
  return normalizeTag(explicitTag) ?? normalizeTag(currentTag) ?? defaultTag;
}

export async function loadTaskStore(options: TaskStoreOptions = {}): Promise<LoadTaskStoreResult> {
  const storePath = resolveTaskStorePath(options);

  try {
    const contents = await readFile(storePath, "utf8");
    const raw = JSON.parse(contents);
    const migrated = migrateLegacyStore(raw, options.now);
    const parsed = parseTaskStore(migrated.store);

    validateTaskStore(parsed);

    return {
      store: parsed,
      migrated: migrated.migrated,
      corrupt: false,
    };
  } catch (error) {
    if (isNodeFileError(error, "ENOENT") || error instanceof SyntaxError) {
      return { store: {}, migrated: false, corrupt: error instanceof SyntaxError };
    }

    throw error;
  }
}

export async function saveTaskStore(
  store: TaskStore,
  options: TaskStoreOptions = {},
): Promise<void> {
  const parsed = parseTaskStore(store);
  validateTaskStore(parsed);
  await writeTaskStoreFile(resolveTaskStorePath(options), parsed);
}

export async function saveTaskTag(
  tag: string,
  tasks: Task[],
  options: SaveTagOptions = {},
): Promise<TaskStore> {
  const resolvedTag = resolveTaskTag({ explicitTag: tag });
  const { store } = await loadTaskStore(options);
  const now = (options.now ?? new Date()).toISOString();
  const existing = store[resolvedTag];
  const nextStore: TaskStore = {
    ...store,
    [resolvedTag]: {
      tasks,
      metadata: {
        created: existing?.metadata.created ?? now,
        updated: now,
        description: options.description ?? existing?.metadata.description ?? "",
      },
    },
  };

  await saveTaskStore(nextStore, options);

  return nextStore;
}

export function validateTaskStore(store: TaskStore): void {
  const parsed = parseTaskStore(store);
  const issues = Object.entries(parsed).flatMap(([tag, tagStore]) =>
    validateTaskTag(tag, tagStore),
  );

  if (issues.length > 0) {
    throw new TaskStoreValidationError(issues);
  }
}

function parseTaskStore(store: unknown): TaskStore {
  const parsed = taskStoreSchema.safeParse(store);

  if (parsed.success) {
    return parsed.data;
  }

  throw new TaskStoreValidationError(
    parsed.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    }),
  );
}

export function allocateNextTaskId(tasks: Task[]): number {
  const numericIds = tasks
    .map((task) => task.id)
    .filter((id): id is number => typeof id === "number");

  return numericIds.length === 0 ? 1 : Math.max(...numericIds) + 1;
}

export function createTaskTagStore(
  tasks: Task[],
  options: { now?: Date; description?: string } = {},
): TaskTagStore {
  const now = (options.now ?? new Date()).toISOString();

  return {
    tasks,
    metadata: {
      created: now,
      updated: now,
      description: options.description ?? "",
    },
  };
}

function migrateLegacyStore(raw: unknown, now?: Date): { store: TaskStore; migrated: boolean } {
  const legacy = legacyTaskListSchema.safeParse(raw);

  if (!legacy.success) {
    return { store: raw as TaskStore, migrated: false };
  }

  return {
    store: {
      [DEFAULT_TASK_TAG]: createTaskTagStore(legacy.data, {
        now,
        description: "Migrated legacy task list",
      }),
    },
    migrated: true,
  };
}

function validateTaskTag(tag: string, tagStore: TaskTagStore): string[] {
  const issues: string[] = [];
  const taskIds = new Set<string>();
  const taskDependencyEdges = new Map<string, string[]>();

  for (const task of tagStore.tasks) {
    const taskKey = idKey(task.id);

    if (taskIds.has(taskKey)) {
      issues.push(`Tag "${tag}" has duplicate task id "${taskKey}".`);
    }

    taskIds.add(taskKey);
  }

  for (const task of tagStore.tasks) {
    const taskKey = idKey(task.id);
    const subtaskIds = new Set<string>();
    const subtaskEdges = new Map<string, string[]>();

    taskDependencyEdges.set(
      taskKey,
      task.dependencies.map((dependency) => idKey(dependency)),
    );

    for (const dependency of task.dependencies) {
      const dependencyKey = idKey(dependency);

      if (!taskIds.has(dependencyKey)) {
        issues.push(`Tag "${tag}" task "${taskKey}" has unknown dependency "${dependencyKey}".`);
      }
    }

    for (const subtask of task.subtasks) {
      const subtaskKey = idKey(subtask.id);

      if (subtaskIds.has(subtaskKey)) {
        issues.push(`Tag "${tag}" task "${taskKey}" has duplicate subtask id "${subtaskKey}".`);
      }

      subtaskIds.add(subtaskKey);
    }

    for (const subtask of task.subtasks) {
      const subtaskKey = idKey(subtask.id);
      const siblingDependencies: string[] = [];

      for (const dependency of subtask.dependencies) {
        const dependencyKey = idKey(dependency);
        const dotNotation = parseDotNotationDependency(dependencyKey);
        const referencesThisParent = dotNotation?.taskId === taskKey;
        const knownSibling = subtaskIds.has(dependencyKey);
        const knownDottedSibling = referencesThisParent && subtaskIds.has(dotNotation.subtaskId);
        const knownTask = taskIds.has(dependencyKey);

        if (!knownSibling && !knownDottedSibling && !knownTask) {
          issues.push(
            `Tag "${tag}" task "${taskKey}" subtask "${subtaskKey}" has unknown dependency "${dependencyKey}".`,
          );
        }

        if (knownSibling) {
          siblingDependencies.push(dependencyKey);
        } else if (knownDottedSibling) {
          siblingDependencies.push(dotNotation.subtaskId);
        }
      }

      subtaskEdges.set(subtaskKey, siblingDependencies);
    }

    issues.push(
      ...findCircularDependencies(subtaskEdges, `Tag "${tag}" task "${taskKey}" subtasks`),
    );
  }

  issues.push(...findCircularDependencies(taskDependencyEdges, `Tag "${tag}" tasks`));

  return issues;
}

function findCircularDependencies(edges: Map<string, string[]>, label: string): string[] {
  const issues: string[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(node: string, path: string[]): void {
    if (visiting.has(node)) {
      issues.push(`${label} contain a circular dependency: ${[...path, node].join(" -> ")}.`);
      return;
    }

    if (visited.has(node)) {
      return;
    }

    visiting.add(node);

    for (const dependency of edges.get(node) ?? []) {
      if (edges.has(dependency)) {
        visit(dependency, [...path, node]);
      }
    }

    visiting.delete(node);
    visited.add(node);
  }

  for (const node of edges.keys()) {
    visit(node, []);
  }

  return issues;
}

function idKey(id: TaskEntityId): string {
  return String(id);
}

function parseDotNotationDependency(id: string): { taskId: string; subtaskId: string } | undefined {
  const [taskId, subtaskId, extra] = id.split(".");

  if (!taskId || !subtaskId || extra !== undefined) {
    return undefined;
  }

  return { taskId, subtaskId };
}

function normalizeTag(tag: string | null | undefined): string | undefined {
  const trimmed = tag?.trim();
  return trimmed ? trimmed : undefined;
}

async function writeTaskStoreFile(storePath: string, store: TaskStore): Promise<void> {
  await mkdir(dirname(storePath), { recursive: true });

  const tempPath = join(
    dirname(storePath),
    `.${TASK_STORE_FILE_NAME}.${process.pid}.${randomUUID()}.tmp`,
  );
  const contents = `${JSON.stringify(store, null, 2)}\n`;

  await writeFile(tempPath, contents, "utf8");
  await rename(tempPath, storePath);
}

function isNodeFileError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}

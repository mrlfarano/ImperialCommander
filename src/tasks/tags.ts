import {
  createDefaultRuntimeState,
  getRuntimeState,
  setRuntimeState,
} from "../state/runtime-state.js";
import { FileTaskRepository } from "../storage/index.js";
import {
  type TaskStoreOptions,
  createTaskTagStore,
  loadTaskStore,
  saveTaskStore,
} from "../storage/task-store.js";
import { findNextTask } from "./lifecycle.js";

export interface TagMetrics {
  tag: string;
  description: string;
  taskCount: number;
  completionPercent: number;
  readyCount: number;
  created: string;
  updated: string;
}

export interface TagOptions extends TaskStoreOptions {
  currentTag?: string;
}

export async function addTag(
  tag: string,
  options: TagOptions & {
    description?: string;
    copyFrom?: string;
    copyFromCurrent?: boolean;
    fromBranch?: string;
  } = {},
): Promise<string> {
  const targetTag = options.fromBranch ? branchNameToTag(options.fromBranch) : tag;
  const { store } = await loadTaskStore(options);

  if (store[targetTag]) {
    return targetTag;
  }

  const sourceTag = options.copyFromCurrent ? options.currentTag : options.copyFrom;
  const source = sourceTag ? store[sourceTag] : undefined;
  store[targetTag] = source
    ? {
        tasks: structuredClone(source.tasks),
        metadata: {
          ...source.metadata,
          description: options.description ?? source.metadata.description,
        },
      }
    : createTaskTagStore([], { description: options.description });

  await saveTaskStore(store, options);
  return targetTag;
}

export async function useTag(tag: string, options: TagOptions = {}): Promise<void> {
  const state = await getRuntimeState(options);
  await setRuntimeState(
    {
      ...state,
      currentTag: tag,
      lastSwitched: (options.now ?? new Date()).toISOString(),
    },
    options,
  );
}

export async function listTagMetrics(options: TagOptions = {}): Promise<TagMetrics[]> {
  const { store } = await loadTaskStore(options);
  const metrics: TagMetrics[] = [];

  for (const [tag, tagStore] of Object.entries(store)) {
    const done = tagStore.tasks.filter((task) => task.status === "done").length;
    const next = await findNextTask(
      new FileTaskRepository({ storePath: options.storePath, currentTag: tag }),
      { tag },
    );
    metrics.push({
      tag,
      description: tagStore.metadata.description,
      taskCount: tagStore.tasks.length,
      completionPercent:
        tagStore.tasks.length === 0 ? 0 : Math.round((done / tagStore.tasks.length) * 100),
      readyCount: next ? 1 : 0,
      created: tagStore.metadata.created,
      updated: tagStore.metadata.updated,
    });
  }

  return metrics.sort((left, right) => left.tag.localeCompare(right.tag));
}

export async function renameTag(from: string, to: string, options: TagOptions = {}): Promise<void> {
  const { store } = await loadTaskStore(options);

  if (!store[from]) {
    throw new Error(`Tag "${from}" was not found.`);
  }

  if (store[to]) {
    throw new Error(`Tag "${to}" already exists.`);
  }

  store[to] = store[from];
  delete store[from];
  await saveTaskStore(store, options);
}

export async function copyTag(
  from: string,
  to: string,
  options: TagOptions & { description?: string } = {},
): Promise<void> {
  const { store } = await loadTaskStore(options);

  if (!store[from]) {
    throw new Error(`Tag "${from}" was not found.`);
  }

  if (store[to]) {
    throw new Error(`Tag "${to}" already exists.`);
  }

  store[to] = {
    tasks: structuredClone(store[from].tasks),
    metadata: {
      ...store[from].metadata,
      description: options.description ?? store[from].metadata.description,
    },
  };
  await saveTaskStore(store, options);
}

export async function deleteTagWithConfirm(
  tag: string,
  options: TagOptions & { yes?: boolean } = {},
): Promise<boolean> {
  if (!options.yes) {
    throw new Error("Confirmation required. Pass yes to delete a tag.");
  }

  const { store } = await loadTaskStore(options);

  if (!store[tag]) {
    return false;
  }

  delete store[tag];
  await saveTaskStore(store, options);
  return true;
}

export function branchNameToTag(branch: string): string {
  return (
    branch
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "branch"
  );
}

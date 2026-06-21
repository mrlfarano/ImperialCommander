import { appendHistoryEntry } from "../history/audit-log.js";
import type { Task } from "../schemas/index.js";
import { queueHermesKanbanAutoSync } from "../sync/auto-sync.js";
import { createStorageChangeEvent, emitStorageChange } from "./change-events.js";
import type {
  CreateTagOptions,
  MoveTarget,
  RepositoryTagOptions,
  TaskRepository,
} from "./repository.js";
import {
  DEFAULT_TASK_TAG,
  type TaskStore,
  type TaskStoreOptions,
  createTaskTagStore,
  loadTaskStore,
  resolveTaskTag,
  saveTaskStore,
} from "./task-store.js";

export class TaskNotFoundError extends Error {
  constructor(id: Task["id"]) {
    super(`Task "${String(id)}" was not found.`);
    this.name = "TaskNotFoundError";
  }
}

export class FileTaskRepository implements TaskRepository {
  constructor(private readonly options: TaskStoreOptions & { currentTag?: string } = {}) {}

  async findAll(options: RepositoryTagOptions = {}): Promise<Task[]> {
    const { tagStore } = await this.readTag(options);
    return tagStore.tasks;
  }

  async findById(id: Task["id"], options: RepositoryTagOptions = {}): Promise<Task | undefined> {
    return (await this.findAll(options)).find((task) => sameId(task.id, id));
  }

  async create(task: Task, options: RepositoryTagOptions = {}): Promise<Task> {
    const { store, tag, tagStore } = await this.readTag(options);

    if (tagStore.tasks.some((existing) => sameId(existing.id, task.id))) {
      throw new Error(`Task "${String(task.id)}" already exists.`);
    }

    const nextStore = {
      ...store,
      [tag]: {
        ...tagStore,
        tasks: [...tagStore.tasks, task],
      },
    };

    await saveTaskStore(nextStore, this.options);
    await this.recordChange(
      createStorageChangeEvent({
        operation: "task.created",
        tag,
        taskIds: [task.id],
        before: store,
        after: nextStore,
        reversible: true,
        source: "repository",
      }),
    );

    return task;
  }

  async update(
    id: Task["id"],
    patch: Partial<Task>,
    options: RepositoryTagOptions = {},
  ): Promise<Task> {
    const { store, tag, tagStore } = await this.readTag(options);
    let updatedTask: Task | undefined;

    const tasks = tagStore.tasks.map((task) => {
      if (!sameId(task.id, id)) {
        return task;
      }

      updatedTask = { ...task, ...patch, id: task.id };
      return updatedTask;
    });

    if (!updatedTask) {
      throw new TaskNotFoundError(id);
    }

    const nextStore = { ...store, [tag]: { ...tagStore, tasks } };
    await saveTaskStore(nextStore, this.options);
    await this.recordChange(
      createStorageChangeEvent({
        operation: "task.updated",
        tag,
        taskIds: [id],
        before: store,
        after: nextStore,
        reversible: true,
        source: "repository",
        metadata:
          patch.status !== undefined
            ? {
                status: updatedTask.status,
                previousStatus: tagStore.tasks.find((task) => sameId(task.id, id))?.status,
              }
            : undefined,
      }),
    );
    return updatedTask;
  }

  async delete(id: Task["id"], options: RepositoryTagOptions = {}): Promise<boolean> {
    const { store, tag, tagStore } = await this.readTag(options);
    const tasks = tagStore.tasks.filter((task) => !sameId(task.id, id));

    if (tasks.length === tagStore.tasks.length) {
      return false;
    }

    const nextStore = { ...store, [tag]: { ...tagStore, tasks } };
    await saveTaskStore(nextStore, this.options);
    await this.recordChange(
      createStorageChangeEvent({
        operation: "task.removed",
        tag,
        taskIds: [id],
        before: store,
        after: nextStore,
        reversible: true,
        source: "repository",
      }),
    );
    return true;
  }

  async move(
    id: Task["id"],
    target: MoveTarget,
    options: RepositoryTagOptions = {},
  ): Promise<Task> {
    const source = await this.readTag(options);
    const sourceTasks = [...source.tagStore.tasks];
    const taskIndex = sourceTasks.findIndex((task) => sameId(task.id, id));

    if (taskIndex === -1) {
      throw new TaskNotFoundError(id);
    }

    const [task] = sourceTasks.splice(taskIndex, 1);
    const targetTag = this.resolveTag({ tag: target.tag });
    const targetTagStore = source.store[targetTag] ?? createTaskTagStore([]);
    const targetTasks = targetTag === source.tag ? sourceTasks : [...targetTagStore.tasks];
    const insertIndex = findInsertIndex(targetTasks, target);

    targetTasks.splice(insertIndex, 0, task);

    const nextStore: TaskStore = {
      ...source.store,
      [source.tag]: { ...source.tagStore, tasks: sourceTasks },
      [targetTag]: { ...targetTagStore, tasks: targetTasks },
    };

    await saveTaskStore(nextStore, this.options);
    await this.recordChange(
      createStorageChangeEvent({
        operation: "task.moved",
        tag: source.tag,
        taskIds: [id],
        before: source.store,
        after: nextStore,
        reversible: true,
        source: "repository",
        metadata: { targetTag },
      }),
    );
    return task;
  }

  async listTags(): Promise<string[]> {
    const { store } = await loadTaskStore(this.options);
    return Object.keys(store);
  }

  async createTag(tag: string, options: CreateTagOptions = {}): Promise<void> {
    const { store } = await loadTaskStore(this.options);

    if (store[tag]) {
      return;
    }

    const nextStore = {
      ...store,
      [tag]: createTaskTagStore([], { description: options.description }),
    };
    await saveTaskStore(nextStore, this.options);
    await this.recordChange(
      createStorageChangeEvent({
        operation: "tag.created",
        tag,
        taskIds: [],
        before: store,
        after: nextStore,
        reversible: true,
        source: "repository",
      }),
    );
  }

  async deleteTag(tag: string): Promise<boolean> {
    const { store } = await loadTaskStore(this.options);

    if (!store[tag]) {
      return false;
    }

    const { [tag]: _deleted, ...remaining } = store;
    await saveTaskStore(remaining, this.options);
    await this.recordChange(
      createStorageChangeEvent({
        operation: "tag.removed",
        tag,
        taskIds: store[tag]?.tasks.map((task) => task.id) ?? [],
        before: store,
        after: remaining,
        reversible: true,
        source: "repository",
      }),
    );
    return true;
  }

  private async readTag(options: RepositoryTagOptions = {}) {
    const tag = this.resolveTag(options);
    const { store } = await loadTaskStore(this.options);
    const tagStore = store[tag] ?? createTaskTagStore([]);

    return { store, tag, tagStore };
  }

  private resolveTag(options: RepositoryTagOptions = {}): string {
    return resolveTaskTag({
      explicitTag: options.tag,
      currentTag: this.options.currentTag,
      defaultTag: DEFAULT_TASK_TAG,
    });
  }

  private async recordChange(event: Parameters<typeof emitStorageChange>[0]): Promise<void> {
    await emitStorageChange(event);

    try {
      await appendHistoryEntry(event, this.options);
    } catch {
      // History is audit-only and must not break repository writes.
    }

    queueHermesKanbanAutoSync(this, this.options, event);
  }
}

function sameId(left: Task["id"], right: Task["id"]): boolean {
  return String(left) === String(right);
}

function findInsertIndex(tasks: Task[], target: MoveTarget): number {
  const { beforeId, afterId } = target;

  if (beforeId !== undefined) {
    const index = tasks.findIndex((task) => sameId(task.id, beforeId));
    return index === -1 ? tasks.length : index;
  }

  if (afterId !== undefined) {
    const index = tasks.findIndex((task) => sameId(task.id, afterId));
    return index === -1 ? tasks.length : index + 1;
  }

  return tasks.length;
}

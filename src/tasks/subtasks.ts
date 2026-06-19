import type { Subtask, Task, TaskStatus } from "../schemas/index.js";
import type { TaskRepository } from "../storage/index.js";
import { nextTaskId, parseCommandId, parseCsvIds } from "./ids.js";

export interface AddSubtaskOptions {
  parentId: Task["id"];
  title?: string;
  existingTaskId?: Task["id"];
  description?: string;
  details?: string;
  status?: TaskStatus;
  dependencies?: string;
  tag?: string;
}

export async function addSubtask(
  repository: TaskRepository,
  options: AddSubtaskOptions,
): Promise<Subtask> {
  const parent = await requireTask(repository, options.parentId, options.tag);
  const id = nextSubtaskId(parent);
  let subtask: Subtask;

  if (options.existingTaskId !== undefined) {
    const existing = await requireTask(repository, options.existingTaskId, options.tag);
    subtask = {
      id,
      title: existing.title,
      description: existing.description,
      details: existing.details,
      status: existing.status,
      dependencies: existing.dependencies,
      metadata: { convertedFromTaskId: existing.id },
    };
    await repository.delete(existing.id, { tag: options.tag });
  } else {
    if (!options.title) {
      throw new Error("A title or existing task id is required to add a subtask.");
    }
    subtask = {
      id,
      title: options.title,
      description: options.description ?? "",
      details: options.details ?? "",
      status: options.status ?? "pending",
      dependencies: parseCsvIds(options.dependencies),
    };
  }

  await repository.update(
    parent.id,
    { subtasks: [...parent.subtasks, subtask] },
    { tag: options.tag },
  );
  return subtask;
}

export async function removeSubtask(
  repository: TaskRepository,
  dottedId: string,
  options: { convert?: boolean; tag?: string } = {},
): Promise<Subtask> {
  const { parentId, subtaskId } = parseDottedSubtaskId(dottedId);
  const parent = await requireTask(repository, parentId, options.tag);
  const subtask = parent.subtasks.find((candidate) => String(candidate.id) === String(subtaskId));

  if (!subtask) {
    throw new Error(`Subtask "${dottedId}" was not found.`);
  }

  await repository.update(
    parent.id,
    { subtasks: parent.subtasks.filter((candidate) => String(candidate.id) !== String(subtaskId)) },
    { tag: options.tag },
  );

  if (options.convert) {
    const tasks = await repository.findAll({ tag: options.tag });
    await repository.create(
      {
        id: nextTaskId(tasks),
        title: subtask.title,
        description: subtask.description,
        details: subtask.details,
        testStrategy: "",
        status: subtask.status,
        priority: "medium",
        dependencies: [],
        subtasks: [],
      },
      { tag: options.tag },
    );
  }

  return subtask;
}

export async function removeTasks(
  repository: TaskRepository,
  ids: Task["id"][],
  options: { yes?: boolean; tag?: string } = {},
): Promise<number> {
  if (ids.length === 0) {
    throw new Error("At least one id is required.");
  }

  if (!options.yes) {
    throw new Error("Confirmation required. Pass yes to delete tasks.");
  }

  let deleted = 0;
  for (const id of ids) {
    if (await repository.delete(id, { tag: options.tag })) {
      deleted += 1;
    }
  }
  return deleted;
}

export async function clearSubtasks(
  repository: TaskRepository,
  options: { ids?: Task["id"][]; all?: boolean; tag?: string } = {},
): Promise<number> {
  if (!options.all && (!options.ids || options.ids.length === 0)) {
    throw new Error("Provide ids or all=true to clear subtasks.");
  }

  const tasks = await repository.findAll({ tag: options.tag });
  const targetIds = options.all
    ? new Set(tasks.map((task) => String(task.id)))
    : new Set(options.ids?.map(String));
  let cleared = 0;

  for (const task of tasks) {
    if (targetIds.has(String(task.id)) && task.subtasks.length > 0) {
      cleared += task.subtasks.length;
      await repository.update(task.id, { subtasks: [] }, { tag: options.tag });
    }
  }

  return cleared;
}

export function parseDottedSubtaskId(id: string): { parentId: Task["id"]; subtaskId: Task["id"] } {
  const [parentId, subtaskId, extra] = id.split(".");

  if (!parentId || !subtaskId || extra !== undefined) {
    throw new Error("Subtask id must use dot notation.");
  }

  return { parentId: parseCommandId(parentId), subtaskId: parseCommandId(subtaskId) };
}

function nextSubtaskId(parent: Task): number {
  const numericIds = parent.subtasks
    .map((subtask) => subtask.id)
    .filter((id): id is number => typeof id === "number");
  return numericIds.length === 0 ? 1 : Math.max(...numericIds) + 1;
}

async function requireTask(
  repository: TaskRepository,
  id: Task["id"],
  tag: string | undefined,
): Promise<Task> {
  const task = await repository.findById(id, { tag });

  if (!task) {
    throw new Error(`Task "${String(id)}" was not found.`);
  }

  return task;
}

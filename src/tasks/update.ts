import type { Subtask, Task } from "../schemas/index.js";
import type { TaskRepository } from "../storage/index.js";
import { parseCommandId } from "./ids.js";

export interface UpdateOptions {
  prompt: string;
  fromId?: number;
  append?: boolean;
  now?: Date;
  tag?: string;
}

export async function updateTasksFrom(
  repository: TaskRepository,
  options: UpdateOptions,
): Promise<Task[]> {
  if (!options.prompt) {
    throw new Error("A prompt is required for update.");
  }

  const fromId = options.fromId ?? 1;
  const tasks = (await repository.findAll({ tag: options.tag })).filter(
    (task) => typeof task.id === "number" && task.id >= fromId,
  );

  const updated: Task[] = [];
  for (const task of tasks) {
    updated.push(await updateTask(repository, task.id, options));
  }

  return updated;
}

export async function updateTask(
  repository: TaskRepository,
  id: Task["id"],
  options: UpdateOptions,
): Promise<Task> {
  if (!options.prompt) {
    throw new Error("A prompt is required for update-task.");
  }

  const task = await requireTask(repository, id, options.tag);
  const details = options.append
    ? appendTimestampedNote(task.details, options.prompt, options.now)
    : options.prompt;

  return repository.update(task.id, { details }, { tag: options.tag });
}

export async function updateSubtask(
  repository: TaskRepository,
  dottedId: string,
  options: UpdateOptions,
): Promise<Subtask> {
  if (!options.prompt) {
    throw new Error("A prompt is required for update-subtask.");
  }

  const { parentId, subtaskId } = parseDottedSubtaskId(dottedId);
  const parent = await requireTask(repository, parentId, options.tag);
  let updated: Subtask | undefined;
  const subtasks = parent.subtasks.map((subtask) => {
    if (String(subtask.id) !== String(subtaskId)) {
      return subtask;
    }

    updated = {
      ...subtask,
      details: appendTimestampedNote(subtask.details, options.prompt, options.now),
    };
    return updated;
  });

  if (!updated) {
    throw new Error(`Subtask "${dottedId}" was not found.`);
  }

  await repository.update(parent.id, { subtasks }, { tag: options.tag });
  return updated;
}

export function appendTimestampedNote(existing: string, note: string, now = new Date()): string {
  const block = `[${now.toISOString()}] ${note}`;
  return existing ? `${existing}\n\n${block}` : block;
}

function parseDottedSubtaskId(id: string): { parentId: Task["id"]; subtaskId: Task["id"] } {
  const [parentId, subtaskId, extra] = id.split(".");

  if (!parentId || !subtaskId || extra !== undefined) {
    throw new Error("Subtask id must use dot notation, e.g. 5.2.");
  }

  return { parentId: parseCommandId(parentId), subtaskId: parseCommandId(subtaskId) };
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

import { FileTaskRepository } from "../storage/index.js";
import { parseCommandId, parseCsvIds } from "../tasks/ids.js";
import { addSubtask, clearSubtasks, removeSubtask, removeTasks } from "../tasks/subtasks.js";
import type { TaskCommandOptions } from "./tasks.js";

export async function addSubtaskCommand(
  options: TaskCommandOptions & {
    parent?: string;
    title?: string;
    existingTaskId?: string;
    description?: string;
    details?: string;
    status?: "pending" | "done" | "in-progress" | "review" | "deferred" | "cancelled";
    dependencies?: string;
  } = {},
): Promise<string> {
  if (!options.parent) {
    throw new Error("Parent task id is required.");
  }

  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const subtask = await addSubtask(repository, {
    parentId: parseCommandId(options.parent),
    title: options.title,
    existingTaskId: options.existingTaskId ? parseCommandId(options.existingTaskId) : undefined,
    description: options.description,
    details: options.details,
    status: options.status,
    dependencies: options.dependencies,
    tag: options.tag,
  });
  return `Created subtask ${String(subtask.id)}: ${subtask.title}`;
}

export async function removeSubtaskCommand(
  id: string,
  options: TaskCommandOptions & { convert?: boolean } = {},
): Promise<string> {
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const subtask = await removeSubtask(repository, id, {
    convert: options.convert,
    tag: options.tag,
  });
  return `Removed subtask ${String(subtask.id)}.`;
}

export async function removeTaskCommand(
  ids: string,
  options: TaskCommandOptions & { yes?: boolean } = {},
): Promise<string> {
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const deleted = await removeTasks(repository, parseCsvIds(ids), {
    yes: options.yes,
    tag: options.tag,
  });
  return `Removed ${deleted} tasks.`;
}

export async function clearSubtasksCommand(
  options: TaskCommandOptions & { ids?: string; all?: boolean } = {},
): Promise<string> {
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const cleared = await clearSubtasks(repository, {
    ids: parseCsvIds(options.ids),
    all: options.all,
    tag: options.tag,
  });
  return `Cleared ${cleared} subtasks.`;
}

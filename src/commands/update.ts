import { FileTaskRepository } from "../storage/index.js";
import { parseCommandId } from "../tasks/ids.js";
import { updateSubtask, updateTask, updateTasksFrom } from "../tasks/update.js";
import type { TaskCommandOptions } from "./tasks.js";

export async function updateCommand(
  options: TaskCommandOptions & { prompt?: string; from?: number; id?: string } = {},
): Promise<string> {
  if (options.id) {
    throw new Error("Use update-task for a single task id.");
  }
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const updated = await updateTasksFrom(repository, {
    prompt: options.prompt ?? "",
    fromId: options.from,
    tag: options.tag,
  });
  return `Updated ${updated.length} tasks.`;
}

export async function updateTaskCommand(
  id: string,
  options: TaskCommandOptions & { prompt?: string; append?: boolean } = {},
): Promise<string> {
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const task = await updateTask(repository, parseCommandId(id), {
    prompt: options.prompt ?? "",
    append: options.append,
    tag: options.tag,
  });
  return `Updated task ${String(task.id)}.`;
}

export async function updateSubtaskCommand(
  id: string,
  options: TaskCommandOptions & { prompt?: string } = {},
): Promise<string> {
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const subtask = await updateSubtask(repository, id, {
    prompt: options.prompt ?? "",
    tag: options.tag,
  });
  return `Updated subtask ${String(subtask.id)}.`;
}

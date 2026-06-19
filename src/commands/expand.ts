import { FileTaskRepository } from "../storage/index.js";
import { expandAllTasks, expandTask } from "../tasks/expand.js";
import { parseCommandId } from "../tasks/ids.js";
import type { TaskCommandOptions } from "./tasks.js";

export interface ExpandCommandOptions extends TaskCommandOptions {
  id?: string;
  num?: number;
  prompt?: string;
  force?: boolean;
}

export async function expandCommand(options: ExpandCommandOptions = {}): Promise<string> {
  if (!options.id) {
    throw new Error("Task id is required.");
  }

  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const result = await expandTask(repository, {
    id: parseCommandId(options.id),
    num: options.num,
    prompt: options.prompt,
    force: options.force,
    tag: options.tag,
  });

  return result.skipped
    ? `Task ${String(result.task.id)} already has subtasks.`
    : `Expanded task ${String(result.task.id)} with ${result.created} subtasks.`;
}

export async function expandAllCommand(
  options: Omit<ExpandCommandOptions, "id"> = {},
): Promise<string> {
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const results = await expandAllTasks(repository, {
    num: options.num,
    prompt: options.prompt,
    force: options.force,
    tag: options.tag,
  });
  const created = results.reduce((total, result) => total + result.created, 0);
  const skipped = results.filter((result) => result.skipped).length;
  return `Expanded ${results.length} tasks with ${created} subtasks (${skipped} skipped).`;
}

import { FileTaskRepository } from "../storage/index.js";
import { moveTask } from "../tasks/move.js";
import type { TaskCommandOptions } from "./tasks.js";

export async function moveCommand(
  options: TaskCommandOptions & {
    from?: string;
    to?: string;
    fromTag?: string;
    toTag?: string;
    before?: string;
    after?: string;
  } = {},
): Promise<string> {
  if (!options.from) {
    throw new Error("A source id is required.");
  }

  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const task = await moveTask(repository, {
    from: options.from,
    to: options.to,
    fromTag: options.fromTag ?? options.tag,
    toTag: options.toTag,
    beforeId: options.before,
    afterId: options.after,
  });
  return `Moved task ${String(task.id)}.`;
}

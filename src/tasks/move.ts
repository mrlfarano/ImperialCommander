import type { Task } from "../schemas/index.js";
import type { TaskRepository } from "../storage/index.js";
import { parseCommandId } from "./ids.js";

export interface MoveTaskOptions {
  from: string;
  to?: string;
  toTag?: string;
  fromTag?: string;
  beforeId?: string;
  afterId?: string;
}

export async function moveTask(
  repository: TaskRepository,
  options: MoveTaskOptions,
): Promise<Task> {
  if (options.from.includes(".") && options.toTag) {
    throw new Error("Subtasks cannot be moved directly between tags.");
  }

  if (options.fromTag && options.toTag && options.fromTag === options.toTag) {
    throw new Error("Source and target tags must differ for cross-tag moves.");
  }

  if (options.to?.includes(".")) {
    throw new Error("Task-to-subtask moves are not implemented in the baseline move command.");
  }

  if (options.toTag) {
    await repository.createTag(options.toTag);
  }

  return repository.move(
    parseCommandId(options.from),
    {
      tag: options.toTag,
      beforeId: options.beforeId
        ? parseCommandId(options.beforeId)
        : options.to
          ? parseCommandId(options.to)
          : undefined,
      afterId: options.afterId ? parseCommandId(options.afterId) : undefined,
    },
    {
      tag: options.fromTag,
    },
  );
}

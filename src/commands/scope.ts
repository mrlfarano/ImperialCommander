import { FileTaskRepository } from "../storage/index.js";
import { type ScopeDirection, type ScopeStrength, scopeTasks } from "../tasks/scope.js";
import type { TaskCommandOptions } from "./tasks.js";

export async function scopeCommand(
  direction: ScopeDirection,
  options: TaskCommandOptions & {
    id?: string;
    strength?: ScopeStrength;
    prompt?: string;
  } = {},
): Promise<string> {
  if (!options.id) {
    throw new Error("Provide --id with one or more task ids.");
  }

  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const tasks = await scopeTasks(repository, options.id, direction, {
    strength: options.strength,
    prompt: options.prompt,
    tag: options.tag,
  });
  return `${direction === "up" ? "Scoped up" : "Scoped down"} ${tasks.length} tasks.`;
}

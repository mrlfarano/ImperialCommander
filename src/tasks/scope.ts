import type { Task } from "../schemas/index.js";
import type { TaskRepository } from "../storage/index.js";
import { parseCsvIds } from "./ids.js";

export type ScopeDirection = "up" | "down";
export type ScopeStrength = "light" | "regular" | "heavy";

export async function scopeTasks(
  repository: TaskRepository,
  ids: string,
  direction: ScopeDirection,
  options: { strength?: ScopeStrength; prompt?: string; tag?: string } = {},
): Promise<Task[]> {
  const parsedIds = parseCsvIds(ids);

  if (parsedIds.length === 0) {
    throw new Error("At least one id is required for scope changes.");
  }

  const updated: Task[] = [];
  for (const id of parsedIds) {
    const task = await repository.findById(id, { tag: options.tag });
    if (!task) {
      throw new Error(`Task "${String(id)}" was not found.`);
    }

    const details = buildScopedDetails(
      task.details,
      direction,
      options.strength ?? "regular",
      options.prompt,
    );
    updated.push(await repository.update(task.id, { details }, { tag: options.tag }));
  }

  return updated;
}

export function buildScopedDetails(
  details: string,
  direction: ScopeDirection,
  strength: ScopeStrength,
  prompt?: string,
): string {
  const action = direction === "up" ? "Increase scope" : "Decrease scope";
  const note = `${action} (${strength})${prompt ? `: ${prompt}` : ""}`;
  return details ? `${details}\n\n${note}` : note;
}

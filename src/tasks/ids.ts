import type { Task } from "../schemas/index.js";

export function parseCommandId(id: string): string | number {
  const numeric = Number(id);
  return Number.isInteger(numeric) && numeric > 0 && String(numeric) === id ? numeric : id;
}

export function parseCsvIds(value: string | undefined): Array<Task["id"]> {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(parseCommandId);
}

export function nextTaskId(tasks: Task[]): number {
  const numericIds = tasks
    .map((task) => task.id)
    .filter((id): id is number => typeof id === "number");

  return numericIds.length === 0 ? 1 : Math.max(...numericIds) + 1;
}

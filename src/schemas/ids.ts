import { z } from "zod";

export const NumericIdSchema = z.number().int().positive();
export const StringIdSchema = z.string().min(1);
export const TaskEntityIdSchema = z.union([NumericIdSchema, StringIdSchema]);

export type TaskEntityId = z.infer<typeof TaskEntityIdSchema>;

export interface ParsedTaskId {
  taskId: number;
  subtaskId?: number;
}

const taskIdPattern = /^[1-9]\d*$/;
const subtaskIdPattern = /^[1-9]\d*\.[1-9]\d*$/;

export function parseTaskId(id: string): ParsedTaskId {
  if (taskIdPattern.test(id)) {
    return { taskId: Number(id) };
  }

  if (subtaskIdPattern.test(id)) {
    const [taskId, subtaskId] = id.split(".").map(Number);

    return { taskId, subtaskId };
  }

  throw new Error(`Invalid task id: ${id}`);
}

export function formatTaskId(taskId: number): string {
  NumericIdSchema.parse(taskId);

  return String(taskId);
}

export function formatSubtaskId(taskId: number, subtaskId: number): string {
  NumericIdSchema.parse(taskId);
  NumericIdSchema.parse(subtaskId);

  return `${taskId}.${subtaskId}`;
}

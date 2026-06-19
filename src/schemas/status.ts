import { z } from "zod";

export const TASK_STATUSES = [
  "pending",
  "done",
  "in-progress",
  "review",
  "deferred",
  "cancelled",
] as const;

export const TaskStatusSchema = z.enum(TASK_STATUSES);

export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export function isValidStatus(status: unknown): status is TaskStatus {
  return TaskStatusSchema.safeParse(status).success;
}

export function isDependencySatisfiedStatus(status: unknown): boolean {
  return status === "done" || status === "completed";
}

import { z } from "zod";
import { TaskEntityIdSchema } from "./ids.js";
import { TaskStatusSchema } from "./status.js";

export const TaskPrioritySchema = z.enum(["high", "medium", "low"]);

export const SubtaskSchema = z.object({
  id: TaskEntityIdSchema,
  title: z.string().min(1),
  description: z.string(),
  details: z.string(),
  status: TaskStatusSchema,
  dependencies: z.array(TaskEntityIdSchema).default([]),
  metadata: z.record(z.unknown()).optional(),
});

export const TaskSchema = z.object({
  id: TaskEntityIdSchema,
  title: z.string().min(1),
  description: z.string(),
  details: z.string(),
  testStrategy: z.string(),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema,
  dependencies: z.array(TaskEntityIdSchema).default([]),
  subtasks: z.array(SubtaskSchema).default([]),
  metadata: z.record(z.unknown()).optional(),
});

export type TaskPriority = z.infer<typeof TaskPrioritySchema>;
export type Subtask = z.infer<typeof SubtaskSchema>;
export type Task = z.infer<typeof TaskSchema>;

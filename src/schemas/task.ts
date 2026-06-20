import { z } from "zod";
import { TaskEntityIdSchema } from "./ids.js";
import { TaskStatusSchema } from "./status.js";

export const TaskPrioritySchema = z.enum(["high", "medium", "low"]);

export const ComplexityLevelSchema = z.enum(["low", "medium", "high"]);

export const TaskComplexitySchema = z.object({
  score: z.number().int().min(1).max(10),
  level: ComplexityLevelSchema,
  recommendedSubtasks: z.number().int().min(0).max(12),
  reasoning: z.string(),
});

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
  complexity: TaskComplexitySchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type TaskPriority = z.infer<typeof TaskPrioritySchema>;
export type ComplexityLevel = z.infer<typeof ComplexityLevelSchema>;
export type TaskComplexity = z.infer<typeof TaskComplexitySchema>;
export type Subtask = z.infer<typeof SubtaskSchema>;
export type Task = z.infer<typeof TaskSchema>;

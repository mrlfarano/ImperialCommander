import type { AiTelemetryRecord } from "../ai/ai-service.js";
import type { Task } from "../schemas/index.js";
import type { TaskRepository } from "../storage/index.js";
import { nextTaskId, parseCsvIds } from "./ids.js";

export interface AddTaskOptions {
  title?: string;
  description?: string;
  details?: string;
  testStrategy?: string;
  dependencies?: string;
  priority?: Task["priority"];
  prompt?: string;
  research?: boolean;
  tag?: string;
  aiGenerator?: AddTaskGenerator;
}

export interface AddTaskResult {
  task: Task;
  telemetryData?: AiTelemetryRecord;
}

export type AddTaskGenerator = (input: {
  prompt: string;
  research: boolean;
  nextId: number;
}) => Promise<{
  task: Omit<Task, "id" | "status" | "subtasks">;
  telemetryData?: AiTelemetryRecord;
}>;

export async function addTask(
  repository: TaskRepository,
  options: AddTaskOptions,
): Promise<AddTaskResult> {
  const existing = await repository.findAll({ tag: options.tag });
  const id = nextTaskId(existing);

  if (options.prompt) {
    if (!options.aiGenerator) {
      throw new Error("AI task generation is not configured. Provide title and description.");
    }

    const generated = await options.aiGenerator({
      prompt: options.prompt,
      research: options.research === true,
      nextId: id,
    });
    const task = normalizeTask(id, generated.task);
    await repository.create(task, { tag: options.tag });
    return { task, telemetryData: generated.telemetryData };
  }

  if (!options.title || !options.description) {
    throw new Error("Provide both title and description, or provide a prompt for AI generation.");
  }

  const task: Task = {
    id,
    title: options.title,
    description: options.description,
    details: options.details ?? "",
    testStrategy: options.testStrategy ?? "",
    status: "pending",
    priority: options.priority ?? "medium",
    dependencies: parseCsvIds(options.dependencies),
    subtasks: [],
  };

  await repository.create(task, { tag: options.tag });
  return { task };
}

function normalizeTask(id: number, generated: Omit<Task, "id" | "status" | "subtasks">): Task {
  return {
    ...generated,
    id,
    status: "pending",
    priority: generated.priority ?? "medium",
    dependencies: generated.dependencies ?? [],
    subtasks: [],
  };
}

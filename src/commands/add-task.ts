import type { TaskAssessor } from "../analysis/assess.js";
import { FileTaskRepository } from "../storage/index.js";
import { type AddTaskGenerator, addTask } from "../tasks/add-task.js";
import type { TaskCommandOptions } from "./tasks.js";

export interface AddTaskCommandOptions extends TaskCommandOptions {
  title?: string;
  description?: string;
  details?: string;
  testStrategy?: string;
  dependencies?: string;
  priority?: "high" | "medium" | "low";
  prompt?: string;
  research?: boolean;
  aiGenerator?: AddTaskGenerator;
  assessor?: TaskAssessor;
}

export async function addTaskCommand(options: AddTaskCommandOptions = {}): Promise<string> {
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const result = await addTask(repository, options);
  return `Created task ${String(result.task.id)}: ${result.task.title}`;
}

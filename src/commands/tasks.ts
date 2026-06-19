import type { TaskStatus } from "../schemas/index.js";
import { FileTaskRepository } from "../storage/index.js";
import { findNextTask, listTasks, setTaskStatus, showTask } from "../tasks/lifecycle.js";

export interface TaskCommandOptions {
  file?: string;
  tag?: string;
}

export async function listTasksCommand(options: TaskCommandOptions = {}): Promise<string> {
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const tasks = await listTasks(repository, { tag: options.tag });

  if (tasks.length === 0) {
    return "No tasks found.";
  }

  return tasks
    .map(
      (task) =>
        `${String(task.id)} [${task.status}] (${task.priority}) ${task.title} deps:${task.dependencyCount} subtasks:${task.subtaskCount}`,
    )
    .join("\n");
}

export async function showTaskCommand(
  id: string,
  options: TaskCommandOptions = {},
): Promise<string> {
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const task = await showTask(repository, parseCommandId(id), { tag: options.tag });

  if (!task) {
    return `Task ${id} not found.`;
  }

  return [
    `${String(task.id)}: ${task.title}`,
    `Status: ${task.status}`,
    `Priority: ${task.priority}`,
    `Dependencies: ${task.dependencies.map(String).join(", ") || "none"}`,
    "",
    task.description,
    task.details,
  ].join("\n");
}

export async function setStatusCommand(
  id: string,
  status: TaskStatus,
  options: TaskCommandOptions = {},
): Promise<string> {
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const task = await setTaskStatus(repository, parseCommandId(id), status, { tag: options.tag });
  return `Task ${String(task.id)} status set to ${task.status}.`;
}

export async function nextTaskCommand(options: TaskCommandOptions = {}): Promise<string> {
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const result = await findNextTask(repository, { tag: options.tag });

  if (!result) {
    return "No actionable task found.";
  }

  return `${String(result.task.id)}: ${result.task.title}\n${result.reason}`;
}

function parseCommandId(id: string): string | number {
  const numeric = Number(id);
  return Number.isInteger(numeric) && numeric > 0 && String(numeric) === id ? numeric : id;
}

import type { Task, TaskStatus } from "../schemas/index.js";
import { TaskStatusSchema, isDependencySatisfiedStatus } from "../schemas/index.js";
import type { TaskRepository } from "../storage/index.js";

export interface TaskListItem {
  id: Task["id"];
  title: string;
  status: TaskStatus;
  priority: Task["priority"];
  dependencyCount: number;
  subtaskCount: number;
}

export interface NextTaskResult {
  task: Task;
  reason: string;
}

const priorityWeight: Record<Task["priority"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export async function listTasks(
  repository: TaskRepository,
  options: { tag?: string; status?: TaskStatus } = {},
): Promise<TaskListItem[]> {
  const tasks = await repository.findAll({ tag: options.tag });

  return tasks
    .filter((task) => !options.status || task.status === options.status)
    .map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dependencyCount: task.dependencies.length,
      subtaskCount: task.subtasks.length,
    }));
}

export async function showTask(
  repository: TaskRepository,
  id: Task["id"],
  options: { tag?: string } = {},
): Promise<Task | undefined> {
  return repository.findById(id, { tag: options.tag });
}

export async function setTaskStatus(
  repository: TaskRepository,
  id: Task["id"],
  status: TaskStatus,
  options: { tag?: string } = {},
): Promise<Task> {
  TaskStatusSchema.parse(status);
  return repository.update(id, { status }, { tag: options.tag });
}

export async function findNextTask(
  repository: TaskRepository,
  options: { tag?: string } = {},
): Promise<NextTaskResult | undefined> {
  const tasks = await repository.findAll({ tag: options.tag });
  const completed = new Map(
    tasks.map((task) => [String(task.id), isDependencySatisfiedStatus(task.status)]),
  );
  const candidates = tasks.filter((task) => {
    if (task.status !== "pending" && task.status !== "in-progress") {
      return false;
    }

    return task.dependencies.every((dependency) => completed.get(String(dependency)) === true);
  });

  const [task] = candidates.sort(compareNextTask);

  if (!task) {
    return undefined;
  }

  return {
    task,
    reason: `Selected ${task.priority} priority task with all dependencies satisfied.`,
  };
}

function compareNextTask(left: Task, right: Task): number {
  const priorityDelta = priorityWeight[right.priority] - priorityWeight[left.priority];

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const statusDelta = statusWeight(right.status) - statusWeight(left.status);

  if (statusDelta !== 0) {
    return statusDelta;
  }

  return Number(left.id) - Number(right.id);
}

function statusWeight(status: TaskStatus): number {
  return status === "in-progress" ? 1 : 0;
}

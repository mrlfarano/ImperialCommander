import type { Task } from "../schemas/index.js";
import type { TaskRepository } from "../storage/index.js";

export interface DependencyValidationIssue {
  taskId: Task["id"];
  dependencyId: Task["id"];
  type: "unknown" | "self";
}

export async function addDependency(
  repository: TaskRepository,
  taskId: Task["id"],
  dependencyId: Task["id"],
  options: { tag?: string } = {},
): Promise<Task> {
  if (sameId(taskId, dependencyId)) {
    throw new Error("A task cannot depend on itself.");
  }

  const task = await requireTask(repository, taskId, options.tag);
  await requireTask(repository, dependencyId, options.tag);

  if (task.dependencies.some((dependency) => sameId(dependency, dependencyId))) {
    return task;
  }

  return repository.update(
    taskId,
    { dependencies: [...task.dependencies, dependencyId] },
    { tag: options.tag },
  );
}

export async function removeDependency(
  repository: TaskRepository,
  taskId: Task["id"],
  dependencyId: Task["id"],
  options: { tag?: string } = {},
): Promise<Task> {
  const task = await requireTask(repository, taskId, options.tag);

  return repository.update(
    taskId,
    { dependencies: task.dependencies.filter((dependency) => !sameId(dependency, dependencyId)) },
    { tag: options.tag },
  );
}

export async function validateDependencies(
  repository: TaskRepository,
  options: { tag?: string } = {},
): Promise<DependencyValidationIssue[]> {
  const tasks = await repository.findAll({ tag: options.tag });
  const ids = new Set(tasks.map((task) => String(task.id)));
  const issues: DependencyValidationIssue[] = [];

  for (const task of tasks) {
    for (const dependency of task.dependencies) {
      if (sameId(task.id, dependency)) {
        issues.push({ taskId: task.id, dependencyId: dependency, type: "self" });
      } else if (!ids.has(String(dependency))) {
        issues.push({ taskId: task.id, dependencyId: dependency, type: "unknown" });
      }
    }
  }

  return issues;
}

export async function fixDependencies(
  repository: TaskRepository,
  options: { tag?: string } = {},
): Promise<DependencyValidationIssue[]> {
  const issues = await validateDependencies(repository, options);
  const removalsByTask = new Map<string, Set<string>>();

  for (const issue of issues) {
    const taskKey = String(issue.taskId);
    const removals = removalsByTask.get(taskKey) ?? new Set<string>();
    removals.add(String(issue.dependencyId));
    removalsByTask.set(taskKey, removals);
  }

  for (const [taskKey, removals] of removalsByTask) {
    const task = await requireTask(repository, taskKey, options.tag);
    await repository.update(
      task.id,
      {
        dependencies: task.dependencies.filter((dependency) => !removals.has(String(dependency))),
      },
      { tag: options.tag },
    );
  }

  return issues;
}

async function requireTask(
  repository: TaskRepository,
  id: Task["id"],
  tag: string | undefined,
): Promise<Task> {
  const task = await repository.findById(id, { tag });

  if (!task) {
    throw new Error(`Task "${String(id)}" was not found.`);
  }

  return task;
}

function sameId(left: Task["id"], right: Task["id"]): boolean {
  return String(left) === String(right);
}

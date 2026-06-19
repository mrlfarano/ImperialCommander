import { FileTaskRepository } from "../storage/index.js";
import {
  addDependency,
  fixDependencies,
  removeDependency,
  validateDependencies,
} from "../tasks/dependencies.js";
import type { TaskCommandOptions } from "./tasks.js";

export async function addDependencyCommand(
  taskId: string,
  dependencyId: string,
  options: TaskCommandOptions = {},
): Promise<string> {
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const task = await addDependency(
    repository,
    parseCommandId(taskId),
    parseCommandId(dependencyId),
    {
      tag: options.tag,
    },
  );
  return `Task ${String(task.id)} now depends on ${dependencyId}.`;
}

export async function removeDependencyCommand(
  taskId: string,
  dependencyId: string,
  options: TaskCommandOptions = {},
): Promise<string> {
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const task = await removeDependency(
    repository,
    parseCommandId(taskId),
    parseCommandId(dependencyId),
    {
      tag: options.tag,
    },
  );
  return `Task ${String(task.id)} no longer depends on ${dependencyId}.`;
}

export async function validateDependenciesCommand(
  options: TaskCommandOptions = {},
): Promise<string> {
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const issues = await validateDependencies(repository, { tag: options.tag });

  if (issues.length === 0) {
    return "Dependencies are valid.";
  }

  return issues
    .map(
      (issue) =>
        `${String(issue.taskId)} has ${issue.type} dependency ${String(issue.dependencyId)}`,
    )
    .join("\n");
}

export async function fixDependenciesCommand(options: TaskCommandOptions = {}): Promise<string> {
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const issues = await fixDependencies(repository, { tag: options.tag });
  return `Removed ${issues.length} invalid dependencies.`;
}

function parseCommandId(id: string): string | number {
  const numeric = Number(id);
  return Number.isInteger(numeric) && numeric > 0 && String(numeric) === id ? numeric : id;
}

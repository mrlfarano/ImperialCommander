import { readComplexityReport } from "../complexity/report.js";
import type { Subtask, Task } from "../schemas/index.js";
import type { TaskRepository } from "../storage/index.js";

export interface ExpandOptions {
  id: Task["id"];
  num?: number;
  prompt?: string;
  force?: boolean;
  complexityReport?: string;
  defaultSubtasks?: number;
  tag?: string;
}

export interface ExpandAllOptions extends Omit<ExpandOptions, "id"> {
  all?: boolean;
}

export interface ExpandResult {
  task: Task;
  created: number;
  skipped: boolean;
}

export async function expandTask(
  repository: TaskRepository,
  options: ExpandOptions,
): Promise<ExpandResult> {
  const task = await repository.findById(options.id, { tag: options.tag });

  if (!task) {
    throw new Error(`Task "${String(options.id)}" was not found.`);
  }

  if (task.subtasks.length > 0 && !options.force) {
    return { task, created: 0, skipped: true };
  }

  const report = await readComplexityReport({ output: options.complexityReport, tag: options.tag });
  const analysis = report?.complexityAnalysis.find(
    (item) => String(item.taskId) === String(task.id),
  );
  const count = resolveSubtaskCount({
    explicitNum: options.num,
    reportRecommended: analysis?.recommendedSubtasks,
    defaultSubtasks: options.defaultSubtasks,
  });
  const prompt = promptText(options.prompt ?? analysis?.expansionPrompt ?? `Expand ${task.title}`);
  const subtasks = Array.from({ length: count }, (_, index) =>
    createSubtask(index + 1, task, prompt, analysis?.reasoning),
  );
  const updated = await repository.update(
    task.id,
    { subtasks: options.force ? subtasks : [...task.subtasks, ...subtasks] },
    { tag: options.tag },
  );

  return { task: updated, created: subtasks.length, skipped: false };
}

export async function expandAllTasks(
  repository: TaskRepository,
  options: ExpandAllOptions = {},
): Promise<ExpandResult[]> {
  const tasks = (await repository.findAll({ tag: options.tag })).filter(
    (task) => task.status === "pending",
  );
  const results: ExpandResult[] = [];

  for (const task of tasks) {
    results.push(await expandTask(repository, { ...options, id: task.id }));
  }

  return results;
}

export function resolveSubtaskCount(input: {
  explicitNum?: number;
  reportRecommended?: number;
  defaultSubtasks?: number;
}): number {
  if (input.explicitNum !== undefined) {
    return input.explicitNum === 0 ? 3 : Math.max(0, input.explicitNum);
  }

  if (input.reportRecommended !== undefined) {
    return input.reportRecommended;
  }

  if (!input.defaultSubtasks || input.defaultSubtasks < 1) {
    return 3;
  }

  return input.defaultSubtasks;
}

function createSubtask(
  id: number,
  task: Task,
  prompt: string,
  reasoning: string | undefined,
): Subtask {
  return {
    id,
    title: `${task.title} - step ${id}`,
    description: prompt,
    details: reasoning ? `${prompt}\n\nContext: ${reasoning}` : prompt,
    status: "pending",
    dependencies: id === 1 ? [] : [id - 1],
  };
}

function promptText(prompt: string | { text: string }): string {
  return typeof prompt === "string" ? prompt : prompt.text;
}

import { type TaskAssessor, assessTask } from "../analysis/assess.js";
import type { ComplexityLevel, Task } from "../schemas/index.js";
import type { TaskRepository } from "../storage/index.js";
import { parseCsvIds } from "../tasks/ids.js";

export interface AnalyzeComplexityOptions {
  ids?: string;
  from?: number;
  to?: number;
  threshold?: number;
  tag?: string;
  assessor?: TaskAssessor;
}

export interface AnalyzeComplexityResult {
  assessed: number;
  summary: string;
  tasks: Task[];
}

const activeStatuses = new Set(["pending", "in-progress", "review"]);

export async function analyzeComplexity(
  repository: TaskRepository,
  options: AnalyzeComplexityOptions = {},
): Promise<AnalyzeComplexityResult> {
  const allTasks = await repository.findAll({ tag: options.tag });
  const targets = filterTasks(allTasks, options);
  const updated: Task[] = [];

  for (const target of targets) {
    const assessment = await assessTask(options.assessor, {
      title: target.title,
      description: target.description,
      details: target.details,
      dependencies: target.dependencies,
    });
    updated.push(
      await repository.update(
        target.id,
        { complexity: assessment.complexity },
        { tag: options.tag },
      ),
    );
  }

  return {
    assessed: updated.length,
    summary: summarize(updated, normalizeThreshold(options.threshold)),
    tasks: updated,
  };
}

function filterTasks(tasks: Task[], options: AnalyzeComplexityOptions): Task[] {
  const ids = new Set(parseCsvIds(options.ids).map(String));

  return tasks.filter((task) => {
    if (!activeStatuses.has(task.status)) {
      return false;
    }
    if (ids.size > 0 && !ids.has(String(task.id))) {
      return false;
    }
    if (typeof task.id === "number") {
      if (options.from !== undefined && task.id < options.from) {
        return false;
      }
      if (options.to !== undefined && task.id > options.to) {
        return false;
      }
    }
    return true;
  });
}

function summarize(tasks: Task[], threshold: number): string {
  if (tasks.length === 0) {
    return "No matching active tasks found.";
  }

  const counts: Record<ComplexityLevel, number> = { low: 0, medium: 0, high: 0 };
  let scoreSum = 0;
  let needsExpansion = 0;

  for (const task of tasks) {
    if (!task.complexity) {
      continue;
    }
    counts[task.complexity.level] += 1;
    scoreSum += task.complexity.score;
    if (task.complexity.score >= threshold) {
      needsExpansion += 1;
    }
  }

  const avg = (scoreSum / tasks.length).toFixed(1);

  return [
    `Assessed ${tasks.length} tasks (avg complexity ${avg}).`,
    `By level: high ${counts.high} · medium ${counts.medium} · low ${counts.low}.`,
    `${needsExpansion} task(s) at or above threshold ${threshold} — consider \`impcom expand\`.`,
  ].join("\n");
}

function normalizeThreshold(threshold: number | undefined): number {
  if (!threshold || !Number.isInteger(threshold) || threshold < 1 || threshold > 10) {
    return 5;
  }
  return threshold;
}

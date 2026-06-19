import type { Task } from "../schemas/index.js";
import type { TaskRepository } from "../storage/index.js";
import { parseCsvIds } from "../tasks/ids.js";
import {
  type ComplexityAnalysis,
  type ComplexityReport,
  readComplexityReport,
  writeComplexityReport,
} from "./report.js";

export interface AnalyzeComplexityOptions {
  ids?: string;
  from?: number;
  to?: number;
  threshold?: number;
  output?: string;
  research?: boolean;
  tag?: string;
  projectName?: string;
  now?: Date;
  projectRoot?: string;
}

export interface AnalyzeComplexityResult {
  report: ComplexityReport;
  path: string;
  warning?: string;
}

const activeStatuses = new Set(["pending", "in-progress", "review"]);

export async function analyzeComplexity(
  repository: TaskRepository,
  options: AnalyzeComplexityOptions = {},
): Promise<AnalyzeComplexityResult> {
  const tag = options.tag ?? "master";
  const allTasks = await repository.findAll({ tag: options.tag });
  const filteredTasks = filterTasks(allTasks, options);
  const existing = await readComplexityReport({
    output: options.output,
    tag,
    projectRoot: options.projectRoot,
  });

  if (filteredTasks.length === 0) {
    const report = existing ?? createReport([], allTasks.length, options);
    const path = await writeComplexityReport(report, {
      output: options.output,
      tag,
      projectRoot: options.projectRoot,
    });
    return { report, path, warning: "No matching active tasks found." };
  }

  const generated = filteredTasks.map(createAnalysis);
  const generatedById = new Map(generated.map((item) => [String(item.taskId), item]));
  const currentTaskIds = new Set(allTasks.map((task) => String(task.id)));
  const retained =
    existing?.complexityAnalysis.filter(
      (item) => currentTaskIds.has(String(item.taskId)) && !generatedById.has(String(item.taskId)),
    ) ?? [];
  const defaulted = allTasks
    .filter((task) => activeStatuses.has(task.status))
    .filter((task) => !generatedById.has(String(task.id)))
    .filter((task) => !retained.some((item) => String(item.taskId) === String(task.id)))
    .map(createDefaultAnalysis);
  const report = createReport([...retained, ...generated, ...defaulted], allTasks.length, options);
  const path = await writeComplexityReport(report, {
    output: options.output,
    tag,
    projectRoot: options.projectRoot,
  });

  return { report, path };
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

function createReport(
  analysis: ComplexityAnalysis[],
  totalTasks: number,
  options: AnalyzeComplexityOptions,
): ComplexityReport {
  return {
    meta: {
      generatedAt: (options.now ?? new Date()).toISOString(),
      tasksAnalyzed: analysis.length,
      totalTasks,
      analysisCount: analysis.length,
      thresholdScore: normalizeThreshold(options.threshold),
      projectName: options.projectName ?? "Imperial Commander Project",
      usedResearch: options.research === true,
      tag: options.tag ?? "master",
    },
    complexityAnalysis: analysis.sort((left, right) =>
      String(left.taskId).localeCompare(String(right.taskId)),
    ),
  };
}

function createAnalysis(task: Task): ComplexityAnalysis {
  const text = `${task.title} ${task.description} ${task.details}`;
  const score = Math.min(10, Math.max(1, Math.ceil(text.length / 80) + task.dependencies.length));

  return {
    taskId: task.id,
    taskTitle: task.title,
    complexityScore: score,
    recommendedSubtasks: Math.max(1, Math.min(8, Math.ceil(score / 2))),
    expansionPrompt: `Break "${task.title}" into implementation subtasks.`,
    reasoning: `Estimated from task text length and ${task.dependencies.length} dependencies.`,
  };
}

function createDefaultAnalysis(task: Task): ComplexityAnalysis {
  return {
    taskId: task.id,
    taskTitle: task.title,
    complexityScore: 5,
    recommendedSubtasks: 3,
    expansionPrompt: `Break "${task.title}" into implementation subtasks.`,
    reasoning: "Default analysis inserted because the task was not re-analyzed.",
  };
}

function normalizeThreshold(threshold: number | undefined): number {
  if (!threshold || !Number.isInteger(threshold) || threshold < 1 || threshold > 10) {
    return 5;
  }
  return threshold;
}

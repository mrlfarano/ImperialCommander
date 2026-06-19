import type { Task } from "../schemas/index.js";

export const autopilotPhases = ["select", "red", "green", "refactor", "verify", "commit"] as const;

export type AutopilotPhase = (typeof autopilotPhases)[number];

export interface AutopilotPlan {
  taskId: string;
  title: string;
  phases: AutopilotPhase[];
  steps: string[];
  commitMessage: string;
}

export function createAutopilotPlan(task: Task, prompt?: string): AutopilotPlan {
  const scope = prompt?.trim() || task.title;
  return {
    taskId: String(task.id),
    title: task.title,
    phases: [...autopilotPhases],
    steps: [
      `Select task ${String(task.id)}: ${task.title}`,
      `Write or update failing tests for ${scope}`,
      "Implement the smallest offline change that satisfies the tests",
      "Refactor while keeping tests green",
      "Run relevant verification commands",
      "Prepare a conventional commit message",
    ],
    commitMessage: createConventionalCommit(task),
  };
}

export function createConventionalCommit(task: Task): string {
  const slug = task.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 64);
  return `feat(tasks): ${slug || `complete task ${String(task.id)}`}`;
}

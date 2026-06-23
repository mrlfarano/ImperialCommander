import { z } from "zod";
import type { TaskEntityId } from "../schemas/index.js";
import {
  type ComplexityLevel,
  type TaskComplexity,
  type TaskPriority,
  TaskPrioritySchema,
} from "../schemas/index.js";

export interface TaskAssessmentInput {
  title: string;
  description: string;
  details: string;
  dependencies: TaskEntityId[];
}

export const rawAssessmentSchema = z
  .object({
    priority: TaskPrioritySchema,
    complexityScore: z.number().int().min(1).max(10),
    recommendedSubtasks: z.number().int().min(0).max(12),
    reasoning: z.string(),
  })
  .strict();

export type RawAssessment = z.infer<typeof rawAssessmentSchema>;

/** Injected boundary: returns the model's raw scores; pure code derives `level`. */
export type TaskAssessor = (input: TaskAssessmentInput) => Promise<RawAssessment>;

export interface TaskAssessment {
  priority: TaskPriority;
  complexity: TaskComplexity;
}

export class AssessmentRequiredError extends Error {
  constructor() {
    super(
      "Task creation requires an AI provider to assess priority and complexity. " +
        "Configure one with `impcom models`, or run inside the MCP host.",
    );
    this.name = "AssessmentRequiredError";
  }
}

export function complexityLevelForScore(score: number): ComplexityLevel {
  if (score < 5) {
    return "low";
  }
  if (score < 8) {
    return "medium";
  }
  return "high";
}

export function toAssessment(raw: RawAssessment): TaskAssessment {
  return {
    priority: raw.priority,
    complexity: {
      score: raw.complexityScore,
      level: complexityLevelForScore(raw.complexityScore),
      recommendedSubtasks: raw.recommendedSubtasks,
      reasoning: raw.reasoning,
    },
  };
}

export const DEFAULT_ASSESSMENT: TaskAssessment = {
  priority: "medium",
  complexity: {
    score: 5,
    level: "medium",
    recommendedSubtasks: 0,
    reasoning: "Default assessment — no AI provider configured.",
  },
};

export async function assessTask(
  assessor: TaskAssessor | undefined,
  input: TaskAssessmentInput,
  opts?: { requireAi?: boolean },
): Promise<TaskAssessment> {
  if (!assessor) {
    if (opts?.requireAi) {
      throw new AssessmentRequiredError();
    }
    console.warn(
      "[impcom] No AI provider configured — using default priority/complexity. " +
        "Configure with `impcom models` or use --no-ai flag to suppress this warning.",
    );
    return DEFAULT_ASSESSMENT;
  }
  return toAssessment(await assessor(input));
}

export async function assessMany(
  assessor: TaskAssessor | undefined,
  inputs: TaskAssessmentInput[],
): Promise<TaskAssessment[]> {
  const assessments: TaskAssessment[] = [];
  for (const input of inputs) {
    assessments.push(await assessTask(assessor, input));
  }
  return assessments;
}

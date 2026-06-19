import { z } from "zod";
import type { SpecReadiness } from "../prd/check-spec.js";
import { specReadinessSchema } from "../prd/check-spec.js";
import type { PrdAnswer, PrdInterviewState } from "../prd/interview-state-machine.js";
import { prdAnswerSchema } from "../prd/interview-state-machine.js";
import type { ResearchContextItem, ResearchGenerator } from "../research/research.js";
import type { Task } from "../schemas/index.js";
import { TaskPrioritySchema } from "../schemas/index.js";
import type { AddTaskGenerator } from "../tasks/add-task.js";
import { HostSessionSamplingProvider, type SamplingClient } from "./providers/sampling.js";

export interface HostSamplingContext {
  samplingClient?: SamplingClient;
}

const generatedTaskSchema = z
  .object({
    title: z.string().min(1),
    description: z.string(),
    details: z.string().default(""),
    testStrategy: z.string().default(""),
    priority: TaskPrioritySchema.default("medium"),
    dependencies: z.array(z.union([z.string(), z.number()])).default([]),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict();

const prdAnswersSchema = z.array(prdAnswerSchema).min(1);

export function createHostAddTaskGenerator(
  context: HostSamplingContext,
): AddTaskGenerator | undefined {
  const provider = providerFor(context);
  if (!provider) {
    return undefined;
  }

  return async (input) => {
    const task = await provider.generateObject(
      [
        "Create one implementation task as JSON.",
        `Next task id: ${input.nextId}`,
        `Research mode: ${input.research ? "yes" : "no"}`,
        "Required fields: title, description, details, testStrategy, priority, dependencies.",
        "Allowed priority values: high, medium, low.",
        "",
        input.prompt,
      ].join("\n"),
      generatedTaskSchema,
    );

    return {
      task: task as Omit<Task, "id" | "status" | "subtasks">,
      telemetryData: telemetry("host-session", input.prompt),
    };
  };
}

export function createHostResearchGenerator(
  context: HostSamplingContext,
): ResearchGenerator | undefined {
  const provider = providerFor(context);
  if (!provider) {
    return undefined;
  }

  return async (input) => {
    const text = await provider.generateText(
      [
        `Research detail level: ${input.detail}`,
        `Query: ${input.query}`,
        "",
        "Context:",
        formatResearchContext(input.context),
      ].join("\n"),
    );

    return { text, telemetryData: telemetry("host-session", input.query) };
  };
}

export function createHostPrdQuestionGenerator(context: HostSamplingContext) {
  const provider = providerFor(context);
  if (!provider) {
    return undefined;
  }

  return async (state: PrdInterviewState): Promise<PrdAnswer[]> =>
    provider.generateObject(
      [
        "Return JSON array of PRD interview answers for the next useful topics.",
        "Each item must have topic and answer.",
        "Allowed topics: problem, users, goals, features, constraints, metrics.",
        "",
        `Idea: ${state.idea}`,
        `Title: ${state.title}`,
        `Existing answers: ${JSON.stringify(state.answers)}`,
      ].join("\n"),
      prdAnswersSchema,
    );
}

export function createHostSpecScorer(context: HostSamplingContext) {
  const provider = providerFor(context);
  if (!provider) {
    return undefined;
  }

  return async (contents: string): Promise<SpecReadiness> =>
    provider.generateObject(
      [
        "Score this product specification as JSON.",
        "Return scores for clarity, completeness, scopedness, testability, and structure from 1 to 10.",
        "Return overall from 1 to 10, verdict pass/warn/block, and concrete gaps.",
        "",
        contents,
      ].join("\n"),
      specReadinessSchema,
    );
}

function providerFor(context: HostSamplingContext): HostSessionSamplingProvider | undefined {
  return context.samplingClient?.supportsSampling
    ? new HostSessionSamplingProvider(context.samplingClient)
    : undefined;
}

function formatResearchContext(context: ResearchContextItem[]): string {
  return context.length === 0
    ? "No extra context."
    : context.map((item) => `## ${item.source}\n${item.content}`).join("\n\n");
}

function telemetry(commandName: string, prompt: string) {
  return {
    timestamp: new Date().toISOString(),
    commandName,
    modelUsed: "host-session",
    providerName: "host-session",
    inputTokens: prompt.length,
    outputTokens: 0,
    totalTokens: prompt.length,
    totalCost: 0,
    currency: "USD" as const,
  };
}

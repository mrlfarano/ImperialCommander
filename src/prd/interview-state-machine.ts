import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { resolveProjectConfigDir } from "../config/paths.js";

export const prdTopicSchema = z.enum([
  "problem",
  "users",
  "goals",
  "features",
  "constraints",
  "metrics",
]);

export const prdAnswerSchema = z
  .object({
    topic: prdTopicSchema,
    answer: z.string(),
  })
  .strict();

export const prdInterviewStateSchema = z
  .object({
    idea: z.string(),
    template: z.enum(["simple", "complex"]),
    title: z.string(),
    rounds: z.number().int().min(0),
    answers: z.array(prdAnswerSchema),
    complete: z.boolean(),
  })
  .strict();

export type PrdTopic = z.infer<typeof prdTopicSchema>;
export type PrdAnswer = z.infer<typeof prdAnswerSchema>;
export type PrdInterviewState = z.infer<typeof prdInterviewStateSchema>;

export interface PrdStateOptions {
  projectRoot?: string;
  configDir?: string;
}

export const prdTopicOrder: PrdTopic[] = [
  "problem",
  "users",
  "goals",
  "features",
  "constraints",
  "metrics",
];

export function createPrdInterviewState(options: {
  idea: string;
  template?: "simple" | "complex";
  title?: string;
}): PrdInterviewState {
  const idea = options.idea.trim();
  if (!idea) {
    throw new Error("Provide a non-empty idea for the PRD.");
  }

  return {
    idea,
    template: options.template ?? "complex",
    title: options.title?.trim() || titleFromIdea(idea),
    rounds: 0,
    answers: [],
    complete: false,
  };
}

export function advancePrdInterview(
  state: PrdInterviewState,
  answers: PrdAnswer[],
  options: { maxRounds?: number } = {},
): PrdInterviewState {
  const nextAnswers = [...state.answers, ...answers.filter((answer) => answer.answer.trim())];
  const answeredTopics = new Set(nextAnswers.map((answer) => answer.topic));
  const complete =
    prdTopicOrder.every((topic) => answeredTopics.has(topic)) ||
    state.rounds + 1 >= (options.maxRounds ?? prdTopicOrder.length);

  return {
    ...state,
    rounds: state.rounds + 1,
    answers: nextAnswers,
    complete,
  };
}

export function nextPrdQuestions(
  state: PrdInterviewState,
): Array<{ topic: PrdTopic; text: string }> {
  const answeredTopics = new Set(state.answers.map((answer) => answer.topic));
  const nextTopic = prdTopicOrder.find((topic) => !answeredTopics.has(topic));

  if (!nextTopic) {
    return [];
  }

  return [{ topic: nextTopic, text: defaultQuestion(nextTopic, state.idea) }];
}

export async function loadPrdInterviewState(
  options: PrdStateOptions = {},
): Promise<PrdInterviewState | undefined> {
  try {
    const raw = JSON.parse(await readFile(resolvePrdStatePath(options), "utf8"));
    return prdInterviewStateSchema.parse(raw);
  } catch (error) {
    if (
      isNodeFileError(error, "ENOENT") ||
      error instanceof SyntaxError ||
      error instanceof z.ZodError
    ) {
      return undefined;
    }
    throw error;
  }
}

export async function savePrdInterviewState(
  state: PrdInterviewState,
  options: PrdStateOptions = {},
): Promise<string> {
  const path = resolvePrdStatePath(options);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    `${JSON.stringify(prdInterviewStateSchema.parse(state), null, 2)}\n`,
    "utf8",
  );
  return path;
}

export function resolvePrdStatePath(options: PrdStateOptions = {}): string {
  return join(resolveProjectConfigDir(options), "prd-interview-state.json");
}

export function titleFromIdea(idea: string): string {
  const firstSentence = idea.split(/[.!?]/)[0]?.trim() || idea;
  return firstSentence.replace(/^build\s+/i, "").trim() || "Project PRD";
}

function defaultQuestion(topic: PrdTopic, idea: string): string {
  const byTopic: Record<PrdTopic, string> = {
    problem: `What problem should "${idea}" solve, and what background matters?`,
    users: "Who are the primary users or personas?",
    goals: "What goals and non-goals should constrain this work?",
    features: "What core features or scope should be included?",
    constraints: "What constraints, assumptions, integrations, or risks matter?",
    metrics: "How will success be measured and tested?",
  };
  return byTopic[topic];
}

function isNodeFileError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}

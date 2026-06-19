import { readFile } from "node:fs/promises";
import { z } from "zod";
import {
  type PrdAnswer,
  type PrdInterviewState,
  advancePrdInterview,
  createPrdInterviewState,
  loadPrdInterviewState,
  nextPrdQuestions,
  prdAnswerSchema,
  savePrdInterviewState,
} from "../prd/interview-state-machine.js";
import { writeRenderedPrd } from "../prd/renderer.js";
import type { TaskCommandOptions } from "./tasks.js";

export interface PrdCommandOptions extends TaskCommandOptions {
  idea?: string;
  title?: string;
  template?: "simple" | "complex";
  answers?: string;
  resume?: boolean;
  output?: string;
  maxRounds?: number;
  research?: boolean;
  chain?: boolean;
  projectRoot?: string;
  configDir?: string;
  questionGenerator?: (state: PrdInterviewState) => Promise<PrdAnswer[]>;
}

const answerFileSchema = z
  .object({
    idea: z.string().optional(),
    title: z.string().optional(),
    template: z.enum(["simple", "complex"]).optional(),
    answers: z.array(prdAnswerSchema),
  })
  .strict();

export async function prdCommand(options: PrdCommandOptions = {}): Promise<string> {
  const initial = options.resume ? await loadPrdInterviewState(options) : undefined;
  const batch = options.answers ? await readAnswersFile(options.answers) : undefined;
  const state =
    initial ??
    createPrdInterviewState({
      idea: options.idea ?? batch?.idea ?? "",
      title: options.title ?? batch?.title,
      template: options.template ?? batch?.template,
    });

  const generated = options.questionGenerator ? await options.questionGenerator(state) : [];
  const answers = batch?.answers ?? generated;
  const next =
    answers.length > 0
      ? advancePrdInterview(state, answers, { maxRounds: options.maxRounds })
      : state;

  if (!next.complete && !options.answers) {
    await savePrdInterviewState(next, options);
    return [
      `Saved PRD interview state: ${next.rounds} round(s).`,
      ...nextPrdQuestions(next).map((question) => `${question.topic}: ${question.text}`),
    ].join("\n");
  }

  const path = await writeRenderedPrd({ ...next, complete: true }, options);
  await savePrdInterviewState({ ...next, complete: true }, options);
  const chainHint = options.chain ? "\nNext: check-spec then parse-spec." : "";
  return `Wrote PRD: ${path}${chainHint}`;
}

async function readAnswersFile(path: string): Promise<z.infer<typeof answerFileSchema>> {
  const raw = JSON.parse(await readFile(path, "utf8"));
  return answerFileSchema.parse(raw);
}

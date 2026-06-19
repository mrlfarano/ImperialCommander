import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { resolveDocsDir } from "../config/paths.js";
import type { PrdAnswer, PrdInterviewState, PrdTopic } from "./interview-state-machine.js";

export interface RenderPrdOptions {
  projectRoot?: string;
  configDir?: string;
  output?: string;
}

export async function writeRenderedPrd(
  state: PrdInterviewState,
  options: RenderPrdOptions = {},
): Promise<string> {
  const path = options.output ?? join(resolveDocsDir(options), `${slug(state.title)}.md`);

  if (await fileExists(path)) {
    throw new Error(`Spec file already exists: ${path}. Choose --output to write elsewhere.`);
  }

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, renderPrd(state), "utf8");
  return path;
}

export function renderPrd(state: PrdInterviewState): string {
  return state.template === "simple" ? renderSimplePrd(state) : renderComplexPrd(state);
}

export function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "prd"
  );
}

function renderSimplePrd(state: PrdInterviewState): string {
  return [
    `# ${state.title}`,
    "",
    "## Summary",
    state.idea,
    "",
    "## Goals",
    listOrFallback(state.answers, "goals"),
    "",
    "## Requirements",
    listOrFallback(state.answers, "features"),
    "",
    "## Notes",
    renderTopic(state.answers, "constraints"),
    "",
  ].join("\n");
}

function renderComplexPrd(state: PrdInterviewState): string {
  return [
    `# ${state.title}`,
    "",
    "## Problem / Background",
    renderTopic(state.answers, "problem", state.idea),
    "",
    "## Users / Personas",
    renderTopic(state.answers, "users"),
    "",
    "## Goals",
    renderTopic(state.answers, "goals"),
    "",
    "## Non-Goals",
    "- To be clarified.",
    "",
    "## Functional Requirements",
    listOrFallback(state.answers, "features"),
    "",
    "## Constraints and Assumptions",
    renderTopic(state.answers, "constraints"),
    "",
    "## Success Metrics",
    renderTopic(state.answers, "metrics"),
    "",
    "## Test Strategy",
    "- Validate each functional requirement with automated or manual acceptance checks.",
    "",
  ].join("\n");
}

function renderTopic(answers: PrdAnswer[], topic: PrdTopic, fallback = "To be clarified."): string {
  const values = answers.filter((answer) => answer.topic === topic).map((answer) => answer.answer);
  return values.length > 0 ? values.join("\n\n") : fallback;
}

function listOrFallback(answers: PrdAnswer[], topic: PrdTopic): string {
  const values = answers.filter((answer) => answer.topic === topic).map((answer) => answer.answer);
  if (values.length === 0) {
    return "- To be clarified.";
  }
  return values
    .flatMap((value) => value.split(/\r?\n/))
    .map((line) => `- ${line.replace(/^[-*]\s+/, "").trim()}`)
    .join("\n");
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path, "utf8");
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

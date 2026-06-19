import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { resolveDocsDir, resolveReportsDir } from "../config/paths.js";

export const specGapSchema = z
  .object({
    section: z.string(),
    issue: z.string(),
    suggestion: z.string(),
  })
  .strict();

export const specReadinessSchema = z
  .object({
    scores: z
      .object({
        clarity: z.number().int().min(1).max(10),
        completeness: z.number().int().min(1).max(10),
        scopedness: z.number().int().min(1).max(10),
        testability: z.number().int().min(1).max(10),
        structure: z.number().int().min(1).max(10),
      })
      .strict(),
    overall: z.number().int().min(1).max(10),
    verdict: z.enum(["pass", "warn", "block"]),
    gaps: z.array(specGapSchema),
  })
  .strict();

export type SpecReadiness = z.infer<typeof specReadinessSchema>;

export interface CheckSpecOptions {
  projectRoot?: string;
  configDir?: string;
  input?: string;
  threshold?: number;
  report?: string | boolean;
  scorer?: (contents: string) => Promise<SpecReadiness>;
}

export async function checkSpecReadiness(options: CheckSpecOptions = {}): Promise<{
  input: string;
  readiness: SpecReadiness;
  reportPath?: string;
}> {
  const input = options.input ?? join(resolveDocsDir(options), "spec.md");
  const contents = await readSpec(input);
  const threshold = options.threshold ?? 5;
  const scored = options.scorer ? await options.scorer(contents) : heuristicSpecScore(contents);
  const readiness = withThresholdVerdict(specReadinessSchema.parse(scored), threshold);
  const reportPath = options.report
    ? await writeSpecReadinessReport(readiness, {
        ...options,
        output: typeof options.report === "string" ? options.report : undefined,
      })
    : undefined;

  return { input, readiness, reportPath };
}

export async function writeSpecReadinessReport(
  readiness: SpecReadiness,
  options: { projectRoot?: string; configDir?: string; output?: string } = {},
): Promise<string> {
  const path = options.output ?? join(resolveReportsDir(options), "spec-readiness.md");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, renderSpecReadinessMarkdown(readiness), "utf8");
  return path;
}

export function renderSpecReadinessMarkdown(readiness: SpecReadiness): string {
  return [
    "# Spec Readiness",
    "",
    `Verdict: ${readiness.verdict}`,
    `Overall: ${readiness.overall}/10`,
    "",
    "## Scores",
    ...Object.entries(readiness.scores).map(([name, score]) => `- ${name}: ${score}/10`),
    "",
    "## Gaps",
    ...(readiness.gaps.length === 0
      ? ["- None"]
      : readiness.gaps.map((gap) => `- ${gap.section}: ${gap.issue} Fix: ${gap.suggestion}`)),
    "",
  ].join("\n");
}

function heuristicSpecScore(contents: string): SpecReadiness {
  const headings = contents.match(/^#{1,3}\s+/gm)?.length ?? 0;
  const bullets = contents.match(/^[-*]\s+/gm)?.length ?? 0;
  const lengthScore = score(contents.trim().length, 250, 1600);
  const structure = Math.max(1, Math.min(10, headings * 2));
  const completeness = Math.max(1, Math.min(10, Math.round((headings + bullets) / 2)));
  const testability = /test|acceptance|metric|success|verify/i.test(contents) ? 7 : 3;
  const scopedness = /non-goal|constraint|assumption|scope/i.test(contents) ? 7 : 4;
  const clarity = lengthScore;
  const scores = { clarity, completeness, scopedness, testability, structure };
  const overall = Math.round((clarity + completeness + scopedness + testability + structure) / 5);
  const gaps = buildHeuristicGaps(contents);
  return { scores, overall, verdict: "warn", gaps };
}

function withThresholdVerdict(readiness: SpecReadiness, threshold: number): SpecReadiness {
  const verdict =
    readiness.overall < threshold ? "block" : readiness.gaps.length > 0 ? "warn" : "pass";
  return { ...readiness, verdict };
}

async function readSpec(path: string): Promise<string> {
  const contents = await readFile(path, "utf8");
  if (!contents.trim()) {
    throw new Error(`Spec file is empty or unreadable: ${path}`);
  }
  return contents;
}

function buildHeuristicGaps(contents: string): SpecReadiness["gaps"] {
  const checks: Array<[RegExp, string, string, string]> = [
    [/problem|background/i, "Problem", "Missing problem/background.", "Describe the user pain."],
    [/user|persona/i, "Users", "Missing target users.", "Name primary personas."],
    [/goal/i, "Goals", "Missing goals or non-goals.", "List goals and explicit non-goals."],
    [
      /requirement|feature/i,
      "Requirements",
      "Missing core scope.",
      "List functional requirements.",
    ],
    [
      /metric|success|test|acceptance/i,
      "Success Metrics",
      "Missing readiness criteria.",
      "Add measurable outcomes or tests.",
    ],
  ];
  return checks
    .filter(([pattern]) => !pattern.test(contents))
    .map(([, section, issue, suggestion]) => ({ section, issue, suggestion }));
}

function score(value: number, low: number, high: number): number {
  return Math.max(1, Math.min(10, Math.round(((value - low) / (high - low)) * 9 + 1)));
}

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { type ProjectPathOptions, resolveReportsDir } from "../config/paths.js";

export const complexityAnalysisSchema = z
  .object({
    taskId: z.union([z.number().int().positive(), z.string().min(1)]),
    taskTitle: z.string(),
    complexityScore: z.number().int().min(1).max(10),
    recommendedSubtasks: z.number().int().min(0),
    expansionPrompt: z.union([z.string(), z.object({ text: z.string() })]),
    reasoning: z.string(),
  })
  .strict();

export const complexityReportSchema = z
  .object({
    meta: z
      .object({
        generatedAt: z.string().datetime(),
        tasksAnalyzed: z.number().int().min(0),
        totalTasks: z.number().int().min(0),
        analysisCount: z.number().int().min(0),
        thresholdScore: z.number().int().min(1).max(10),
        projectName: z.string(),
        usedResearch: z.boolean(),
        tag: z.string(),
      })
      .strict(),
    complexityAnalysis: z.array(complexityAnalysisSchema),
  })
  .strict();

export type ComplexityAnalysis = z.infer<typeof complexityAnalysisSchema>;
export type ComplexityReport = z.infer<typeof complexityReportSchema>;

export interface ComplexityReportPathOptions extends ProjectPathOptions {
  output?: string;
  tag?: string;
}

export function resolveComplexityReportPath(options: ComplexityReportPathOptions = {}): string {
  if (options.output) {
    return options.output;
  }

  const suffix = options.tag && options.tag !== "master" ? `-${slug(options.tag)}` : "";
  return join(resolveReportsDir(options), `complexity-report${suffix}.json`);
}

export async function readComplexityReport(
  options: ComplexityReportPathOptions = {},
): Promise<ComplexityReport | undefined> {
  try {
    const raw = JSON.parse(await readFile(resolveComplexityReportPath(options), "utf8"));
    return complexityReportSchema.parse(raw);
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

export async function writeComplexityReport(
  report: ComplexityReport,
  options: ComplexityReportPathOptions = {},
): Promise<string> {
  const path = resolveComplexityReportPath(options);
  const parsed = complexityReportSchema.parse(report);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  return path;
}

export function summarizeComplexityReport(report: ComplexityReport): string {
  const total = report.complexityAnalysis.length || 1;
  const low = report.complexityAnalysis.filter((item) => item.complexityScore < 5).length;
  const medium = report.complexityAnalysis.filter(
    (item) => item.complexityScore >= 5 && item.complexityScore < 8,
  ).length;
  const high = report.complexityAnalysis.filter((item) => item.complexityScore >= 8).length;
  const needsExpansion = report.complexityAnalysis.filter(
    (item) => item.complexityScore >= report.meta.thresholdScore,
  );

  return [
    `Complexity Report (${report.meta.tag})`,
    `Low: ${low} (${percent(low, total)})`,
    `Medium: ${medium} (${percent(medium, total)})`,
    `High: ${high} (${percent(high, total)})`,
    "",
    "Tasks Needing Expansion",
    ...needsExpansion.map(
      (item) =>
        `- ${String(item.taskId)} ${item.taskTitle} score:${item.complexityScore} expand --id ${String(
          item.taskId,
        )}`,
    ),
    "",
    "Simple Tasks",
    ...report.complexityAnalysis
      .filter((item) => item.complexityScore < report.meta.thresholdScore)
      .map((item) => `- ${String(item.taskId)} ${item.taskTitle}: ${item.reasoning}`),
  ].join("\n");
}

function percent(count: number, total: number): string {
  return `${Math.round((count / total) * 100)}%`;
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "tag"
  );
}

function isNodeFileError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}

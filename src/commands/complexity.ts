import { analyzeComplexity } from "../complexity/analyze.js";
import { readComplexityReport, summarizeComplexityReport } from "../complexity/report.js";
import { FileTaskRepository } from "../storage/index.js";
import type { TaskCommandOptions } from "./tasks.js";

export interface AnalyzeComplexityCommandOptions extends TaskCommandOptions {
  output?: string;
  threshold?: number;
  research?: boolean;
  id?: string;
  from?: number;
  to?: number;
}

export async function analyzeComplexityCommand(
  options: AnalyzeComplexityCommandOptions = {},
): Promise<string> {
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const result = await analyzeComplexity(repository, {
    output: options.output,
    threshold: options.threshold,
    research: options.research,
    ids: options.id,
    from: options.from,
    to: options.to,
    tag: options.tag,
  });

  return `${result.warning ? `${result.warning}\n` : ""}Wrote complexity report: ${result.path}`;
}

export async function complexityReportCommand(
  options: TaskCommandOptions & { output?: string } = {},
): Promise<string> {
  const report = await readComplexityReport({ output: options.output, tag: options.tag });

  if (!report) {
    return "No complexity report found.";
  }

  return summarizeComplexityReport(report);
}

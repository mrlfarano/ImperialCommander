import type { TaskAssessor } from "../analysis/assess.js";
import { analyzeComplexity } from "../complexity/analyze.js";
import { FileTaskRepository } from "../storage/index.js";
import type { TaskCommandOptions } from "./tasks.js";

export interface AnalyzeComplexityCommandOptions extends TaskCommandOptions {
  threshold?: number;
  id?: string;
  from?: number;
  to?: number;
  assessor?: TaskAssessor;
}

export async function analyzeComplexityCommand(
  options: AnalyzeComplexityCommandOptions = {},
): Promise<string> {
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const result = await analyzeComplexity(repository, {
    threshold: options.threshold,
    ids: options.id,
    from: options.from,
    to: options.to,
    tag: options.tag,
    assessor: options.assessor,
  });

  return result.summary;
}

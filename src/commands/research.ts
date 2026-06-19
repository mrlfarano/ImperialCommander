import { runResearch } from "../research/research.js";
import type { ResearchGenerator } from "../research/research.js";
import { FileTaskRepository } from "../storage/index.js";
import type { TaskCommandOptions } from "./tasks.js";

export interface ResearchCommandOptions extends TaskCommandOptions {
  detail?: "low" | "medium" | "high";
  ids?: string;
  files?: string;
  context?: string;
  tree?: boolean;
  saveTo?: string;
  saveFile?: boolean;
  generator?: ResearchGenerator;
}

export async function researchCommand(
  query: string,
  options: ResearchCommandOptions = {},
): Promise<string> {
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const result = await runResearch(repository, {
    query,
    detail: options.detail,
    ids: options.ids,
    files: options.files,
    customContext: options.context,
    includeTree: options.tree,
    saveTo: options.saveTo,
    saveFile: options.saveFile,
    tag: options.tag,
    generator: options.generator,
  });

  return result.savedPath ? `${result.result}\nSaved: ${result.savedPath}` : result.result;
}

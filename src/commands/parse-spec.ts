import { parseSpecFile } from "../spec/parse-spec.js";
import { FileTaskRepository } from "../storage/index.js";
import type { TaskCommandOptions } from "./tasks.js";

export interface ParseSpecCommandOptions extends TaskCommandOptions {
  append?: boolean;
  force?: boolean;
  numTasks?: number;
}

export async function parseSpecCommand(
  filePath: string,
  options: ParseSpecCommandOptions = {},
): Promise<string> {
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const result = await parseSpecFile(repository, filePath, {
    append: options.append,
    force: options.force,
    numTasks: options.numTasks,
    tag: options.tag,
  });

  const mode = result.overwritten ? "overwrote" : result.appended ? "appended" : "created";
  return `${mode} ${result.tasks.length} tasks from ${filePath}.`;
}

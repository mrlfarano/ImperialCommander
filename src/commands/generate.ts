import { join } from "node:path";
import { resolveProjectConfigDir } from "../config/paths.js";
import { FileTaskRepository } from "../storage/index.js";
import { generateTaskFiles, syncReadme } from "../tasks/generate.js";
import type { TaskCommandOptions } from "./tasks.js";

export async function generateCommand(
  options: TaskCommandOptions & { output?: string } = {},
): Promise<string> {
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const outputDir = options.output ?? join(resolveProjectConfigDir(), "tasks");
  const result = await generateTaskFiles(repository, { outputDir, tag: options.tag });
  return `Wrote ${result.tasks} tasks to ${join(result.outputDir, result.file)}; removed ${result.removed} legacy files.`;
}

export async function syncReadmeCommand(
  options: TaskCommandOptions & {
    readme?: string;
    withSubtasks?: boolean;
    status?: "pending" | "done" | "in-progress" | "review" | "deferred" | "cancelled";
  } = {},
): Promise<string> {
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const readmePath = options.readme ?? "README.md";
  await syncReadme(repository, readmePath, {
    tag: options.tag,
    withSubtasks: options.withSubtasks,
    status: options.status,
  });
  return `Synced tasks to ${readmePath}.`;
}

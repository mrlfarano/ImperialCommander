import { FileTaskRepository } from "../storage/index.js";
import { runExternalSync } from "../sync/sync.js";
import type { TaskCommandOptions } from "./tasks.js";

export interface SyncCommandOptions extends TaskCommandOptions {
  provider?: "github" | "linear" | "jira" | "gitlab" | "local";
  dryRun?: boolean;
  write?: boolean;
  json?: boolean;
  projectRoot?: string;
  mappingPath?: string;
}

export async function syncCommand(options: SyncCommandOptions = {}): Promise<string> {
  const provider = options.provider ?? "local";
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const result = await runExternalSync(repository, {
    provider,
    tag: options.tag,
    dryRun: options.write ? false : (options.dryRun ?? true),
    projectRoot: options.projectRoot,
    mappingPath: options.mappingPath,
  });

  if (options.json) {
    return JSON.stringify(result, null, 2);
  }

  return `${result.dryRun ? "Planned" : "Synced"} ${result.pushed} tasks with ${provider}; pulled ${result.pulled} items.`;
}

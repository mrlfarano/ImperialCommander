import { FileTaskRepository } from "../storage/index.js";
import {
  type SyncCommandRunner,
  type SyncProviderName,
  type SyncScope,
  runExternalSync,
} from "../sync/sync.js";
import type { TaskCommandOptions } from "./tasks.js";

export interface SyncCommandOptions extends TaskCommandOptions {
  provider?: SyncProviderName;
  dryRun?: boolean;
  write?: boolean;
  json?: boolean;
  projectRoot?: string;
  mappingPath?: string;
  board?: string;
  scope?: SyncScope;
  assignee?: string;
  goal?: boolean;
  hermesCommand?: string;
  commandRunner?: SyncCommandRunner;
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
    board: options.board,
    scope: options.scope,
    assignee: options.assignee,
    goal: options.goal,
    hermesCommand: options.hermesCommand,
    commandRunner: options.commandRunner,
  });

  if (options.json) {
    return JSON.stringify(result, null, 2);
  }

  const linked = result.linked > 0 ? ` linked ${result.linked} dependencies;` : "";
  return `${result.dryRun ? "Planned" : "Synced"} ${result.pushed} tasks with ${provider};${linked} pulled ${result.pulled} items.`;
}

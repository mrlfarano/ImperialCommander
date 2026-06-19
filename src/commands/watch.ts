import { type WatchAction, startTaskWatch } from "../watch/watch.js";
import { validateDependenciesCommand } from "./dependencies.js";
import { generateCommand, syncReadmeCommand } from "./generate.js";
import type { TaskCommandOptions } from "./tasks.js";

export interface WatchCommandOptions extends TaskCommandOptions {
  specFile?: string;
  debounceMs?: number;
  onChange?: WatchAction;
  once?: boolean;
}

export async function watchCommand(options: WatchCommandOptions = {}): Promise<string> {
  const action = options.onChange;
  let runs = 0;
  const runAction = async () => {
    runs += 1;
    if (action === "generate") {
      await generateCommand({ file: options.file, tag: options.tag });
    } else if (action === "sync-readme") {
      await syncReadmeCommand({ file: options.file, tag: options.tag });
    } else if (action === "validate-deps") {
      await validateDependenciesCommand({ file: options.file, tag: options.tag });
    }
  };

  if (options.once) {
    await runAction();
    return `Watch action ${action ?? "none"} ran ${runs} time.`;
  }

  startTaskWatch({
    storePath: options.file,
    specFile: options.specFile,
    debounceMs: options.debounceMs,
    onChange: runAction,
  });

  return `Watching task store${action ? `; on-change=${action}` : ""}.`;
}

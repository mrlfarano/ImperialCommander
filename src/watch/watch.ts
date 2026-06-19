import { type FSWatcher, existsSync, watch } from "node:fs";
import { dirname } from "node:path";
import { type TaskStoreOptions, onStorageChange, resolveTaskStorePath } from "../storage/index.js";

export type WatchAction = "generate" | "sync-readme" | "validate-deps";

export interface WatchOptions extends TaskStoreOptions {
  specFile?: string;
  debounceMs?: number;
  onChange?: (reason: string) => void | Promise<void>;
}

export interface WatchHandle {
  close(): void;
}

export function startTaskWatch(options: WatchOptions = {}): WatchHandle {
  const debounceMs = options.debounceMs ?? 100;
  const paths = [resolveTaskStorePath(options), options.specFile].filter(
    (path): path is string => typeof path === "string",
  );
  const watchers: FSWatcher[] = [];
  let timer: NodeJS.Timeout | undefined;
  const run = (reason: string) => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      void options.onChange?.(reason);
    }, debounceMs);
  };

  for (const path of paths) {
    const target = existsSync(path) ? path : dirname(path);
    if (existsSync(target)) {
      watchers.push(watch(target, { persistent: true }, () => run(path)));
    }
  }

  const unsubscribe = onStorageChange((event) => run(event.operation));

  return {
    close: () => {
      if (timer) {
        clearTimeout(timer);
      }
      unsubscribe();
      for (const watcher of watchers) {
        watcher.close();
      }
    },
  };
}

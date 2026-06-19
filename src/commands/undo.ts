import { undoHistoryEntry } from "../history/undo.js";
import type { TaskCommandOptions } from "./tasks.js";

export interface UndoCommandOptions extends TaskCommandOptions {
  entry?: string;
}

export async function undoCommand(options: UndoCommandOptions = {}): Promise<string> {
  const result = await undoHistoryEntry({
    storePath: options.file,
    entryId: options.entry,
  });

  return `Undid ${result.entry.operation} from ${result.entry.timestamp}.`;
}

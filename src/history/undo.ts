import {
  type TaskStoreOptions,
  createStorageChangeEvent,
  emitStorageChange,
  loadTaskStore,
  saveTaskStore,
} from "../storage/index.js";
import { type HistoryEntry, appendHistoryEntry, readHistory } from "./audit-log.js";

export interface UndoOptions extends TaskStoreOptions {
  historyPath?: string;
  entryId?: string;
}

export interface UndoResult {
  entry: HistoryEntry;
  tag?: string;
}

export async function undoHistoryEntry(options: UndoOptions = {}): Promise<UndoResult> {
  const entries = await readHistory(options);
  const entry = findUndoEntry(entries, options.entryId);

  if (!entry) {
    throw new Error("No reversible history entry found.");
  }

  if (!entry.reversible || !entry.before) {
    throw new Error(`History entry ${entry.id} is not reversible.`);
  }

  const { store } = await loadTaskStore(options);
  const nextStore = entry.tag ? { ...store, [entry.tag]: entry.before[entry.tag] } : entry.before;

  await saveTaskStore(nextStore, options);

  const event = createStorageChangeEvent({
    operation: "undo.applied",
    tag: entry.tag,
    taskIds: entry.taskIds,
    before: store,
    after: nextStore,
    reversible: true,
    source: "history",
    metadata: { undoneEntryId: entry.id, undoneOperation: entry.operation },
  });
  await emitStorageChange(event);
  await appendHistoryEntry(event, options);

  return { entry, tag: entry.tag };
}

function findUndoEntry(entries: HistoryEntry[], entryId?: string): HistoryEntry | undefined {
  if (entryId) {
    return entries.find((entry) => entry.id === entryId);
  }

  return [...entries]
    .reverse()
    .find((entry) => entry.reversible && entry.operation !== "undo.applied");
}

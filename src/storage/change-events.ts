import type { Task } from "../schemas/index.js";
import type { TaskStore } from "./task-store.js";

export type StorageChangeOperation =
  | "task.created"
  | "task.updated"
  | "task.removed"
  | "task.moved"
  | "tag.created"
  | "tag.removed"
  | "store.saved"
  | "undo.applied";

export interface StorageChangeEvent {
  id: string;
  timestamp: string;
  operation: StorageChangeOperation;
  tag?: string;
  taskIds: Array<Task["id"]>;
  before?: TaskStore;
  after?: TaskStore;
  reversible: boolean;
  source: "repository" | "history" | "watch" | "test";
  metadata?: Record<string, unknown>;
}

export type StorageChangeListener = (event: StorageChangeEvent) => void | Promise<void>;

const listeners = new Set<StorageChangeListener>();

export function onStorageChange(listener: StorageChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearStorageChangeListeners(): void {
  listeners.clear();
}

export async function emitStorageChange(event: StorageChangeEvent): Promise<void> {
  await Promise.all(
    Array.from(listeners).map(async (listener) => {
      try {
        await listener(event);
      } catch {
        // Change consumers must not break the originating write.
      }
    }),
  );
}

export function createStorageChangeEvent(
  event: Omit<StorageChangeEvent, "id" | "timestamp"> & { id?: string; timestamp?: string },
): StorageChangeEvent {
  return {
    ...event,
    id: event.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: event.timestamp ?? new Date().toISOString(),
  };
}

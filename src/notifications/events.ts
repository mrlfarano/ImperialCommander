import type { StorageChangeEvent } from "../storage/index.js";

export type NotificationEventType =
  | "task.created"
  | "task.updated"
  | "task.status-changed"
  | "task.removed"
  | "next-ready"
  | "dependency-validation.failed"
  | "autopilot.phase-transition";

export interface NotificationEvent {
  id: string;
  timestamp: string;
  type: NotificationEventType;
  tag?: string;
  taskIds: Array<string | number>;
  payload: Record<string, unknown>;
}

export function notificationFromStorageChange(
  event: StorageChangeEvent,
): NotificationEvent | undefined {
  if (event.operation === "task.created") {
    return toNotification(event, "task.created");
  }

  if (event.operation === "task.removed") {
    return toNotification(event, "task.removed");
  }

  if (event.operation === "task.updated") {
    return toNotification(
      event,
      event.metadata?.status !== undefined ? "task.status-changed" : "task.updated",
    );
  }

  return undefined;
}

function toNotification(event: StorageChangeEvent, type: NotificationEventType): NotificationEvent {
  return {
    id: event.id,
    timestamp: event.timestamp,
    type,
    tag: event.tag,
    taskIds: event.taskIds,
    payload: event.metadata ?? {},
  };
}

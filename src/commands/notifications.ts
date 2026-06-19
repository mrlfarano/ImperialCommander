import { type NotificationSink, dispatchNotification } from "../notifications/dispatcher.js";
import type { NotificationEventType } from "../notifications/events.js";

export interface NotificationsCommandOptions {
  type?: NotificationEventType;
  id?: string;
  tag?: string;
  fileSink?: string;
  webhook?: string;
  signingSecretEnv?: string;
  json?: boolean;
}

export async function notificationsCommand(
  options: NotificationsCommandOptions = {},
): Promise<string> {
  const event = {
    id: options.id ?? `manual-${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: options.type ?? "task.updated",
    tag: options.tag,
    taskIds: [],
    payload: { source: "notifications-command" },
  };
  const sinks: NotificationSink[] = [
    ...(options.fileSink ? [{ type: "file" as const, target: options.fileSink }] : []),
    ...(options.webhook
      ? [
          {
            type: "webhook" as const,
            target: options.webhook,
            signingSecretEnv: options.signingSecretEnv,
          },
        ]
      : []),
  ];
  const deliveries = await dispatchNotification(
    event,
    sinks.length > 0 ? sinks : [{ type: "console" }],
  );

  if (options.json) {
    return JSON.stringify({ event, deliveries }, null, 2);
  }

  return `Prepared ${event.type}; ${deliveries.filter((delivery) => delivery.delivered).length}/${deliveries.length} sinks delivered.`;
}

import { createHmac } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { NotificationEvent, NotificationEventType } from "./events.js";

export interface NotificationSink {
  type: "console" | "file" | "webhook";
  target?: string;
  events?: NotificationEventType[];
  signingSecretEnv?: string;
}

export interface NotificationDelivery {
  sink: NotificationSink["type"];
  target?: string;
  delivered: boolean;
  skipped?: boolean;
  error?: string;
  signature?: string;
}

export async function dispatchNotification(
  event: NotificationEvent,
  sinks: NotificationSink[],
  options: { env?: NodeJS.ProcessEnv } = {},
): Promise<NotificationDelivery[]> {
  const deliveries: NotificationDelivery[] = [];

  for (const sink of sinks) {
    if (sink.events && !sink.events.includes(event.type)) {
      deliveries.push({ sink: sink.type, target: sink.target, delivered: false, skipped: true });
      continue;
    }

    try {
      deliveries.push(await deliver(event, sink, options.env ?? process.env));
    } catch (error) {
      deliveries.push({
        sink: sink.type,
        target: sink.target,
        delivered: false,
        error: error instanceof Error ? error.message : "Unknown delivery error.",
      });
    }
  }

  return deliveries;
}

async function deliver(
  event: NotificationEvent,
  sink: NotificationSink,
  env: NodeJS.ProcessEnv,
): Promise<NotificationDelivery> {
  const serialized = JSON.stringify(event);
  const signature = sink.signingSecretEnv
    ? sign(serialized, env[sink.signingSecretEnv] ?? "")
    : undefined;

  if (sink.type === "console") {
    return { sink: sink.type, target: sink.target, delivered: true, signature };
  }

  if (sink.type === "file" && sink.target) {
    await mkdir(dirname(sink.target), { recursive: true });
    await appendFile(sink.target, `${serialized}\n`, "utf8");
    return { sink: sink.type, target: sink.target, delivered: true, signature };
  }

  if (sink.type === "webhook") {
    return { sink: sink.type, target: sink.target, delivered: false, skipped: true, signature };
  }

  throw new Error(`Unsupported notification sink ${sink.type}.`);
}

function sign(payload: string, secret: string): string | undefined {
  return secret ? createHmac("sha256", secret).update(payload).digest("hex") : undefined;
}

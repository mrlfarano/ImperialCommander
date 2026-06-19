import { VERSION } from "../version.js";

export interface AgentEnvelope<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta: {
    version: string;
    tag?: string;
  };
}

export interface HostToolResponse {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  error?: {
    code: string;
    message: string;
  };
  meta: {
    version: string;
    tag?: string;
  };
}

export function createSuccessEnvelope<T>(data: T, tag?: string): AgentEnvelope<T> {
  return {
    success: true,
    data,
    meta: { version: VERSION, tag },
  };
}

export function createErrorEnvelope(error: unknown, tag?: string): AgentEnvelope {
  const message = error instanceof Error ? error.message : String(error);
  return {
    success: false,
    error: {
      code: error instanceof Error ? error.name : "Error",
      message,
    },
    meta: { version: VERSION, tag },
  };
}

export function toHostResponse(envelope: AgentEnvelope): HostToolResponse {
  const text = JSON.stringify(envelope, null, 2);

  if (!envelope.success) {
    return {
      content: [{ type: "text", text }],
      isError: true,
      error: envelope.error,
      meta: envelope.meta,
    };
  }

  return {
    content: [{ type: "text", text }],
    meta: envelope.meta,
  };
}

export async function wrapAgentCall<T>(
  operation: () => Promise<T>,
  tag?: string,
): Promise<HostToolResponse> {
  try {
    return toHostResponse(createSuccessEnvelope(await operation(), tag));
  } catch (error) {
    return toHostResponse(createErrorEnvelope(error, tag));
  }
}

import { computeTokenCost } from "./cost.js";

export interface TelemetryRecordInput {
  userId: string;
  commandName: string;
  modelUsed: string;
  providerName: string;
  inputTokens: number;
  outputTokens: number;
  timestamp?: Date;
}

export interface TelemetryRecord extends TelemetryRecordInput {
  timestamp: Date;
  totalTokens: number;
  totalCost: number;
  currency: "USD";
}

export function createTelemetryRecord(input: TelemetryRecordInput): TelemetryRecord {
  const totalCost = computeTokenCost(input.providerName, input.modelUsed, {
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
  });

  return {
    ...input,
    timestamp: input.timestamp ?? new Date(),
    totalTokens: input.inputTokens + input.outputTokens,
    totalCost,
    currency: "USD",
  };
}

export function isTelemetryEnabled(value: unknown): boolean {
  return value !== false && value !== "false" && value !== "0";
}

export function formatUsageSummary(
  record: Pick<TelemetryRecord, "totalTokens" | "totalCost">,
): string {
  return `Usage: ${record.totalTokens} tokens, $${record.totalCost.toFixed(6)} USD`;
}

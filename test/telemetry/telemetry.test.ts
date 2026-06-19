import { chmod, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeTokenCost } from "../../src/telemetry/cost.js";
import {
  createTelemetryRecord,
  formatUsageSummary,
  isTelemetryEnabled,
} from "../../src/telemetry/telemetry.js";
import { getOrCreateUserId } from "../../src/telemetry/user-id.js";
import { Logger } from "../../src/utils/logger.js";

describe("telemetry", () => {
  it("computes cost from catalog per-million rates and zero for local/free models", () => {
    expect(
      computeTokenCost("openai", "gpt-4.1", { inputTokens: 1_000_000, outputTokens: 1_000_000 }),
    ).toBe(10);
    expect(
      computeTokenCost("ollama", "llama3.1", { inputTokens: 1_000_000, outputTokens: 1_000_000 }),
    ).toBe(0);
  });

  it("creates telemetry records and usage summaries", () => {
    const record = createTelemetryRecord({
      userId: "user",
      commandName: "parse",
      modelUsed: "gpt-4.1",
      providerName: "openai",
      inputTokens: 10,
      outputTokens: 20,
      timestamp: new Date("2026-06-19T12:00:00.000Z"),
    });

    expect(record.totalTokens).toBe(30);
    expect(record.currency).toBe("USD");
    expect(formatUsageSummary(record)).toMatch(/30 tokens/);
  });

  it("honors telemetry opt-out values", () => {
    expect(isTelemetryEnabled(undefined)).toBe(true);
    expect(isTelemetryEnabled("false")).toBe(false);
    expect(isTelemetryEnabled("0")).toBe(false);
  });
});

describe("user id", () => {
  it("persists and reuses a generated user id", async () => {
    const dir = await mkdtemp(join(tmpdir(), "imperial-user-id-"));
    const first = await getOrCreateUserId({ configDir: dir });
    const second = await getOrCreateUserId({ configDir: dir });

    expect(second).toBe(first);
  });

  it("warns and returns an in-memory id when persistence fails", async () => {
    const dir = await mkdtemp(join(tmpdir(), "imperial-user-id-readonly-"));
    await chmod(dir, 0o400);
    const warnings: string[] = [];

    const id = await getOrCreateUserId({
      userIdPath: join(dir, "missing", "user-id"),
      warn: (message) => warnings.push(message),
    });

    expect(id).toBeTruthy();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/using in-memory id/);
    await chmod(dir, 0o700);
  });
});

describe("logger", () => {
  it("filters by log level and treats debug as a strict boolean", () => {
    const messages: string[] = [];
    const logger = new Logger({
      level: "warn",
      debug: false,
      sink: (level, message) => messages.push(`${level}:${message}`),
    });

    logger.info("hidden");
    logger.warn("shown");

    expect(messages).toEqual(["warn:shown"]);
  });
});

import { z } from "zod";
import { type AiProviderInvoker, AiService } from "../../src/ai/ai-service.js";
import { type ProjectConfig, defaultConfig } from "../../src/config/config-manager.js";

describe("AI service", () => {
  it("generates text through the requested role and returns telemetry", async () => {
    const calls: Parameters<AiProviderInvoker>[0][] = [];
    const service = new AiService(
      defaultConfig,
      async (call) => {
        calls.push(call);
        return { text: "result", inputTokens: 2, outputTokens: 3 };
      },
      {
        processEnv: { OPENAI_API_KEY: "key" },
        now: () => new Date("2026-06-19T12:00:00.000Z"),
      },
    );

    const result = await service.generateText({ prompt: "Plan", commandName: "test" });

    expect(result.text).toBe("result");
    expect(result.role).toBe("main");
    expect(result.telemetryData).toMatchObject({
      timestamp: "2026-06-19T12:00:00.000Z",
      commandName: "test",
      modelUsed: "gpt-4.1",
      providerName: "openai",
      inputTokens: 2,
      outputTokens: 3,
      totalTokens: 5,
    });
    expect(calls[0].prompt).toMatch(/^Respond in English/);
  });

  it("falls back once for main-role failures", async () => {
    const roles: string[] = [];
    const service = new AiService(
      defaultConfig,
      async (call) => {
        roles.push(call.roleConfig.role);
        if (call.roleConfig.role === "main") {
          throw new Error("main failed");
        }
        return { text: "fallback ok" };
      },
      { processEnv: { OPENAI_API_KEY: "key" } },
    );

    const result = await service.generateText({ prompt: "Plan", commandName: "test" });

    expect(result.text).toBe("fallback ok");
    expect(result.role).toBe("fallback");
    expect(roles).toEqual(["main", "fallback"]);
  });

  it("does not fallback for research-role failures", async () => {
    const service = new AiService(
      defaultConfig,
      async () => {
        throw new Error("research failed");
      },
      { processEnv: { OPENAI_API_KEY: "key" } },
    );

    await expect(
      service.generateText({ role: "research", prompt: "Research", commandName: "research" }),
    ).rejects.toThrow(/research failed/);
  });

  it("parses generated objects through a zod schema", async () => {
    const service = new AiService(
      defaultConfig,
      async () => ({ text: JSON.stringify({ title: "Task" }) }),
      { processEnv: { OPENAI_API_KEY: "key" } },
    );

    const result = await service.generateObject(z.object({ title: z.string() }), {
      prompt: "JSON",
      commandName: "object",
    });

    expect(result.object).toEqual({ title: "Task" });
  });

  it("uses non-streaming fallback when streaming is disabled", async () => {
    const streamFlags: boolean[] = [];
    const service = new AiService(
      defaultConfig,
      async (call) => {
        streamFlags.push(call.stream);
        return { text: "ok" };
      },
      { processEnv: { OPENAI_API_KEY: "key" }, streamEnabled: false },
    );

    await service.generateText({ prompt: "Stream", commandName: "stream", stream: true });

    expect(streamFlags).toEqual([false]);
  });

  it("passes the stream timeout when streaming is enabled", async () => {
    let timeoutMs: number | undefined;
    const service = new AiService(
      defaultConfig,
      async (call) => {
        timeoutMs = call.timeoutMs;
        return { text: "ok" };
      },
      { processEnv: { OPENAI_API_KEY: "key" }, streamEnabled: true, streamTimeoutMs: 100 },
    );

    await service.generateText({ prompt: "Stream", commandName: "stream", stream: true });

    expect(timeoutMs).toBe(100);
  });

  it("ignores incomplete fallback configuration", async () => {
    const config: ProjectConfig = {
      ...defaultConfig,
      models: {
        ...defaultConfig.models,
        fallback: {
          maxTokens: 1000,
          temperature: 0.2,
        },
      },
    };
    const service = new AiService(
      config,
      async () => {
        throw new Error("main failed");
      },
      { processEnv: { OPENAI_API_KEY: "key" } },
    );

    await expect(service.generateText({ prompt: "Plan", commandName: "test" })).rejects.toThrow(
      /main failed/,
    );
  });
});

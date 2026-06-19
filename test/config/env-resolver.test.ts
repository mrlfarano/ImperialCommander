import {
  getProviderKeyEnvName,
  getProviderKeyStatus,
  resolveProviderSecret,
} from "../../src/config/env-resolver.js";

describe("env resolver", () => {
  it("resolves provider secrets with process > session > dotenv precedence", () => {
    expect(
      resolveProviderSecret("openai", {
        processEnv: { OPENAI_API_KEY: "process-key" },
        sessionEnv: { OPENAI_API_KEY: "session-key" },
        dotenvEnv: { OPENAI_API_KEY: "dotenv-key" },
      }),
    ).toBe("process-key");

    expect(
      resolveProviderSecret("openai", {
        processEnv: {},
        sessionEnv: { OPENAI_API_KEY: "session-key" },
        dotenvEnv: { OPENAI_API_KEY: "dotenv-key" },
      }),
    ).toBe("session-key");
  });

  it("rejects empty and placeholder values", () => {
    expect(
      getProviderKeyStatus("openai", {
        processEnv: { OPENAI_API_KEY: "your-api-key" },
        sessionEnv: { OPENAI_API_KEY: " " },
        dotenvEnv: { OPENAI_API_KEY: "dotenv-key" },
      }),
    ).toEqual({
      provider: "openai",
      ok: true,
      source: "dotenv",
      envVar: "OPENAI_API_KEY",
    });
  });

  it("reports no-key providers as ok", () => {
    expect(getProviderKeyStatus("ollama")).toEqual({
      provider: "ollama",
      ok: true,
      source: "not-required",
    });
  });

  it("reports missing key-backed providers", () => {
    expect(
      getProviderKeyStatus("anthropic", { processEnv: {}, sessionEnv: {}, dotenvEnv: {} }),
    ).toEqual({
      provider: "anthropic",
      ok: false,
      source: "missing",
      envVar: "ANTHROPIC_API_KEY",
    });
  });

  it("exposes provider key names without reading config secrets", () => {
    expect(getProviderKeyEnvName("openrouter")).toBe("OPENROUTER_API_KEY");
    expect(getProviderKeyEnvName("host-session")).toBeUndefined();
  });
});

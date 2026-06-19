import {
  getCommandOverride,
  parseProviderAdvancedConfig,
} from "../../src/providers/advanced-config.js";
import { getProviderDefinition } from "../../src/providers/registry.js";

describe("provider advanced config", () => {
  it("validates command-specific overrides for known AI commands", () => {
    const config = parseProviderAdvancedConfig({
      executablePath: "/usr/local/bin/codex",
      workingDirectory: "/tmp",
      approvalMode: "on-request",
      permissionMode: "workspace-write",
      sandboxMode: "workspace-write",
      allowedTools: ["read_file"],
      reasoningEffort: "high",
      commandOverrides: {
        research: {
          modelId: "gpt-4.1",
          maxTokens: 1000,
          temperature: 0.1,
        },
      },
    });

    expect(getCommandOverride(config, "research")).toEqual({
      modelId: "gpt-4.1",
      maxTokens: 1000,
      temperature: 0.1,
    });
  });

  it("rejects invalid command override keys", () => {
    expect(() =>
      parseProviderAdvancedConfig({
        commandOverrides: {
          "not-a-command": {
            modelId: "gpt-4.1",
          },
        },
      }),
    ).toThrow();
  });

  it("registers all provider categories without requiring keys for no-key runtimes", () => {
    expect(getProviderDefinition("azure")?.requiresKey).toBe(true);
    expect(getProviderDefinition("bedrock")?.requiresKey).toBe(true);
    expect(getProviderDefinition("vertex")?.requiresKey).toBe(true);
    expect(getProviderDefinition("openai-compatible")?.requiresKey).toBe(false);
    expect(getProviderDefinition("ollama")?.create({}).baseURL).toBe("http://localhost:11434/api");
    expect(getProviderDefinition("local-cli")?.requiresKey).toBe(false);
    expect(getProviderDefinition("host-session")?.requiresKey).toBe(false);
    expect(getProviderDefinition("cloud-managed")?.requiresKey).toBe(false);
  });
});

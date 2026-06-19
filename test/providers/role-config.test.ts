import { type ProjectConfig, defaultConfig } from "../../src/config/config-manager.js";
import { getProviderDefinition, hasUsableProvider } from "../../src/providers/registry.js";
import { resolveFallbackRoleConfig, resolveRoleConfig } from "../../src/providers/role-config.js";
import { assertAtLeastOneUsableRole } from "../../src/providers/role-config.js";

describe("provider registry", () => {
  it("returns registered provider definitions and checks usability", () => {
    expect(getProviderDefinition("openai")?.requiresKey).toBe(true);
    expect(getProviderDefinition("ollama")?.requiresKey).toBe(false);
    expect(hasUsableProvider(["ollama"])).toBe(true);
  });
});

describe("role config", () => {
  it("resolves role defaults with credential status and catalog caps", () => {
    const resolved = resolveRoleConfig(defaultConfig, "main", {
      processEnv: { OPENAI_API_KEY: "key" },
    });

    expect(resolved.provider).toBe("openai");
    expect(resolved.modelId).toBe("gpt-4.1");
    expect(resolved.maxTokens).toBe(32768);
    expect(resolved.apiKey).toBe("key");
    expect(resolved.runtime.id).toBe("openai");
  });

  it("uses role baseURL before provider env baseURL", () => {
    const config = withMain({
      baseURL: "https://role.example.test",
    });

    expect(
      resolveRoleConfig(config, "main", {
        processEnv: {
          OPENAI_API_KEY: "key",
          OPENAI_BASE_URL: "https://env.example.test",
        },
      }).baseURL,
    ).toBe("https://role.example.test");
  });

  it("omits incomplete fallback role", () => {
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

    expect(resolveFallbackRoleConfig(config)).toBeUndefined();
  });

  it("requires credentials for key-backed providers", () => {
    expect(() => resolveRoleConfig(defaultConfig, "main", { processEnv: {} })).toThrow(
      /missing OPENAI_API_KEY/,
    );
  });

  it("allows no-key providers to satisfy usable-role checks", () => {
    const config = withMain({ provider: "ollama", modelId: "llama3.1" });

    expect(() => assertAtLeastOneUsableRole(config, { processEnv: {} })).not.toThrow();
  });

  it("rejects role-ineligible models", () => {
    const config: ProjectConfig = {
      ...defaultConfig,
      models: {
        ...defaultConfig.models,
        research: {
          ...defaultConfig.models.research,
          modelId: "gpt-4.1-mini",
        },
      },
    };

    expect(() =>
      resolveRoleConfig(config, "research", { processEnv: { OPENAI_API_KEY: "key" } }),
    ).toThrow(/not allowed/);
  });

  function withMain(patch: Partial<ProjectConfig["models"]["main"]>): ProjectConfig {
    return {
      ...defaultConfig,
      models: {
        ...defaultConfig.models,
        main: {
          ...defaultConfig.models.main,
          ...patch,
        },
      },
    };
  }
});

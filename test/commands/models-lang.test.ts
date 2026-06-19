import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { langCommand } from "../../src/commands/lang.js";
import { modelsCommand } from "../../src/commands/models.js";
import { defaultConfig, saveConfig } from "../../src/config/config-manager.js";

describe("models and lang commands", () => {
  let configPath: string;

  beforeEach(async () => {
    configPath = join(await mkdtemp(join(tmpdir(), "imperial-models-")), "config.json");
    await saveConfig(defaultConfig, { configPath });
  });

  it("views and sets known models with provider inference", async () => {
    await expect(modelsCommand({ configPath })).resolves.toContain("main: openai/gpt-4.1");
    await modelsCommand({ configPath, setMain: "gpt-4.1-mini" });
    await expect(modelsCommand({ configPath })).resolves.toContain("main: openai/gpt-4.1-mini");
  });

  it("supports custom model ids with explicit provider flags", async () => {
    await modelsCommand({
      configPath,
      setMain: "custom-model",
      openaiCompatible: true,
      baseURL: "https://models.example.test",
    });
    await expect(modelsCommand({ configPath })).resolves.toContain(
      "main: openai-compatible/custom-model",
    );
  });

  it("rejects multiple provider flags and role-ineligible assignments", async () => {
    await expect(
      modelsCommand({ configPath, setMain: "x", azure: true, bedrock: true }),
    ).rejects.toThrow(/Only one provider/);
    await expect(modelsCommand({ configPath, setResearch: "gpt-4.1-mini" })).rejects.toThrow(
      /not allowed/,
    );
  });

  it("sets and views response language", async () => {
    await expect(langCommand({ configPath })).resolves.toBe("Response language: English");
    await expect(langCommand({ configPath, response: "Spanish" })).resolves.toBe(
      "Response language: Spanish",
    );
  });
});

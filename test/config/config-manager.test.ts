import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  clearConfigCache,
  defaultConfig,
  getConfig,
  getConfigSection,
  substituteConfigTemplateTokens,
} from "../../src/config/config-manager.js";
import { resolveProjectConfigDir, resolveProjectConfigPath } from "../../src/config/paths.js";

describe("config manager", () => {
  let projectRoot: string;

  beforeEach(async () => {
    clearConfigCache();
    projectRoot = await mkdtemp(join(tmpdir(), "imperial-config-"));
  });

  it("returns defaults when config is missing", async () => {
    const warnings: string[] = [];

    await expect(
      getConfig({ projectRoot, warn: (message) => warnings.push(message) }),
    ).resolves.toEqual(defaultConfig);
    expect(warnings[0]).toMatch(/missing/);
  });

  it("deep-merges partial config over defaults", async () => {
    await writeConfig({
      project: { name: "Custom" },
      global: { responseLanguage: "Spanish" },
      models: {
        main: { temperature: 0.4 },
      },
    });

    const config = await getConfig({ projectRoot });

    expect(config.project.name).toBe("Custom");
    expect(config.project.version).toBe(defaultConfig.project.version);
    expect(config.global.responseLanguage).toBe("Spanish");
    expect(config.models.main.provider).toBe(defaultConfig.models.main.provider);
    expect(config.models.main.temperature).toBe(0.4);
  });

  it("falls back to defaults for corrupt config", async () => {
    const warnings: string[] = [];

    await mkdir(resolveProjectConfigDir({ projectRoot }), { recursive: true });
    await writeFile(resolveProjectConfigPath({ projectRoot }), "{", "utf8");

    await expect(
      getConfig({ projectRoot, warn: (message) => warnings.push(message) }),
    ).resolves.toEqual(defaultConfig);
    expect(warnings.join("\n")).toMatch(/parse/);
  });

  it("normalizes invalid providers", async () => {
    const warnings: string[] = [];

    await writeConfig({
      models: {
        main: { provider: "not-real" },
        fallback: { provider: "also-bad" },
      },
    });

    const config = await getConfig({ projectRoot, warn: (message) => warnings.push(message) });

    expect(config.models.main).toEqual(defaultConfig.models.main);
    expect(config.models.fallback.provider).toBeUndefined();
    expect(warnings.join("\n")).toMatch(/not supported/);
  });

  it("caches config until forced to reload", async () => {
    await writeConfig({ project: { name: "First" } });
    expect((await getConfig({ projectRoot })).project.name).toBe("First");

    await writeConfig({ project: { name: "Second" } });
    expect((await getConfig({ projectRoot })).project.name).toBe("First");
    expect((await getConfig({ projectRoot, forceReload: true })).project.name).toBe("Second");
  });

  it("exposes section getters and token substitution", async () => {
    await writeConfig({ project: { name: "{{ name }} {{ year }}" } });

    const project = await getConfigSection("project", {
      projectRoot,
      templateValues: { name: "Release", year: 2026 },
    });

    expect(project.name).toBe("Release 2026");
    expect(substituteConfigTemplateTokens("Copyright {{ year }}", { year: 2027 })).toBe(
      "Copyright 2027",
    );
  });

  async function writeConfig(config: unknown): Promise<void> {
    const configDir = resolveProjectConfigDir({ projectRoot });
    await mkdir(configDir, { recursive: true });
    await writeFile(resolveProjectConfigPath({ configDir }), JSON.stringify(config), "utf8");
  }
});

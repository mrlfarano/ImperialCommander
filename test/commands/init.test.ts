import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInitCommand } from "../../src/commands/init.js";
import { resolveProjectConfigDir, resolveProjectConfigPath } from "../../src/config/paths.js";
import { resolveRuntimeStatePath } from "../../src/config/paths.js";

describe("init command", () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "imperial-init-"));
  });

  it("creates the project configuration tree and templates", async () => {
    await runInitCommand({
      projectRoot,
      name: "Custom Project",
      description: "Custom description",
      now: new Date("2026-06-19T12:00:00.000Z"),
    });

    const configDir = resolveProjectConfigDir({ projectRoot });
    const config = JSON.parse(await readFile(resolveProjectConfigPath({ projectRoot }), "utf8"));
    const state = JSON.parse(await readFile(resolveRuntimeStatePath({ projectRoot }), "utf8"));

    expect(config.project.name).toBe("Custom Project");
    expect(config.project.description).toBe("Custom description");
    expect(state.currentTag).toBe("master");
    await expect(
      readFile(join(configDir, "templates", "spec-simple.md"), "utf8"),
    ).resolves.toContain("Project Specification");
    await expect(
      readFile(join(configDir, "templates", "spec-structured.md"), "utf8"),
    ).resolves.toContain("Product Requirements Document");
  });

  it("preserves existing files and writes a system readme when README exists", async () => {
    await writeFile(join(projectRoot, "README.md"), "# Existing\n", "utf8");
    await writeFile(join(projectRoot, ".env.example"), "EXISTING=1\n", "utf8");

    const result = await runInitCommand({ projectRoot });

    await expect(readFile(join(projectRoot, "README.md"), "utf8")).resolves.toBe("# Existing\n");
    await expect(readFile(join(projectRoot, ".env.example"), "utf8")).resolves.toBe("EXISTING=1\n");
    await expect(readFile(join(projectRoot, "IMPERIAL_COMMANDER.md"), "utf8")).resolves.toContain(
      "Imperial Commander",
    );
    expect(result.skipped).toContain(join(projectRoot, ".env.example"));
  });

  it("merges gitignore entries based on task VCS preference", async () => {
    await writeFile(join(projectRoot, ".gitignore"), "node_modules/\n", "utf8");

    await runInitCommand({ projectRoot, storeTasksInVcs: false });

    const gitignore = await readFile(join(projectRoot, ".gitignore"), "utf8");
    expect(gitignore).toContain("node_modules/");
    expect(gitignore).toContain("# Imperial Commander");
    expect(gitignore).toContain(".imperial-commander/tasks/");
  });

  it("is idempotent and does not overwrite config on rerun", async () => {
    await runInitCommand({ projectRoot, name: "First" });
    await runInitCommand({ projectRoot, name: "Second" });

    const config = JSON.parse(await readFile(resolveProjectConfigPath({ projectRoot }), "utf8"));
    expect(config.project.name).toBe("First");
  });

  it("dry-run reports actions without writing files", async () => {
    const result = await runInitCommand({ projectRoot, dryRun: true });

    await expect(readFile(resolveProjectConfigPath({ projectRoot }), "utf8")).rejects.toThrow();
    expect(result.actions.some((action) => action.includes("write file"))).toBe(true);
  });
});

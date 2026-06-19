import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authCommand } from "../../src/commands/auth.js";
import { autopilotCommand } from "../../src/commands/autopilot.js";
import { briefsCommand } from "../../src/commands/briefs.js";
import { contextCommand } from "../../src/commands/context.js";
import { deriveIterations, loopCommand } from "../../src/commands/loop.js";
import { tuiCommand } from "../../src/commands/tui.js";
import type { Task } from "../../src/schemas/index.js";
import { ApiTaskRepository, FileTaskRepository } from "../../src/storage/index.js";

describe("autonomy, cloud, and shell commands", () => {
  let root: string;
  let storePath: string;
  let previousCloudStateDir: string | undefined;
  let previousSandboxAuth: string | undefined;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "imperial-autonomy-cloud-"));
    storePath = join(root, "tasks.json");
    previousCloudStateDir = process.env.IMPERIAL_CLOUD_STATE_DIR;
    previousSandboxAuth = process.env.IMPERIAL_SANDBOX_AUTH;
    process.env.IMPERIAL_CLOUD_STATE_DIR = join(root, "cloud");

    const repository = new FileTaskRepository({ storePath });
    await repository.create(task(1, { priority: "high" }));
    await repository.create(task(2, { dependencies: [1] }));
  });

  afterEach(() => {
    if (previousCloudStateDir === undefined) {
      process.env.IMPERIAL_CLOUD_STATE_DIR = undefined;
    } else {
      process.env.IMPERIAL_CLOUD_STATE_DIR = previousCloudStateDir;
    }

    if (previousSandboxAuth === undefined) {
      process.env.IMPERIAL_SANDBOX_AUTH = undefined;
    } else {
      process.env.IMPERIAL_SANDBOX_AUTH = previousSandboxAuth;
    }
  });

  it("plans autopilot state and marks a task done when not dry-run", async () => {
    const stateFile = join(root, "state.json");
    await expect(autopilotCommand({ file: storePath, stateFile })).resolves.toContain(
      "Autopilot passed",
    );

    const repository = new FileTaskRepository({ storePath });
    await expect(repository.findById(1)).resolves.toMatchObject({ status: "done" });
    await expect(readFile(stateFile, "utf8")).resolves.toContain("feat(tasks): task 1");
  });

  it("derives loop iterations, writes progress, and enforces sandbox auth", async () => {
    expect(deriveIterations(undefined, "aggressive", 2)).toBe(2);
    await expect(
      loopCommand({ file: storePath, progressFile: join(root, "progress.log") }),
    ).resolves.toContain("Loop complete: 1/1");
    await expect(readFile(join(root, "progress.log"), "utf8")).resolves.toContain("iteration=1");
    await expect(loopCommand({ file: storePath, sandbox: true })).rejects.toThrow("Sandbox auth");
  });

  it("stores credentials outside project config and applies context org/brief rules", async () => {
    await expect(authCommand("status")).resolves.toBe("Not authenticated.");
    await expect(
      authCommand("login", { token: "secret", endpoint: "offline.test" }),
    ).resolves.toContain("offline.test");
    await expect(contextCommand("brief", { brief: "brief-1" })).rejects.toThrow("Select an org");
    await expect(contextCommand("org", { org: "org-1" })).resolves.toContain("Brief cleared");
    await expect(
      contextCommand("brief", { brief: "https://example.test/briefs/brief-2" }),
    ).resolves.toContain("brief-2");
    await expect(readFile(join(root, "cloud", "credentials.json"), "utf8")).resolves.toContain(
      "secret",
    );
  });

  it("requires auth and org for briefs and selects the current brief", async () => {
    await expect(briefsCommand("list")).rejects.toThrow("cloud auth");
    await authCommand("login", { token: "secret" });
    await expect(briefsCommand("list")).rejects.toThrow("active org");
    await contextCommand("org", { org: "org-1" });
    await expect(briefsCommand("list")).resolves.toContain("brief-1");
    await expect(briefsCommand("select", { id: "brief-2" })).resolves.toContain("brief-2");
    await expect(briefsCommand("list")).resolves.toContain("brief-2 *");
  });

  it("provides an offline api repository with string ids", async () => {
    const repository = new ApiTaskRepository({ storePath: join(root, "api.json") });
    const created = await repository.create(task(10));
    expect(created.id).toBe("10");
    await expect(repository.findById("10")).resolves.toMatchObject({ title: "Task 10" });
  });

  it("renders tui/repl fallback with auth awareness and non-interactive hint", async () => {
    await expect(tuiCommand({ interactive: false })).resolves.toContain("Non-interactive");
    await authCommand("login", { token: "secret", endpoint: "offline.test" });
    await expect(tuiCommand({ interactive: true })).resolves.toContain(
      "authenticated to offline.test",
    );
  });
});

function task(id: number, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: `Task ${id}`,
    description: "Description",
    details: "Details",
    testStrategy: "Test strategy",
    status: "pending",
    priority: "medium",
    dependencies: [],
    subtasks: [],
    ...overrides,
  };
}

import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInitCommand } from "../../src/commands/init.js";
import { syncCommand } from "../../src/commands/sync.js";
import { defaultConfig } from "../../src/config/config-manager.js";
import type { Task } from "../../src/schemas/index.js";
import { FileTaskRepository } from "../../src/storage/index.js";
import { flushHermesKanbanAutoSyncs } from "../../src/sync/auto-sync.js";
import { type SyncCommandRunner, runExternalSync } from "../../src/sync/sync.js";

describe("Hermes Kanban sync", () => {
  let root: string;
  let storePath: string;
  let repository: FileTaskRepository;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "imperial-hermes-kanban-"));
    storePath = join(root, "tasks.json");
    repository = new FileTaskRepository({ storePath });
    await repository.create(task(1, { status: "done" }));
    await repository.create(task(2, { dependencies: [1], priority: "high" }));
  });

  it("pushes open tasks to Hermes Kanban with idempotency keys and dependency links", async () => {
    const calls: string[][] = [];
    const commandRunner: SyncCommandRunner = async (command, args) => {
      calls.push([command, ...args]);
      const joined = args.join(" ");
      if (joined === "kanban boards list --json") {
        return result(JSON.stringify([]));
      }
      if (joined.startsWith("kanban boards create")) {
        return result("Created board\n");
      }
      if (joined === "kanban --board demo list --json --archived") {
        return result(JSON.stringify([]));
      }
      if (joined.includes("kanban --board demo create")) {
        const key = args[args.indexOf("--idempotency-key") + 1];
        const taskId = key.endsWith(":1") ? "t_one" : "t_two";
        return result(JSON.stringify({ id: taskId }));
      }
      if (joined === "kanban --board demo link t_one t_two") {
        return result("linked\n");
      }
      throw new Error(`unexpected command: ${command} ${joined}`);
    };

    const syncResult = await runExternalSync(repository, {
      provider: "hermes-kanban",
      projectRoot: root,
      tag: "master",
      board: "demo",
      scope: "all",
      dryRun: false,
      commandRunner,
    });

    expect(syncResult).toMatchObject({
      provider: "hermes-kanban",
      dryRun: false,
      pushed: 2,
      pulled: 0,
      linked: 1,
    });
    expect(calls.some((call) => call.join(" ").includes("kanban boards create demo"))).toBe(true);
    expect(calls.some((call) => call.includes("IC#1 — Task 1"))).toBe(true);
    expect(calls.some((call) => call.includes("IC#2 — Task 2"))).toBe(true);
    expect(calls.some((call) => call.includes(`imperial:${root}:master:2`))).toBe(true);
    expect(
      calls.some((call) => call.join(" ") === "hermes kanban --board demo link t_one t_two"),
    ).toBe(true);

    const mappings = JSON.parse(
      await readFile(join(root, ".imperial-commander", "sync-mappings.json"), "utf8"),
    );
    expect(mappings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: "hermes-kanban", taskId: "1", externalId: "t_one" }),
        expect.objectContaining({ provider: "hermes-kanban", taskId: "2", externalId: "t_two" }),
      ]),
    );
  });

  it("exposes Hermes Kanban through the sync command", async () => {
    const commandRunner: SyncCommandRunner = async (_command, args) => {
      const joined = args.join(" ");
      if (joined === "kanban boards list --json") {
        return result(JSON.stringify([{ slug: "demo" }]));
      }
      if (joined === "kanban --board demo list --json --archived") {
        return result(JSON.stringify([]));
      }
      if (joined.includes("kanban --board demo create")) {
        return result(
          JSON.stringify({
            id: `t_${args[args.indexOf("--idempotency-key") + 1].split(":").at(-1)}`,
          }),
        );
      }
      if (joined === "kanban --board demo link t_1 t_2") {
        return result("linked\n");
      }
      throw new Error(`unexpected command: ${joined}`);
    };

    const output = await syncCommand({
      file: storePath,
      provider: "hermes-kanban",
      projectRoot: root,
      board: "demo",
      scope: "all",
      write: true,
      json: true,
      commandRunner,
    });

    expect(output).toContain('"provider": "hermes-kanban"');
    expect(output).toContain('"linked": 1');
  });

  it("can initialize a project with Hermes Kanban auto-sync config", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "imperial-init-kanban-"));

    await runInitCommand({ projectRoot, name: "Demo App", hermesKanban: true });

    const config = JSON.parse(
      await readFile(join(projectRoot, ".imperial-commander", "config.json"), "utf8"),
    );
    expect(config.integrations.hermesKanban).toMatchObject({
      enabled: true,
      board: "demo-app",
      scope: "open",
      autoSync: true,
      assignee: null,
      goal: false,
    });
  });

  it("auto-syncs repository writes when project config enables Hermes Kanban", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "imperial-auto-kanban-"));
    const configDir = join(projectRoot, ".imperial-commander");
    const logPath = join(projectRoot, "hermes-calls.ndjson");
    const fakeHermes = join(projectRoot, "fake-hermes.mjs");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      join(configDir, "config.json"),
      `${JSON.stringify(
        {
          ...defaultConfig,
          integrations: {
            hermesKanban: {
              enabled: true,
              board: "auto-demo",
              scope: "open",
              autoSync: true,
              assignee: null,
              goal: false,
              hermesCommand: fakeHermes,
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      fakeHermes,
      `#!/usr/bin/env node\nimport { appendFileSync } from "node:fs";\nconst args = process.argv.slice(2);\nappendFileSync(${JSON.stringify(logPath)}, JSON.stringify(args) + "\\n");\nconst joined = args.join(" ");\nif (joined === "kanban boards list --json") console.log(JSON.stringify([{ slug: "auto-demo" }]));\nelse if (joined === "kanban --board auto-demo list --json --archived") console.log(JSON.stringify([]));\nelse if (joined.includes("kanban --board auto-demo create")) console.log(JSON.stringify({ id: "t_auto" }));\nelse console.log("ok");\n`,
      "utf8",
    );
    await chmod(fakeHermes, 0o755);

    const autoRepository = new FileTaskRepository({ projectRoot });
    await autoRepository.create(task(1));
    await flushHermesKanbanAutoSyncs();

    const log = await readFile(logPath, "utf8");
    expect(log).toContain("kanban");
    expect(log).toContain("auto-demo");
    expect(log).toContain("IC#1 — Task 1");
  });
});

function result(stdout: string, exitCode = 0) {
  return { exitCode, stdout, stderr: "" };
}

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

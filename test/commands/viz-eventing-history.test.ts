import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { boardCommand } from "../../src/commands/board.js";
import { historyCommand } from "../../src/commands/history.js";
import { notificationsCommand } from "../../src/commands/notifications.js";
import { roadmapCommand } from "../../src/commands/roadmap.js";
import { syncCommand } from "../../src/commands/sync.js";
import { undoCommand } from "../../src/commands/undo.js";
import { watchCommand } from "../../src/commands/watch.js";
import type { Task } from "../../src/schemas/index.js";
import { FileTaskRepository } from "../../src/storage/index.js";
import { updateTaskStatusFromVisualization } from "../../src/viz/server.js";

describe("visualization, eventing, history, and sync commands", () => {
  let dir: string;
  let storePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "imperial-viz-eventing-"));
    storePath = join(dir, "tasks.json");
    const repository = new FileTaskRepository({ storePath });
    await repository.create(task(1, { status: "done", metadata: { milestone: "Foundation" } }));
    await repository.create(task(2, { dependencies: [1], priority: "high" }));
  });

  it("builds board, graph, and roadmap command output", async () => {
    await expect(boardCommand({ file: storePath, view: "board" })).resolves.toContain("pending: 1");
    await expect(boardCommand({ file: storePath, view: "graph" })).resolves.toContain("Edges: 1");
    await expect(roadmapCommand({ file: storePath })).resolves.toContain("Foundation");
    await expect(roadmapCommand({ file: storePath })).resolves.toContain("Phase 2 (derived)");
  });

  it("records history and undoes the latest reversible write", async () => {
    const repository = new FileTaskRepository({ storePath });
    await repository.update(2, { status: "in-progress" });

    await expect(historyCommand({ file: storePath, id: "2" })).resolves.toContain("task.updated");
    await expect(undoCommand({ file: storePath })).resolves.toContain("Undid task.updated");

    await expect(repository.findById(2)).resolves.toMatchObject({ status: "pending" });
  });

  it("runs local notification and sync skeletons without external calls", async () => {
    const notificationPath = join(dir, "events.ndjson");
    await expect(
      notificationsCommand({ fileSink: notificationPath, type: "task.status-changed" }),
    ).resolves.toContain("1/1 sinks delivered");
    await expect(readFile(notificationPath, "utf8")).resolves.toContain("task.status-changed");

    await expect(
      syncCommand({ file: storePath, provider: "github", json: true }),
    ).resolves.toContain('"dryRun": true');
    await expect(
      syncCommand({ file: storePath, provider: "local", write: true, projectRoot: dir }),
    ).resolves.toContain("Synced 2 tasks");
  });

  it("refuses visualization writes in read-only mode", async () => {
    const repository = new FileTaskRepository({ storePath });
    const result = await updateTaskStatusFromVisualization(repository, {
      id: 2,
      status: "done",
      readOnly: true,
    });

    expect(result).toMatchObject({ ok: false, status: 403 });
    await expect(repository.findById(2)).resolves.toMatchObject({ status: "pending" });
  });

  it("can run a watch action once for automation", async () => {
    await expect(
      watchCommand({ file: storePath, onChange: "validate-deps", once: true }),
    ).resolves.toContain("ran 1 time");
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
});

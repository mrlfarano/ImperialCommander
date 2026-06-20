import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tableCommand, watchTaskTable } from "../../src/commands/table.js";
import type { Task } from "../../src/schemas/index.js";
import { FileTaskRepository } from "../../src/storage/index.js";

describe("table command", () => {
  let storePath: string;

  beforeEach(async () => {
    storePath = join(await mkdtemp(join(tmpdir(), "imperial-table-cmd-")), "tasks.json");
    const repository = new FileTaskRepository({ storePath });
    await repository.create(task(1, { status: "pending", priority: "high" }));
    await repository.create(task(2, { status: "done", priority: "low" }));
  });

  it("renders a no-color pretty table by default", async () => {
    const out = await tableCommand({ file: storePath, color: false });
    expect(out).toContain("TASKS · master");
    expect(out).toContain("Task 1");
    expect(out).not.toContain("\x1b");
  });

  it("emits json when requested", async () => {
    const out = await tableCommand({ file: storePath, format: "json" });
    expect(JSON.parse(out).footer.total).toBe(2);
  });

  it("rejects an invalid status filter", async () => {
    await expect(tableCommand({ file: storePath, status: "nope" })).rejects.toThrow(
      /Invalid --status/,
    );
  });

  it("rejects an invalid sort field", async () => {
    await expect(tableCommand({ file: storePath, sort: "nope" })).rejects.toThrow(/Invalid --sort/);
  });

  it("rejects an invalid format", async () => {
    await expect(tableCommand({ file: storePath, format: "xml" })).rejects.toThrow(
      /Invalid --format/,
    );
  });

  it("rejects --ready combined with --blocked", async () => {
    await expect(tableCommand({ file: storePath, ready: true, blocked: true })).rejects.toThrow(
      /--ready or --blocked/,
    );
  });

  it("rejects --json combined with a conflicting --format", async () => {
    await expect(tableCommand({ file: storePath, json: true, format: "csv" })).rejects.toThrow(
      /--json or --format/,
    );
  });

  it("watches the store and renders once in once-mode", async () => {
    const renders: string[] = [];
    await watchTaskTable(
      { file: storePath, color: false },
      { once: true, write: (text) => renders.push(text) },
    );
    expect(renders).toHaveLength(1);
    expect(renders[0]).toContain("TASKS · master");
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

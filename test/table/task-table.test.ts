import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Task } from "../../src/schemas/index.js";
import { FileTaskRepository } from "../../src/storage/index.js";
import { buildTaskTable } from "../../src/table/task-table.js";

describe("buildTaskTable", () => {
  let repository: FileTaskRepository;

  beforeEach(async () => {
    const storePath = join(await mkdtemp(join(tmpdir(), "imperial-table-")), "tasks.json");
    repository = new FileTaskRepository({ storePath });
    await repository.create(
      task(1, {
        status: "done",
        priority: "high",
        complexity: { score: 9, level: "high", recommendedSubtasks: 4, reasoning: "x" },
      }),
    );
    await repository.create(
      task(2, {
        status: "pending",
        priority: "high",
        dependencies: [1],
        complexity: { score: 4, level: "low", recommendedSubtasks: 2, reasoning: "y" },
        subtasks: [
          { id: 1, title: "a", description: "", details: "", status: "done", dependencies: [] },
          { id: 2, title: "b", description: "", details: "", status: "pending", dependencies: [] },
        ],
      }),
    );
    await repository.create(task(3, { status: "pending", priority: "low", dependencies: [2] }));
  });

  it("builds rows with readiness, subtask progress, and missing-complexity markers", async () => {
    const data = await buildTaskTable(repository, {});
    const row3 = data.rows.find((r) => r.id === "3");

    expect(data.rows).toHaveLength(3);
    expect(data.rows.find((r) => r.id === "2")).toMatchObject({
      ready: true,
      subtasksDone: 1,
      subtasksTotal: 2,
      complexityScore: 4,
    });
    expect(row3?.complexityScore).toBeUndefined();
    expect(row3?.ready).toBe(false);
    expect(row3?.blockedBy).toEqual(["2"]);
  });

  it("computes a tracking footer", async () => {
    const data = await buildTaskTable(repository, {});

    expect(data.footer).toMatchObject({
      total: 3,
      done: 1,
      percentDone: 33,
      ready: 1,
      blocked: 1,
    });
    expect(data.footer.byPriority).toMatchObject({ high: 2, low: 1 });
    expect(data.footer.byComplexity).toMatchObject({ high: 1, low: 1, unknown: 1 });
    expect(data.footer.avgComplexity).toBeCloseTo(6.5, 5);
    expect(data.footer.next?.id).toBe("2");
  });

  it("filters by min complexity and sorts by complexity desc", async () => {
    const data = await buildTaskTable(repository, { minComplexity: 5, sort: "complexity" });
    expect(data.rows.map((r) => r.id)).toEqual(["1"]);
  });

  it("groups rows when groupBy is provided", async () => {
    const data = await buildTaskTable(repository, { groupBy: "priority" });
    const high = data.groups?.find((g) => g.key === "high");
    expect(high?.count).toBe(2);
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

import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Task } from "../../src/schemas/index.js";
import { FileTaskRepository } from "../../src/storage/index.js";
import { moveTask } from "../../src/tasks/move.js";
import { buildScopedDetails, scopeTasks } from "../../src/tasks/scope.js";

describe("move and scope", () => {
  let repository: FileTaskRepository;

  beforeEach(async () => {
    const storePath = join(await mkdtemp(join(tmpdir(), "imperial-move-scope-")), "tasks.json");
    repository = new FileTaskRepository({ storePath });
    await repository.create(task(1));
    await repository.create(task(2));
    await repository.create(task(3));
  });

  it("reorders tasks within a tag", async () => {
    await moveTask(repository, { from: "3", beforeId: "1" });
    expect((await repository.findAll()).map((task) => task.id)).toEqual([3, 1, 2]);
  });

  it("moves tasks across tags and auto-creates the target tag", async () => {
    await moveTask(repository, { from: "2", toTag: "feature" });

    expect(await repository.listTags()).toContain("feature");
    expect((await repository.findAll({ tag: "feature" })).map((task) => task.id)).toEqual([2]);
  });

  it("rejects direct subtask cross-tag moves", async () => {
    await expect(moveTask(repository, { from: "1.1", toTag: "feature" })).rejects.toThrow(
      /Subtasks cannot/,
    );
  });

  it("scopes task details up and down", async () => {
    await scopeTasks(repository, "1", "up", { strength: "heavy", prompt: "more detail" });
    await expect(repository.findById(1)).resolves.toMatchObject({
      details: expect.stringContaining("Increase scope (heavy): more detail"),
    });
    expect(buildScopedDetails("", "down", "light")).toBe("Decrease scope (light)");
  });

  function task(id: number): Task {
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
    };
  }
});

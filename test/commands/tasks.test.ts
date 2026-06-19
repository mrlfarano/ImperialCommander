import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  listTasksCommand,
  nextTaskCommand,
  setStatusCommand,
  showTaskCommand,
} from "../../src/commands/tasks.js";
import type { Task } from "../../src/schemas/index.js";
import { FileTaskRepository } from "../../src/storage/index.js";

describe("task commands", () => {
  let storePath: string;

  beforeEach(async () => {
    storePath = join(await mkdtemp(join(tmpdir(), "imperial-task-commands-")), "tasks.json");
    const repository = new FileTaskRepository({ storePath });
    await repository.create(task(1, { status: "done" }));
    await repository.create(task(2, { dependencies: [1], priority: "high" }));
  });

  it("prints list and show output", async () => {
    await expect(listTasksCommand({ file: storePath })).resolves.toContain("2 [pending]");
    await expect(showTaskCommand("2", { file: storePath })).resolves.toContain("2: Task 2");
  });

  it("sets status and prints next task output", async () => {
    await expect(setStatusCommand("2", "in-progress", { file: storePath })).resolves.toContain(
      "in-progress",
    );
    await expect(nextTaskCommand({ file: storePath })).resolves.toContain("2: Task 2");
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

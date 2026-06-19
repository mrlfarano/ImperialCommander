import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addSubtaskCommand, clearSubtasksCommand } from "../../src/commands/subtasks.js";
import { updateTaskCommand } from "../../src/commands/update.js";
import type { Task } from "../../src/schemas/index.js";
import { FileTaskRepository } from "../../src/storage/index.js";

describe("update and subtask commands", () => {
  let storePath: string;

  beforeEach(async () => {
    storePath = join(await mkdtemp(join(tmpdir(), "imperial-update-command-")), "tasks.json");
    const repository = new FileTaskRepository({ storePath });
    await repository.create(task(1));
  });

  it("updates a task and manages subtasks", async () => {
    await expect(updateTaskCommand("1", { file: storePath, prompt: "Updated" })).resolves.toContain(
      "Updated task 1",
    );
    await expect(
      addSubtaskCommand({ file: storePath, parent: "1", title: "Child" }),
    ).resolves.toContain("Created subtask 1");
    await expect(clearSubtasksCommand({ file: storePath, ids: "1" })).resolves.toBe(
      "Cleared 1 subtasks.",
    );
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

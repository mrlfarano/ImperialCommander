import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { moveCommand } from "../../src/commands/move.js";
import { scopeCommand } from "../../src/commands/scope.js";
import type { Task } from "../../src/schemas/index.js";
import { FileTaskRepository } from "../../src/storage/index.js";

describe("move and scope commands", () => {
  let storePath: string;

  beforeEach(async () => {
    storePath = join(await mkdtemp(join(tmpdir(), "imperial-move-scope-command-")), "tasks.json");
    const repository = new FileTaskRepository({ storePath });
    await repository.create(task(1));
    await repository.create(task(2));
  });

  it("moves and scopes tasks", async () => {
    await expect(moveCommand({ file: storePath, from: "2", before: "1" })).resolves.toContain(
      "Moved task 2",
    );
    await expect(scopeCommand("up", { file: storePath, id: "1" })).resolves.toBe(
      "Scoped up 1 tasks.",
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

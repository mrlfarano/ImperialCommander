import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  addDependencyCommand,
  removeDependencyCommand,
  validateDependenciesCommand,
} from "../../src/commands/dependencies.js";
import type { Task } from "../../src/schemas/index.js";
import { FileTaskRepository } from "../../src/storage/index.js";

describe("dependency commands", () => {
  let storePath: string;

  beforeEach(async () => {
    storePath = join(await mkdtemp(join(tmpdir(), "imperial-dependency-commands-")), "tasks.json");
    const repository = new FileTaskRepository({ storePath });
    await repository.create(task(1));
    await repository.create(task(2));
  });

  it("adds, validates, and removes dependencies", async () => {
    await expect(addDependencyCommand("2", "1", { file: storePath })).resolves.toContain(
      "depends on 1",
    );
    await expect(validateDependenciesCommand({ file: storePath })).resolves.toBe(
      "Dependencies are valid.",
    );
    await expect(removeDependencyCommand("2", "1", { file: storePath })).resolves.toContain(
      "no longer depends on 1",
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

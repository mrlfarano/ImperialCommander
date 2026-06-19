import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Task } from "../../src/schemas/index.js";
import { FileTaskRepository } from "../../src/storage/index.js";
import { findNextTask, listTasks, setTaskStatus, showTask } from "../../src/tasks/lifecycle.js";

describe("task lifecycle", () => {
  let repository: FileTaskRepository;

  beforeEach(async () => {
    const storePath = join(await mkdtemp(join(tmpdir(), "imperial-lifecycle-")), "tasks.json");
    repository = new FileTaskRepository({ storePath });
    await repository.create(task(1, { status: "done", priority: "low" }));
    await repository.create(task(2, { dependencies: [1], priority: "high" }));
    await repository.create(task(4, { priority: "medium", status: "review" }));
    await repository.create(task(3, { dependencies: [4], priority: "high" }));
  });

  it("lists summary rows and shows task detail", async () => {
    expect(await listTasks(repository)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 2, title: "Task 2", dependencyCount: 1 }),
      ]),
    );
    await expect(showTask(repository, 2)).resolves.toMatchObject({ id: 2 });
  });

  it("sets valid task statuses", async () => {
    await expect(setTaskStatus(repository, 2, "in-progress")).resolves.toMatchObject({
      id: 2,
      status: "in-progress",
    });
  });

  it("selects the highest-priority unblocked pending task", async () => {
    await expect(findNextTask(repository)).resolves.toMatchObject({
      task: expect.objectContaining({ id: 2 }),
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
});

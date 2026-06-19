import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Task } from "../../src/schemas/index.js";
import { FileTaskRepository } from "../../src/storage/index.js";
import { addSubtask, clearSubtasks, removeSubtask, removeTasks } from "../../src/tasks/subtasks.js";
import { updateSubtask, updateTask, updateTasksFrom } from "../../src/tasks/update.js";

describe("task update and subtask management", () => {
  let repository: FileTaskRepository;

  beforeEach(async () => {
    const storePath = join(
      await mkdtemp(join(tmpdir(), "imperial-update-subtasks-")),
      "tasks.json",
    );
    repository = new FileTaskRepository({ storePath });
    await repository.create(task(1));
    await repository.create(task(2));
  });

  it("updates bulk tasks and replaces or appends task details", async () => {
    await expect(updateTasksFrom(repository, { prompt: "Bulk", fromId: 2 })).resolves.toHaveLength(
      1,
    );
    await expect(repository.findById(2)).resolves.toMatchObject({ details: "Bulk" });

    await updateTask(repository, 2, {
      prompt: "Append",
      append: true,
      now: new Date("2026-06-19T12:00:00.000Z"),
    });

    expect((await repository.findById(2))?.details).toContain("[2026-06-19T12:00:00.000Z] Append");
  });

  it("adds, updates, removes, and promotes subtasks", async () => {
    await addSubtask(repository, { parentId: 1, title: "Child" });
    await updateSubtask(repository, "1.1", {
      prompt: "Note",
      now: new Date("2026-06-19T12:00:00.000Z"),
    });

    expect((await repository.findById(1))?.subtasks[0].details).toContain("Note");

    await removeSubtask(repository, "1.1", { convert: true });

    expect((await repository.findById(1))?.subtasks).toHaveLength(0);
    expect((await repository.findAll()).map((task) => task.title)).toContain("Child");
  });

  it("converts existing tasks into subtasks", async () => {
    await addSubtask(repository, { parentId: 1, existingTaskId: 2 });

    expect(await repository.findById(2)).toBeUndefined();
    expect((await repository.findById(1))?.subtasks[0]).toMatchObject({
      title: "Task 2",
      metadata: { convertedFromTaskId: 2 },
    });
  });

  it("removes tasks with confirmation and clears subtasks", async () => {
    await addSubtask(repository, { parentId: 1, title: "Child" });

    await expect(removeTasks(repository, [2])).rejects.toThrow(/Confirmation/);
    await expect(removeTasks(repository, [2], { yes: true })).resolves.toBe(1);
    await expect(clearSubtasks(repository, { all: true })).resolves.toBe(1);
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

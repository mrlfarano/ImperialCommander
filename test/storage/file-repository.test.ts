import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Task } from "../../src/schemas/index.js";
import { createTaskRepository } from "../../src/storage/factory.js";
import {
  ApiTaskRepository,
  FileTaskRepository,
  TaskNotFoundError,
} from "../../src/storage/index.js";

describe("file task repository", () => {
  let storePath: string;
  let repository: FileTaskRepository;

  beforeEach(async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "imperial-repository-"));
    storePath = join(projectRoot, "tasks.json");
    repository = new FileTaskRepository({ storePath, currentTag: "master" });
  });

  it("creates, finds, updates, and deletes tasks in the active tag", async () => {
    await repository.create(task(1));

    await expect(repository.findAll()).resolves.toHaveLength(1);
    await expect(repository.findById(1)).resolves.toMatchObject({ title: "Task 1" });
    await expect(repository.update(1, { title: "Updated" })).resolves.toMatchObject({
      id: 1,
      title: "Updated",
    });
    await expect(repository.delete(1)).resolves.toBe(true);
    await expect(repository.findById(1)).resolves.toBeUndefined();
  });

  it("isolates tags and manages tag lifecycle", async () => {
    await repository.createTag("feature", { description: "Feature work" });
    await repository.create(task(1));
    await repository.create(task(2), { tag: "feature" });

    await expect(repository.listTags()).resolves.toEqual(["feature", "master"]);
    await expect(repository.findAll()).resolves.toHaveLength(1);
    await expect(repository.findAll({ tag: "feature" })).resolves.toHaveLength(1);
    await expect(repository.deleteTag("feature")).resolves.toBe(true);
    await expect(repository.deleteTag("feature")).resolves.toBe(false);
  });

  it("moves tasks within and across tags", async () => {
    await repository.create(task(1));
    await repository.create(task(2));
    await repository.move(2, { beforeId: 1 });

    expect((await repository.findAll()).map((storedTask) => storedTask.id)).toEqual([2, 1]);

    await repository.move(2, { tag: "feature" });

    expect((await repository.findAll()).map((storedTask) => storedTask.id)).toEqual([1]);
    expect(
      (await repository.findAll({ tag: "feature" })).map((storedTask) => storedTask.id),
    ).toEqual([2]);
  });

  it("throws for missing updates and selects repository backends", async () => {
    await expect(repository.update(999, { title: "Nope" })).rejects.toThrow(TaskNotFoundError);
    const apiRepository = createTaskRepository({
      backend: "api",
      api: { storePath: join(storePath, "..", "api.json") },
    });
    expect(apiRepository).toBeInstanceOf(ApiTaskRepository);
    await expect(apiRepository.create(task(1))).resolves.toMatchObject({ id: "1" });
    expect(createTaskRepository({ backend: "file", file: { storePath } })).toBeInstanceOf(
      FileTaskRepository,
    );
  });

  function task(id: Task["id"]): Task {
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

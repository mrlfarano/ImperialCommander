import type { Task } from "../../src/schemas/index.js";
import type { MoveTarget, RepositoryTagOptions, TaskRepository } from "../../src/storage/index.js";
import {
  addDependency,
  fixDependencies,
  removeDependency,
  validateDependencies,
} from "../../src/tasks/dependencies.js";

describe("task dependencies", () => {
  it("adds and removes dependencies", async () => {
    const repository = new MemoryRepository([task(1), task(2)]);

    await expect(addDependency(repository, 2, 1)).resolves.toMatchObject({
      id: 2,
      dependencies: [1],
    });
    await expect(removeDependency(repository, 2, 1)).resolves.toMatchObject({
      id: 2,
      dependencies: [],
    });
  });

  it("rejects self dependencies and missing dependency targets", async () => {
    const repository = new MemoryRepository([task(1)]);

    await expect(addDependency(repository, 1, 1)).rejects.toThrow(/cannot depend on itself/);
    await expect(addDependency(repository, 1, 999)).rejects.toThrow(/was not found/);
  });

  it("validates and fixes unknown and self dependencies", async () => {
    const repository = new MemoryRepository([
      task(1, { dependencies: [1, 999] }),
      task(2, { dependencies: [1] }),
    ]);

    await expect(validateDependencies(repository)).resolves.toEqual([
      { taskId: 1, dependencyId: 1, type: "self" },
      { taskId: 1, dependencyId: 999, type: "unknown" },
    ]);

    await fixDependencies(repository);

    await expect(repository.findById(1)).resolves.toMatchObject({ dependencies: [] });
    await expect(repository.findById(2)).resolves.toMatchObject({ dependencies: [1] });
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

class MemoryRepository implements TaskRepository {
  constructor(private tasks: Task[]) {}

  async findAll(): Promise<Task[]> {
    return this.tasks;
  }

  async findById(id: Task["id"]): Promise<Task | undefined> {
    return this.tasks.find((task) => String(task.id) === String(id));
  }

  async create(task: Task): Promise<Task> {
    this.tasks.push(task);
    return task;
  }

  async update(id: Task["id"], patch: Partial<Task>): Promise<Task> {
    const existing = await this.findById(id);

    if (!existing) {
      throw new Error("missing");
    }

    Object.assign(existing, patch, { id: existing.id });
    return existing;
  }

  async delete(id: Task["id"]): Promise<boolean> {
    const before = this.tasks.length;
    this.tasks = this.tasks.filter((task) => String(task.id) !== String(id));
    return this.tasks.length !== before;
  }

  async move(id: Task["id"], _target: MoveTarget, _options?: RepositoryTagOptions): Promise<Task> {
    const task = await this.findById(id);
    if (!task) {
      throw new Error("missing");
    }
    return task;
  }

  async listTags(): Promise<string[]> {
    return ["master"];
  }

  async createTag(): Promise<void> {}

  async deleteTag(): Promise<boolean> {
    return false;
  }
}

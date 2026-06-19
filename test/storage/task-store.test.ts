import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Task } from "../../src/schemas/index.js";
import {
  TaskStoreValidationError,
  allocateNextTaskId,
  createTaskTagStore,
  loadTaskStore,
  resolveTaskTag,
  saveTaskStore,
  saveTaskTag,
  validateTaskStore,
} from "../../src/storage/task-store.js";

describe("task store", () => {
  let projectRoot: string;
  let storePath: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "imperial-store-"));
    storePath = join(projectRoot, "tasks.json");
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("round-trips a tag while preserving untouched tags", async () => {
    const now = new Date("2026-06-19T12:00:00.000Z");

    await saveTaskStore(
      {
        master: createTaskTagStore([task(1)], { now, description: "Main" }),
        feature: createTaskTagStore([task(10)], { now, description: "Feature" }),
      },
      { storePath },
    );

    await saveTaskTag("master", [task(1), task(2, { dependencies: [1] })], {
      storePath,
      now: new Date("2026-06-19T13:00:00.000Z"),
    });

    const { store } = await loadTaskStore({ storePath });

    expect(store.master.tasks.map((storedTask) => storedTask.id)).toEqual([1, 2]);
    expect(store.feature.tasks.map((storedTask) => storedTask.id)).toEqual([10]);
  });

  it("loads corrupt JSON as an empty corrupt store and fresh save rewrites the file", async () => {
    await writeFile(storePath, "{", "utf8");

    await expect(loadTaskStore({ storePath })).resolves.toEqual({
      store: {},
      migrated: false,
      corrupt: true,
    });

    await saveTaskStore({ master: createTaskTagStore([task(1)]) }, { storePath });

    const persisted = JSON.parse(await readFile(storePath, "utf8"));
    expect(persisted.master.tasks).toHaveLength(1);
  });

  it("migrates a legacy single-list store under master", async () => {
    await writeFile(storePath, JSON.stringify([task(1)]), "utf8");

    const { store, migrated, corrupt } = await loadTaskStore({
      storePath,
      now: new Date("2026-06-19T12:00:00.000Z"),
    });

    expect(migrated).toBe(true);
    expect(corrupt).toBe(false);
    expect(store.master.tasks[0].id).toBe(1);
    expect(store.master.metadata.description).toMatch(/Migrated/);
  });

  it("validates duplicate ids, invalid ids, bad dependencies, and cycles", () => {
    expect(() =>
      validateTaskStore({
        master: createTaskTagStore([
          task(1, { dependencies: [2] }),
          task(1),
          task(2, { dependencies: [1] }),
        ]),
      }),
    ).toThrow(TaskStoreValidationError);

    expect(() => validateTaskStore({ master: createTaskTagStore([task(0)]) })).toThrow(
      TaskStoreValidationError,
    );

    expect(() =>
      validateTaskStore({
        master: createTaskTagStore([
          task(1, {
            subtasks: [subtask(1, { dependencies: [2] }), subtask(1)],
          }),
        ]),
      }),
    ).toThrow(TaskStoreValidationError);
  });

  it("rejects invalid task status during parse", async () => {
    await writeFile(
      storePath,
      JSON.stringify({
        master: createTaskTagStore([{ ...task(1), status: "completed" } as unknown as Task]),
      }),
      "utf8",
    );

    await expect(loadTaskStore({ storePath })).rejects.toThrow();
  });

  it("resolves tags and allocates next numeric task ids", () => {
    expect(resolveTaskTag({ explicitTag: " explicit ", currentTag: "current" })).toBe("explicit");
    expect(resolveTaskTag({ currentTag: "current" })).toBe("current");
    expect(resolveTaskTag()).toBe("master");
    expect(allocateNextTaskId([task(1), task(7), task("api-task")])).toBe(8);
  });

  function task(id: Task["id"], overrides: Partial<Task> = {}): Task {
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

  function subtask(
    id: Task["subtasks"][number]["id"],
    overrides: Partial<Task["subtasks"][number]> = {},
  ): Task["subtasks"][number] {
    return {
      id,
      title: `Subtask ${id}`,
      description: "Description",
      details: "Details",
      status: "pending",
      dependencies: [],
      ...overrides,
    };
  }
});

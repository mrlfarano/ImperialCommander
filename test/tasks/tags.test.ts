import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  addTagCommand,
  copyTagCommand,
  deleteTagCommand,
  listTagsCommand,
  renameTagCommand,
} from "../../src/commands/tags.js";
import type { Task } from "../../src/schemas/index.js";
import { getRuntimeState } from "../../src/state/runtime-state.js";
import { FileTaskRepository } from "../../src/storage/index.js";
import { addTag, branchNameToTag, listTagMetrics, useTag } from "../../src/tasks/tags.js";

describe("tags", () => {
  let root: string;
  let storePath: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "imperial-tags-"));
    storePath = join(root, "tasks.json");
    const repository = new FileTaskRepository({ storePath });
    await repository.create(task(1, { status: "done" }));
    await repository.create(task(2));
  });

  it("creates empty and copied tags with isolated tasks", async () => {
    await addTag("empty", { storePath, description: "Empty" });
    await addTag("copy", { storePath, copyFrom: "master", description: "Copy" });

    const emptyRepository = new FileTaskRepository({ storePath, currentTag: "empty" });
    const copyRepository = new FileTaskRepository({ storePath, currentTag: "copy" });

    expect(await emptyRepository.findAll()).toHaveLength(0);
    expect(await copyRepository.findAll()).toHaveLength(2);
    await copyRepository.update(2, { title: "Changed" });
    await expect(new FileTaskRepository({ storePath }).findById(2)).resolves.toMatchObject({
      title: "Task 2",
    });
  });

  it("lists metrics and derives branch tags", async () => {
    const metrics = await listTagMetrics({ storePath });
    expect(metrics[0]).toMatchObject({ tag: "master", taskCount: 2, completionPercent: 50 });
    expect(branchNameToTag("Feature/Add Auth")).toBe("feature-add-auth");
  });

  it("renames, copies, deletes, and switches tags through commands", async () => {
    await addTagCommand("feature", { file: storePath, copyFrom: "master" });
    await renameTagCommand("feature", "renamed", { file: storePath });
    await copyTagCommand("renamed", "copied", { file: storePath });
    await expect(deleteTagCommand("copied", { file: storePath })).rejects.toThrow(/Confirmation/);
    await expect(deleteTagCommand("copied", { file: storePath, yes: true })).resolves.toContain(
      "Deleted",
    );
    await expect(listTagsCommand({ file: storePath, showMetadata: true })).resolves.toContain(
      "renamed",
    );
    await useTag("renamed", { projectRoot: root });
    await expect(getRuntimeState({ projectRoot: root })).resolves.toMatchObject({
      currentTag: "renamed",
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

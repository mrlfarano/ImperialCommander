import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addTaskCommand } from "../../src/commands/add-task.js";
import { FileTaskRepository } from "../../src/storage/index.js";

describe("add-task command", () => {
  it("creates manual tasks in the selected file store", async () => {
    const storePath = join(
      await mkdtemp(join(tmpdir(), "imperial-add-task-command-")),
      "tasks.json",
    );

    await expect(
      addTaskCommand({
        file: storePath,
        title: "Manual",
        description: "Manual description",
      }),
    ).resolves.toContain("Created task 1");

    await expect(new FileTaskRepository({ storePath }).findById(1)).resolves.toMatchObject({
      title: "Manual",
    });
  });
});

import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TaskAssessor } from "../../src/analysis/assess.js";
import { addTaskCommand } from "../../src/commands/add-task.js";
import { FileTaskRepository } from "../../src/storage/index.js";

const assessor: TaskAssessor = async () => ({
  priority: "medium",
  complexityScore: 5,
  recommendedSubtasks: 3,
  reasoning: "assessed",
});

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
        assessor,
      }),
    ).resolves.toContain("Created task 1");

    await expect(new FileTaskRepository({ storePath }).findById(1)).resolves.toMatchObject({
      title: "Manual",
      complexity: { level: "medium" },
    });
  });
});

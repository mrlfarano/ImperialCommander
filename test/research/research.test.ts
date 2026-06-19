import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { researchCommand } from "../../src/commands/research.js";
import {
  gatherResearchContext,
  runResearch,
  stripInternalReasoning,
} from "../../src/research/research.js";
import type { Task } from "../../src/schemas/index.js";
import { FileTaskRepository } from "../../src/storage/index.js";

describe("research", () => {
  let root: string;
  let storePath: string;
  let repository: FileTaskRepository;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "imperial-research-"));
    storePath = join(root, "tasks.json");
    repository = new FileTaskRepository({ storePath });
    await repository.create(task(1));
    await repository.update(1, {
      subtasks: [
        {
          id: 1,
          title: "Child",
          description: "Child description",
          details: "Child details",
          status: "pending",
          dependencies: [],
        },
      ],
    });
  });

  it("gathers task, file, custom, and tree context", async () => {
    const contextPath = join(root, "context.md");
    await writeFile(contextPath, "File context", "utf8");

    const context = await gatherResearchContext(repository, {
      query: "query",
      ids: "1",
      files: contextPath,
      customContext: "Custom",
      includeTree: true,
    });

    expect(context.map((item) => item.source)).toEqual([
      "task:1",
      `file:${contextPath}`,
      "custom",
      "tree",
    ]);
  });

  it("strips internal reasoning and saves markdown", async () => {
    const result = await runResearch(repository, {
      query: "How to test?",
      saveFile: true,
      projectRoot: root,
      now: new Date("2026-06-19T12:00:00.000Z"),
      generator: async () => ({ text: "<reasoning>hidden</reasoning>\nVisible" }),
    });

    expect(result.result).toBe("Visible");
    expect(result.savedPath).toContain("2026-06-19_how-to-test.md");
    await expect(readFile(result.savedPath ?? "", "utf8")).resolves.toContain("Visible");
    expect(stripInternalReasoning("<reasoning>x</reasoning>y")).toBe("y");
  });

  it("saves research to tasks and subtasks", async () => {
    await runResearch(repository, {
      query: "Save task",
      saveTo: "1",
      now: new Date("2026-06-19T12:00:00.000Z"),
    });
    await runResearch(repository, {
      query: "Save subtask",
      saveTo: "1.1",
      now: new Date("2026-06-19T12:00:00.000Z"),
    });

    const updated = await repository.findById(1);
    expect(updated?.details).toContain("Research query: Save task");
    expect(updated?.subtasks[0].details).toContain("Research query: Save subtask");
  });

  it("supports command wrapper output", async () => {
    await expect(researchCommand("Query", { file: storePath, saveFile: false })).resolves.toContain(
      'Research (medium) for "Query"',
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

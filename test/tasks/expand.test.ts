import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expandAllCommand, expandCommand } from "../../src/commands/expand.js";
import { writeComplexityReport } from "../../src/complexity/report.js";
import type { Task } from "../../src/schemas/index.js";
import { FileTaskRepository } from "../../src/storage/index.js";
import { expandAllTasks, expandTask, resolveSubtaskCount } from "../../src/tasks/expand.js";

describe("task expansion", () => {
  let root: string;
  let storePath: string;
  let repository: FileTaskRepository;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "imperial-expand-"));
    storePath = join(root, "tasks.json");
    repository = new FileTaskRepository({ storePath });
    await repository.create(task(1));
    await repository.create(task(2, { status: "done" }));
  });

  it("resolves subtask count precedence", () => {
    expect(resolveSubtaskCount({ explicitNum: 2, reportRecommended: 5 })).toBe(2);
    expect(resolveSubtaskCount({ explicitNum: 0, reportRecommended: 5 })).toBe(3);
    expect(resolveSubtaskCount({ reportRecommended: 4 })).toBe(4);
    expect(resolveSubtaskCount({ defaultSubtasks: -1 })).toBe(3);
  });

  it("expands a task and skips existing subtasks unless forced", async () => {
    await expect(expandTask(repository, { id: 1, num: 2 })).resolves.toMatchObject({
      created: 2,
      skipped: false,
    });
    await expect(expandTask(repository, { id: 1, num: 2 })).resolves.toMatchObject({
      created: 0,
      skipped: true,
    });
    await expect(expandTask(repository, { id: 1, num: 1, force: true })).resolves.toMatchObject({
      created: 1,
      skipped: false,
    });
  });

  it("uses complexity report recommendations and reasoning", async () => {
    const reportPath = join(root, "complexity.json");
    await writeComplexityReport(
      {
        meta: {
          generatedAt: "2026-06-19T12:00:00.000Z",
          tasksAnalyzed: 1,
          totalTasks: 1,
          analysisCount: 1,
          thresholdScore: 5,
          projectName: "Test",
          usedResearch: false,
          tag: "master",
        },
        complexityAnalysis: [
          {
            taskId: 1,
            taskTitle: "Task 1",
            complexityScore: 8,
            recommendedSubtasks: 4,
            expansionPrompt: { text: "Use report prompt" },
            reasoning: "Report reasoning",
          },
        ],
      },
      { output: reportPath },
    );

    const result = await expandTask(repository, { id: 1, complexityReport: reportPath });

    expect(result.created).toBe(4);
    expect(result.task.subtasks[0].details).toContain("Report reasoning");
  });

  it("expands all pending tasks only", async () => {
    await expect(expandAllTasks(repository, { num: 1 })).resolves.toHaveLength(1);
  });

  it("supports command wrappers", async () => {
    await expect(expandCommand({ file: storePath, id: "1", num: 1 })).resolves.toContain(
      "Expanded task 1",
    );
    await expect(expandAllCommand({ file: storePath, force: true, num: 1 })).resolves.toContain(
      "Expanded 1 tasks",
    );
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

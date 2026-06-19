import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  analyzeComplexityCommand,
  complexityReportCommand,
} from "../../src/commands/complexity.js";
import { analyzeComplexity } from "../../src/complexity/analyze.js";
import {
  resolveComplexityReportPath,
  summarizeComplexityReport,
} from "../../src/complexity/report.js";
import type { Task } from "../../src/schemas/index.js";
import { FileTaskRepository } from "../../src/storage/index.js";

describe("complexity analysis", () => {
  let root: string;
  let storePath: string;
  let repository: FileTaskRepository;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "imperial-complexity-"));
    storePath = join(root, "tasks.json");
    repository = new FileTaskRepository({ storePath });
    await repository.create(task(1, { status: "done" }));
    await repository.create(task(2, { title: "Active medium task" }));
    await repository.create(task(3, { title: "Another active task" }));
    await repository.create(task(4, { status: "cancelled" }));
  });

  it("analyzes active tasks and writes a strict report", async () => {
    const output = join(root, "report.json");
    const result = await analyzeComplexity(repository, {
      output,
      threshold: 6,
      research: true,
      now: new Date("2026-06-19T12:00:00.000Z"),
    });

    expect(result.path).toBe(output);
    expect(result.report.meta).toMatchObject({
      tasksAnalyzed: 2,
      totalTasks: 4,
      thresholdScore: 6,
      usedResearch: true,
    });
    expect(result.report.complexityAnalysis.map((item) => item.taskId)).toEqual([2, 3]);
  });

  it("injects default analysis for omitted active tasks during partial re-analysis", async () => {
    const result = await analyzeComplexity(repository, { ids: "2", projectRoot: root });

    expect(result.report.complexityAnalysis.map((item) => item.taskId)).toEqual([2, 3]);
    expect(result.report.complexityAnalysis.find((item) => item.taskId === 3)?.reasoning).toMatch(
      /Default analysis/,
    );
  });

  it("uses tag-suffixed report paths and renders a report summary", async () => {
    expect(resolveComplexityReportPath({ projectRoot: root, tag: "feature/x" })).toContain(
      "complexity-report-feature-x.json",
    );

    const result = await analyzeComplexity(repository, {
      threshold: 5,
      tag: "master",
      projectRoot: root,
    });
    expect(summarizeComplexityReport(result.report)).toContain("Tasks Needing Expansion");
  });

  it("supports command wrappers", async () => {
    const output = join(root, "command-report.json");

    await expect(
      analyzeComplexityCommand({ file: storePath, output, threshold: 5 }),
    ).resolves.toContain("Wrote complexity report");
    await expect(complexityReportCommand({ output })).resolves.toContain("Complexity Report");
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

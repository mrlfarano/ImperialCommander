import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TaskAssessor } from "../../src/analysis/assess.js";
import { analyzeComplexityCommand } from "../../src/commands/complexity.js";
import { analyzeComplexity } from "../../src/complexity/analyze.js";
import type { Task } from "../../src/schemas/index.js";
import { FileTaskRepository } from "../../src/storage/index.js";

const assessor: TaskAssessor = async (input) => ({
  priority: "medium",
  complexityScore: input.title.includes("3") ? 9 : 4,
  recommendedSubtasks: 3,
  reasoning: "assessed",
});

describe("complexity analysis", () => {
  let root: string;
  let storePath: string;
  let repository: FileTaskRepository;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "imperial-complexity-"));
    storePath = join(root, "tasks.json");
    repository = new FileTaskRepository({ storePath });
    await repository.create(task(1, { status: "done" }));
    await repository.create(task(2, { title: "Active task 2" }));
    await repository.create(task(3, { title: "Active task 3" }));
    await repository.create(task(4, { status: "cancelled" }));
  });

  it("writes complexity back onto active tasks only", async () => {
    const result = await analyzeComplexity(repository, { assessor, threshold: 8 });

    expect(result.assessed).toBe(2);
    const tasks = await repository.findAll();
    expect(tasks.find((t) => t.id === 2)?.complexity).toMatchObject({ score: 4, level: "low" });
    expect(tasks.find((t) => t.id === 3)?.complexity).toMatchObject({ score: 9, level: "high" });
    expect(tasks.find((t) => t.id === 1)?.complexity).toBeUndefined();
    expect(tasks.find((t) => t.id === 4)?.complexity).toBeUndefined();
  });

  it("preserves existing priority when re-assessing", async () => {
    await repository.update(2, { priority: "high" });
    await analyzeComplexity(repository, { assessor });
    expect((await repository.findById(2))?.priority).toBe("high");
  });

  it("filters by id", async () => {
    const result = await analyzeComplexity(repository, { assessor, ids: "3" });
    expect(result.assessed).toBe(1);
    expect((await repository.findById(2))?.complexity).toBeUndefined();
    expect((await repository.findById(3))?.complexity?.level).toBe("high");
  });

  it("summarizes counts above the threshold via the command wrapper", async () => {
    const summary = await analyzeComplexityCommand({ file: storePath, assessor, threshold: 8 });
    expect(summary).toContain("Assessed 2 tasks");
    expect(summary).toContain("high 1");
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

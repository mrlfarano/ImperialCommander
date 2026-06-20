import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TaskAssessor } from "../../src/analysis/assess.js";
import { parseSpecCommand } from "../../src/commands/parse-spec.js";
import { parseSpecFile } from "../../src/spec/parse-spec.js";
import { FileTaskRepository } from "../../src/storage/index.js";

const assessor: TaskAssessor = async (input) => ({
  priority: input.title.includes("next") ? "high" : "medium",
  complexityScore: 6,
  recommendedSubtasks: 3,
  reasoning: "assessed",
});

describe("parse spec", () => {
  let root: string;
  let storePath: string;
  let specPath: string;
  let repository: FileTaskRepository;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "imperial-parse-spec-"));
    storePath = join(root, "tasks.json");
    specPath = join(root, "prd.md");
    repository = new FileTaskRepository({ storePath });
    await writeFile(
      specPath,
      `# Product

## Requirements
- Bootstrap a project
- Parse a spec
- Pick next task
`,
      "utf8",
    );
  });

  it("parses bullets into dependency-ordered, assessed tasks", async () => {
    const result = await parseSpecFile(repository, specPath, { assessor });
    const tasks = await repository.findAll();

    expect(result.tasks).toHaveLength(3);
    expect(tasks.map((task) => task.title)).toEqual([
      "Bootstrap a project",
      "Parse a spec",
      "Pick next task",
    ]);
    expect(tasks[1].dependencies).toEqual([1]);
    expect(tasks[2].priority).toBe("high");
    expect(tasks[0].complexity).toMatchObject({ score: 6, level: "medium" });
  });

  it("throws when no assessor is configured", async () => {
    await expect(parseSpecFile(repository, specPath)).rejects.toThrow(/requires an AI provider/);
  });

  it("guards existing task stores unless append or force is used", async () => {
    await parseSpecFile(repository, specPath, { numTasks: 1, assessor });

    await expect(parseSpecFile(repository, specPath, { assessor })).rejects.toThrow(
      /already contains/,
    );
    await expect(
      parseSpecFile(repository, specPath, { append: true, numTasks: 1, assessor }),
    ).resolves.toMatchObject({ appended: true });
  });

  it("overwrites existing tasks when forced", async () => {
    await parseSpecFile(repository, specPath, { numTasks: 2, assessor });

    const result = await parseSpecFile(repository, specPath, {
      force: true,
      numTasks: 1,
      assessor,
    });

    expect(result.overwritten).toBe(true);
    expect((await repository.findAll()).map((task) => task.id)).toEqual([1]);
  });

  it("prints command output", async () => {
    await expect(
      parseSpecCommand(specPath, { file: storePath, numTasks: 2, assessor }),
    ).resolves.toContain("created 2 tasks");
  });
});

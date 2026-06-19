import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseSpecCommand } from "../../src/commands/parse-spec.js";
import { parseSpecFile } from "../../src/spec/parse-spec.js";
import { FileTaskRepository } from "../../src/storage/index.js";

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

  it("parses requirement bullets into dependency-ordered tasks", async () => {
    const result = await parseSpecFile(repository, specPath);
    const tasks = await repository.findAll();

    expect(result.tasks).toHaveLength(3);
    expect(tasks.map((task) => task.title)).toEqual([
      "Bootstrap a project",
      "Parse a spec",
      "Pick next task",
    ]);
    expect(tasks[1].dependencies).toEqual([1]);
  });

  it("guards existing task stores unless append or force is used", async () => {
    await parseSpecFile(repository, specPath, { numTasks: 1 });

    await expect(parseSpecFile(repository, specPath)).rejects.toThrow(/already contains/);
    await expect(
      parseSpecFile(repository, specPath, { append: true, numTasks: 1 }),
    ).resolves.toMatchObject({
      appended: true,
    });
  });

  it("overwrites existing tasks when forced", async () => {
    await parseSpecFile(repository, specPath, { numTasks: 2 });

    const result = await parseSpecFile(repository, specPath, { force: true, numTasks: 1 });

    expect(result.overwritten).toBe(true);
    expect((await repository.findAll()).map((task) => task.id)).toEqual([1]);
  });

  it("prints command output", async () => {
    await expect(parseSpecCommand(specPath, { file: storePath, numTasks: 2 })).resolves.toContain(
      "created 2 tasks",
    );
  });
});

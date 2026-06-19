import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateCommand, syncReadmeCommand } from "../../src/commands/generate.js";
import type { Task } from "../../src/schemas/index.js";
import { FileTaskRepository } from "../../src/storage/index.js";
import { generateTaskFiles, syncReadme } from "../../src/tasks/generate.js";

describe("task file generation", () => {
  let root: string;
  let storePath: string;
  let repository: FileTaskRepository;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "imperial-generate-"));
    storePath = join(root, "tasks.json");
    repository = new FileTaskRepository({ storePath });
    await repository.create(task(1, { status: "done" }));
    await repository.create(task(2));
  });

  it("writes a single tasks.generated.yaml and removes legacy task files", async () => {
    const outputDir = join(root, "out");
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, "task_999.md"), "orphan", "utf8");

    const result = await generateTaskFiles(repository, { outputDir, tag: "master" });

    expect(result).toMatchObject({ tasks: 2, removed: 1, file: "tasks.generated.yaml" });
    const yaml = await readFile(join(outputDir, "tasks.generated.yaml"), "utf8");
    expect(yaml).toContain('tag: "master"');
    expect(yaml).toContain("- id: 1");
    expect(yaml).toContain('    title: "Task 1"');
  });

  it("generates the yaml export through the command wrapper", async () => {
    const outputDir = join(root, "yaml");

    await expect(generateCommand({ file: storePath, output: outputDir })).resolves.toContain(
      "tasks.generated.yaml",
    );
    await expect(readFile(join(outputDir, "tasks.generated.yaml"), "utf8")).resolves.toContain(
      "- id: 1",
    );
  });

  it("syncs readme with filters and subtasks", async () => {
    const readmePath = join(root, "README.md");
    await repository.update(2, {
      subtasks: [
        {
          id: 1,
          title: "Child",
          description: "",
          details: "",
          status: "pending",
          dependencies: [],
        },
      ],
    });

    await syncReadme(repository, readmePath, {
      withSubtasks: true,
      status: "pending",
    });

    const readme = await readFile(readmePath, "utf8");
    expect(readme).toContain("2 Task 2");
    expect(readme).not.toContain("1 Task 1");
    expect(readme).toContain("2.1 Child");
    await expect(syncReadmeCommand({ file: storePath, readme: readmePath })).resolves.toContain(
      "Synced",
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

import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CheckSpecStrictError, checkSpecCommand } from "../../src/commands/check-spec.js";
import { exportCommand } from "../../src/commands/export.js";
import { prdCommand } from "../../src/commands/prd.js";
import { searchCommand } from "../../src/commands/search.js";
import type { Task } from "../../src/schemas/index.js";
import { FileTaskRepository } from "../../src/storage/index.js";

describe("prd, check-spec, search, and export commands", () => {
  let projectRoot: string;
  let storePath: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "imperial-prd-search-export-"));
    storePath = join(projectRoot, "tasks.json");
  });

  it("builds a PRD from a batch answers file and preserves existing output files", async () => {
    const answersPath = join(projectRoot, "answers.json");
    const outputPath = join(projectRoot, "docs", "inventory-prd.md");
    await writeFile(
      answersPath,
      `${JSON.stringify({
        idea: "Build inventory planning",
        title: "Inventory Planning",
        template: "complex",
        answers: [
          { topic: "problem", answer: "Teams need better stock visibility." },
          { topic: "users", answer: "Operations managers." },
          { topic: "goals", answer: "Reduce stockouts." },
          { topic: "features", answer: "Forecast demand\nFlag low inventory" },
          { topic: "constraints", answer: "Use existing warehouse data." },
          { topic: "metrics", answer: "Stockout rate falls." },
        ],
      })}\n`,
      "utf8",
    );

    await expect(
      prdCommand({ answers: answersPath, output: outputPath, projectRoot }),
    ).resolves.toContain(outputPath);
    await expect(readFile(outputPath, "utf8")).resolves.toContain("## Functional Requirements");
    await expect(
      prdCommand({ answers: answersPath, output: outputPath, projectRoot }),
    ).rejects.toThrow("already exists");
  });

  it("checks spec readiness with injected scoring and writes a report", async () => {
    const specPath = join(projectRoot, "spec.md");
    const reportPath = join(projectRoot, "reports", "spec.md");
    await writeFile(specPath, "# Spec\n\n## Problem\nUseful.\n", "utf8");

    const output = await checkSpecCommand({
      input: specPath,
      threshold: 7,
      report: reportPath,
      scorer: async () => ({
        scores: {
          clarity: 8,
          completeness: 8,
          scopedness: 8,
          testability: 8,
          structure: 8,
        },
        overall: 8,
        verdict: "warn",
        gaps: [],
      }),
    });

    expect(output).toContain("Verdict: pass");
    await expect(readFile(reportPath, "utf8")).resolves.toContain("Overall: 8/10");
  });

  it("throws in strict mode when the readiness gate blocks", async () => {
    const specPath = join(projectRoot, "thin.md");
    await writeFile(specPath, "# Thin\n", "utf8");

    await expect(
      checkSpecCommand({
        input: specPath,
        threshold: 7,
        strict: true,
        scorer: async () => ({
          scores: {
            clarity: 2,
            completeness: 2,
            scopedness: 2,
            testability: 2,
            structure: 2,
          },
          overall: 2,
          verdict: "warn",
          gaps: [{ section: "Requirements", issue: "Too thin.", suggestion: "Add detail." }],
        }),
      }),
    ).rejects.toBeInstanceOf(CheckSpecStrictError);
  });

  it("searches text and filters readiness across tags", async () => {
    const repository = new FileTaskRepository({ storePath });
    await repository.create(task(1, { title: "Design API", status: "done" }));
    await repository.create(
      task(2, { title: "Build planner", dependencies: [1], priority: "high" }),
    );
    await repository.create(task(3, { title: "Blocked dashboard", dependencies: [2] }));
    await repository.create(task(1, { title: "Mobile planner" }), { tag: "mobile" });

    await expect(searchCommand({ file: storePath, query: "pln", ready: true })).resolves.toContain(
      "Build planner",
    );
    await expect(
      searchCommand({ file: storePath, query: "planner", allTags: true, sort: "title" }),
    ).resolves.toContain("Mobile planner");
    await expect(searchCommand({ file: storePath, blocked: true })).resolves.toContain(
      "Blocked dashboard",
    );
  });

  it("exports markdown, csv, json, and board reports", async () => {
    const repository = new FileTaskRepository({ storePath });
    await repository.create(task(1, { status: "done" }));
    await repository.create(task(2, { priority: "low", dependencies: [1] }));

    await expect(exportCommand({ file: storePath, format: "markdown" })).resolves.toContain(
      "## Progress",
    );
    await expect(exportCommand({ file: storePath, format: "csv" })).resolves.toContain(
      "tag,id,status",
    );
    await expect(exportCommand({ file: storePath, format: "board" })).resolves.toContain(
      "## pending",
    );

    const outputPath = join(projectRoot, "exports", "tasks.json");
    await expect(
      exportCommand({ file: storePath, format: "json", output: outputPath }),
    ).resolves.toContain(outputPath);
    await expect(readFile(outputPath, "utf8")).resolves.toContain('"completionPercent": 50');
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

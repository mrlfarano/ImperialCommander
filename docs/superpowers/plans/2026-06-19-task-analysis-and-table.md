# Embedded Task Analysis + `impcom table` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-assess priority + complexity on every task at creation time and store both on the task, then add a color-coded `impcom table` command with a tracking dashboard.

**Architecture:** Two injectable cores with thin command wrappers, matching existing patterns (`AddTaskGenerator` injection, `searchTasks` reuse). An **assessor core** (`src/analysis/assess.ts`) feeds priority/complexity into every creation path; a **table core** (`src/table/`) wraps `searchTasks` and renders. The AI assessor is *injected* (never instantiated in `src`); the MCP host wires the real one via sampling, tests inject fakes, and a missing assessor raises a clear `AssessmentRequiredError`.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers, Node ≥22), Zod, Commander, chalk, Vitest, Biome.

**Design spec:** `docs/superpowers/specs/2026-06-19-task-analysis-and-table-design.md`

---

## Conventions for every task

- **Run from repo root** `/Users/la/dev/ImperialCommander`.
- **Test runner:** `npm test` runs `vitest run` (globals enabled — `describe`/`it`/`expect`/`beforeEach` are global, no imports). Run a single file with `npx vitest run <path>`.
- **Typecheck:** `npm run typecheck` (`tsc --noEmit`). **Lint/format:** `npm run lint` (`biome check .`), `npm run format`.
- **Imports:** always use `.js` extensions on relative imports, even for `.ts` files.
- **Immutability:** never mutate inputs; build new objects with spread.
- **Commit trailer (REQUIRED):** every `git commit` message body must end with a final line:
  `Claude-Session: https://claude.ai/code/session_019kVb8if8RdKWWyaSDRhju5`
  The commit commands below show `-m "<subject>"`; append the trailer with a second `-m` line, e.g.
  `git commit -m "feat: …" -m "Claude-Session: https://claude.ai/code/session_019kVb8if8RdKWWyaSDRhju5"`.

## Intended behavior change (locked decision — do not soften)

Per the approved spec, **task creation requires an AI assessor**. After this plan:

- `add-task` (manual **and** `--prompt`) and `parse-spec` assess priority + complexity. Without an injected assessor they throw `AssessmentRequiredError`.
- The plain CLI does not wire a provider for these paths (same limitation that `add-task --prompt` already has today), so they error from a bare shell and succeed under the MCP host. This is the deliberate "AI required; error if no provider" decision.
- `analyze-complexity` is repurposed to re-assess and write `complexity` back onto tasks; the standalone `complexity-report*.json` artifact and the `complexity-report` command/tool are removed.

---

## File Structure

**Create**
- `src/analysis/assess.ts` — assessor types, raw schema, level derivation, `assessTask`/`assessMany`, `AssessmentRequiredError`.
- `src/tasks/yaml.ts` — minimal, safe YAML serializer for the `generate` export.
- `src/table/render-table.ts` — generic column renderer (pure, color-aware).
- `src/table/task-table.ts` — `buildTaskTable` → structured `TaskTableData` (rows + footer + groups).
- `src/table/format-table.ts` — pretty/json/csv/markdown formatters over `TaskTableData`.
- `src/commands/table.ts` — `tableCommand` wrapper + `watchTaskTable` loop.
- `test/analysis/assess.test.ts`, `test/tasks/yaml.test.ts`, `test/table/render-table.test.ts`, `test/table/task-table.test.ts`, `test/table/format-table.test.ts`, `test/commands/table.test.ts`.

**Modify**
- `src/schemas/task.ts` — `ComplexityLevel` + `TaskComplexity`, optional `complexity` on `Task`.
- `src/tasks/add-task.ts`, `src/commands/add-task.ts` — inject assessor; `--priority` overrides.
- `src/spec/parse-spec.ts`, `src/commands/parse-spec.ts` — inject assessor; assess seeds.
- `src/complexity/analyze.ts`, `src/commands/complexity.ts` — rewrite to re-assess + write back.
- `src/tasks/expand.ts` — read `task.complexity?.recommendedSubtasks`; drop report + `--complexity-report`.
- `src/tasks/generate.ts`, `src/commands/generate.ts` — single `tasks.generated.yaml`.
- `src/mcp-server/host-sampling.ts`, `src/mcp-server/tool-registry.ts`, `src/mcp-server/tool-loader.ts` — `createHostTaskAssessor`; wire it; drop `complexity-report`; add `table`.
- `src/cli/program.ts` — drop `complexity-report` + `--complexity-report` + `--priority` default + `--format` on generate; add `table`.
- `README.md` — document the new behavior + command.

**Delete**
- `src/complexity/report.ts` (after its importers are cut over).

**Update existing tests**
- `test/tasks/add-task.test.ts`, `test/commands/add-task.test.ts`, `test/spec/parse-spec.test.ts`, `test/complexity/analyze.test.ts`, `test/tasks/expand.test.ts`, `test/tasks/generate.test.ts`.

---

# Phase A — Schema + Assessor core

### Task 1: Add `TaskComplexity` to the schema

**Files:**
- Modify: `src/schemas/task.ts`
- Test: `test/schemas/task-complexity.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `test/schemas/task-complexity.test.ts`:

```ts
import { TaskComplexitySchema, TaskSchema } from "../../src/schemas/index.js";

describe("task complexity schema", () => {
  it("accepts a valid complexity object", () => {
    const parsed = TaskComplexitySchema.parse({
      score: 8,
      level: "high",
      recommendedSubtasks: 4,
      reasoning: "Touches auth + payments.",
    });
    expect(parsed.level).toBe("high");
  });

  it("rejects out-of-range scores", () => {
    expect(() =>
      TaskComplexitySchema.parse({
        score: 11,
        level: "high",
        recommendedSubtasks: 4,
        reasoning: "x",
      }),
    ).toThrow();
  });

  it("loads a legacy task with no complexity field (back-compat)", () => {
    const task = TaskSchema.parse({
      id: 1,
      title: "Legacy",
      description: "d",
      details: "",
      testStrategy: "",
      status: "pending",
      priority: "medium",
      dependencies: [],
      subtasks: [],
    });
    expect(task.complexity).toBeUndefined();
  });

  it("accepts a task with embedded complexity", () => {
    const task = TaskSchema.parse({
      id: 1,
      title: "Modern",
      description: "d",
      details: "",
      testStrategy: "",
      status: "pending",
      priority: "high",
      dependencies: [],
      subtasks: [],
      complexity: { score: 3, level: "low", recommendedSubtasks: 2, reasoning: "small" },
    });
    expect(task.complexity?.score).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/schemas/task-complexity.test.ts`
Expected: FAIL — `TaskComplexitySchema` is not exported.

- [ ] **Step 3: Implement the schema**

Edit `src/schemas/task.ts`. After the `TaskPrioritySchema` line, add:

```ts
export const ComplexityLevelSchema = z.enum(["low", "medium", "high"]);

export const TaskComplexitySchema = z.object({
  score: z.number().int().min(1).max(10),
  level: ComplexityLevelSchema,
  recommendedSubtasks: z.number().int().min(0).max(12),
  reasoning: z.string(),
});
```

In `TaskSchema`, add the optional field right after `subtasks`:

```ts
  subtasks: z.array(SubtaskSchema).default([]),
  complexity: TaskComplexitySchema.optional(),
  metadata: z.record(z.unknown()).optional(),
```

At the bottom with the other type exports, add:

```ts
export type ComplexityLevel = z.infer<typeof ComplexityLevelSchema>;
export type TaskComplexity = z.infer<typeof TaskComplexitySchema>;
```

`src/schemas/index.ts` already re-exports `./task.js`, so no change there.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/schemas/task-complexity.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/schemas/task.ts test/schemas/task-complexity.test.ts
git commit -m "feat: add TaskComplexity schema with optional task field"
```

---

### Task 2: Assessor core

**Files:**
- Create: `src/analysis/assess.ts`
- Test: `test/analysis/assess.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/analysis/assess.test.ts`:

```ts
import {
  AssessmentRequiredError,
  assessMany,
  assessTask,
  complexityLevelForScore,
  toAssessment,
} from "../../src/analysis/assess.js";

const input = { title: "t", description: "d", details: "x", dependencies: [] };

describe("assessor core", () => {
  it("derives complexity level from score thresholds", () => {
    expect(complexityLevelForScore(1)).toBe("low");
    expect(complexityLevelForScore(4)).toBe("low");
    expect(complexityLevelForScore(5)).toBe("medium");
    expect(complexityLevelForScore(7)).toBe("medium");
    expect(complexityLevelForScore(8)).toBe("high");
    expect(complexityLevelForScore(10)).toBe("high");
  });

  it("maps a raw assessment to a task assessment with derived level", () => {
    const assessment = toAssessment({
      priority: "high",
      complexityScore: 9,
      recommendedSubtasks: 5,
      reasoning: "big",
    });
    expect(assessment).toEqual({
      priority: "high",
      complexity: { score: 9, level: "high", recommendedSubtasks: 5, reasoning: "big" },
    });
  });

  it("assesses a task through an injected assessor", async () => {
    const assessment = await assessTask(
      async () => ({ priority: "low", complexityScore: 2, recommendedSubtasks: 1, reasoning: "tiny" }),
      input,
    );
    expect(assessment.priority).toBe("low");
    expect(assessment.complexity.level).toBe("low");
  });

  it("throws AssessmentRequiredError when no assessor is supplied", async () => {
    await expect(assessTask(undefined, input)).rejects.toBeInstanceOf(AssessmentRequiredError);
  });

  it("assesses many inputs in order", async () => {
    const assessor = async (i: typeof input) => ({
      priority: "medium" as const,
      complexityScore: i.title.length,
      recommendedSubtasks: 0,
      reasoning: "len",
    });
    const results = await assessMany(assessor, [
      { ...input, title: "ab" },
      { ...input, title: "abcde" },
    ]);
    expect(results.map((r) => r.complexity.score)).toEqual([2, 5]);
  });

  it("does not require an assessor for an empty batch", async () => {
    await expect(assessMany(undefined, [])).resolves.toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/analysis/assess.test.ts`
Expected: FAIL — cannot find module `src/analysis/assess.js`.

- [ ] **Step 3: Implement the assessor core**

Create `src/analysis/assess.ts`:

```ts
import { z } from "zod";
import type { TaskEntityId } from "../schemas/index.js";
import {
  type ComplexityLevel,
  type TaskComplexity,
  type TaskPriority,
  TaskPrioritySchema,
} from "../schemas/index.js";

export interface TaskAssessmentInput {
  title: string;
  description: string;
  details: string;
  dependencies: TaskEntityId[];
}

export const rawAssessmentSchema = z
  .object({
    priority: TaskPrioritySchema,
    complexityScore: z.number().int().min(1).max(10),
    recommendedSubtasks: z.number().int().min(0).max(12),
    reasoning: z.string(),
  })
  .strict();

export type RawAssessment = z.infer<typeof rawAssessmentSchema>;

/** Injected boundary: returns the model's raw scores; pure code derives `level`. */
export type TaskAssessor = (input: TaskAssessmentInput) => Promise<RawAssessment>;

export interface TaskAssessment {
  priority: TaskPriority;
  complexity: TaskComplexity;
}

export class AssessmentRequiredError extends Error {
  constructor() {
    super(
      "Task creation requires an AI provider to assess priority and complexity. " +
        "Configure one with `impcom models`, or run inside the MCP host.",
    );
    this.name = "AssessmentRequiredError";
  }
}

export function complexityLevelForScore(score: number): ComplexityLevel {
  if (score < 5) {
    return "low";
  }
  if (score < 8) {
    return "medium";
  }
  return "high";
}

export function toAssessment(raw: RawAssessment): TaskAssessment {
  return {
    priority: raw.priority,
    complexity: {
      score: raw.complexityScore,
      level: complexityLevelForScore(raw.complexityScore),
      recommendedSubtasks: raw.recommendedSubtasks,
      reasoning: raw.reasoning,
    },
  };
}

export async function assessTask(
  assessor: TaskAssessor | undefined,
  input: TaskAssessmentInput,
): Promise<TaskAssessment> {
  if (!assessor) {
    throw new AssessmentRequiredError();
  }
  return toAssessment(await assessor(input));
}

export async function assessMany(
  assessor: TaskAssessor | undefined,
  inputs: TaskAssessmentInput[],
): Promise<TaskAssessment[]> {
  const assessments: TaskAssessment[] = [];
  for (const input of inputs) {
    assessments.push(await assessTask(assessor, input));
  }
  return assessments;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/analysis/assess.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/analysis/assess.ts test/analysis/assess.test.ts
git commit -m "feat: add injectable task assessor core"
```

---

# Phase B — Wire assessment into creation paths

### Task 3: Assess in `add-task` (manual + prompt), `--priority` overrides

**Files:**
- Modify: `src/tasks/add-task.ts`
- Modify: `src/commands/add-task.ts`
- Modify: `src/cli/program.ts` (remove the `--priority` default)
- Test: `test/tasks/add-task.test.ts` (rewrite), `test/commands/add-task.test.ts` (update)

- [ ] **Step 1: Update the failing tests**

Replace `test/tasks/add-task.test.ts` with:

```ts
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TaskAssessor } from "../../src/analysis/assess.js";
import { FileTaskRepository } from "../../src/storage/index.js";
import { addTask } from "../../src/tasks/add-task.js";

const assessor: TaskAssessor = async () => ({
  priority: "low",
  complexityScore: 3,
  recommendedSubtasks: 2,
  reasoning: "assessed",
});

describe("add task", () => {
  let repository: FileTaskRepository;

  beforeEach(async () => {
    const storePath = join(await mkdtemp(join(tmpdir(), "imperial-add-task-")), "tasks.json");
    repository = new FileTaskRepository({ storePath });
  });

  it("assesses priority and complexity for manual tasks", async () => {
    const result = await addTask(repository, {
      title: "First",
      description: "One",
      assessor,
    });

    expect(result.task).toMatchObject({
      id: 1,
      priority: "low",
      complexity: { score: 3, level: "low", recommendedSubtasks: 2 },
    });
  });

  it("lets an explicit --priority override the assessed priority", async () => {
    const result = await addTask(repository, {
      title: "Second",
      description: "Two",
      dependencies: "1",
      priority: "high",
      assessor,
    });

    expect(result.task).toMatchObject({ priority: "high", dependencies: [1] });
    expect(result.task.complexity?.level).toBe("low");
  });

  it("throws when no assessor is configured", async () => {
    await expect(addTask(repository, { title: "X", description: "Y" })).rejects.toThrow(
      /requires an AI provider/,
    );
  });

  it("requires manual title and description when no prompt is supplied", async () => {
    await expect(addTask(repository, { title: "Missing", assessor })).rejects.toThrow(
      /title and description/,
    );
  });

  it("assesses AI-generated tasks and returns telemetry", async () => {
    const result = await addTask(repository, {
      prompt: "Build auth",
      research: true,
      assessor,
      aiGenerator: async ({ prompt, nextId }) => ({
        task: {
          title: `${prompt} ${nextId}`,
          description: "Generated",
          details: "Generated details",
          testStrategy: "Generated tests",
          priority: "medium",
          dependencies: [],
        },
        telemetryData: {
          timestamp: "2026-06-19T12:00:00.000Z",
          commandName: "add-task",
          modelUsed: "test",
          providerName: "test",
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
          totalCost: 0,
          currency: "USD",
        },
      }),
    });

    expect(result.task.title).toBe("Build auth 1");
    expect(result.task.priority).toBe("low"); // assessment wins over generator's "medium"
    expect(result.task.complexity?.score).toBe(3);
    expect(result.telemetryData?.totalTokens).toBe(2);
  });
});
```

Update `test/commands/add-task.test.ts` to inject an assessor (replace the `addTaskCommand({...})` call body):

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/tasks/add-task.test.ts test/commands/add-task.test.ts`
Expected: FAIL — `assessor` is not an accepted option / `complexity` undefined.

- [ ] **Step 3: Implement the wiring**

Edit `src/tasks/add-task.ts`. Add the import at the top:

```ts
import { type TaskAssessor, assessTask } from "../analysis/assess.js";
```

Add `assessor` to `AddTaskOptions`:

```ts
export interface AddTaskOptions {
  title?: string;
  description?: string;
  details?: string;
  testStrategy?: string;
  dependencies?: string;
  priority?: Task["priority"];
  prompt?: string;
  research?: boolean;
  tag?: string;
  aiGenerator?: AddTaskGenerator;
  assessor?: TaskAssessor;
}
```

Replace the body of `addTask` (lines 33–73) with:

```ts
export async function addTask(
  repository: TaskRepository,
  options: AddTaskOptions,
): Promise<AddTaskResult> {
  const existing = await repository.findAll({ tag: options.tag });
  const id = nextTaskId(existing);

  if (options.prompt) {
    if (!options.aiGenerator) {
      throw new Error("AI task generation is not configured. Provide title and description.");
    }

    const generated = await options.aiGenerator({
      prompt: options.prompt,
      research: options.research === true,
      nextId: id,
    });
    const base = normalizeTask(id, generated.task);
    const task = await applyAssessment(base, options);
    await repository.create(task, { tag: options.tag });
    return { task, telemetryData: generated.telemetryData };
  }

  if (!options.title || !options.description) {
    throw new Error("Provide both title and description, or provide a prompt for AI generation.");
  }

  const base: Task = {
    id,
    title: options.title,
    description: options.description,
    details: options.details ?? "",
    testStrategy: options.testStrategy ?? "",
    status: "pending",
    priority: options.priority ?? "medium",
    dependencies: parseCsvIds(options.dependencies),
    subtasks: [],
  };

  const task = await applyAssessment(base, options);
  await repository.create(task, { tag: options.tag });
  return { task };
}

async function applyAssessment(base: Task, options: AddTaskOptions): Promise<Task> {
  const assessment = await assessTask(options.assessor, {
    title: base.title,
    description: base.description,
    details: base.details,
    dependencies: base.dependencies,
  });

  return {
    ...base,
    priority: options.priority ?? assessment.priority,
    complexity: assessment.complexity,
  };
}
```

Leave `normalizeTask` as-is (it still produces a valid base task).

Edit `src/commands/add-task.ts` — add `assessor` to `AddTaskCommandOptions`:

```ts
import { FileTaskRepository } from "../storage/index.js";
import { type AddTaskGenerator, addTask } from "../tasks/add-task.js";
import type { TaskAssessor } from "../analysis/assess.js";
import type { TaskCommandOptions } from "./tasks.js";

export interface AddTaskCommandOptions extends TaskCommandOptions {
  title?: string;
  description?: string;
  details?: string;
  testStrategy?: string;
  dependencies?: string;
  priority?: "high" | "medium" | "low";
  prompt?: string;
  research?: boolean;
  aiGenerator?: AddTaskGenerator;
  assessor?: TaskAssessor;
}
```

(`addTaskCommand` already passes `options` straight into `addTask`, so `assessor` flows through unchanged.)

Edit `src/cli/program.ts` — remove the `"medium"` default on the `add-task` `--priority` option so an omitted flag stays `undefined` (assessment then wins). Change line 686 from:

```ts
    .option("--priority <priority>", "Task priority", "medium")
```

to:

```ts
    .option("--priority <priority>", "Override the assessed priority (high, medium, low)")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/tasks/add-task.test.ts test/commands/add-task.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tasks/add-task.ts src/commands/add-task.ts src/cli/program.ts test/tasks/add-task.test.ts test/commands/add-task.test.ts
git commit -m "feat: assess priority and complexity in add-task"
```

---

### Task 4: Assess seeds in `parse-spec`

**Files:**
- Modify: `src/spec/parse-spec.ts`
- Modify: `src/commands/parse-spec.ts`
- Test: `test/spec/parse-spec.test.ts` (update)

- [ ] **Step 1: Update the failing test**

Replace `test/spec/parse-spec.test.ts` with:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/spec/parse-spec.test.ts`
Expected: FAIL — `assessor` not accepted; no assessment applied.

- [ ] **Step 3: Implement the wiring**

Edit `src/spec/parse-spec.ts`. Add the import:

```ts
import { type TaskAssessor, assessMany } from "../analysis/assess.js";
```

Add `assessor` to `ParseSpecOptions`:

```ts
export interface ParseSpecOptions {
  append?: boolean;
  force?: boolean;
  numTasks?: number;
  tag?: string;
  assessor?: TaskAssessor;
}
```

Replace the generation block in `parseSpecText` (the `const generated = ...` line) with seed-build + assess + merge:

```ts
  const nextId = options.force && !options.append ? 1 : nextNumericId(existing);
  const seeds = extractTaskSeeds(contents)
    .slice(0, options.numTasks)
    .map((seed, index) => taskFromSeed(nextId + index, seed));
  const assessments = await assessMany(
    options.assessor,
    seeds.map((task) => ({
      title: task.title,
      description: task.description,
      details: task.details,
      dependencies: task.dependencies,
    })),
  );
  const generated = seeds.map((task, index) => ({
    ...task,
    priority: assessments[index].priority,
    complexity: assessments[index].complexity,
  }));
```

(`taskFromSeed` keeps its placeholder `priority: "medium"`; the assessment overwrites it.)

Edit `src/commands/parse-spec.ts` to accept and forward `assessor`:

```ts
import { parseSpecFile } from "../spec/parse-spec.js";
import type { TaskAssessor } from "../analysis/assess.js";
import { FileTaskRepository } from "../storage/index.js";
import type { TaskCommandOptions } from "./tasks.js";

export interface ParseSpecCommandOptions extends TaskCommandOptions {
  append?: boolean;
  force?: boolean;
  numTasks?: number;
  assessor?: TaskAssessor;
}

export async function parseSpecCommand(
  filePath: string,
  options: ParseSpecCommandOptions = {},
): Promise<string> {
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const result = await parseSpecFile(repository, filePath, {
    append: options.append,
    force: options.force,
    numTasks: options.numTasks,
    tag: options.tag,
    assessor: options.assessor,
  });

  const mode = result.overwritten ? "overwrote" : result.appended ? "appended" : "created";
  return `${mode} ${result.tasks.length} tasks from ${filePath}.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/spec/parse-spec.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/spec/parse-spec.ts src/commands/parse-spec.ts test/spec/parse-spec.test.ts
git commit -m "feat: assess priority and complexity in parse-spec"
```

---

# Phase C — Complexity repurpose + expand

### Task 5: Rewrite `analyze-complexity` to re-assess and write back

**Files:**
- Rewrite: `src/complexity/analyze.ts`
- Rewrite: `src/commands/complexity.ts` (drop `complexityReportCommand`)
- Test: `test/complexity/analyze.test.ts` (rewrite)

- [ ] **Step 1: Write the failing test**

Replace `test/complexity/analyze.test.ts` with:

```ts
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
    // done/cancelled tasks are left untouched
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/complexity/analyze.test.ts`
Expected: FAIL — new signature/behavior not present.

- [ ] **Step 3: Rewrite `src/complexity/analyze.ts`**

Replace the entire file with:

```ts
import { type TaskAssessor, assessTask } from "../analysis/assess.js";
import type { ComplexityLevel, Task } from "../schemas/index.js";
import type { TaskRepository } from "../storage/index.js";
import { parseCsvIds } from "../tasks/ids.js";

export interface AnalyzeComplexityOptions {
  ids?: string;
  from?: number;
  to?: number;
  threshold?: number;
  tag?: string;
  assessor?: TaskAssessor;
}

export interface AnalyzeComplexityResult {
  assessed: number;
  summary: string;
  tasks: Task[];
}

const activeStatuses = new Set(["pending", "in-progress", "review"]);

export async function analyzeComplexity(
  repository: TaskRepository,
  options: AnalyzeComplexityOptions = {},
): Promise<AnalyzeComplexityResult> {
  const allTasks = await repository.findAll({ tag: options.tag });
  const targets = filterTasks(allTasks, options);
  const updated: Task[] = [];

  for (const target of targets) {
    const assessment = await assessTask(options.assessor, {
      title: target.title,
      description: target.description,
      details: target.details,
      dependencies: target.dependencies,
    });
    updated.push(
      await repository.update(
        target.id,
        { complexity: assessment.complexity },
        { tag: options.tag },
      ),
    );
  }

  return {
    assessed: updated.length,
    summary: summarize(updated, normalizeThreshold(options.threshold)),
    tasks: updated,
  };
}

function filterTasks(tasks: Task[], options: AnalyzeComplexityOptions): Task[] {
  const ids = new Set(parseCsvIds(options.ids).map(String));

  return tasks.filter((task) => {
    if (!activeStatuses.has(task.status)) {
      return false;
    }
    if (ids.size > 0 && !ids.has(String(task.id))) {
      return false;
    }
    if (typeof task.id === "number") {
      if (options.from !== undefined && task.id < options.from) {
        return false;
      }
      if (options.to !== undefined && task.id > options.to) {
        return false;
      }
    }
    return true;
  });
}

function summarize(tasks: Task[], threshold: number): string {
  if (tasks.length === 0) {
    return "No matching active tasks found.";
  }

  const counts: Record<ComplexityLevel, number> = { low: 0, medium: 0, high: 0 };
  let scoreSum = 0;
  let needsExpansion = 0;

  for (const task of tasks) {
    if (!task.complexity) {
      continue;
    }
    counts[task.complexity.level] += 1;
    scoreSum += task.complexity.score;
    if (task.complexity.score >= threshold) {
      needsExpansion += 1;
    }
  }

  const avg = (scoreSum / tasks.length).toFixed(1);

  return [
    `Assessed ${tasks.length} tasks (avg complexity ${avg}).`,
    `By level: high ${counts.high} · medium ${counts.medium} · low ${counts.low}.`,
    `${needsExpansion} task(s) at or above threshold ${threshold} — consider \`impcom expand\`.`,
  ].join("\n");
}

function normalizeThreshold(threshold: number | undefined): number {
  if (!threshold || !Number.isInteger(threshold) || threshold < 1 || threshold > 10) {
    return 5;
  }
  return threshold;
}
```

- [ ] **Step 4: Rewrite `src/commands/complexity.ts`**

Replace the entire file with (drops `complexityReportCommand`):

```ts
import type { TaskAssessor } from "../analysis/assess.js";
import { analyzeComplexity } from "../complexity/analyze.js";
import { FileTaskRepository } from "../storage/index.js";
import type { TaskCommandOptions } from "./tasks.js";

export interface AnalyzeComplexityCommandOptions extends TaskCommandOptions {
  threshold?: number;
  id?: string;
  from?: number;
  to?: number;
  assessor?: TaskAssessor;
}

export async function analyzeComplexityCommand(
  options: AnalyzeComplexityCommandOptions = {},
): Promise<string> {
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const result = await analyzeComplexity(repository, {
    threshold: options.threshold,
    ids: options.id,
    from: options.from,
    to: options.to,
    tag: options.tag,
    assessor: options.assessor,
  });

  return result.summary;
}
```

> Note: `src/complexity/report.ts` is still imported elsewhere (expand) at this point — do **not** delete it yet (Task 7).

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/complexity/analyze.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/complexity/analyze.ts src/commands/complexity.ts test/complexity/analyze.test.ts
git commit -m "feat: repurpose analyze-complexity to write complexity onto tasks"
```

---

### Task 6: `expand` reads embedded complexity (drop the report)

**Files:**
- Modify: `src/tasks/expand.ts`
- Test: `test/tasks/expand.test.ts` (update)

- [ ] **Step 1: Update the failing test**

Replace `test/tasks/expand.test.ts` with:

```ts
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expandAllCommand, expandCommand } from "../../src/commands/expand.js";
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
    expect(resolveSubtaskCount({ explicitNum: 2, recommendedSubtasks: 5 })).toBe(2);
    expect(resolveSubtaskCount({ explicitNum: 0, recommendedSubtasks: 5 })).toBe(3);
    expect(resolveSubtaskCount({ recommendedSubtasks: 4 })).toBe(4);
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

  it("uses embedded complexity recommendations and reasoning", async () => {
    await repository.update(1, {
      complexity: { score: 8, level: "high", recommendedSubtasks: 4, reasoning: "Embedded reasoning" },
    });

    const result = await expandTask(repository, { id: 1 });

    expect(result.created).toBe(4);
    expect(result.task.subtasks[0].details).toContain("Embedded reasoning");
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/tasks/expand.test.ts`
Expected: FAIL — `recommendedSubtasks` param + embedded-complexity behavior not present.

- [ ] **Step 3: Implement**

Replace the entire `src/tasks/expand.ts` with:

```ts
import type { Subtask, Task } from "../schemas/index.js";
import type { TaskRepository } from "../storage/index.js";

export interface ExpandOptions {
  id: Task["id"];
  num?: number;
  prompt?: string;
  force?: boolean;
  defaultSubtasks?: number;
  tag?: string;
}

export interface ExpandAllOptions extends Omit<ExpandOptions, "id"> {
  all?: boolean;
}

export interface ExpandResult {
  task: Task;
  created: number;
  skipped: boolean;
}

export async function expandTask(
  repository: TaskRepository,
  options: ExpandOptions,
): Promise<ExpandResult> {
  const task = await repository.findById(options.id, { tag: options.tag });

  if (!task) {
    throw new Error(`Task "${String(options.id)}" was not found.`);
  }

  if (task.subtasks.length > 0 && !options.force) {
    return { task, created: 0, skipped: true };
  }

  const count = resolveSubtaskCount({
    explicitNum: options.num,
    recommendedSubtasks: task.complexity?.recommendedSubtasks,
    defaultSubtasks: options.defaultSubtasks,
  });
  const prompt = options.prompt ?? `Expand ${task.title}`;
  const subtasks = Array.from({ length: count }, (_, index) =>
    createSubtask(index + 1, task, prompt, task.complexity?.reasoning),
  );
  const updated = await repository.update(
    task.id,
    { subtasks: options.force ? subtasks : [...task.subtasks, ...subtasks] },
    { tag: options.tag },
  );

  return { task: updated, created: subtasks.length, skipped: false };
}

export async function expandAllTasks(
  repository: TaskRepository,
  options: ExpandAllOptions = {},
): Promise<ExpandResult[]> {
  const tasks = (await repository.findAll({ tag: options.tag })).filter(
    (task) => task.status === "pending",
  );
  const results: ExpandResult[] = [];

  for (const task of tasks) {
    results.push(await expandTask(repository, { ...options, id: task.id }));
  }

  return results;
}

export function resolveSubtaskCount(input: {
  explicitNum?: number;
  recommendedSubtasks?: number;
  defaultSubtasks?: number;
}): number {
  if (input.explicitNum !== undefined) {
    return input.explicitNum === 0 ? 3 : Math.max(0, input.explicitNum);
  }

  if (input.recommendedSubtasks !== undefined) {
    return input.recommendedSubtasks;
  }

  if (!input.defaultSubtasks || input.defaultSubtasks < 1) {
    return 3;
  }

  return input.defaultSubtasks;
}

function createSubtask(
  id: number,
  task: Task,
  prompt: string,
  reasoning: string | undefined,
): Subtask {
  return {
    id,
    title: `${task.title} - step ${id}`,
    description: prompt,
    details: reasoning ? `${prompt}\n\nContext: ${reasoning}` : prompt,
    status: "pending",
    dependencies: id === 1 ? [] : [id - 1],
  };
}
```

> `ExpandOptions` no longer has `complexityReport`. The `expand`/`expand-all` command wrappers and the CLI/MCP flags are cleaned up in Task 7.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/tasks/expand.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tasks/expand.ts test/tasks/expand.test.ts
git commit -m "feat: expand from embedded task complexity instead of a report file"
```

---

### Task 7: Remove the standalone complexity report surface

**Files:**
- Delete: `src/complexity/report.ts`
- Modify: `src/cli/program.ts`, `src/mcp-server/tool-registry.ts`, `src/mcp-server/tool-loader.ts`, `src/commands/expand.ts`

- [ ] **Step 1: Find every remaining reference**

Run: `grep -rn "complexity-report\|complexityReportCommand\|readComplexityReport\|writeComplexityReport\|summarizeComplexityReport\|resolveComplexityReportPath\|complexityReport\|report.js" src`
Expected: matches only in the files listed below (no test references should remain after Phase C). If a test still references the report, fix that test to drop the reference.

- [ ] **Step 2: Remove the `complexity-report` command + `--complexity-report` flags from `src/cli/program.ts`**

1. Change the import on line 8 from:
   ```ts
   import { analyzeComplexityCommand, complexityReportCommand } from "../commands/complexity.js";
   ```
   to:
   ```ts
   import { analyzeComplexityCommand } from "../commands/complexity.js";
   ```
2. Delete the whole `program.command("complexity-report")…` block (the `.command("complexity-report")` through its `.action(...)`; in the current file this is lines 319–332).
3. In the `expand` command, delete the line:
   ```ts
   .option("--complexity-report <path>", "Complexity report path")
   ```
   and remove `complexityReport` from that action's options type and the destructured object.
4. In the `expand-all` command, delete the same `.option("--complexity-report <path>", …)` line and remove `complexityReport` from its options type.

- [ ] **Step 3: Clean the expand command wrapper**

Open `src/commands/expand.ts`. Remove any `complexityReport` field from its options interface(s) and from the object passed to `expandTask`/`expandAllTasks`. (Search the file for `complexityReport` and delete those references — `expandTask` no longer accepts it.)

- [ ] **Step 4: Remove the `complexity-report` MCP tool + expand arg**

In `src/mcp-server/tool-registry.ts`:
1. Change the import on line 7 to:
   ```ts
   import { analyzeComplexityCommand } from "../commands/complexity.js";
   ```
2. Delete the `"complexity-report": tool("complexity-report", …)` entry (lines 222–228).
3. In the `expand` and `expand-all` tool definitions, delete the `complexityReport: optionalString(args.complexityReport),` lines.

In `src/mcp-server/tool-loader.ts`:
1. Remove `"complexity-report"` from the `standardTools` array.
2. Remove the `["complexityreport", "complexity-report"]` entry from the `aliases` map.

- [ ] **Step 5: Delete the report module**

Run: `git rm src/complexity/report.ts`

- [ ] **Step 6: Verify nothing dangles**

Run: `npm run typecheck`
Expected: PASS (no references to the deleted module/command).
Run: `npx vitest run test/complexity test/tasks/expand.test.ts test/mcp-server`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: remove standalone complexity-report surface"
```

---

# Phase D — generate consolidation + MCP assessor wiring

### Task 8: Minimal safe YAML serializer

**Files:**
- Create: `src/tasks/yaml.ts`
- Test: `test/tasks/yaml.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/tasks/yaml.test.ts`:

```ts
import { toYaml } from "../../src/tasks/yaml.js";

describe("toYaml", () => {
  it("emits scalars with safe double-quoting", () => {
    const yaml = toYaml({ title: 'He said: "hi"\nbye', count: 3, done: false, missing: null });
    expect(yaml).toContain('title: "He said: \\"hi\\"\\nbye"');
    expect(yaml).toContain("count: 3");
    expect(yaml).toContain("done: false");
    expect(yaml).toContain("missing: null");
  });

  it("inlines scalar arrays and blocks object arrays", () => {
    const yaml = toYaml({
      dependencies: [1, 2],
      empty: [],
      tasks: [{ id: 1, title: "A" }],
    });
    expect(yaml).toContain("dependencies: [1, 2]");
    expect(yaml).toContain("empty: []");
    expect(yaml).toContain("tasks:");
    expect(yaml).toContain("  - id: 1");
    expect(yaml).toContain("    title: \"A\"");
  });

  it("skips undefined object values and ends with a newline", () => {
    const yaml = toYaml({ a: 1, b: undefined });
    expect(yaml).not.toContain("b:");
    expect(yaml.endsWith("\n")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/tasks/yaml.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/tasks/yaml.ts`:

```ts
/**
 * Minimal YAML serializer for derived task exports. Every string scalar is emitted
 * via JSON.stringify, which produces a valid YAML double-quoted scalar (YAML's
 * double-quoted escapes are a superset of JSON's), so newlines/colons/quotes are safe.
 */
export function toYaml(value: unknown): string {
  return `${emit(value, 0).join("\n")}\n`;
}

const pad = (depth: number): string => "  ".repeat(depth);

function isScalar(value: unknown): boolean {
  return value === null || value === undefined || typeof value !== "object";
}

function scalar(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(String(value));
}

function emit(value: unknown, depth: number): string[] {
  if (Array.isArray(value)) {
    return emitArray(value, depth);
  }
  if (value && typeof value === "object") {
    return emitObject(value as Record<string, unknown>, depth);
  }
  return [`${pad(depth)}${scalar(value)}`];
}

function emitArray(items: unknown[], depth: number): string[] {
  const lines: string[] = [];
  for (const item of items) {
    if (isScalar(item)) {
      lines.push(`${pad(depth)}- ${scalar(item)}`);
      continue;
    }
    const child = emit(item, depth + 1);
    const firstContent = child[0].slice((depth + 1) * 2);
    lines.push(`${pad(depth)}- ${firstContent}`);
    lines.push(...child.slice(1));
  }
  return lines;
}

function emitObject(record: Record<string, unknown>, depth: number): string[] {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) {
      continue;
    }
    if (isScalar(value)) {
      lines.push(`${pad(depth)}${key}: ${scalar(value)}`);
    } else if (Array.isArray(value) && value.length === 0) {
      lines.push(`${pad(depth)}${key}: []`);
    } else if (Array.isArray(value) && value.every(isScalar)) {
      lines.push(`${pad(depth)}${key}: [${value.map(scalar).join(", ")}]`);
    } else {
      lines.push(`${pad(depth)}${key}:`);
      lines.push(...emit(value, depth + 1));
    }
  }
  return lines;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/tasks/yaml.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/tasks/yaml.ts test/tasks/yaml.test.ts
git commit -m "feat: add minimal YAML serializer for task exports"
```

---

### Task 9: `generate` writes a single `tasks.generated.yaml`

**Files:**
- Modify: `src/tasks/generate.ts`
- Modify: `src/commands/generate.ts`
- Modify: `src/cli/program.ts` (drop `--format`)
- Modify: `src/mcp-server/tool-registry.ts` (drop `format` arg)
- Test: `test/tasks/generate.test.ts` (update)

- [ ] **Step 1: Update the failing test**

Replace the two generation tests in `test/tasks/generate.test.ts` (keep the `syncReadme` test and the `task()` helper unchanged). The new file head + first two `it` blocks:

```ts
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
    expect(yaml).toContain("tag: \"master\"");
    expect(yaml).toContain("- id: 1");
    expect(yaml).toContain("    title: \"Task 1\"");
  });

  it("generates the yaml export through the command wrapper", async () => {
    const outputDir = join(root, "yaml");

    await expect(
      generateCommand({ file: storePath, output: outputDir }),
    ).resolves.toContain("tasks.generated.yaml");
    await expect(
      readFile(join(outputDir, "tasks.generated.yaml"), "utf8"),
    ).resolves.toContain("- id: 1");
  });
```

(Leave the existing `it("syncs readme …")` test and `function task(...)` exactly as they are.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/tasks/generate.test.ts`
Expected: FAIL — `tasks.generated.yaml` not written; `result.file` undefined.

- [ ] **Step 3: Implement the generator**

In `src/tasks/generate.ts`, replace the imports + `GenerateOptions`/`GenerateResult`/`generatedPrefix`/`generateTaskFiles`/`renderTaskFile` region (lines 1–93) with:

```ts
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Task } from "../schemas/index.js";
import type { TaskRepository } from "../storage/index.js";
import { toYaml } from "./yaml.js";

export interface GenerateOptions {
  outputDir: string;
  tag?: string;
}

export interface GenerateResult {
  tasks: number;
  removed: number;
  outputDir: string;
  file: string;
}

const GENERATED_FILE = "tasks.generated.yaml";
const legacyPrefix = "task_";

export async function generateTaskFiles(
  repository: TaskRepository,
  options: GenerateOptions,
): Promise<GenerateResult> {
  const tasks = await repository.findAll({ tag: options.tag });
  await mkdir(options.outputDir, { recursive: true });

  const document = toYaml({ tag: options.tag ?? "master", tasks });
  await writeFile(join(options.outputDir, GENERATED_FILE), document, "utf8");

  let removed = 0;
  for (const file of await readdir(options.outputDir)) {
    if (file.startsWith(legacyPrefix)) {
      await rm(join(options.outputDir, file), { force: true });
      removed += 1;
    }
  }

  return { tasks: tasks.length, removed, outputDir: options.outputDir, file: GENERATED_FILE };
}
```

Keep `syncReadme`, `renderReadmeBlock`, `replaceGeneratedBlock`, and `readOptional` exactly as they are below that region. (The `renderTaskFile` helper is now unused — delete it.)

- [ ] **Step 4: Update the generate command wrapper**

Replace `generateCommand` in `src/commands/generate.ts` with:

```ts
export async function generateCommand(
  options: TaskCommandOptions & { output?: string } = {},
): Promise<string> {
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const outputDir = options.output ?? join(resolveProjectConfigDir(), "tasks");
  const result = await generateTaskFiles(repository, { outputDir, tag: options.tag });
  return `Wrote ${result.tasks} tasks to ${join(result.outputDir, result.file)}; removed ${result.removed} legacy files.`;
}
```

(Leave `syncReadmeCommand` unchanged. The `join`/`resolveProjectConfigDir`/`FileTaskRepository`/`generateTaskFiles` imports stay.)

- [ ] **Step 5: Drop `--format` from the CLI and MCP**

In `src/cli/program.ts`, replace the `generate` command block (lines 334–348) with:

```ts
  program
    .command("generate")
    .description("Write all tasks for the tag to a single tasks.generated.yaml")
    .option("--output <dir>", "Output directory")
    .action(async (options: { output?: string }) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(
        await generateCommand({
          ...options,
          file: globalOptions.file,
          tag: globalOptions.tag,
        }),
      );
    });
```

In `src/mcp-server/tool-registry.ts`, replace the `generate` tool (lines 323–330) with:

```ts
  generate: tool("generate", true, async (args) =>
    generateCommand({
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      output: optionalString(args.output),
    }),
  ),
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run test/tasks/generate.test.ts && npm run typecheck`
Expected: PASS (generate tests + clean typecheck — confirms `watch.ts`, which calls `generateCommand({file, tag})` without `format`, still compiles).

- [ ] **Step 7: Commit**

```bash
git add src/tasks/generate.ts src/commands/generate.ts src/cli/program.ts src/mcp-server/tool-registry.ts test/tasks/generate.test.ts
git commit -m "feat: consolidate generate output into a single tasks.generated.yaml"
```

---

### Task 10: Host-session assessor + MCP wiring

**Files:**
- Modify: `src/mcp-server/host-sampling.ts`
- Modify: `src/mcp-server/tool-registry.ts`
- Test: `test/mcp-server/host-assessor.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `test/mcp-server/host-assessor.test.ts`:

```ts
import { createHostTaskAssessor } from "../../src/mcp-server/host-sampling.js";

describe("createHostTaskAssessor", () => {
  it("returns undefined when sampling is unavailable", () => {
    expect(createHostTaskAssessor({})).toBeUndefined();
    expect(createHostTaskAssessor({ samplingClient: { supportsSampling: false } })).toBeUndefined();
  });

  it("produces a validated raw assessment from host sampling", async () => {
    const assessor = createHostTaskAssessor({
      samplingClient: {
        supportsSampling: true,
        sampleText: async () =>
          JSON.stringify({
            priority: "high",
            complexityScore: 8,
            recommendedSubtasks: 4,
            reasoning: "auth + payments",
          }),
      },
    });

    expect(assessor).toBeDefined();
    const raw = await assessor!({ title: "t", description: "d", details: "x", dependencies: [] });
    expect(raw).toMatchObject({ priority: "high", complexityScore: 8, recommendedSubtasks: 4 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/mcp-server/host-assessor.test.ts`
Expected: FAIL — `createHostTaskAssessor` not exported.

- [ ] **Step 3: Implement `createHostTaskAssessor`**

In `src/mcp-server/host-sampling.ts`, add the import near the top (with the other imports):

```ts
import { type TaskAssessor, rawAssessmentSchema } from "../analysis/assess.js";
```

Add this exported factory (place it after `createHostAddTaskGenerator`):

```ts
export function createHostTaskAssessor(context: HostSamplingContext): TaskAssessor | undefined {
  const provider = providerFor(context);
  if (!provider) {
    return undefined;
  }

  return async (input) =>
    provider.generateObject(
      [
        "Assess this implementation task. Respond with JSON only.",
        "Fields: priority (high|medium|low), complexityScore (integer 1-10),",
        "recommendedSubtasks (integer 0-12), reasoning (string).",
        "",
        `Title: ${input.title}`,
        `Description: ${input.description}`,
        `Details: ${input.details}`,
        `Dependency count: ${input.dependencies.length}`,
      ].join("\n"),
      rawAssessmentSchema,
    );
}
```

- [ ] **Step 4: Wire the assessor into the task-creating tools**

In `src/mcp-server/tool-registry.ts`, add `createHostTaskAssessor` to the host-sampling import block (lines 57–63):

```ts
import {
  type HostSamplingContext,
  createHostAddTaskGenerator,
  createHostPrdQuestionGenerator,
  createHostResearchGenerator,
  createHostSpecScorer,
  createHostTaskAssessor,
} from "./host-sampling.js";
```

In the `add-task` tool, add `assessor: createHostTaskAssessor(context),` alongside `aiGenerator`:

```ts
  "add-task": tool("add-task", true, async (args, context) =>
    addTaskCommand({
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      title: optionalString(args.title),
      description: optionalString(args.description),
      details: optionalString(args.details),
      testStrategy: optionalString(args.testStrategy),
      dependencies: optionalString(args.dependencies),
      priority: optionalString(args.priority) as never,
      prompt: optionalString(args.prompt),
      research: booleanArg(args.research),
      aiGenerator: createHostAddTaskGenerator(context),
      assessor: createHostTaskAssessor(context),
    }),
  ),
```

In the `parse-spec` tool, thread the context + assessor (note the handler signature gains `context`):

```ts
  "parse-spec": tool("parse-spec", true, async (args, context) =>
    parseSpecCommand(requiredString(args.specFile, "specFile"), {
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      append: booleanArg(args.append),
      force: booleanArg(args.force),
      numTasks: optionalNumber(args.numTasks),
      assessor: createHostTaskAssessor(context),
    }),
  ),
```

In the `analyze-complexity` tool, do the same (and drop `output`/`research`, which the rewritten command no longer accepts):

```ts
  "analyze-complexity": tool("analyze-complexity", true, async (args, context) =>
    analyzeComplexityCommand({
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      threshold: optionalNumber(args.threshold),
      id: optionalString(args.id),
      from: optionalNumber(args.from),
      to: optionalNumber(args.to),
      assessor: createHostTaskAssessor(context),
    }),
  ),
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/mcp-server && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/mcp-server/host-sampling.ts src/mcp-server/tool-registry.ts test/mcp-server/host-assessor.test.ts
git commit -m "feat: wire host-session task assessor into MCP tools"
```

---

# Phase E — `impcom table`

### Task 11: Generic table renderer

**Files:**
- Create: `src/table/render-table.ts`
- Test: `test/table/render-table.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/table/render-table.test.ts`:

```ts
import { renderTable } from "../../src/table/render-table.js";

interface Row {
  id: string;
  title: string;
}

const columns = [
  { header: "ID", get: (r: Row) => r.id, align: "right" as const },
  { header: "TITLE", get: (r: Row) => r.title, flex: true },
];

describe("renderTable", () => {
  it("renders aligned, color-free rows with a separator", () => {
    const out = renderTable(columns, [
      { id: "1", title: "Alpha" },
      { id: "20", title: "Beta" },
    ]);
    const lines = out.split("\n");
    expect(lines[0]).toBe("ID TITLE");
    expect(lines[1]).toBe("── ─────");
    expect(lines[2]).toBe(" 1 Alpha");
    expect(lines[3]).toBe("20 Beta ");
  });

  it("truncates the flex column to fit maxWidth with an ellipsis", () => {
    const out = renderTable(columns, [{ id: "1", title: "A very long title indeed" }], {
      maxWidth: 12,
    });
    const dataLine = out.split("\n")[2];
    expect(dataLine.length).toBe(12);
    expect(dataLine.endsWith("…")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/table/render-table.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/table/render-table.ts`:

```ts
export interface TableColumn<Row> {
  header: string;
  get: (row: Row) => string;
  align?: "left" | "right";
  /** At most one column should set flex; it absorbs/truncates to fit maxWidth. */
  flex?: boolean;
  /** Applied to the already-padded cell when color is enabled. */
  color?: (row: Row, text: string) => string;
}

export interface RenderTableOptions {
  color?: boolean;
  maxWidth?: number;
}

const MIN_FLEX_WIDTH = 8;
const COLUMN_GAP = 1;

export function renderTable<Row>(
  columns: TableColumn<Row>[],
  rows: Row[],
  options: RenderTableOptions = {},
): string {
  const color = options.color ?? false;
  const maxWidth = options.maxWidth ?? process.stdout.columns ?? 100;

  const widths = columns.map((column) =>
    Math.max(column.header.length, 1, ...rows.map((row) => column.get(row).length)),
  );

  const flexIndex = columns.findIndex((column) => column.flex);
  if (flexIndex >= 0) {
    const overhead = COLUMN_GAP * (columns.length - 1);
    const others = widths.reduce((sum, width, index) => (index === flexIndex ? sum : sum + width), 0);
    const available = maxWidth - overhead - others;
    widths[flexIndex] = Math.max(MIN_FLEX_WIDTH, Math.min(widths[flexIndex], available));
  }

  const header = columns.map((column, index) => fit(column.header, widths[index], "left")).join(" ");
  const separator = widths.map((width) => "─".repeat(width)).join(" ");
  const body = rows.map((row) =>
    columns
      .map((column, index) => {
        const padded = fit(column.get(row), widths[index], column.align ?? "left");
        return color && column.color ? column.color(row, padded) : padded;
      })
      .join(" "),
  );

  return [header, separator, ...body].join("\n");
}

function fit(text: string, width: number, align: "left" | "right"): string {
  const value = text.length > width ? `${text.slice(0, Math.max(0, width - 1))}…` : text;
  return align === "right" ? value.padStart(width) : value.padEnd(width);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/table/render-table.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/table/render-table.ts test/table/render-table.test.ts
git commit -m "feat: add generic color-aware table renderer"
```

---

### Task 12: `buildTaskTable` (rows + footer + groups)

**Files:**
- Create: `src/table/task-table.ts`
- Test: `test/table/task-table.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/table/task-table.test.ts`:

```ts
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Task } from "../../src/schemas/index.js";
import { FileTaskRepository } from "../../src/storage/index.js";
import { buildTaskTable } from "../../src/table/task-table.js";

describe("buildTaskTable", () => {
  let repository: FileTaskRepository;

  beforeEach(async () => {
    const storePath = join(await mkdtemp(join(tmpdir(), "imperial-table-")), "tasks.json");
    repository = new FileTaskRepository({ storePath });
    await repository.create(
      task(1, {
        status: "done",
        priority: "high",
        complexity: { score: 9, level: "high", recommendedSubtasks: 4, reasoning: "x" },
      }),
    );
    await repository.create(
      task(2, {
        status: "pending",
        priority: "high",
        dependencies: [1],
        complexity: { score: 4, level: "low", recommendedSubtasks: 2, reasoning: "y" },
        subtasks: [
          { id: 1, title: "a", description: "", details: "", status: "done", dependencies: [] },
          { id: 2, title: "b", description: "", details: "", status: "pending", dependencies: [] },
        ],
      }),
    );
    await repository.create(task(3, { status: "pending", priority: "low", dependencies: [2] }));
  });

  it("builds rows with readiness, subtask progress, and missing-complexity markers", async () => {
    const data = await buildTaskTable(repository, {});
    const row3 = data.rows.find((r) => r.id === "3");

    expect(data.rows).toHaveLength(3);
    expect(data.rows.find((r) => r.id === "2")).toMatchObject({
      ready: true,
      subtasksDone: 1,
      subtasksTotal: 2,
      complexityScore: 4,
    });
    expect(row3?.complexityScore).toBeUndefined();
    expect(row3?.ready).toBe(false);
    expect(row3?.blockedBy).toEqual(["2"]);
  });

  it("computes a tracking footer", async () => {
    const data = await buildTaskTable(repository, {});

    expect(data.footer).toMatchObject({
      total: 3,
      done: 1,
      percentDone: 33,
      ready: 1, // only task 2 (task 1 done, task 3 blocked)
      blocked: 1,
    });
    expect(data.footer.byPriority).toMatchObject({ high: 2, low: 1 });
    expect(data.footer.byComplexity).toMatchObject({ high: 1, low: 1, unknown: 1 });
    expect(data.footer.avgComplexity).toBeCloseTo(6.5, 5);
    expect(data.footer.next?.id).toBe("2");
  });

  it("filters by min complexity and sorts by complexity desc", async () => {
    const data = await buildTaskTable(repository, { minComplexity: 5, sort: "complexity" });
    expect(data.rows.map((r) => r.id)).toEqual(["1"]);
  });

  it("groups rows when groupBy is provided", async () => {
    const data = await buildTaskTable(repository, { groupBy: "priority" });
    const high = data.groups?.find((g) => g.key === "high");
    expect(high?.count).toBe(2);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/table/task-table.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/table/task-table.ts`:

```ts
import type { ComplexityLevel, Task, TaskPriority, TaskStatus } from "../schemas/index.js";
import { searchTasks } from "../search/search.js";
import type { SearchOptions } from "../search/search.js";
import type { TaskRepository } from "../storage/index.js";
import { findNextTask } from "../tasks/lifecycle.js";

export interface TaskTableRow {
  id: string;
  tag: string;
  status: TaskStatus;
  priority: TaskPriority;
  title: string;
  complexityScore?: number;
  complexityLevel?: ComplexityLevel;
  dependencies: string[];
  blockedBy: string[];
  ready: boolean;
  subtasksDone: number;
  subtasksTotal: number;
}

export interface TaskTableFooter {
  total: number;
  done: number;
  percentDone: number;
  byStatus: Record<string, number>;
  byPriority: Record<TaskPriority, number>;
  byComplexity: Record<ComplexityLevel, number> & { unknown: number };
  avgComplexity: number | null;
  ready: number;
  blocked: number;
  next?: { id: string; title: string };
}

export interface TaskTableGroup {
  key: string;
  count: number;
  rows: TaskTableRow[];
}

export interface TaskTableData {
  tag: string;
  rows: TaskTableRow[];
  footer: TaskTableFooter;
  groups?: TaskTableGroup[];
}

export type TaskTableSort = "id" | "priority" | "status" | "title" | "complexity";

export interface BuildTaskTableOptions extends Omit<SearchOptions, "sort"> {
  minComplexity?: number;
  sort?: TaskTableSort;
  groupBy?: "status" | "priority" | "complexity" | "tag";
}

export async function buildTaskTable(
  repository: TaskRepository,
  options: BuildTaskTableOptions = {},
): Promise<TaskTableData> {
  const tag = options.tag ?? "master";
  const searchSort = options.sort === "complexity" ? undefined : options.sort;
  const results = await searchTasks(repository, { ...options, sort: searchSort });

  const doneByTag = await buildDoneSets(
    repository,
    new Set(results.map((result) => result.tag)),
  );

  let rows = results.map((result) =>
    toRow(result.task, result.tag, doneByTag.get(result.tag) ?? new Set()),
  );

  if (options.minComplexity !== undefined) {
    const threshold = options.minComplexity;
    rows = rows.filter((row) => row.complexityScore !== undefined && row.complexityScore >= threshold);
  }

  if (options.sort === "complexity") {
    rows = [...rows].sort((left, right) => (right.complexityScore ?? -1) - (left.complexityScore ?? -1));
  }

  const next = await findNextTask(repository, { tag });

  return {
    tag,
    rows,
    footer: buildFooter(rows, next ? { id: String(next.task.id), title: next.task.title } : undefined),
    groups: options.groupBy ? groupRows(rows, options.groupBy) : undefined,
  };
}

async function buildDoneSets(
  repository: TaskRepository,
  tags: Set<string>,
): Promise<Map<string, Set<string>>> {
  const doneByTag = new Map<string, Set<string>>();
  for (const tag of tags) {
    const tasks = await repository.findAll({ tag });
    doneByTag.set(
      tag,
      new Set(tasks.filter((task) => task.status === "done").map((task) => String(task.id))),
    );
  }
  return doneByTag;
}

function toRow(task: Task, tag: string, done: Set<string>): TaskTableRow {
  const dependencies = task.dependencies.map(String);
  const blockedBy = dependencies.filter((id) => !done.has(id));
  return {
    id: String(task.id),
    tag,
    status: task.status,
    priority: task.priority,
    title: task.title,
    complexityScore: task.complexity?.score,
    complexityLevel: task.complexity?.level,
    dependencies,
    blockedBy,
    ready: blockedBy.length === 0,
    subtasksDone: task.subtasks.filter((subtask) => subtask.status === "done").length,
    subtasksTotal: task.subtasks.length,
  };
}

function buildFooter(
  rows: TaskTableRow[],
  next: { id: string; title: string } | undefined,
): TaskTableFooter {
  const byStatus: Record<string, number> = {};
  const byPriority: Record<TaskPriority, number> = { high: 0, medium: 0, low: 0 };
  const byComplexity: Record<ComplexityLevel, number> & { unknown: number } = {
    low: 0,
    medium: 0,
    high: 0,
    unknown: 0,
  };

  let scoreSum = 0;
  let scored = 0;
  let done = 0;
  let ready = 0;

  for (const row of rows) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    byPriority[row.priority] += 1;
    if (row.complexityLevel) {
      byComplexity[row.complexityLevel] += 1;
      scoreSum += row.complexityScore ?? 0;
      scored += 1;
    } else {
      byComplexity.unknown += 1;
    }
    if (row.status === "done") {
      done += 1;
    }
    if (row.ready && row.status !== "done") {
      ready += 1;
    }
  }

  const total = rows.length;
  return {
    total,
    done,
    percentDone: total === 0 ? 0 : Math.round((done / total) * 100),
    byStatus,
    byPriority,
    byComplexity,
    avgComplexity: scored === 0 ? null : Number((scoreSum / scored).toFixed(1)),
    ready,
    blocked: rows.filter((row) => !row.ready && row.status !== "done").length,
    next,
  };
}

function groupRows(
  rows: TaskTableRow[],
  groupBy: NonNullable<BuildTaskTableOptions["groupBy"]>,
): TaskTableGroup[] {
  const keyOf = (row: TaskTableRow): string => {
    if (groupBy === "status") return row.status;
    if (groupBy === "priority") return row.priority;
    if (groupBy === "tag") return row.tag;
    return row.complexityLevel ?? "none";
  };

  const buckets = new Map<string, TaskTableRow[]>();
  for (const row of rows) {
    const key = keyOf(row);
    buckets.set(key, [...(buckets.get(key) ?? []), row]);
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, groupRows]) => ({ key, count: groupRows.length, rows: groupRows }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/table/task-table.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/table/task-table.ts test/table/task-table.test.ts
git commit -m "feat: build structured task table data with tracking footer"
```

---

### Task 13: Table formatters (pretty / json / csv / markdown)

**Files:**
- Create: `src/table/format-table.ts`
- Test: `test/table/format-table.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/table/format-table.test.ts`:

```ts
import type { TaskTableData } from "../../src/table/task-table.js";
import { formatTaskTable } from "../../src/table/format-table.js";

const data: TaskTableData = {
  tag: "master",
  rows: [
    {
      id: "2",
      tag: "master",
      status: "in-progress",
      priority: "high",
      title: "Payment service",
      complexityScore: 9,
      complexityLevel: "high",
      dependencies: ["1"],
      blockedBy: [],
      ready: true,
      subtasksDone: 2,
      subtasksTotal: 4,
    },
    {
      id: "3",
      tag: "master",
      status: "pending",
      priority: "low",
      title: "Docs",
      dependencies: [],
      blockedBy: [],
      ready: true,
      subtasksDone: 0,
      subtasksTotal: 0,
    },
  ],
  footer: {
    total: 2,
    done: 0,
    percentDone: 0,
    byStatus: { "in-progress": 1, pending: 1 },
    byPriority: { high: 1, medium: 0, low: 1 },
    byComplexity: { low: 0, medium: 0, high: 1, unknown: 1 },
    avgComplexity: 9,
    ready: 2,
    blocked: 0,
    next: { id: "2", title: "Payment service" },
  },
};

describe("formatTaskTable", () => {
  it("renders a pretty table without color by default", () => {
    const out = formatTaskTable(data, { format: "pretty", color: false });
    expect(out).toContain("TASKS · master");
    expect(out).toContain("Payment service");
    expect(out).toContain("NEXT");
    expect(out).not.toContain("["); // no ANSI codes
  });

  it("emits json of the structured data", () => {
    const out = formatTaskTable(data, { format: "json" });
    expect(JSON.parse(out).footer.next.id).toBe("2");
  });

  it("emits csv with a header row and quoted titles", () => {
    const out = formatTaskTable(data, { format: "csv" });
    const lines = out.split("\n");
    expect(lines[0]).toBe("id,status,priority,complexityScore,complexityLevel,ready,subtasks,title");
    expect(lines[1]).toBe('2,in-progress,high,9,high,true,2/4,"Payment service"');
  });

  it("emits a markdown table plus a summary line", () => {
    const out = formatTaskTable(data, { format: "markdown" });
    expect(out).toContain("| ID | Status | Priority | Complexity | Ready | Subtasks | Title |");
    expect(out).toContain("| 2 | in-progress | high | 9 (high) | yes | 2/4 | Payment service |");
    expect(out).toContain("**2 tasks**");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/table/format-table.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/table/format-table.ts`:

```ts
import chalk from "chalk";
import type { TaskPriority, TaskStatus } from "../schemas/index.js";
import { type TableColumn, renderTable } from "./render-table.js";
import type { TaskTableData, TaskTableRow } from "./task-table.js";

export type TaskTableFormat = "pretty" | "json" | "csv" | "markdown";

export interface FormatTaskTableOptions {
  format?: TaskTableFormat;
  color?: boolean;
  wide?: boolean;
  maxWidth?: number;
}

export function formatTaskTable(data: TaskTableData, options: FormatTaskTableOptions = {}): string {
  switch (options.format ?? "pretty") {
    case "json":
      return JSON.stringify(data, null, 2);
    case "csv":
      return toCsv(data);
    case "markdown":
      return toMarkdown(data);
    default:
      return toPretty(data, options);
  }
}

const STATUS_COLOR: Record<TaskStatus, (text: string) => string> = {
  pending: chalk.yellow,
  "in-progress": chalk.cyan,
  review: chalk.magenta,
  done: chalk.green,
  deferred: chalk.gray,
  cancelled: chalk.gray,
};

const PRIORITY_COLOR: Record<TaskPriority, (text: string) => string> = {
  high: chalk.red,
  medium: chalk.yellow,
  low: chalk.gray,
};

function complexityCell(row: TaskTableRow): string {
  if (row.complexityScore === undefined || !row.complexityLevel) {
    return "—";
  }
  return `${row.complexityScore} ${row.complexityLevel}`;
}

function subtasksCell(row: TaskTableRow): string {
  return row.subtasksTotal === 0 ? "—" : `${row.subtasksDone}/${row.subtasksTotal}`;
}

function depsCell(row: TaskTableRow): string {
  if (row.dependencies.length === 0) {
    return "—";
  }
  return row.blockedBy.length > 0 ? `${row.dependencies.join(",")} ✗` : row.dependencies.join(",");
}

function toPretty(data: TaskTableData, options: FormatTaskTableOptions): string {
  const color = options.color ?? true;
  const columns: TableColumn<TaskTableRow>[] = [
    { header: "ID", get: (row) => row.id, align: "right" },
    { header: "STATUS", get: (row) => row.status, color: (row, text) => STATUS_COLOR[row.status](text) },
    { header: "PRI", get: (row) => row.priority, color: (row, text) => PRIORITY_COLOR[row.priority](text) },
    { header: "CX", get: complexityCell },
    { header: "DEPS", get: depsCell },
    { header: "SUB", get: subtasksCell },
    { header: "TITLE", get: (row) => row.title, flex: !options.wide },
  ];

  const heading = `TASKS · ${data.tag}    ${data.footer.total} tasks · ${data.footer.percentDone}% done`;
  const sections = (data.groups ?? [{ key: "", count: data.rows.length, rows: data.rows }]).map(
    (group) => {
      const title = group.key ? `\n${group.key} (${group.count})` : "";
      return `${title}\n${renderTable(columns, group.rows, { color, maxWidth: options.maxWidth })}`;
    },
  );

  return [heading, ...sections, "", footerLines(data).join("\n")].join("\n");
}

function footerLines(data: TaskTableData): string[] {
  const { footer } = data;
  const status = Object.entries(footer.byStatus)
    .map(([key, count]) => `${key} ${count}`)
    .join(" · ");
  const complexity =
    footer.avgComplexity === null
      ? "n/a"
      : `avg ${footer.avgComplexity} · hi ${footer.byComplexity.high} · med ${footer.byComplexity.medium} · low ${footer.byComplexity.low} · ? ${footer.byComplexity.unknown}`;

  return [
    `STATUS    ${status}`,
    `PRIORITY  high ${footer.byPriority.high} · med ${footer.byPriority.medium} · low ${footer.byPriority.low}`,
    `COMPLEXITY ${complexity}`,
    `READY     ${footer.ready} actionable · ${footer.blocked} blocked`,
    footer.next ? `NEXT      #${footer.next.id} ${footer.next.title}` : "NEXT      none",
  ];
}

function toCsv(data: TaskTableData): string {
  const header = "id,status,priority,complexityScore,complexityLevel,ready,subtasks,title";
  const rows = data.rows.map((row) =>
    [
      row.id,
      row.status,
      row.priority,
      row.complexityScore ?? "",
      row.complexityLevel ?? "",
      String(row.ready),
      `${row.subtasksDone}/${row.subtasksTotal}`,
      csvQuote(row.title),
    ].join(","),
  );
  return [header, ...rows].join("\n");
}

function csvQuote(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toMarkdown(data: TaskTableData): string {
  const header = "| ID | Status | Priority | Complexity | Ready | Subtasks | Title |";
  const divider = "| --- | --- | --- | --- | --- | --- | --- |";
  const rows = data.rows.map((row) => {
    const cx = row.complexityScore === undefined ? "—" : `${row.complexityScore} (${row.complexityLevel})`;
    const sub = row.subtasksTotal === 0 ? "—" : `${row.subtasksDone}/${row.subtasksTotal}`;
    return `| ${row.id} | ${row.status} | ${row.priority} | ${cx} | ${row.ready ? "yes" : "no"} | ${sub} | ${row.title} |`;
  });
  const summary = `**${data.footer.total} tasks** · ${data.footer.percentDone}% done · ${data.footer.ready} ready · ${data.footer.blocked} blocked`;
  return [`### Tasks · ${data.tag}`, "", header, divider, ...rows, "", summary].join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/table/format-table.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/table/format-table.ts test/table/format-table.test.ts
git commit -m "feat: add pretty/json/csv/markdown task table formatters"
```

---

### Task 14: `table` command + CLI + MCP registration

**Files:**
- Create: `src/commands/table.ts`
- Modify: `src/cli/program.ts`
- Modify: `src/mcp-server/tool-registry.ts`
- Test: `test/commands/table.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/commands/table.test.ts`:

```ts
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Task } from "../../src/schemas/index.js";
import { FileTaskRepository } from "../../src/storage/index.js";
import { tableCommand } from "../../src/commands/table.js";

describe("table command", () => {
  let storePath: string;

  beforeEach(async () => {
    storePath = join(await mkdtemp(join(tmpdir(), "imperial-table-cmd-")), "tasks.json");
    const repository = new FileTaskRepository({ storePath });
    await repository.create(task(1, { status: "pending", priority: "high" }));
    await repository.create(task(2, { status: "done", priority: "low" }));
  });

  it("renders a no-color pretty table by default", async () => {
    const out = await tableCommand({ file: storePath, color: false });
    expect(out).toContain("TASKS · master");
    expect(out).toContain("Task 1");
    expect(out).not.toContain("[");
  });

  it("emits json when requested", async () => {
    const out = await tableCommand({ file: storePath, format: "json" });
    expect(JSON.parse(out).footer.total).toBe(2);
  });

  it("rejects an invalid status filter", async () => {
    await expect(tableCommand({ file: storePath, status: "nope" })).rejects.toThrow(/Invalid --status/);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/commands/table.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the command**

Create `src/commands/table.ts`:

```ts
import { TaskPrioritySchema, TaskStatusSchema } from "../schemas/index.js";
import { FileTaskRepository } from "../storage/index.js";
import { type FormatTaskTableOptions, formatTaskTable } from "../table/format-table.js";
import { type BuildTaskTableOptions, buildTaskTable } from "../table/task-table.js";
import type { TaskCommandOptions } from "./tasks.js";

const SORT_FIELDS = ["id", "priority", "status", "title", "complexity"] as const;
const GROUP_FIELDS = ["status", "priority", "complexity", "tag"] as const;
const FORMATS = ["pretty", "json", "csv", "markdown"] as const;

export interface TableCommandOptions extends TaskCommandOptions {
  query?: string;
  status?: string;
  priority?: string;
  ready?: boolean;
  blocked?: boolean;
  hasSubtasks?: boolean;
  noSubtasks?: boolean;
  allTags?: boolean;
  limit?: number;
  minComplexity?: number;
  sort?: string;
  groupBy?: string;
  format?: string;
  json?: boolean;
  color?: boolean;
  wide?: boolean;
}

export async function tableCommand(options: TableCommandOptions = {}): Promise<string> {
  const { build, format } = parseTableOptions(options);
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const data = await buildTaskTable(repository, { ...build, tag: options.tag });
  return formatTaskTable(data, format);
}

export function parseTableOptions(options: TableCommandOptions): {
  build: BuildTaskTableOptions;
  format: FormatTaskTableOptions;
} {
  if (options.ready && options.blocked) {
    throw new Error("Use either --ready or --blocked, not both.");
  }
  if (options.hasSubtasks && options.noSubtasks) {
    throw new Error("Use either --has-subtasks or --no-subtasks, not both.");
  }

  const status = options.status ? TaskStatusSchema.safeParse(options.status) : undefined;
  if (status && !status.success) {
    throw new Error("Invalid --status. Use pending, in-progress, review, done, deferred, or cancelled.");
  }
  const priority = options.priority ? TaskPrioritySchema.safeParse(options.priority) : undefined;
  if (priority && !priority.success) {
    throw new Error("Invalid --priority. Use high, medium, or low.");
  }
  const sort = parseEnum(options.sort, SORT_FIELDS, "--sort");
  const groupBy = parseEnum(options.groupBy, GROUP_FIELDS, "--group-by");
  const format = options.json
    ? "json"
    : parseEnum(options.format, FORMATS, "--format") ?? "pretty";

  return {
    build: {
      query: options.query,
      status: status?.success ? status.data : undefined,
      priority: priority?.success ? priority.data : undefined,
      readiness: options.ready ? "ready" : options.blocked ? "blocked" : undefined,
      hasSubtasks: options.hasSubtasks ? true : options.noSubtasks ? false : undefined,
      allTags: options.allTags,
      limit: options.limit,
      minComplexity: options.minComplexity,
      sort,
      groupBy,
    },
    format: { format, color: options.color, wide: options.wide },
  };
}

function parseEnum<T extends readonly string[]>(
  value: string | undefined,
  allowed: T,
  flag: string,
): T[number] | undefined {
  if (!value) {
    return undefined;
  }
  if ((allowed as readonly string[]).includes(value)) {
    return value as T[number];
  }
  throw new Error(`Invalid ${flag}. Use ${allowed.join(", ")}.`);
}
```

- [ ] **Step 4: Register the CLI command**

In `src/cli/program.ts`, add the import near the other command imports:

```ts
import { tableCommand } from "../commands/table.js";
```

Add this command registration (place it right after the `search` command block, before `export`):

```ts
  program
    .command("table")
    .description("Render a color-coded task table with a tracking dashboard")
    .argument("[query]", "Search query")
    .option("--status <status>", "Filter by status")
    .option("--priority <priority>", "Filter by priority")
    .option("--ready", "Only tasks with satisfied dependencies")
    .option("--blocked", "Only tasks with unsatisfied dependencies")
    .option("--has-subtasks", "Only tasks with subtasks")
    .option("--no-subtasks", "Only tasks without subtasks")
    .option("--all-tags", "Include all tags")
    .option("--limit <count>", "Maximum rows", Number.parseInt)
    .option("--min-complexity <score>", "Only tasks at/above a complexity score", Number.parseInt)
    .option("--sort <field>", "id, priority, status, title, or complexity")
    .option("--group-by <field>", "status, priority, complexity, or tag")
    .option("--format <format>", "pretty, json, csv, or markdown")
    .option("--json", "Shortcut for --format json")
    .option("--no-color", "Disable ANSI color")
    .option("--wide", "Disable title truncation")
    .action(async (query: string | undefined, options: Record<string, unknown>) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(
        await tableCommand({
          ...(options as Record<string, never>),
          query: query ?? (options.query as string | undefined),
          file: globalOptions.file,
          tag: globalOptions.tag,
        }),
      );
    });
```

> Commander maps `--no-color` to `options.color === false` and `--no-subtasks` to `options.subtasks === false`. The `--no-subtasks` flag is read by the command as `noSubtasks`; mirror the existing `search` handling by translating it. To keep parity with `search`, add this just before the `tableCommand` call:
> ```ts
> const noSubtasks = (options as { subtasks?: boolean }).subtasks === false;
> ```
> and pass `noSubtasks` into the `tableCommand({ ... })` object. (The `search` command relies on the same Commander behavior.)

- [ ] **Step 5: Register the MCP tool**

In `src/mcp-server/tool-registry.ts`, add the import:

```ts
import { tableCommand } from "../commands/table.js";
```

Add this entry to `toolRegistry` (next to `search`):

```ts
  table: tool("table", false, async (args) =>
    tableCommand({
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      query: optionalString(args.query),
      status: optionalString(args.status),
      priority: optionalString(args.priority),
      ready: booleanArg(args.ready),
      blocked: booleanArg(args.blocked),
      hasSubtasks: booleanArg(args.hasSubtasks),
      noSubtasks: booleanArg(args.noSubtasks),
      allTags: booleanArg(args.allTags),
      limit: optionalNumber(args.limit),
      minComplexity: optionalNumber(args.minComplexity),
      sort: optionalString(args.sort),
      groupBy: optionalString(args.groupBy),
      format: optionalString(args.format),
      json: booleanArg(args.json),
      color: booleanArg(args.color),
      wide: booleanArg(args.wide),
    }),
  ),
```

- [ ] **Step 6: Run tests + typecheck**

Run: `npx vitest run test/commands/table.test.ts test/cli-smoke.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/commands/table.ts src/cli/program.ts src/mcp-server/tool-registry.ts test/commands/table.test.ts
git commit -m "feat: add impcom table command (CLI + MCP)"
```

---

### Task 15: `--watch` mode for `table`

**Files:**
- Modify: `src/commands/table.ts`
- Modify: `src/cli/program.ts`
- Test: `test/commands/table.test.ts` (add a case)

- [ ] **Step 1: Add the failing test**

Append this `it` block inside the `describe("table command", …)` in `test/commands/table.test.ts`:

```ts
  it("watches the store and renders once in once-mode", async () => {
    const renders: string[] = [];
    await watchTaskTable(
      { file: storePath, color: false },
      { once: true, write: (text) => renders.push(text) },
    );
    expect(renders).toHaveLength(1);
    expect(renders[0]).toContain("TASKS · master");
  });
```

Add `watchTaskTable` to the import at the top of the test file:

```ts
import { tableCommand, watchTaskTable } from "../../src/commands/table.js";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/commands/table.test.ts`
Expected: FAIL — `watchTaskTable` not exported.

- [ ] **Step 3: Implement the watch helper**

Append to `src/commands/table.ts`:

```ts
import { watch } from "node:fs";
import { resolveProjectConfigDir } from "../config/paths.js";
import { join } from "node:path";

export interface WatchTableOptions {
  once?: boolean;
  write?: (text: string) => void;
  signal?: AbortSignal;
}

export async function watchTaskTable(
  options: TableCommandOptions,
  watchOptions: WatchTableOptions = {},
): Promise<void> {
  const write = watchOptions.write ?? ((text: string) => process.stdout.write(`${text}\n`));
  const render = async () => {
    write(await tableCommand(options));
  };

  await render();

  if (watchOptions.once) {
    return;
  }

  const storePath =
    options.file ?? join(resolveProjectConfigDir(), "tasks", "tasks.json");

  await new Promise<void>((resolve) => {
    const watcher = watch(storePath, { persistent: true }, () => {
      void render();
    });
    const stop = () => {
      watcher.close();
      resolve();
    };
    watchOptions.signal?.addEventListener("abort", stop, { once: true });
  });
}
```

> Move the two new `import` lines (`node:fs` `watch`, `resolveProjectConfigDir`) up to the top import block of the file rather than mid-file; they are shown here for locality. Ensure `join` is imported once.

- [ ] **Step 4: Wire `--watch` into the CLI**

In the `table` command in `src/cli/program.ts`, add the option:

```ts
    .option("--watch", "Re-render when the task store changes")
```

and replace the action body's render call with a branch:

```ts
      if (options.watch) {
        await watchTaskTable({
          ...tableOptions,
          file: globalOptions.file,
          tag: globalOptions.tag,
        });
        return;
      }
      console.log(await tableCommand({ ...tableOptions, file: globalOptions.file, tag: globalOptions.tag }));
```

Add `watchTaskTable` to the table import:

```ts
import { tableCommand, watchTaskTable } from "../commands/table.js";
```

(Where `tableOptions` is the options object you already build for `tableCommand`; reuse it for both branches.)

- [ ] **Step 5: Run test + typecheck**

Run: `npx vitest run test/commands/table.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/commands/table.ts src/cli/program.ts test/commands/table.test.ts
git commit -m "feat: add --watch mode to impcom table"
```

---

# Phase F — Docs + full verification

### Task 16: Document the new behavior and run the full suite

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the README**

Add a section to `README.md` (place it near the existing task/command documentation). Include:

```markdown
## Task analysis (priority + complexity)

Every task-creating path now assesses **priority** and **complexity** with the
configured AI provider and stores both on the task:

- `add-task` (manual or `--prompt`) and `parse-spec` require a provider. Pass an
  explicit `--priority` to `add-task` to override the assessed priority.
- Without a provider these commands fail with a clear error — run them under the
  MCP host (which supplies host-session sampling) or configure models first.
- `analyze-complexity` re-assesses active tasks and writes `complexity` back onto
  them (useful for backfilling older stores). The separate `complexity-report`
  command and `complexity-report*.json` file have been removed; use `impcom table`
  for the roll-up view.
- `generate` now writes a single `tasks.generated.yaml` instead of per-task files.

## `impcom table`

Render a color-coded task table with a tracking dashboard:

```bash
impcom table                        # pretty table + footer
impcom table --status pending --sort complexity
impcom table --group-by priority
impcom table --min-complexity 7
impcom table --format markdown      # paste into a PR
impcom table --json                 # structured data
impcom table --watch                # live re-render on store change
```

Filters mirror `impcom search` (`--status`, `--priority`, `--ready`/`--blocked`,
`--has-subtasks`/`--no-subtasks`, `--query`, `--tag`/`--all-tags`, `--limit`),
plus `--min-complexity`, `--sort complexity`, `--group-by`, `--format`,
`--no-color`, and `--wide`.
```

- [ ] **Step 2: Run the full verification suite**

Run: `npm test`
Expected: PASS — all suites green.

Run: `npm run typecheck`
Expected: PASS — no type errors.

Run: `npm run lint`
Expected: PASS (or run `npm run format` then re-run `npm run lint`).

If any pre-existing test elsewhere seeds tasks via `addTask`/`parseSpecFile`/`analyzeComplexity` without an assessor and now fails, inject the same deterministic fake assessor used in this plan and re-run.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document task analysis and impcom table"
```

---

## Self-Review (completed by plan author)

**Spec coverage** — every spec section maps to a task:
- §4.1 schema → Task 1. §4.2 assessor → Task 2 (refined: `TaskAssessor` is a function returning `RawAssessment`, consistent with the existing `AddTaskGenerator` function-type pattern; `level` derivation lives in pure, tested code via `toAssessment`/`complexityLevelForScore`). §4.3 wiring → Tasks 3 (add-task), 4 (parse-spec), 6 (expand), 10 (MCP). §4.4 analyze-complexity repurpose + report removal → Tasks 5 & 7. §4.5 generate consolidation → Tasks 8 & 9. §5.1 table modules → Tasks 11 (render), 12 (build), 13 (format). §5.2 flags → Tasks 14 & 15. §5.3 example → footer/pretty in Task 13. §6 testing → tests in every task + Task 16 full run. §8 implications → captured in "Intended behavior change" and README (Task 16).

**Placeholder scan** — no TBD/"add error handling"/"similar to Task N". Every code step contains complete code; modify-steps show full function bodies or exact line targets.

**Type consistency** — names are stable across tasks: `TaskAssessor`, `TaskAssessmentInput`, `RawAssessment`, `rawAssessmentSchema`, `TaskAssessment`, `assessTask`, `assessMany`, `toAssessment`, `complexityLevelForScore`, `AssessmentRequiredError` (Task 2) are used identically in Tasks 3/4/5/10. `TaskComplexity`/`ComplexityLevel` (Task 1) are consumed in Tasks 2/12/13. `resolveSubtaskCount({ recommendedSubtasks })` is renamed consistently in Task 6 (impl + test). `buildTaskTable`/`TaskTableData`/`TaskTableRow` (Task 12) feed `formatTaskTable` (Task 13) and `tableCommand` (Task 14). `toYaml` (Task 8) is consumed by `generateTaskFiles` (Task 9). Removed names (`writeComplexityReport`, `readComplexityReport`, `complexityReportCommand`, `--complexity-report`) are eliminated everywhere in Task 7 after their importers are cut over in Tasks 5–6.

**Ordering safety** — `report.ts` is deleted (Task 7) only after `analyze.ts` (Task 5) and `expand.ts` (Task 6) stop importing it. The schema's optional `complexity` (Task 1) lands before any path writes it.

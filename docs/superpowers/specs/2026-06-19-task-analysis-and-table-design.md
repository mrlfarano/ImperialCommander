# Design: Embedded Task Analysis + `impcom table`

- **Date:** 2026-06-19
- **Status:** Approved (pending spec review)
- **Scope:** Two features in Imperial Commander
  1. Auto-analyze **priority + complexity** at task-creation time and store both **on the task**.
  2. New **`impcom table`** command — a color-coded task table with filtering, sorting, and a tracking dashboard.

---

## 1. Background & Current State

Imperial Commander stores tasks in a single tag-keyed JSON file
(`.imperial-commander/tasks/tasks.json`, shape `Record<tag, { tasks, metadata }>`).
Two assumptions in the original request turned out to be already partly true, which
reshaped the work:

- **Tasks are already a single file**, not individual files. The only place individual
  files appear is the optional `generate` command, which writes throwaway
  `task_NNN.md` exports into `.imperial-commander/tasks/`.
- **`priority` already exists** on every task (`high`/`medium`/`low`), but it is never
  *analyzed* — `add-task` hardcodes `priority ?? "medium"` and `parse-spec` hardcodes
  `"medium"`.
- **Complexity already exists** but lives in a *separate* report file
  (`analyze-complexity` → `.imperial-commander/reports/complexity-report*.json`),
  computed by a crude `text.length / 80 + dependencyCount` heuristic. It is **not**
  stored on the task.

Relevant current behavior:

- `parse-spec` is **100% deterministic** today — it scrapes bullet/heading lines from
  markdown and creates tasks with no AI involvement.
- `add-task --prompt` already uses an injectable `aiGenerator`; manual `add-task`
  (title + description) does not call AI at all.
- `expand` reads the **separate complexity report** to decide `recommendedSubtasks`.
- `list` renders flat one-line-per-task text; `search` has a rich filter/sort/fuzzy
  engine but also renders flat lines; `board` is a web/summary view; `tui` is a stub.
  **No table rendering exists anywhere.** `chalk` is already a dependency.

## 2. Decisions (locked with user)

| Decision | Choice |
| --- | --- |
| Canonical storage format | **Stays JSON** (`tasks.json`). No JSON→YAML migration. |
| "Single file, not individual files" | Consolidate `generate`'s many `task_NNN.md` into **one `tasks.generated.yaml`**. |
| How priority + complexity are computed | **AI required** on every creation path; error if no provider configured. Tests inject a fake assessor. |
| Explicit `--priority` flag | **Overrides** the AI-assigned priority. |
| Standalone complexity report | **Dropped.** `analyze-complexity` becomes a re-assess command that writes `complexity` back onto tasks. `impcom table` is the new roll-up view. |
| Subtasks | **Stay lightweight** — no priority/complexity on subtasks. |
| Table tool form factor | **New `impcom table` command** (static, scriptable). Renderer built reusable for a future TUI. |
| `Task.complexity` schema | **Optional** field, so existing stores still load; always populated on new tasks. |

## 3. Architecture Overview

Two shared, pure/injectable cores with thin command wrappers, matching existing
patterns (`aiGenerator` injection, `searchTasks` reuse):

- **Assessor core** (`src/analysis/assess.ts`) — feeds Feature 1. Wired into every
  creation path.
- **Table core** (`src/table/`) — feeds Feature 2. Wraps `searchTasks` and renders.

---

## 4. Feature 1 — Embedded Priority + Complexity

### 4.1 Data model (`src/schemas/task.ts`)

```ts
export const ComplexityLevelSchema = z.enum(["low", "medium", "high"]);

export const TaskComplexitySchema = z.object({
  score: z.number().int().min(1).max(10),
  level: ComplexityLevelSchema,
  recommendedSubtasks: z.number().int().min(0).max(12),
  reasoning: z.string(),
});

// Added to TaskSchema:
complexity: TaskComplexitySchema.optional(),
```

- `level` is **derived deterministically from `score`** (`<5` → low, `5–7` → medium,
  `≥8` → high), mirroring the thresholds already in `summarizeComplexityReport`. The AI
  returns `score`, `recommendedSubtasks`, and `reasoning`; the code computes `level`.
  This prevents the AI from returning an inconsistent score/level pair.
- `complexity` is **optional** purely for back-compat with existing `tasks.json` files.
  Every *newly created* task populates it.

### 4.2 Assessor (`src/analysis/assess.ts`)

```ts
export interface TaskAssessmentInput {
  title: string;
  description: string;
  details: string;
  dependencies: TaskEntityId[];
}

export interface TaskAssessment {
  priority: TaskPriority;
  complexity: TaskComplexity;
}

export interface TaskAssessor {
  assess(input: TaskAssessmentInput): Promise<TaskAssessment>;
}
```

- `AiTaskAssessor` — concrete implementation using `AiService.generateObject(schema, …)`
  with a `commandName` of `"assess-task"`. A dedicated Zod schema validates the model's
  JSON (`{ priority, complexityScore, recommendedSubtasks, reasoning }`); `level` is
  derived after parse.
- Throws a clear, actionable error when no provider is configured:
  *"Task creation requires an AI provider to assess priority and complexity. Run `impcom models` to configure one."*
- Batch helper for bulk paths: `assessMany(inputs)` so `parse-spec` can assess N seeds
  (sequentially or with bounded concurrency — sequential is acceptable for v1).
- Tests inject a `FakeTaskAssessor` returning deterministic values.

### 4.3 Wiring into creation paths

| Path | Change |
| --- | --- |
| `add-task` (manual + `--prompt`) | Accept an injected `assessor`. After building the task, set `priority`/`complexity` from `assessor.assess(...)`. An explicit `options.priority` **overrides** the assessed priority. Command wires the real `AiTaskAssessor`. |
| `parse-spec` (`parseSpecText`/`parseSpecFile`) | Accept an injected `assessor`. After extracting seeds, assess each before persisting. **This adds a new AI dependency to `parse-spec`** — it will now error without a configured provider. |
| `expand` | No new assessment of the parent. Replace `readComplexityReport(...)` lookup with `task.complexity?.recommendedSubtasks` for the subtask count. Subtasks remain lightweight. |
| MCP server providers that create tasks | Wire the same `AiTaskAssessor` so the agent surface stays consistent with the CLI. |

### 4.4 `analyze-complexity` repurposed

- Re-runs the assessor over the selected/active tasks and **writes `complexity` back
  onto each task** via `repository.update`. Useful for backfilling old tasks and
  re-scoring after edits.
- **Removes** the separate-report machinery: `writeComplexityReport`, the
  `complexity-report*.json` file, and `readComplexityReport` usage in `expand`.
  `src/complexity/report.ts` is trimmed to the parts still used (e.g. summary
  formatting) or folded into the table footer logic; `src/complexity/analyze.ts` is
  rewritten around the assessor.
- Command stdout becomes a short summary computed from embedded data (counts by level,
  tasks above threshold), preserving the spirit of the old summary output.

### 4.5 `generate` consolidation (`src/tasks/generate.ts`)

- Replace the per-task `task_NNN.md` / `.json` writer with a single
  **`tasks.generated.yaml`** file containing all tasks for the tag (including embedded
  `priority` + `complexity`).
- On run, write the one file and remove any stale `task_NNN.*` files left by the old
  behavior (preserve the existing orphan-cleanup intent).
- A minimal hand-rolled YAML serializer (or a tiny dependency if justified during
  planning) — **no** new YAML dep added speculatively; decide during planning. Default
  is hand-rolled to keep the 4-dependency profile.
- `generate` is an **export/derived** artifact; `tasks.json` remains canonical.

---

## 5. Feature 2 — `impcom table`

### 5.1 Modules

- **`src/table/render-table.ts`** — generic column renderer. Inputs: column defs
  (header, width/flex, align, optional `color(value) => string`), rows, and options
  (`color: boolean`, `maxWidth`). Pads/aligns, truncates the flexible column (title) to
  `process.stdout.columns` (fallback 100), respects `NO_COLOR` / non-TTY (chalk
  auto-detects; `--no-color` forces off). Pure and unit-testable with color disabled.
- **`src/table/task-table.ts`** — `buildTaskTable(repository, options)`:
  - Selects + filters + sorts tasks via **`searchTasks`** (full reuse).
  - Computes per-row display data: status glyph, priority, complexity heat
    (`score`/`level`, `—` when absent), dependency readiness (blocked → blocker ids),
    subtask progress (`done/total`).
  - Computes a **tracking footer**: totals, `% done`, counts by status / priority /
    complexity level, average complexity score, ready vs blocked counts, and the
    computed **next** task (reuse `findNextTask`).
  - Returns a structured `TaskTableData` object → `--json` is trivial and tests assert
    on data, not ANSI.
- **`src/commands/table.ts`** + registration in `src/cli/program.ts`.

### 5.2 Flags

Reuse the search surface plus table-specific additions:

- Filters (reused): `--status`, `--priority`, `--ready` / `--blocked`,
  `--has-subtasks` / `--no-subtasks`, `--query` (or positional), `--tag` /
  `--all-tags`, `--limit`.
- New: `--min-complexity <score>`, `--sort` extended with `complexity`,
  `--group-by status|priority|complexity|tag` (sectioned tables each with a sub-count).
- Output: pretty table (default), `--json`, `--csv`, `--markdown` (GitHub table +
  summary, for pasting into PRs/docs).
- Display: `--no-color`, `--wide` (disable title truncation), `--watch`
  (re-render on store change; lean on existing watch infra or a simple `fs.watch` loop,
  clearing the screen between renders).

### 5.3 Example

```
TASKS · master                                          12 tasks · 42% done

 ID  STATUS         PRI    CX         TITLE                          DEPS   SUBTASKS
 ─── ────────────── ────── ────────── ────────────────────────────── ────── ──────────
  2  ◐ in-progress  high   ▓▓▓ 9 hi   Payment service integration    1      ▓▓░░ 2/4
  4  ⊘ blocked      high   ▓▓▓ 8 hi   Migrate user database          2 ✗    ▓░░░ 1/5
  ...
 STATUS    done 5 · in-progress 2 · pending 4 · blocked 1
 PRIORITY  high 4 · med 5 · low 3       COMPLEXITY  avg 5.2 · hi 3 · med 4 · low 5
 READY     3 actionable now             NEXT  #2 Payment service integration
```

---

## 6. Testing

- **Assessor:** with `FakeTaskAssessor` — priority override behavior, `level` derivation
  from score, error when no provider configured.
- **Schema:** `TaskComplexitySchema` validation; old store without `complexity` still
  loads (back-compat).
- **Creation paths:** `add-task` (manual + prompt), `parse-spec`, each populate
  `priority` + `complexity`; explicit `--priority` wins.
- **`expand`:** uses `task.complexity.recommendedSubtasks`; no longer reads a report.
- **`analyze-complexity`:** writes `complexity` back onto tasks; no report file emitted.
- **Table builder:** filter/sort reuse, footer math (counts, %, avg, ready/blocked,
  next), grouping, `—` for missing complexity.
- **Renderer:** deterministic output with color disabled; truncation at a fixed width.
- **`generate`:** single `tasks.generated.yaml`; stale `task_NNN.*` removed.
- Existing suites in `test/complexity`, `test/tasks`, `test/commands`, `test/spec`
  updated for the report-removal and the new assessor dependency. Keep the whole suite
  green (`vitest run`, `tsc --noEmit`, `biome check`).

## 7. Out of Scope (v1)

- Interactive full-screen TUI (phase 2 — will wrap `render-table.ts`).
- Subtask-level priority/complexity.
- Migrating the **canonical** store from JSON to YAML.
- Cost/token accounting changes beyond reusing existing telemetry.

## 8. Notable Implications

1. **`parse-spec` becomes AI-dependent** and will error without a configured provider —
   a deliberate consequence of the "AI required" decision.
2. **`Task.complexity` is optional** so no breaking migration is needed; unanalyzed
   tasks render `—` and can be backfilled via `analyze-complexity`.
3. The separate `complexity-report*.json` artifact and its read/write helpers are
   **removed**; anything pointing at it (e.g. `expand --complexity-report`) is updated
   or dropped.

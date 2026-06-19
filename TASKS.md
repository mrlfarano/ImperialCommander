# Implementation Task Breakdown — AI-Driven Development Task Orchestration System

> Derived from [`PRD-task-orchestration-system.md`](./PRD-task-orchestration-system.md) (108 functional requirements, FR-1…FR-108).
> This document decomposes the PRD into **57 build-ordered, dependency-aware tasks** across **22 phases**.
> It is written for an autonomous implementing agent: each task states scope, deliverables, the FRs it satisfies, and a test strategy.
>
> **v1.1 (this revision)** adds **Phases 19–22 / tasks T46–T57** for the builder- and developer-experience features (FR-98–FR-108): interactive PRD Builder, spec-readiness check, local Kanban/graph/roadmap visualizer, watch/live-sync, external tracker sync, notifications/webhooks, search, history/undo, and export/reporting.

---

## How to use this document

- **Build top-to-bottom.** Tasks are listed in dependency order. A task is only actionable once every task in its **Depends on** list is `done`.
- **Each task carries four classifiers** (per the request): **Name**, **Complexity** (1–10), **Priority** (what comes first), **Depends on** (other tasks).
- **Map back to the PRD** via the **FRs** field on each task for full acceptance criteria — this doc summarizes; the PRD is authoritative.
- Prefer **TDD** (write tests first) and keep modules small (200–400 lines). The reference architecture favors many small, single-responsibility modules.

### Complexity scale (1–10)
| Range | Meaning |
|---|---|
| 1–3 | Mechanical / well-bounded; little ambiguity. |
| 4–6 | Moderate; multiple moving parts or non-trivial edge cases. |
| 7–8 | Hard; cross-cutting, stateful, or AI/IO-heavy with many failure modes. |
| 9–10 | Very hard; distributed state machine, multi-surface parity, or external-system orchestration. |

### Priority scale (what comes first)
| Priority | Meaning |
|---|---|
| **P0** | Foundation. Blocks most other work. Build first. |
| **P1** | Core MVP. The minimum to deliver the headline workflow (bootstrap → parse → next → expand → status). |
| **P2** | Feature-complete CLI. Full authoring, tagging, research, complexity, model config. |
| **P3** | Advanced surfaces. MCP/agent server, autonomous TDD, cloud/team, interactive shell. |

---

## Recommended tech stack (grounded in the reference implementation)

| Concern | Choice | Notes |
|---|---|---|
| Language / runtime | **TypeScript on Node.js (≥18)** | Single language across CLI + agent server. |
| CLI framework | **commander** | Subcommands, options, global flags. |
| Interactive prompts | **inquirer / @inquirer/search** | Wizards, profile selection. |
| Terminal UI | **chalk, boxen, cli-table3, ora, figlet, gradient-string, marked-terminal** | Formatted output, boxes, tables, spinners. |
| Validation | **zod** | Task/subtask/report/config schemas (single source of truth). |
| AI providers | **Vercel AI SDK (`ai`) + `@ai-sdk/*` provider packages** | Hosted, Azure/Bedrock/Vertex, OpenAI-compatible, OpenRouter, Ollama, CLI/OAuth runtimes. |
| Agent/editor server | **MCP SDK (`@modelcontextprotocol/sdk`) or `fastmcp`** | stdio transport, structured JSON tools. |
| Fuzzy search | **fuse.js** | Relevant-task discovery for research/complexity context. |
| Git integration | **simple-git** | init, branch-aware tags, autonomous TDD commits. |
| Atomic file writes | **steno / proper-lockfile / fs-extra** | Safe task-store and state-file persistence. |
| Tokenization / cost | **gpt-tokens** + model catalog | Telemetry and cost-per-call. |
| Cloud/team backend | **@supabase/supabase-js + OAuth (open + jsonwebtoken)** | `api` storage, auth, briefs. |
| Local viz server (v1.1) | **fastify/express + ws/SSE; Vite-built SPA** | `board`/graph/roadmap server + live channel (T48–T52). Reuse a maintained kanban + graph (e.g. cytoscape/reactflow) lib — do not hand-roll. |
| File watching (v1.1) | **chokidar** | `watch`/live-sync change detection (T51). |
| External sync (v1.1) | **@octokit/rest, @linear/sdk, jira/gitlab clients** behind one adapter | `sync` providers (T53); add providers without unrelated code change. |
| Build / test | **tsdown (or tsup) + vitest + biome** | Bundling, unit/integration tests, lint/format. |

> **Research & reuse note (v1.1):** before building the visualization, sync, and PRD-interview tasks, run `gh search code` / registry searches for an adaptable Task-Master-style board, a tracker-sync adapter, and an interview/elicitation pattern. Prefer porting a proven implementation over net-new code.

---

## Critical path (longest dependency chain to MVP and beyond)

```
T01 → T02 → T03 → T10 → T11 → T25 (parse-spec, MVP planning)
                         └→ T31 → T32 (complexity + expansion)
T03 → T22 (next) ─ depends on T21 (status) ─ both gate the daily loop
T03 + T11 + all core commands → T38 → T39 (MCP server + tool catalog)
T38 + T21 + git → T41 (autonomous TDD)
T05 + T14 → T43 (cloud/team)

# v1.1 builder/dev-experience chains
T11 → T46 (PRD builder) → T47 (check-spec) → T25 (parse-spec)
T03 + T05 + T14 → T48 (viz server) → T49 / T50 / T52 (board / graph / roadmap); T48 + T37 → T51 (watch)
T03 → T56 (history/undo, introduces the storage change-event hook) → consumed by T51 (watch) + T54 (notifications)
T05 + T21 + git → T53 (external sync); T21 + T22 → T54 (notifications/webhooks)
T03 → T55 (search); T03 + T14 → T57 (export/reporting)
```

## Milestones

| Milestone | Tasks | Outcome |
|---|---|---|
| **M0 — Foundation** | T01–T14 | Buildable repo, data model, persistence, config, AI layer, CLI shell. |
| **M1 — MVP planning loop** | T15, T20, T21, T22, T23, T24, T25 | `init` → `parse-spec` → `list`/`show`/`next` → `set-status`; valid dependency graph. |
| **M2 — Feature-complete CLI** | T26–T37 | Authoring, editing, move, expansion, complexity, research, tags, models, lang, generate. |
| **M3 — Agent + autonomy + cloud** | T38–T45 | MCP server, tool catalog, sampling, autopilot TDD, loop, auth/briefs, tui, hardening. |
| **M4 — Builder & developer experience** | T46–T57 | PRD builder, spec check, local board/graph/roadmap, watch/live-sync, external sync, notifications/webhooks, search, history/undo, export/reporting. |

---

# Phase 0 — Project Foundation & Tooling

### T01 — Repository scaffolding, build & test harness
- **Complexity:** 3/10 · **Priority:** P0 · **Depends on:** — (none)
- **FRs:** project-wide enabler (supports all); NFR-3, NFR-11, NFR-13.
- **Scope:** Stand up the TypeScript project that both the CLI and the agent server compile from. Establish the two binary entry points (`the-cli` and the agent server), bundler, test runner, linter/formatter, `tsconfig`, and CI skeleton. Decide single-package vs. workspace layout; reference uses a Turbo monorepo (`apps/`, `packages/`, `mcp-server/`, `src/`), but a single package with `bin/` + `src/` is acceptable for v1 — document the choice.
- **Deliverables:** `package.json` with `bin` map (cli + mcp), `tsconfig.json`, bundler config (tsdown/tsup), `vitest.config.ts`, biome config, `.env.example`, `.gitignore`, `.nvmrc`, CI workflow running build + lint + test.
- **Test strategy:** A trivial smoke test compiles and the CLI binary prints `--version`/`--help`. CI green on a clean checkout.

---

# Phase 1 — Core Data Model & Persistence

### T02 — Task/Subtask schemas & status enumeration
- **Complexity:** 3/10 · **Priority:** P0 · **Depends on:** T01
- **FRs:** FR-16, FR-18 (Task/Subtask shape), FR-25 (status enum).
- **Scope:** Define Zod schemas for **Task** (`id, title, description, details, testStrategy, status, priority{high|medium|low}, dependencies[], subtasks[]`) and **Subtask** (`id, title, description, details, status, dependencies[], metadata?`). Define the **six-value status enum** (`pending, done, in-progress, review, deferred, cancelled`) + the dependency-only equivalence `completed ≡ done` (FR-25.3). Provide `isValidStatus()` and dot-notation helpers (`5.2` → parent 5, subtask 2). Allow string-form IDs for the api backend (FR-18.5).
- **Deliverables:** `schemas/task.ts`, `schemas/status.ts`, ID parse/format utils, exported TypeScript types.
- **Test strategy:** Unit tests for schema accept/reject, status validation (only the six values pass; `completed` only satisfies dependency checks), dot-notation parsing round-trips, string-ID acceptance under api mode.

### T03 — Task store persistence (tag-keyed JSON)
- **Complexity:** 6/10 · **Priority:** P0 · **Depends on:** T02
- **FRs:** FR-17.2–17.4, FR-18, FR-19, FR-65 (legacy migration), NFR-15.
- **Scope:** Read/write the tag-keyed task store (`{ <tag>: { tasks:[], metadata:{created,updated,description} } }`). Guarantee **non-target tags are always preserved** on write (FR-18.6). Stable, human-readable JSON formatting (FR-19.2). Validation: unique task IDs per tag, unique subtask IDs per parent, valid statuses, intra-tag dependency references, optional circular detection (FR-19.1). Auto-migrate a **legacy single-list store** under `master` with a one-time notice (FR-65). Treat an unparseable store as empty for load (next ID = 1) and a fresh object for save (FR-17.4). Use atomic writes (steno/lockfile).
- **Deliverables:** `storage/task-store.ts` (load/save/validate), tag resolution helper (explicit → current → `master`), next-ID allocator, legacy-migration shim.
- **Test strategy:** Round-trip read/write preserves untouched tags; concurrent-write safety; corrupt-file → empty-load + fresh-save; legacy list auto-migrates without data loss; validation flags duplicate/invalid IDs and bad statuses.

### T04 — Runtime state file
- **Complexity:** 2/10 · **Priority:** P0 · **Depends on:** T01
- **FRs:** FR-20, FR-1.2.
- **Scope:** Persist `{ currentTag, lastSwitched(ISO), migrationNoticeShown, branchTagMapping }` in the project config dir. Auto-create with defaults (`currentTag=master`, empty mapping, `migrationNoticeShown=false`); never require manual editing.
- **Deliverables:** `state/runtime-state.ts` with typed get/set and auto-init.
- **Test strategy:** Auto-creates on first read; updates persist `currentTag`/`lastSwitched`; missing file → defaults.

### T05 — Storage backend abstraction (file vs api)
- **Complexity:** 5/10 · **Priority:** P1 · **Depends on:** T03
- **FRs:** FR-18.5, FR-93 (operating mode), §10.1 `storage`.
- **Scope:** Define a **repository interface** (findAll/findById/create/update/delete/move, tag ops) so business logic is storage-agnostic. Provide the `file` implementation now (wraps T03). Stub the `api` implementation (filled by T43). Resolve backend from config `storage.type` and operating mode (`solo|team`).
- **Deliverables:** `storage/repository.ts` interface + `storage/file-repository.ts`; api repository placeholder.
- **Test strategy:** File repository passes the shared repository contract test suite; backend selection honors config; string IDs flow through the interface.

---

# Phase 2 — Configuration & Model Catalog

### T06 — Configuration loading & defaults (deep-merge)
- **Complexity:** 5/10 · **Priority:** P0 · **Depends on:** T01
- **FRs:** FR-91, §10.1 (`models`, `global`, `storage`, provider sub-objects), NFR-7.
- **Scope:** Load the project config JSON and **deep-merge over built-in defaults** per section (each role, `global`, provider sub-objects). Cache after first load with a force-reload path. Degrade gracefully: missing file → defaults + "run model setup" warning (suppressed in api mode / during bootstrap / when warnings suppressed); parse error → log + reset to defaults; invalid main/research provider → role fallback + warning; invalid fallback → clear fallback role. Substitute config template tokens (e.g. year) at creation (FR-1.5).
- **Deliverables:** `config/config-manager.ts` with `getConfig()`, section getters, defaults table from §10.1, cache + force-reload.
- **Test strategy:** Partial config merges correctly; corrupt config resets to defaults without crashing; invalid provider triggers documented fallback; caching + force-reload behaves.

### T07 — Model catalog (single source of truth)
- **Complexity:** 4/10 · **Priority:** P0 · **Depends on:** T01
- **FRs:** FR-72.1–72.3, FR-1.6 (max-token correction), FR-71.2.
- **Scope:** Ship a `supported-models.json` catalog keyed by provider. Per model: `id, displayName?, benchmarkScore(nullable), cost{input,output}(nullable per-million), allowedRoles⊆{main,research,fallback}, maxTokens, supported(bool), reason?, reasoningEffort?, temperatureOverride?, apiType?`. Provide lookup helpers: model→provider inference, role-eligibility check, allowed-provider validation (catalog providers **or** an allow-list of always-permitted custom providers: cloud-managed/router/local). Reconcile per-role max-tokens against catalog limits (min), apply temperature overrides, cap unknown router models conservatively.
- **Deliverables:** `catalog/supported-models.json`, `catalog/model-catalog.ts` (validated load + helpers).
- **Test strategy:** Catalog validates against its schema; role-eligibility blocks disallowed assignments; unsupported models blocked; token reconciliation picks the min; unknown custom model gets the conservative cap.

### T08 — Secret & environment resolution
- **Complexity:** 4/10 · **Priority:** P0 · **Depends on:** T06
- **FRs:** FR-73, NFR-9, §10.3.
- **Scope:** Resolve provider keys/sensitive endpoints from environment only, never config. Precedence: **process env → agent session env → project `.env` file**. Reject empty/placeholder values. No-key providers (local runtimes, cloud-managed via managed credentials, CLI/OAuth runtimes, host-session sampling) report **key-status OK**. Non-secret settings (base URLs, project/region) may live in `global`; secrets must not.
- **Deliverables:** `config/env-resolver.ts`, per-provider key-name map, key-status reporter.
- **Test strategy:** Precedence honored; placeholders rejected; no-key providers report OK; secrets never read from config object.

### T09 — Feature flags & operating-mode resolution
- **Complexity:** 3/10 · **Priority:** P1 · **Depends on:** T06
- **FRs:** FR-92, FR-93.
- **Scope:** Resolve feature flags with priority **env var → agent session env → config**: `enableCodebaseAnalysis` (default on; additionally requires an analysis-capable CLI/OAuth provider be active), `enableProxy` (default off). Resolve **operating mode**: explicit flag → config `storage.operatingMode` → auth fallback (authenticated→team else solo); default solo.
- **Deliverables:** `config/feature-flags.ts`, `config/operating-mode.ts`.
- **Test strategy:** Override precedence for each flag; codebase-analysis gated on provider capability; mode precedence including auth fallback.

---

# Phase 3 — AI Provider Layer

### T10 — Role-based model configuration & provider registry
- **Complexity:** 6/10 · **Priority:** P0 · **Depends on:** T06, T07, T08
- **FRs:** FR-66, FR-71, FR-72.2–72.4.
- **Scope:** Implement the three roles (**main / research / fallback**), each storing `provider, modelId, maxTokens, temperature, baseURL?`. Defaults: temp 0.2 main/fallback, 0.1 research (FR-71.1). Fallback honored only if both provider+modelId present (FR-66.3). Base-URL resolution: explicit role baseURL → provider base-URL env var (FR-71.3). A **provider registry** maps a provider id to its AI-SDK provider factory. Require at least one usable credential or a no-key provider (FR-72.4).
- **Deliverables:** `providers/registry.ts`, `providers/role-config.ts`, role getters returning resolved `{provider, modelId, params, baseURL}`.
- **Test strategy:** Role resolution + defaults; fallback ignored when incomplete; base-URL precedence; registry returns correct factory per provider id.

### T11 — Unified AI service (generate + fallback + telemetry hook)
- **Complexity:** 7/10 · **Priority:** P0 · **Depends on:** T10
- **FRs:** FR-86 (telemetry), NFR-6 (auto-fallback), FR-12.6 (streaming flag), FR-92.
- **Scope:** Single entry point used by every AI command: `generateText`, `generateObject(schema)`, and (behind a flag) streaming with **automatic non-streaming fallback** + 180s streaming timeout (FR-12.6). On **main-role failure, automatically retry with the fallback role** (NFR-6). Return a **telemetry record** for every call (FR-86.1). Inject the configured response language into prompts (FR-90.3). Accept a role selector (main/research) and per-call model override.
- **Deliverables:** `ai/ai-service.ts` (unified), schema-validated object generation via Zod, fallback chain, streaming+timeout path behind flag.
- **Test strategy:** Object generation validates/repairs against schema; main failure → fallback invoked once; streaming flag off by default; telemetry returned on success; language steering present in composed prompt. Mock providers — no live API calls in unit tests.

### T12 — Multi-category provider integrations
- **Complexity:** 8/10 · **Priority:** P1 · **Depends on:** T11
- **FRs:** FR-72 (six categories), FR-74 (advanced sub-objects), FR-81 (sampling — wired in T40).
- **Scope:** Wire concrete providers for all categories: **hosted commercial** (API key); **cloud-managed** (Azure/Bedrock/Vertex — deployment/region/managed creds); **local/self-hosted** (Ollama, default `http://localhost:11434/api`, no key); **OpenAI-compatible custom** (base URL + optional key); **local CLI/OAuth runtimes** (subscription, no per-token key); **host-session sampling** (interface here, implementation in T40). Support per-provider **advanced sub-objects** (FR-74): executable path, working dir, approval/permission/sandbox modes, allowed/disallowed tools, reasoning effort, host tool-integration defs, and a **command-specific override map** keyed by valid AI-command names (schema-validated; invalid keys fail).
- **Deliverables:** `providers/*.ts` per category, advanced-config Zod schemas with per-command override merge.
- **Test strategy:** Each provider factory builds with correct auth/endpoint; no-key providers need no key; advanced sub-object validation rejects bad keys and merges per-command overrides; Ollama uses default endpoint, overridable.

### T13 — Telemetry, cost computation, logging & user ID
- **Complexity:** 4/10 · **Priority:** P1 · **Depends on:** T11
- **FRs:** FR-86, FR-87, FR-88, FR-89, NFR-14, NFR-17.
- **Scope:** Build the telemetry record (`timestamp, userId, commandName, modelUsed, providerName, inputTokens, outputTokens, totalTokens, totalCost, currency=USD`); cost derived from catalog per-million rates (0 for local/free). CLI text mode auto-displays a usage summary after main output; agent mode passes telemetry through `{success, data:{...op, telemetryData}}` with no auto-display (FR-86.2). Logging: levels `debug/info/warn/error/success` (default info), env override, `debug` flag coerced to strict boolean (FR-88.2). Anonymous telemetry opt-out, default on, honored (FR-87). Stable `userId`: generate+persist if absent; write failure → warn + in-memory default (FR-89).
- **Deliverables:** `telemetry/telemetry.ts`, `telemetry/cost.ts`, `utils/logger.ts`, `telemetry/user-id.ts`.
- **Test strategy:** Cost math from catalog (incl. 0 for local); summary shown in CLI text, suppressed in agent; log level + strict-boolean debug; opt-out honored; userId persisted and resilient to write failure.

---

# Phase 4 — CLI Framework

### T14 — CLI framework, global options, UI & lifecycle
- **Complexity:** 5/10 · **Priority:** P0 · **Depends on:** T01
- **FRs:** FR-88, FR-97 (auto-update/banner), FR-11 (root detection), NFR-1, NFR-2.
- **Scope:** Commander-based command registry. Global options available to task-scoped commands: `--file`, `--tag`, `--no-banner`. **Project-root detection** from markers: project config dir, legacy config file, task store (legacy+new), VCS dirs (FR-11). Output/UI toolkit: styled success/warning/error boxes, tables, spinners, markdown rendering, and an **error formatter** producing actionable messages that name the offending input + corrective command (NFR-2). **Auto-update on launch** (skippable via env flag / CI / test mode) and banner suppression (no-banner / non-TTY / bootstrap/tui) (FR-97).
- **Deliverables:** `cli/program.ts`, `cli/global-options.ts`, `ui/*` (boxes/tables/spinner), `cli/error-formatter.ts`, `cli/root-detect.ts`, `cli/auto-update.ts`.
- **Test strategy:** Global options parsed/propagated; root detection across markers; error formatter output shape; auto-update skipped in CI/test; banner suppressed appropriately.

---

# Phase 5 — Project Bootstrap & Editor Integration

### T15 — `init` project bootstrap scaffolding
- **Complexity:** 7/10 · **Priority:** P1 · **Depends on:** T06, T07, T04, T14
- **FRs:** FR-1, FR-7 (VCS/task-storage), FR-10 (onboarding), FR-11.
- **Scope:** `init` scaffolds the project config dir + subdirs (`tasks/`, `docs/`, `reports/`, `templates/`), config file, runtime state file (T04 defaults), `.env.example`, and VCS ignore file (created or **merged** under a labeled header). Copy two spec templates (simple + complex). **Preserve existing files** (skip, never overwrite; write a System-specific README if a README exists). Substitute config token (year) and **correct max-token defaults against the catalog** after copy (FR-1.6). VCS init flags: force-init / skip / auto-init-when-no-repo (FR-7.1); store-tasks-in-VCS controls ignore entries (FR-7.2); skip with warning if VCS unavailable. **Dry-run** logs all intended actions, changes nothing (FR-1.7). Print storage-tailored next steps (FR-10).
- **Deliverables:** `commands/init.ts`, template assets, gitignore merge util, onboarding printer.
- **Test strategy:** Creates full tree; idempotent re-run preserves files; gitignore merge appends only new entries; dry-run is no-op with full log; token substitution + catalog token-correction applied; next-steps reflect storage choice.

### T16 — Interactive vs non-interactive setup & storage selection
- **Complexity:** 6/10 · **Priority:** P1 · **Depends on:** T15, T10
- **FRs:** FR-2, FR-3, FR-8 (chained model/lang), FR-5 (silent).
- **Scope:** Interactive by default; non-interactive when `--yes` **or** both name+description provided (FR-2.1). Interactive prompt order: storage backend → (local only) VCS init (default Yes) then store-tasks-in-VCS (default Yes) → install integration profiles (default No) → response language (default English) → summary + confirm (default Yes; decline exits 0). Ctrl+C during storage selection defaults to **local** (FR-2.4). Storage: local → `file`/`solo`; cloud → `api`/`team` + endpoint + browser OAuth (MFA + org selection), on auth failure log + fall back to local; cloud skips task-in-VCS and local model setup (FR-3). Local interactive non-dry-run → **chain into model setup** + persist language (FR-8); cloud shows "managed remotely" notice. Silent/agent bootstrap: suppress banner/install/model/profile/lang, default local, advise configuring models later (FR-5).
- **Deliverables:** `commands/init-interactive.ts`, storage-selection flow, non-interactive defaults table (FR-2.3).
- **Test strategy:** Non-interactive trigger conditions; prompt ordering + defaults; decline → exit 0; Ctrl+C → local; cloud auth failure → local fallback; silent mode suppresses everything and defaults local.

### T17 — Shell alias management
- **Complexity:** 3/10 · **Priority:** P2 · **Depends on:** T15
- **FRs:** FR-6.
- **Scope:** Append short CLI aliases to the detected shell profile under a dated, labeled comment block; add only missing aliases. `--no-aliases` skips. If shell undetectable or profile absent → silently skip (debug-level log only). Self-heal: remove stale aliases that point to the CLI but are managed by an external tool; clean up empty alias comment blocks.
- **Deliverables:** `commands/aliases.ts`, shell detection util.
- **Test strategy:** Adds only missing aliases; disable flag; missing profile silently skipped; stale alias removal + empty-block cleanup.

### T18 — Editor/agent integration profiles
- **Complexity:** 7/10 · **Priority:** P2 · **Depends on:** T15
- **FRs:** FR-4 (14 profiles, factory, add/remove/setup), §10.4.
- **Scope:** Canonical enumeration of **14 valid profile identifiers** shared by CLI + agent, with a validation helper rejecting unknowns (FR-4.1). A **single profile factory** with per-profile overrides (display name, profile/rules dirs, tool-integration config name/path, file extensions, file mappings, subdir support, default-rules inclusion, lifecycle hooks) and sensible defaults so a new editor is one minimal override (FR-4.7). Install profiles at bootstrap when requested (filtered by operating mode), else interactive ask (FR-4.2–4.3). Accept comma/space-separated lists; unknown names → warn + skip (FR-4.4). Standalone `rules add|remove|setup` (FR-4.5): `add` (interactive selection w/ auto-detected pre-selected; `--yes` auto-detects + installs), `remove` (force skips confirm; guard against removing the **last** profile unless forced), `setup` (selection without re-init or alias changes). Mode option filters rules/commands, auto-detected from config (FR-4.6).
- **Deliverables:** `profiles/factory.ts`, `profiles/registry.ts` (14 profiles), `commands/rules.ts`.
- **Test strategy:** Enumeration validation; factory defaults + overrides; list parsing + unknown-skip; add/remove/setup behaviors; last-profile guard; mode filtering.

### T19 — Legacy migration (`migrate`)
- **Complexity:** 5/10 · **Priority:** P2 · **Depends on:** T03, T15
- **FRs:** FR-9, FR-65, NFR-16.
- **Scope:** `migrate` relocates legacy layouts into the new structure: legacy task store → new path; individual task files → tasks dir; legacy spec/requirements → docs; legacy templates → templates; legacy complexity report → reports; legacy config → new config (FR-9.1). Options: force, backup, cleanup (sensible default), skip-confirmation, dry-run, debug (FR-9.2). For existing projects read **both** legacy + new locations for gradual adoption; new projects use new layout (FR-9.3). Loading a legacy config emits a deprecation warning; `migrationNoticeShown` tracks one-time display (FR-9.4).
- **Deliverables:** `commands/migrate.ts`, dual-location resolver.
- **Test strategy:** Each relocation; force/backup/cleanup/dry-run; dual-read fallback; one-time deprecation notice via state flag.

---

# Phase 6 — Task Lifecycle, Status & Navigation

### T20 — `list` and `show`
- **Complexity:** 4/10 · **Priority:** P1 · **Depends on:** T03, T14
- **FRs:** FR-21 (list), FR-22 (show).
- **Scope:** `list`: all tasks in active/specified tag; `--status` filter; `--with-subtasks` nesting (combinable). Display id, title, status, priority, dependencies (+subtasks when requested); `--file`/`--tag` overrides. `show`: ids positional or `--id`; comma-separated + mixed parent/subtask; subtasks via dot notation. Single id → detailed view with full implementation details; multiple ids → compact summary table + action menu with copy-paste-ready batch commands. Dependencies shown with completed/pending status indicators (FR-45.3).
- **Deliverables:** `commands/list.ts`, `commands/show.ts`, dependency-status renderer.
- **Test strategy:** Status filter + subtask nesting; single vs multi-id rendering; dot-notation resolution; dependency indicators.

### T21 — `set-status` & status semantics
- **Complexity:** 3/10 · **Priority:** P1 · **Depends on:** T03, T14
- **FRs:** FR-24, FR-25.
- **Scope:** `--id` accepts comma-separated + dot notation; `--status` accepts only enumerated values (enum validation rejects others). Marking a **parent `done` cascades `done` to all subtasks** (FR-24.2). Idempotent on already-set status.
- **Deliverables:** `commands/set-status.ts`.
- **Test strategy:** Multi-id + subtask updates; invalid status rejected; parent→subtask cascade; persistence preserves other tags.

### T22 — `next` task selection algorithm
- **Complexity:** 6/10 · **Priority:** P1 · **Depends on:** T03, T14 (complexity annotation optional, from T31)
- **FRs:** FR-23, NFR-18 (determinism).
- **Scope:** Deterministic selection. Eligible = status `pending`/`in-progress` (case-insensitive) **and** every dependency completed (`done`/`completed`). Two-stage: Stage 1 prefers eligible subtasks of `in-progress` parents; Stage 2 (if none) evaluates top-level tasks. Ranking within a stage: (1) priority high>medium>low, (2) fewest dependencies, (3) lowest numeric id (subtasks: parent id then subtask id). If a complexity report exists, annotate the returned task with its score (FR-23.5). Nothing eligible → report "none found", not an error.
- **Deliverables:** `task-manager/find-next.ts`, `commands/next.ts`.
- **Test strategy:** Determinism on identical input; Stage-1 subtask preference; tie-breaking order; dependency gating with `completed≡done`; complexity annotation when report present; empty-eligible → "none found".

---

# Phase 7 — Dependency Management & Validation

### T23 — `add-dependency` / `remove-dependency` + cycle detection
- **Complexity:** 5/10 · **Priority:** P1 · **Depends on:** T03
- **FRs:** FR-41, FR-42.
- **Scope:** `add-dependency` (`--id`, `--depends-on`, both dotted-notation capable): sort dependencies (numeric ascending, then dotted by parent then child) and persist (FR-41.2). Reject missing target/parent, non-existent dependency, self-dependency, and any addition creating a **cycle** (recursive detection) (FR-41.3). Existing dependency → warn + no change. `remove-dependency`: idempotent (no error if absent) (FR-42).
- **Deliverables:** `dependency-manager/add-remove.ts`, recursive cycle detector.
- **Test strategy:** Sorting; rejection cases incl. cycle; idempotent add/remove; warning on duplicate.

### T24 — `validate-dependencies` / `fix-dependencies`
- **Complexity:** 6/10 · **Priority:** P1 · **Depends on:** T23
- **FRs:** FR-43, FR-44, FR-45.2, R-1 (define exit semantics).
- **Scope:** `validate-dependencies` (read-only): count tasks/subtasks, detect `self`/`missing`/`circular`; clean → success+counts; problems → per-issue type tag + failure summary; must not modify files. **Define explicit non-zero exit / strict CI mode** (resolves PRD Risk R-1). `fix-dependencies`: remove duplicates; remove invalid/non-existent refs + subtask self-deps; detect+break circular chains; write only if changed; print counts summary (invalid/self/duplicates/circular/tasks/subtasks). Internal repair helper guarantees ≥1 dependency-free subtask per task (entry point) (FR-45.2).
- **Deliverables:** `dependency-manager/validate.ts`, `dependency-manager/fix.ts`, entry-point repair util.
- **Test strategy:** Detection of all three issue types; read-only guarantee; exit code/strict mode; fix writes only on change + accurate counts; entry-point guarantee after repair.

---

# Phase 8 — Specification Ingestion & Automated Task Generation

### T25 — `parse-spec` (spec → tasks)
- **Complexity:** 8/10 · **Priority:** P1 · **Depends on:** T11, T03, T14
- **FRs:** FR-12–FR-17.
- **Scope:** Read a plain-text/markdown spec, send it + a generation prompt to the model, validate the structured response against the strict Task schema, run **deterministic ID/dependency processing**, and write under the target tag. Input: positional or `--input` (input wins); default input = docs spec file, default output = task store (create dir if missing). `--num-tasks` default 10; `0` = AI-determined; warn above ~50 (FR-13). **Force guard** (FR-14): without append/force, populated tag fails with "tag already contains N tasks…" (CLI non-zero, agent raises); `--append` continues IDs from `max+1`; `--force` overwrites target tag only; all other tags preserved. `--research` selects research role + prompt variant + (if capable) codebase analysis (FR-15). ID/dep processing (FR-16): sequential IDs from next available; defaults (status `pending`, priority `medium`, deps `[]`); AI IDs must be unique/positive/contiguous/sequential (else error); remap+filter deps (drop forward/dangling/null; coerce non-array → `[]`); backfill missing fields. Non-streaming by default; streaming behind flag with 180s timeout + non-streaming fallback (FR-12.6). Empty/unreadable spec → clear error. Success summary: new count, total, "research-backed" note, next steps.
- **Deliverables:** `task-manager/parse-spec.ts`, ID/dep processor, generation prompt templates (default + research + codebase-analysis variants).
- **Test strategy:** Schema validation + repair; ID contiguity enforcement; dep remap/filter; append vs force vs guard; other tags preserved; num-tasks=0 path; empty-spec error; research note in summary. Mock AI.

---

# Phase 9 — Task Authoring, Editing & Moving

### T26 — `add-task` (manual or AI)
- **Complexity:** 5/10 · **Priority:** P2 · **Depends on:** T11, T03
- **FRs:** FR-26.
- **Scope:** Manual when title+description supplied (details/testStrategy default empty); else send prompt to main/research model to synthesize a complete task. Options: `--prompt`, `--title`, `--description`, `--details`, `--dependencies` (csv), `--priority` (default medium), `--research`, `--file`, `--tag`. New task → next id in active tag, status `pending`, empty subtasks; AI runs report telemetry. Error if neither prompt nor both title+description; if no store, instruct to bootstrap first.
- **Deliverables:** `task-manager/add-task.ts`.
- **Test strategy:** Manual vs AI path; next-id allocation; validation errors; telemetry on AI path; no-store guidance.

### T27 — `update` / `update-task` / `update-subtask`
- **Complexity:** 6/10 · **Priority:** P2 · **Depends on:** T11, T03
- **FRs:** FR-27, FR-28, FR-29.
- **Scope:** `update` (bulk): revise all tasks with id ≥ `--from` (default 1) via `--prompt` (required); `--research`; **guard against passing `--id`** (error → point to single update). `update-task`: target one id (positional or `--id`, positional wins); `--append` adds a timestamped note instead of rewriting; ids accept numeric/dotted/string-form; `--research`; missing resolvable id → error with usage examples. `update-subtask`: target a subtask (dot notation; non-dotted string ids valid under api); appends timestamped content (never overwrites); `--prompt` required unless only metadata updated; agent-only `--metadata` (JSON merge) gated behind an explicit env flag; error if neither prompt nor metadata.
- **Deliverables:** `task-manager/update.ts`, `update-task.ts`, `update-subtask.ts`, timestamped-append util.
- **Test strategy:** Bulk from-id selection + id-guard; append vs replace; dotted/string ids; subtask append-only; metadata gating; validation errors.

### T28 — `add-subtask` / `remove-subtask` / `remove-task` / `clear-subtasks`
- **Complexity:** 5/10 · **Priority:** P2 · **Depends on:** T03
- **FRs:** FR-30, FR-31, FR-32, FR-33.
- **Scope:** `add-subtask`: `--parent` required; `--title` creates new, `--existing-task-id` converts a task to a subtask; options incl. `--status` (default pending), `--dependencies` (dotted kept as string else int), regenerate-files flag; new subtask gets next id in parent. `remove-subtask`: `--id` csv dotted (non-dotted errors); `--convert` promotes to standalone task; regenerate flag. `remove-task`: `--id` csv (tasks/subtasks); pre-delete identify existing ids, count subtasks deleted, surface dependent warnings; confirm unless `--yes`; missing/empty ids or empty store → error. `clear-subtasks`: `--id` csv **or** `--all` (neither → error); `--all` clears every task in active tag.
- **Deliverables:** `task-manager/{add-subtask,remove-subtask,remove-task,clear-subtasks}.ts`.
- **Test strategy:** Create vs convert; promote-on-remove; dependent warnings + confirm/yes; clear via id list vs all; all validation errors.

### T29 — `move` (reorder/relocate within & across tags)
- **Complexity:** 7/10 · **Priority:** P2 · **Depends on:** T03, T23
- **FRs:** FR-34, FR-64.
- **Scope:** Within-tag (`--from`/`--to`): task→subtask, subtask→standalone, subtask→different parent, reorder within parent, move to new id position (placeholder created if absent). Bulk moves require equal from/to counts. Cross-tag (`--from-tag`/`--to-tag`): auto-create missing target; omitted from-tag = current. **Subtasks not moved directly between tags** — promote first or move with parent. Dependency flags `--with-dependencies` (move dependents, preserve links) and `--ignore-dependencies` (break cross-tag links), mutually exclusive; **no legacy force-move flag**. Identical source/target tag → error; cross-tag dependency conflicts → detailed error listing conflicts + numbered resolution options.
- **Deliverables:** `task-manager/move.ts`, conflict reporter.
- **Test strategy:** Each within-tag transformation; placeholder creation; bulk count check; cross-tag auto-create; subtask cross-tag prohibition; with/ignore-deps mutual exclusion; conflict messaging.

### T30 — `scope-up` / `scope-down`
- **Complexity:** 4/10 · **Priority:** P3 · **Depends on:** T11, T03
- **FRs:** FR-35.
- **Scope:** AI increases/decreases task/subtask complexity/detail. `--id` csv required (omission → error w/ usage example); `--strength` light|regular(default)|heavy; `--prompt` custom; `--research`; `--tag` scoping.
- **Deliverables:** `task-manager/scope.ts`, scope-up/down prompt variants.
- **Test strategy:** Strength levels alter prompt; id-required error; research routing; telemetry.

---

# Phase 10 — Complexity Analysis & Task Expansion

### T31 — `analyze-complexity` + report merging + `complexity-report` view
- **Complexity:** 7/10 · **Priority:** P2 · **Depends on:** T11, T03
- **FRs:** FR-46, FR-47, FR-48, FR-50.
- **Scope:** Filter to active tasks (pending/blocked/in-progress; skip done/cancelled/deferred), gather project context via fuzzy search, call AI, write report to reports dir (FR-46.1). Options: `--output`, `--model`, `--threshold` (1–10, default 5), `--file`, `--research`, `--id` csv, `--from`, `--to`, `--tag`. Report = `meta` (generatedAt, tasksAnalyzed, totalTasks, analysisCount, thresholdScore, projectName, usedResearch) + `complexityAnalysis[]` strict schema (taskId, taskTitle, complexityScore 1–10, recommendedSubtasks ≥0, expansionPrompt, reasoning; no extra fields). Omitted tasks → inject default analysis (score 5, 3 subtasks, generic prompt). Empty filter match → retain existing/empty report + warning. Provider-key errors → advise model setup (CLI non-zero, agent rethrows). **Tag-aware merging** (FR-47): filenames tag-suffixed for non-default tags; re-analysis overwrites re-analyzed ids, retains only current-tag ids (drop cross-tag); corrupt report → treat as none + warning; search legacy locations. `--research` sets `usedResearch=true`. `complexity-report` view (FR-48): distribution summary (Low<5/Medium5–<8/High≥8 counts+%), "Tasks Needing Expansion" table (≥threshold) w/ ready-to-run expand commands, "Simple Tasks" table (<threshold) w/ reasoning, suggested actions; score colors green≤3/yellow≤6/red else; table membership driven by report threshold; options `--file`/`--tag`.
- **Deliverables:** `task-manager/analyze-complexity.ts`, `complexity-report.ts`, report schema + merge util, fuzzy context gatherer.
- **Test strategy:** Active-task filtering; strict schema; default injection for omitted; tag-suffixed filenames + merge retention; corrupt-report handling; view buckets/colors/threshold-driven tables; research flag.

### T32 — `expand` / `expand-all`
- **Complexity:** 7/10 · **Priority:** P2 · **Depends on:** T11, T03, T31
- **FRs:** FR-36, FR-37, FR-38, FR-39, FR-40, FR-49.
- **Scope:** `expand` one task → AI subtasks appended. Options: `--id`, `--num`, `--prompt`, `--research`, `--force`, `--complexity-report`, `--file`, `--tag`. **Count precedence**: explicit `--num`(≥0) → report `recommendedSubtasks` → configured default (5; invalid → 3) (FR-49.1, FR-40). `num=0` → dynamic count ignoring report. If a report entry has an expansion prompt, switch to the complexity-report prompt variant + inject reasoning as context (accept prompt as string or `{text}`) (FR-49.2). Without `--force`, expanding a task that already has subtasks is a no-op (FR-36.4). `expand-all` (`--all`): only pending tasks; per-task complexity recs when available else defaults; skip tasks with subtasks unless `--force`. `--research` routes through research role (requires configured provider+key). Force pairs with `clear-subtasks` for full reset.
- **Deliverables:** `task-manager/expand.ts`, `expand-all.ts`, count-precedence resolver.
- **Test strategy:** Count precedence incl. invalid→3 and num=0 dynamic; report-prompt variant + reasoning injection; no-op without force; expand-all pending-only + skip-existing; research routing.

---

# Phase 11 — AI-Assisted Research

### T33 — `research` (project-context-augmented query)
- **Complexity:** 8/10 · **Priority:** P2 · **Depends on:** T11, T03
- **FRs:** FR-51–FR-57.
- **Scope:** Free-form AI query always using the **research role**. CLI takes query positionally + streams answer, strips internal reasoning sections, renders cleaned markdown with a header (query + detail level); agent uses non-streaming + returns text. Empty query rejected; error if project root undeterminable. Result exposes: query, result, context size/tokens, token breakdown (system/user/total input), detail level, telemetry, tag info. **Context sources** (FR-52): task/subtask ids (csv, dotted; invalid reported); automatic fuzzy relevant-task discovery (max 8, recent+category, best-effort/silently tolerant); file context (csv paths, per-file token/size, existence-validated); custom free-text; optional project file tree (default off, counts reported). `--detail` low|medium(default)|high (invalid rejected). `--save-to <id>` appends a formatted thread to task (task-update append) or subtask (subtask-update); missing store/parent/subtask/task → clear errors. `--save-file` writes markdown under docs research dir (`<YYYY-MM-DD>_<query-slug>`; slug rules; YAML front matter + sections + footer; agent returns saved path). **CLI interactive follow-up loop** (FR-56): ask follow-up / save file / save to task / quit; follow-ups prepend full history, preserve custom context, clear explicit ids so fuzzy re-runs; silently skipped in non-interactive terminals. Display context-analysis + usage/cost breakdown (FR-57).
- **Deliverables:** `task-manager/research.ts`, context gatherers (ids/files/tree/fuzzy), reasoning-stripper, markdown saver, follow-up loop.
- **Test strategy:** Each context source incl. fuzzy best-effort; detail validation; save-to task vs subtask; markdown filename/front-matter; follow-up history + id-clearing; non-interactive skip; empty-query + no-root errors.

---

# Phase 12 — Multi-Context / Tagged Task Lists

### T34 — Tag operations (`add-tag`/`use-tag`/`list-tags`/`rename`/`copy`/`delete`) + isolation
- **Complexity:** 6/10 · **Priority:** P2 · **Depends on:** T03, T04
- **FRs:** FR-58–FR-63, FR-62 (global `--tag`), FR-65.
- **Scope:** `add-tag` (`--description`, `--from-branch` [ignores given name], `--copy-from-current`, `--copy-from <tag>`); empty unless a copy option. `use-tag`: persist `currentTag`+`lastSwitched`; subsequent defaults scope to it. `list-tags`: per-tag task counts, completion %, ready-task counts; `--show-metadata`. `rename-tag` preserves tasks; `copy-tag` duplicates tasks+metadata into isolated tag (optional description); `delete-tag` removes tag+tasks (CLI confirm unless `--yes`; agent defaults to skip confirm). **Global `--tag`** targets a tag for one command without switching context; full **isolation** (ops in one tag never affect others; cross-tag requires explicit opt-in). **Branch-aware** tag derivation opt-in (no auto-switch) (FR-63).
- **Deliverables:** `task-manager/tags.ts`, branch-name→tag util, ready-count computation.
- **Test strategy:** Create (empty/copy/from-branch); switch persistence; list metrics; rename/copy/delete + confirm; global-tag isolation; branch derivation opt-in.

---

# Phase 13 — Model & Language Configuration (CLI)

### T35 — `models` command (view / setup / set-* / provider flags)
- **Complexity:** 6/10 · **Priority:** P2 · **Depends on:** T10, T14
- **FRs:** FR-67, FR-68, FR-69, FR-70, FR-72.
- **Scope:** No-flags / `list` → show role assignments, per-provider key presence/status, available built-in models (FR-67). `--setup` interactive wizard selecting provider/model per role (incl. custom/local), then persist (FR-68). `--set-main`/`--set-research`/`--set-fallback` assign with provider inference for known built-ins (FR-69). **Provider-specifier flags** (FR-70): local-runtime, OpenAI-compatible router, cloud-managed (azure/bedrock/vertex), local-CLI/OAuth runtimes, OpenAI-compatible custom, `--baseURL` override; >1 provider flag → error; custom model ids bypass built-in validation. Enforce role-eligibility + supported checks from the catalog (T07).
- **Deliverables:** `commands/models.ts`, setup wizard, provider-flag parser.
- **Test strategy:** View output; set-* + inference; provider-flag exclusivity; custom-id bypass; role-eligibility enforcement.

### T36 — `lang` command (response language)
- **Complexity:** 2/10 · **Priority:** P3 · **Depends on:** T06, T14
- **FRs:** FR-90.
- **Scope:** `--response <lang>` sets directly; `--setup` prompts (default English). Default English, stored in global config; success prints confirmation, failure exits non-zero. Configured language steers AI output across operations (wired via T11 prompt composition).
- **Deliverables:** `commands/lang.ts`.
- **Test strategy:** Set vs setup; default English; persistence; steering present in composed prompts.

---

# Phase 14 — Task File Generation & Export

### T37 — `generate` per-task files + `sync-readme`
- **Complexity:** 5/10 · **Priority:** P2 · **Depends on:** T03, T14
- **FRs:** FR-84, FR-85, FR-17.5.
- **Scope:** `generate`: produce per-task files from the store. Options `--tag`, `--output` (default tasks dir), `--project` (auto-detect), `--format` text(default)|json. Report generated count, output dir, orphaned files removed (no longer in store). File sections: overview, tag context, implementation details, subtask breakdown, dependency status indicators. Filename pattern zero-padded `task_<NNN>` (FR-17.5). text → styled boxes; json → structured; errors → cleanup then non-zero exit. `sync-readme`: write current task list into README; options `--file`, `--with-subtasks`, `--status`, `--tag` (default master); failure → error + non-zero exit.
- **Deliverables:** `task-manager/generate.ts`, `sync-readme.ts`, file template.
- **Test strategy:** File contents + sections; orphan cleanup; text vs json; zero-padded names; sync-readme filter/subtasks; error exit codes.

---

# Phase 15 — Programmatic Agent/Editor Integration (MCP Server)

### T38 — Agent integration server skeleton (stdio, modes, envelope)
- **Complexity:** 8/10 · **Priority:** P3 · **Depends on:** T11, T14, and the direct-function cores of T20–T37
- **FRs:** FR-75, FR-76, FR-77, FR-79, FR-80, FR-83.
- **Scope:** stdio MCP server, launchable on demand; registers a selected tool set; returns structured JSON per call; individual registration failures logged without aborting startup ("already registered" = success). Keys from host env block or project `.env`. **Configurable timeout** 1–3600s (default 60; ~300 recommended for AI ops). **Tool-loading modes** via env var (FR-77): `core`/`lean` (default, 7 tools), `standard` (14), `all` (full), or custom csv; case-insensitive + underscore/hyphen normalization + alias map; unknown custom names dropped w/ warning; empty custom → fall back to all; unparseable → all. Core set = list, next, get-task, set-status, update-subtask, parse-spec, expand. Standard adds bootstrap, analyze-complexity, expand-all, add-subtask, remove-task, add-task, complexity-report. **Calling conventions** (FR-79): require explicit absolute project root; resolution precedence env → call args → session fallback (decode URIs, convert platform paths); long-running tools under raised timeout. **Uniform envelope** (FR-80): internal `{success, data?, error?{code,message}}`; wrapper attaches version metadata + host content `{content:[{type:'text',text}]}` (objects JSON-stringified, indented); error sets error flag + `{error:{code,message}}` + version/tag metadata; higher-order wrapper ensures project root present/normalized. Host wiring (FR-76): per-host config block (command, args, env[keys + tool-loading mode], optional timeout, optional transport `type`); accommodate hosts with a differently-named top-level key + per-server transport type; ≥1 host (OAuth runtime) needs no provider key. Optional long-running-operation status tool (FR-83).
- **Deliverables:** `mcp-server/index.ts`, `mcp-server/tool-loader.ts` (modes/aliases), `mcp-server/envelope.ts`, `mcp-server/project-root.ts`, host config examples.
- **Test strategy:** Mode resolution + normalization + fallbacks; core/standard membership; envelope shape success+error; project-root precedence + URI/path handling; registration-failure tolerance; timeout config bounds.

### T39 — Tool catalog (~44–45 tools) + silent bootstrap parity
- **Complexity:** 7/10 · **Priority:** P3 · **Depends on:** T38, and each wrapped command
- **FRs:** FR-78, FR-12.4, FR-5 (silent bootstrap via agent), §10.4.
- **Scope:** Registry mapping every tool name → registration fn; each tool a **thin wrapper around the corresponding CLI capability** returning structured JSON (FR-78.1, ~44–45 tools). Cover all task/subtask/dependency/tag/complexity/research/model/profile/generation/autonomous-workflow ops. Normalize name casing/hyphenation on lookup (FR-78.2). Mark state-changing tools destructive (e.g. parse-spec requires absolute root, supports progress reporting, returns JSON — FR-12.4). Agent bootstrap runs **silently** + defaults local (FR-5). Map CLI/agent option differences (e.g. add-subtask: CLI `--parent`→tool `id`, `--existing-task-id`→`taskId`, regenerate opt-in CLI vs `skipGenerate` opt-out — FR-30.5).
- **Deliverables:** `mcp-server/tools/*.ts`, `mcp-server/tool-registry.ts`.
- **Test strategy:** Every tool registers + returns valid envelope; name normalization; destructive flags; CLI↔tool option mapping parity (sample across categories); silent bootstrap defaults.

### T40 — Host-session sampling provider
- **Complexity:** 6/10 · **Priority:** P3 · **Depends on:** T38, T12
- **FRs:** FR-81.
- **Scope:** Optionally use the host session's model via **sampling** instead of a direct provider key. Require an active session whose client advertises sampling; support text, schema-driven structured output, and spec parsing via sampling. Fail clearly outside a sampling-capable session; recommend a non-sampling fallback provider. Reports key-status OK (no key).
- **Deliverables:** `mcp-server/providers/sampling.ts`, AI-service integration as a provider.
- **Test strategy:** Sampling text + structured + parse paths (mock session); clear failure without capability; key-status OK; fallback recommendation.

---

# Phase 16 — Autonomy

### T41 — Autonomous TDD workflow (`autopilot`) — CLI + agent tools
- **Complexity:** 9/10 · **Priority:** P3 · **Depends on:** T38, T21, T23, git (simple-git)
- **FRs:** FR-82.
- **Scope:** Resumable TDD **state machine** over a task's subtasks with VCS integration; exposed as agent tools **and** a CLI parent command. Phases RED→GREEN→REFACTOR→COMMIT→FINALIZE; persist state on disk (phase, TDD phase, taskId, subtasks, maxAttempts, branch, attempts, progress, testResults, coverage, orgSlug, tag). `start`: validate main task id (not subtask), no existing workflow (unless `--force`), require subtasks, create feature branch (derived from tag/org slug), init state; return branch/phase/tdd-phase/progress/current-subtask/next-action; `--max-attempts` default 3. `next`: next action. `complete`: validate test results — RED requires ≥1 failing (zero failures auto-completes subtask), GREEN requires all passing; reject during COMMIT (direct to commit); inputs `{total,passed,failed,skipped?}` + optional coverage. `commit`: confirm COMMIT phase + current subtask, stage (specified files or all), generate conventional message from subtask+TDD phase (test for RED, feat for GREEN) or custom, embed metadata (task/subtask/phase), commit, advance. `finalize`: require FINALIZE + clean tree; finalize + mark main task done. `status`: phase/progress/subtask/history. `resume`: reload paused (error if none). `abort`: cancel active (CLI confirms unless force/JSON), note branch/commits remain for manual cleanup. All require absolute project root + prompt to start when no active workflow.
- **Deliverables:** `autopilot/state-machine.ts`, `autopilot/persistence.ts`, CLI `commands/autopilot.ts`, agent `autopilot_*` tools, conventional-commit generator.
- **Test strategy:** Phase transitions + guards; RED/GREEN validation incl. zero-failure auto-complete; commit message generation + metadata; finalize clean-tree gate + task-done; resume/abort; no-workflow errors; persistence round-trip. Mock git.

### T42 — `loop` (autonomous task loop, CLI)
- **Complexity:** 5/10 · **Priority:** P3 · **Depends on:** T22, T21
- **FRs:** FR-95.
- **Scope:** Run an AI assistant in a loop, one task per iteration. Options: `--iterations` (default auto from preset + pending count), `--prompt` (preset default/aggressive/careful or custom file path; default `default`), `--progress-file` (default progress log in config dir), `--tag`, `--project`, `--sandbox`, `--no-output`, `--verbose`. With `--sandbox`, validate sandbox auth before running; only the default preset previews the next pending task. Read pending tasks (optionally tag-filtered), write progress log, print formatted final results incl. completion status.
- **Deliverables:** `commands/loop.ts`, presets, progress logger.
- **Test strategy:** Iteration derivation; preset selection + custom file; sandbox auth gate; progress-file writing; tag filtering; final results format.

---

# Phase 17 — Cloud / Team Collaboration

### T43 — `auth` / `context` / `briefs` + API storage backend
- **Complexity:** 8/10 · **Priority:** P3 · **Depends on:** T05, T14, T16
- **FRs:** FR-3 (cloud path), FR-94, FR-18.5, NFR-10.
- **Scope:** Implement the **`api` storage backend** (remote store, string-form ids) behind the T05 repository interface (Supabase/REST). `auth` (login/logout/status/refresh; top-level login/logout aliases): browser OAuth **or** token-based (remote/SSH), MFA, optional post-login workspace context, teammate invite; **credentials stored locally, user-scoped, never in project config** (NFR-10, FR-3.7). `context`: manage active org + brief — default action sets context from brief id/URL or shows current; org/brief/set/clear subcommands; changing org clears brief; selecting a brief requires an org; `--no-header` suppresses banner. `briefs` (alias `brief`): list (status, updated, task counts, current marker), select (interactive if no arg), create → redirect to web UI; all require api/cloud storage + valid auth. Cloud bootstrap path (FR-3.3–3.5): set api/team + endpoint, OAuth w/ MFA + org selection, skip task-in-VCS + local model setup, on auth failure fall back to local.
- **Deliverables:** `storage/api-repository.ts`, `commands/auth.ts`, `context.ts`, `briefs.ts`, credential store (user-scoped).
- **Test strategy:** Repository contract on api backend (mock server); login/token/MFA flow; context org/brief rules; briefs require auth+cloud; credentials outside project config; cloud-bootstrap fallback to local on failure.

---

# Phase 18 — Interactive Shell & Hardening

### T44 — Interactive shell (`tui`/`repl`) fallback
- **Complexity:** 2/10 · **Priority:** P3 · **Depends on:** T14
- **FRs:** FR-96.
- **Scope:** `tui` (alias `repl`); running the CLI with no args launches it. Current version **gracefully falls back to auth-aware help** with a "coming soon" notice; in a non-interactive terminal render briefly then exit with a hint. (Full TUI is a roadmap item — §15.)
- **Deliverables:** `commands/tui.ts`.
- **Test strategy:** No-arg launch → help fallback; non-interactive → brief render + exit hint; banner suppressed for tui.

### T45 — Integration/E2E test suite, docs & release packaging
- **Complexity:** 5/10 · **Priority:** P2 (continuous) · **Depends on:** all functional tasks (validate as each milestone lands)
- **FRs:** §12 end-to-end workflows; NFR-3 (dual-surface parity), NFR-18.
- **Scope:** End-to-end coverage of the six PRD workflows (§12): greenfield bootstrap→parse→analyze→expand→next; daily next→status loop; mid-project re-planning; multi-branch tags; agent-driven autonomous TDD; **and the v1.1 idea→PRD→plan→board flow (§12.6)** (prd→check-spec→parse→board/watch→sync→export). **Dual-surface parity tests**: same core logic via CLI and agent tool produce equivalent results (CLI formatted vs JSON), including the v1.1 agent tools (T46–T57). Determinism tests for `next` + dependency validation. Package both binaries; finalize README/docs/help; verify ≥80% coverage target.
- **Deliverables:** `tests/e2e/*`, parity harness, packaging config, user docs.
- **Test strategy:** Each §12 workflow runs green; CLI vs agent parity assertions; coverage gate; published binaries smoke-tested.

---

# Phase 19 — Interactive PRD Authoring & Spec Quality (v1.1)

> Front-of-funnel for **Project Builders**: author a spec, then gate its quality before parsing. Both feed `parse-spec` (T25).

### T46 — `prd` interactive PRD Builder
- **Complexity:** 7/10 · **Priority:** P2 · **Depends on:** T11, T14 (writes into docs scaffolded by T15)
- **FRs:** FR-98.
- **Scope:** Guided Q&A interview that drafts a spec into the docs dir. Seed from a one-line idea, a chosen template (simple/complex, FR-1.3), or an existing draft. Sequence topic areas (problem/background → users/personas → goals & non-goals → core features/scope → constraints/assumptions → success metrics). Each round sends prior answers + project context to the main/research model to generate **adaptive follow-up questions**; user can answer/skip/ask-something-else; configurable stop (max rounds and/or "enough detail"). Support interactive prompts, **non-interactive batch** (`--answers <file>`), and **resume** (persist interview state in the config dir). On finish, render the spec with the selected template structure, write to the docs spec path (FR-12.2; title-slug filename), preserve existing files (FR-1.4 semantics), and offer to chain into `check-spec` (T47) + `parse-spec` (T25). `--research` routes question-gen/draft through the research role. Telemetry (FR-86) + response language (FR-90). Agent tool: absolute root, state-changing, multi-turn elicitation or batch, returns saved path.
- **Deliverables:** `commands/prd.ts`, `prd/interview-state-machine.ts`, per-topic question-gen prompts, template-aware spec renderer, agent `build_prd` tool.
- **Test strategy:** Topic sequencing; follow-up generation (mock AI); batch mode from answers file; resume round-trip; template rendering; existing-file preservation; chain offer; telemetry.

### T47 — `check-spec` spec readiness / quality gate
- **Complexity:** 5/10 · **Priority:** P2 · **Depends on:** T11, T14 (pairs with T25)
- **FRs:** FR-99.
- **Scope:** Read a spec (positional/`--input`/default docs path). AI scores dimensions — clarity, completeness, scoped-ness, testability, implied structure — 1–10, plus an overall readiness score and pass/warn/block verdict vs a configurable `--threshold` (default 5). List concrete gaps/ambiguities with suggested fixes and the section each maps to. Empty/unreadable spec → same error as FR-12.5. Read-only w.r.t. the store; optional `--report` writes markdown under reports dir. **Define explicit non-zero exit / `--strict` (CI) mode** (mirrors the R-1 resolution in T24). CLI summary + agent JSON both expose per-dimension scores, verdict, and gap list; telemetry.
- **Deliverables:** `commands/check-spec.ts`, scoring Zod schema, scoring prompt, optional report writer, agent `check_spec` tool.
- **Test strategy:** Dimension scoring (mock AI); threshold verdict; gap list shape; empty-spec error; strict exit code; read-only guarantee.

---

# Phase 20 — Visualization & Local Dashboard (v1.1)

> Local visual surfaces for **Developers**. Read-models over core logic (NFR-22); writes route through existing commands.

### T48 — Visualization server foundation (web server + read API + live channel)
- **Complexity:** 6/10 · **Priority:** P3 · **Depends on:** T03, T05, T14
- **FRs:** FR-100 (server infra), FR-101/FR-103 (shared), FR-102 (live channel).
- **Scope:** Local HTTP server: bind **localhost by default** (NFR-19), configurable `--port` (default auto, printed URL), `--host`, auto-open browser unless `--no-open`. Read API over the **repository interface (T05)** exposing tasks/tags for the active/specified tag. **Live channel** (SSE/WebSocket) for push updates consumed by board/graph (T49/T50). `--read-only` refuses server-side writes; all writes route through core `set-status`/`expand` (no validation bypass, FR-19). Serve the SPA static assets. **Reuse** a maintained web stack + kanban/graph UI libs (research-&-reuse note above) rather than hand-rolling.
- **Deliverables:** `viz/server.ts`, `viz/api.ts` (read + guarded write), `viz/live-channel.ts`, `viz/static/` SPA shell, `commands/board.ts` launcher.
- **Test strategy:** Localhost binding + port selection; read-API shape per tag; read-only refuses writes; write path routes through core; live channel emits on change; clean shutdown.

### T49 — Kanban board UI
- **Complexity:** 6/10 · **Priority:** P3 · **Depends on:** T48, T21
- **FRs:** FR-100.
- **Scope:** SPA board: one column per six-value status in lifecycle order; cards show id/title/priority/readiness indicator/subtask progress. Drag→column calls core `set-status` (T21) incl. parent→subtask cascade (FR-24.2). Tag switcher + status/priority filters. Live-update via T48 channel with manual-refresh fallback. `--read-only` hides write affordances. Team/api mode reads via repository (no duplicate auth, FR-100.7).
- **Deliverables:** `viz/ui/board/*` components, drag→API handler.
- **Test strategy:** Column mapping; card fields; drag→status persists + cascade; filters; live update; read-only hides actions. (Component/integration; full e2e in T45.)

### T50 — Dependency-graph (DAG) view
- **Complexity:** 6/10 · **Priority:** P3 · **Depends on:** T48, T24
- **FRs:** FR-101.
- **Scope:** Render DAG: nodes = tasks (toggle subtasks), edges = dependencies; styling encodes status/priority. Visually flag issues from validate (T24): missing/circular/self; highlight critical path + next task (T22). Node select → detail at parity with `show` (T20) + quick actions (set-status/expand) routed through core. Shares server/port/tag/read-only (T48).
- **Deliverables:** `viz/ui/graph/*`, tasks→DAG builder, issue-overlay.
- **Test strategy:** Node/edge construction; issue flagging; next/critical highlight; node-detail parity; quick actions route through core.

### T51 — Watch / live-sync mode
- **Complexity:** 5/10 · **Priority:** P3 · **Depends on:** T48, T37 (consumes change-event hook from T56)
- **FRs:** FR-102.
- **Scope:** Watch the task store (+ optional spec/docs file); **debounced, atomic-read-aware** change detection (no mid-write races, FR-19.2) via chokidar. Push to the board live channel (T48). As a standalone command, re-run a configured `--on-change` action (generate T37 / sync-readme T37 / validate-deps T24). Resilient to transient states; clean stop on interrupt. Consumes the shared storage change-event stream (introduced in T56), shared with notifications (T54).
- **Deliverables:** `watch/watcher.ts`, debounce util, `commands/watch.ts`.
- **Test strategy:** Change detection + debounce; mid-write resilience; push to channel; on-change action runs + logs; clean shutdown.

### T52 — Roadmap / milestone view
- **Complexity:** 4/10 · **Priority:** P3 · **Depends on:** T03, T48
- **FRs:** FR-103.
- **Scope:** Optional `milestone`/phase label in task metadata. `roadmap` groups tasks by milestone with counts, completion %, ready/blocked (reuse next-readiness, T22). Derive milestones from dependency depth when unlabeled (marked derived). Tag-aware. Render as a CLI summary **and** a viz-server view (T48). **NG-1 guard:** no dates/durations/resourcing.
- **Deliverables:** `commands/roadmap.ts`, milestone grouper, `viz/ui/roadmap/*`, agent `get_roadmap` tool.
- **Test strategy:** Explicit vs derived grouping; counts/%/ready; tag scoping; NG-1 guard (rejects time fields); CLI vs view parity.

---

# Phase 21 — External Integrations & Eventing (v1.1)

> Bridges to where developers already work, and outward eventing.

### T53 — External tracker / Git-platform sync (`sync`)
- **Complexity:** 8/10 · **Priority:** P3 · **Depends on:** T05, T21, git (simple-git)
- **FRs:** FR-104.
- **Scope:** Single **adapter interface** for sync providers (GitHub Issues / GitLab / Linear / Jira), extensible like the catalog/profile factory (§10.4). Direction `push|pull|two-way` + conflict policy (`newest-wins|prefer-local|prefer-remote|report-only`) + `--dry-run` (parity FR-1.7). Persisted **external-id mapping** (task metadata + mapping file) so repeated syncs update, not duplicate. Status mapping six-enum↔provider states (documented, overridable). Optionally link tasks↔branches/commits/PRs (extends autopilot T41) and advance status on PR-merge/issue-close in two-way mode. **Credentials env-only** (FR-104.5 / NFR-20). CLI + agent tool (absolute root). Per-run summary (created/updated/skipped/conflicts).
- **Deliverables:** `integrations/sync/adapter.ts` (interface), `integrations/sync/{github,linear,gitlab,jira}.ts`, id-map store, status-mapper, `commands/sync.ts`, agent `sync_tasks` tool.
- **Test strategy:** Adapter contract (mock provider API); push/pull/two-way; each conflict policy; dry-run; id-map dedupe; status mapping; env-only creds; summary counts.

### T54 — Notifications & webhooks
- **Complexity:** 5/10 · **Priority:** P3 · **Depends on:** T21, T22 (consumes change-event hook from T56), T13
- **FRs:** FR-105.
- **Scope:** Event taxonomy: task created/updated/status-changed/removed, **next-ready**, dependency-validation failure, autopilot phase transitions (T41). Webhook sinks (URL, optional signing secret via env, event filter); best-effort delivery with retry/backoff that **never blocks/crashes** the originating op (NFR-7/NFR-20). Secrets env-only (FR-73). Local/CLI notifications + the board live channel (T51) consume the same stream; opt-out/filter honored (FR-87). Events emitted from the **shared core/storage layer** so CLI + agent are identical (NFR-3).
- **Deliverables:** `events/bus.ts` (shared emitter), `events/webhook-sink.ts`, `events/local-sink.ts`, `commands/notify.ts`, config wiring.
- **Test strategy:** Event taxonomy coverage; webhook delivery + retry + non-blocking; signature; filter/opt-out; CLI/agent parity; secret env-only.

---

# Phase 22 — Discovery, History & Export (v1.1)

### T55 — Task search & advanced filtering (`search`)
- **Complexity:** 4/10 · **Priority:** P2 · **Depends on:** T03, T14
- **FRs:** FR-106.
- **Scope:** `search`/`find`/`query`: full-text over title/description/details/notes + fuzzy (**reuse the fuse.js engine** from research/complexity context, FR-52.2). Filters combine status/priority/ready-blocked/has-subtasks/tag (+`--all-tags` opt-in, FR-62.2) with the query. Render in the standard list format (T20) with match highlighting; `--limit`/`--sort`. Agent JSON. Empty → "no matches"; invalid filter → actionable error (NFR-2).
- **Deliverables:** `task-manager/search.ts`, filter parser, highlight renderer, agent `search_tasks` tool.
- **Test strategy:** Text + fuzzy match; combined filters; all-tags opt-in; sort/limit; empty result; invalid filter error; agent JSON.

### T56 — History / audit log & undo (+ storage change-event hook)
- **Complexity:** 6/10 · **Priority:** P2 · **Depends on:** T03, T05
- **FRs:** FR-107.
- **Scope:** Append an audit entry per **state-changing** op (timestamp, operation, scope/ids, tag, before/after summary or reversible patch) to a history log in the config dir; reads not logged. `history` lists recent (filter tag/operation/id). `undo` reverts the most recent / a selected reversible entry, restoring tasks while **preserving non-target tags** (FR-18.6); irreversible → report, never partial. Capped/rotated retention (configurable); corrupt/missing log → empty (FR-17.4). Emitted from the shared core/storage layer so CLI + agent mutations are recorded (NFR-3/NFR-15/NFR-21). **Introduces the storage write-interceptor / change-event hook** reused by watch (T51) and notifications (T54).
- **Deliverables:** `history/audit-log.ts`, `history/undo.ts`, reversible-patch util, `storage/change-events.ts` (write interceptor + emitter), `commands/{history,undo}.ts`, agent `get_history`/`undo` tools.
- **Test strategy:** Every mutation logged (reads not); list filters; undo reverts + preserves other tags; irreversible reported; rotation; corrupt-log tolerance; CLI/agent parity; event hook fires on writes.

### T57 — Export & reporting (`export`)
- **Complexity:** 5/10 · **Priority:** P2 · **Depends on:** T03, T14 (complexity reuse from T31 when present)
- **FRs:** FR-108.
- **Scope:** `export` to Markdown/JSON/CSV (+ board/column-grouped Markdown SHOULD). Progress report: counts by status, completion %, ready/blocked, per-priority distribution for the active/specified tag (+`--all-tags` opt-in); reuse complexity data (T31) when present. **NG-1 guard**: no time/duration/resourcing — burndown limited to status counts over history (T56) where available. Tag-aware; `--output` path/dir + `--format` flag (parity FR-84); agent JSON; non-zero exit on failure (FR-84.4).
- **Deliverables:** `task-manager/export.ts`, formatters (md/json/csv/board), progress-report builder, agent `export_tasks` tool.
- **Test strategy:** Each format; board export; progress metrics; complexity reuse; NG-1 guard; tag scoping; error exit; agent JSON.

---

## Appendix A — Task index (sortable summary)

| ID | Name | Complexity | Priority | Depends on |
|---|---|:--:|:--:|---|
| T01 | Repo scaffolding, build & test harness | 3 | P0 | — |
| T02 | Task/Subtask schemas & status enum | 3 | P0 | T01 |
| T03 | Task store persistence (tag-keyed) | 6 | P0 | T02 |
| T04 | Runtime state file | 2 | P0 | T01 |
| T05 | Storage backend abstraction (file/api) | 5 | P1 | T03 |
| T06 | Config loading & defaults (deep-merge) | 5 | P0 | T01 |
| T07 | Model catalog (single source of truth) | 4 | P0 | T01 |
| T08 | Secret & environment resolution | 4 | P0 | T06 |
| T09 | Feature flags & operating-mode | 3 | P1 | T06 |
| T10 | Role-based model config & provider registry | 6 | P0 | T06, T07, T08 |
| T11 | Unified AI service (generate+fallback+telemetry) | 7 | P0 | T10 |
| T12 | Multi-category provider integrations | 8 | P1 | T11 |
| T13 | Telemetry, cost, logging, userId | 4 | P1 | T11 |
| T14 | CLI framework, global options, UI, lifecycle | 5 | P0 | T01 |
| T15 | `init` bootstrap scaffolding | 7 | P1 | T06, T07, T04, T14 |
| T16 | Interactive/non-interactive setup & storage | 6 | P1 | T15, T10 |
| T17 | Shell alias management | 3 | P2 | T15 |
| T18 | Editor/agent integration profiles (14) | 7 | P2 | T15 |
| T19 | Legacy migration (`migrate`) | 5 | P2 | T03, T15 |
| T20 | `list` & `show` | 4 | P1 | T03, T14 |
| T21 | `set-status` & status semantics | 3 | P1 | T03, T14 |
| T22 | `next` task selection algorithm | 6 | P1 | T03, T14 |
| T23 | add/remove dependency + cycle detection | 5 | P1 | T03 |
| T24 | validate/fix dependencies | 6 | P1 | T23 |
| T25 | `parse-spec` (spec → tasks) | 8 | P1 | T11, T03, T14 |
| T26 | `add-task` (manual or AI) | 5 | P2 | T11, T03 |
| T27 | `update`/`update-task`/`update-subtask` | 6 | P2 | T11, T03 |
| T28 | add/remove subtask, remove-task, clear-subtasks | 5 | P2 | T03 |
| T29 | `move` (reorder/relocate within & across tags) | 7 | P2 | T03, T23 |
| T30 | `scope-up`/`scope-down` | 4 | P3 | T11, T03 |
| T31 | analyze-complexity + report + view | 7 | P2 | T11, T03 |
| T32 | `expand`/`expand-all` | 7 | P2 | T11, T03, T31 |
| T33 | `research` (context-augmented) | 8 | P2 | T11, T03 |
| T34 | Tag operations + isolation | 6 | P2 | T03, T04 |
| T35 | `models` command | 6 | P2 | T10, T14 |
| T36 | `lang` command | 2 | P3 | T06, T14 |
| T37 | `generate` + `sync-readme` | 5 | P2 | T03, T14 |
| T38 | MCP server skeleton (modes, envelope) | 8 | P3 | T11, T14, T20–T37 cores |
| T39 | Tool catalog (~44–45) + silent bootstrap | 7 | P3 | T38, wrapped commands |
| T40 | Host-session sampling provider | 6 | P3 | T38, T12 |
| T41 | Autonomous TDD workflow (`autopilot`) | 9 | P3 | T38, T21, T23, git |
| T42 | `loop` (autonomous task loop) | 5 | P3 | T22, T21 |
| T43 | `auth`/`context`/`briefs` + API storage | 8 | P3 | T05, T14, T16 |
| T44 | Interactive shell (`tui`/`repl`) fallback | 2 | P3 | T14 |
| T45 | Integration/E2E suite, docs, packaging | 5 | P2 | all functional tasks |
| T46 | `prd` interactive PRD Builder | 7 | P2 | T11, T14 |
| T47 | `check-spec` spec readiness gate | 5 | P2 | T11, T14 |
| T48 | Visualization server foundation | 6 | P3 | T03, T05, T14 |
| T49 | Kanban board UI | 6 | P3 | T48, T21 |
| T50 | Dependency-graph (DAG) view | 6 | P3 | T48, T24 |
| T51 | Watch / live-sync mode | 5 | P3 | T48, T37, T56 |
| T52 | Roadmap / milestone view | 4 | P3 | T03, T48 |
| T53 | External tracker / Git sync (`sync`) | 8 | P3 | T05, T21, git |
| T54 | Notifications & webhooks | 5 | P3 | T21, T22, T56, T13 |
| T55 | Task search & filtering (`search`) | 4 | P2 | T03, T14 |
| T56 | History / audit log & undo | 6 | P2 | T03, T05 |
| T57 | Export & reporting (`export`) | 5 | P2 | T03, T14 |

## Appendix B — FR → Task coverage map

| FRs | Task |
|---|---|
| FR-1, FR-7, FR-10, FR-11 | T15 (also T14 root detection) |
| FR-2, FR-3, FR-5, FR-8 | T16 (silent agent bootstrap also T39) |
| FR-4 | T18 |
| FR-6 | T17 |
| FR-9, FR-65 | T19, T03 |
| FR-12–FR-17 | T25 (FR-17.5 also T37) |
| FR-16, FR-18, FR-25 | T02, T03 |
| FR-19, FR-20 | T03, T04 |
| FR-21, FR-22 | T20 |
| FR-23 | T22 |
| FR-24, FR-25 | T21 |
| FR-26 | T26 |
| FR-27, FR-28, FR-29 | T27 |
| FR-30–FR-33 | T28 |
| FR-34, FR-64 | T29 |
| FR-35 | T30 |
| FR-36–FR-40, FR-49 | T32 |
| FR-41, FR-42 | T23 |
| FR-43, FR-44, FR-45 | T24 |
| FR-46–FR-48, FR-50 | T31 |
| FR-51–FR-57 | T33 |
| FR-58–FR-63 | T34 |
| FR-66, FR-71, FR-72 | T10, T07, T12 |
| FR-67–FR-70 | T35 |
| FR-73, FR-74 | T08, T12 |
| FR-75–FR-80, FR-83 | T38 |
| FR-78, FR-5 | T39 |
| FR-81 | T40 |
| FR-82 | T41 |
| FR-84, FR-85 | T37 |
| FR-86–FR-89 | T13 |
| FR-90 | T36 (steering via T11) |
| FR-91 | T06 |
| FR-92, FR-93 | T09 |
| FR-94 | T43 |
| FR-95 | T42 |
| FR-96 | T44 |
| FR-97 | T14 |
| §12 workflows, NFR-3 | T45 |
| FR-98 | T46 |
| FR-99 | T47 |
| FR-100 | T48, T49 |
| FR-101 | T50 |
| FR-102 | T51 (live channel also T48) |
| FR-103 | T52 |
| FR-104 | T53 |
| FR-105 | T54 |
| FR-106 | T55 |
| FR-107 | T56 |
| FR-108 | T57 |
| NFR-19, NFR-22 | T48, T49, T50, T52 |
| NFR-20 | T53, T54 |
| NFR-21 | T56 |

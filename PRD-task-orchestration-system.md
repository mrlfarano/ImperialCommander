# Product Requirements Document — AI-Driven Development Task Orchestration System

## 1. Document Control

| Field | Value |
|---|---|
| **Title** | AI-Driven Development Task Orchestration System ("the System") |
| **Document Type** | Product Requirements Document (PRD) |
| **Version** | 1.1 |
| **Status** | Draft |
| **Date** | `<YYYY-MM-DD>` |
| **Owner** | Product Team |
| **Audience** | Engineering, Design, QA, Developer Relations, Product |
| **Working Title Note** | "The System" is a neutral working title. References to "the CLI" denote the System's command-line binary; "AI coding assistants/agents" denote compatible editor and agent environments; "a standardized machine-readable tool-integration interface" denotes the programmatic agent integration protocol. |

> **v1.1 additions (this revision).** This revision extends the product with builder- and developer-experience capabilities — see **FR-98–FR-108** and **NFR-19–NFR-22**: an interactive **PRD Builder** and a **spec-readiness check**, a local **visualization dashboard** (Kanban board, dependency graph, roadmap) with **watch/live-sync**, **external tracker/Git-platform sync**, **notifications/webhooks**, **task search**, **durable history with undo**, and **multi-format export/reporting**. These close the "blank-page" gap at the front of the funnel (Project Builders) and the "no local visual surface / no external bridge" gaps during execution (Developers). Implementation tasks **T46–T57** in the companion task breakdown.

---

## 2. Executive Summary

The System is an implementation-neutral, AI-driven task orchestration platform for software development. It converts a written specification into a structured, dependency-aware plan of executable tasks, then guides developers (and autonomous AI agents) through implementing that plan task-by-task.

The System is dual-surfaced:

1. **A command-line interface ("the CLI")** for human users and scripts, producing readable, formatted terminal output.
2. **A standardized machine-readable tool-integration interface** (an agent/editor integration server) that exposes the same capabilities as structured, programmatically-callable tools so AI coding assistants can drive the System from inside compatible editor and agent environments.

Core capabilities include:

- **Project bootstrapping** that scaffolds a project configuration directory, configuration, templates, and editor/agent integration profiles.
- **Specification ingestion**: parsing a requirements document into a structured task list using AI.
- **A persistent, tagged task store** with a strict task/subtask data model.
- **Task lifecycle management**: listing, inspecting, status transitions, and dependency- and priority-aware "next task" selection.
- **Task authoring, editing, relocation, and decomposition** (subtask expansion).
- **Dependency modeling, validation, and automated repair.**
- **AI complexity analysis** producing a reusable report that drives automated decomposition.
- **AI-assisted research** augmented with project context.
- **Multi-context (tagged) task lists** for parallel workstreams.
- **Role-based, multi-provider AI model configuration.**
- **Usage and cost telemetry**, localization, and an agent-facing autonomous TDD workflow engine.
- **Interactive PRD authoring** — a guided, follow-up-driven PRD Builder — and **spec-readiness scoring** before task generation.
- **A local visualization dashboard** — Kanban board, dependency graph, and roadmap — with **watch/live-sync** real-time updates.
- **External integration & developer ergonomics**: two-way sync with issue trackers/Git platforms, notifications/webhooks, task search, durable history with undo, and multi-format export/reporting.

The System keeps secrets out of version-controllable configuration, supports hosted, cloud-managed, local/self-hosted, and OpenAI-compatible AI providers, and degrades gracefully to fully local/offline operation.

---

## 3. Problem Statement & Background

### 3.1 The problem

AI coding assistants are highly capable at writing code for a well-scoped, isolated unit of work, but they struggle to plan, sequence, and persist a large body of work across a multi-step project. When a developer asks an assistant to "build feature X," several failure modes appear:

- **No durable plan.** The assistant holds the plan in volatile conversation context. When context is lost, the plan is lost.
- **No dependency awareness.** Work is attempted out of order; prerequisites are skipped.
- **No shared state between human and agent.** The human cannot see what the agent intends to do, and the agent cannot see the human's progress.
- **No structured decomposition.** Large tasks are not consistently broken into verifiable, individually-completable units.
- **No prioritization.** There is no principled way to pick "what to work on next."
- **No record of decisions.** Research findings and implementation notes are not persisted alongside the work.

### 3.2 Why structured task orchestration

Structured task orchestration solves these problems by externalizing the plan into a **persistent, machine-readable, dependency-aware task store** that both humans and AI agents read and write through identical operations. This gives:

- A single source of truth for "what needs to be done, in what order, and what's done."
- Deterministic, auditable selection of the next actionable task.
- Consistent decomposition of complex work into subtasks sized for AI implementation.
- A durable journal of research and implementation notes attached to the work.
- Seamless human/agent collaboration, since both operate the same task store.

### 3.3 Background context

The System targets the emerging workflow in which a developer pairs with one or more AI coding assistants inside an editor. It must therefore work both as a standalone CLI and as a set of tools an assistant can call without the human leaving their editor. Because AI providers vary widely in capability, cost, privacy posture, and availability, the System must be provider-agnostic and support hosted commercial APIs, cloud-managed services, local/self-hosted runtimes, OpenAI-compatible endpoints, and subscription/OAuth-based assistant runtimes.

---

## 4. Product Vision, Goals & Non-Goals

### 4.1 Vision

To be the durable planning and orchestration layer that turns any written specification into an executable, dependency-ordered task plan, and that lets humans and AI agents collaboratively execute that plan with full transparency, provider flexibility, and zero lock-in.

### 4.2 Goals

| ID | Goal |
|---|---|
| G-1 | Turn a written specification into a structured, dependency-aware task list in a single operation. |
| G-2 | Provide identical capability through a human CLI and a programmatic agent integration interface. |
| G-3 | Make "what to work on next" a deterministic, dependency- and priority-aware decision. |
| G-4 | Support granular decomposition of tasks into subtasks, driven by AI complexity analysis. |
| G-5 | Keep all task state in a transparent, version-controllable, human-readable store. |
| G-6 | Support multiple AI providers via role-based configuration with no hard dependency on any one vendor. |
| G-7 | Keep secrets out of configuration files; never store credentials in version control. |
| G-8 | Enable parallel workstreams via isolated, tagged task contexts. |
| G-9 | Provide cost/usage transparency for every AI operation. |
| G-10 | Support fully local/offline operation with self-hosted models. |
| G-11 | Provide an agent-facing autonomous test-driven-development execution loop. |

### 4.3 Non-Goals

| ID | Non-Goal |
|---|---|
| NG-1 | The System is not a general-purpose project-management suite (no Gantt charts, time tracking, or resourcing). |
| NG-2 | The System does not author application code itself outside the agent-facing autonomous workflow; it orchestrates the plan. |
| NG-3 | The System does not host or train models; it integrates external model providers. |
| NG-4 | The System does not mandate any specific editor, agent product, or AI provider. |
| NG-5 | The System is not a replacement for version control; it integrates with it but does not reimplement it. |

---

## 5. Target Users & Personas

| Persona | Description | Primary needs |
|---|---|---|
| **Solo Developer / "Vibe Coder"** | An individual building a project with AI assistance. | Fast bootstrap, automatic planning from a spec, "tell me what to do next," low ceremony. |
| **Team Developer** | A developer on a team using shared, possibly cloud-hosted task contexts. | Isolated per-branch/per-feature contexts, shared task containers, collaboration/auth. |
| **AI Coding Agent** | An autonomous or semi-autonomous assistant operating inside an editor. | Structured, machine-readable tool calls; explicit project root; deterministic next-task selection; autonomous TDD loop. |
| **Tech Lead / Architect** | Owns scope and sequencing for a feature or release. | Complexity analysis, dependency validation, mid-project re-planning, multi-context organization. |
| **Cost-Conscious / Privacy-Conscious Operator** | Cares about model cost or wants local/offline operation. | Provider choice, cost telemetry, local model support, no-API-key runtimes. |
| **CI/Automation Engineer** | Scripts the System non-interactively. | Non-interactive flags, scriptable defaults, structured output, predictable exit behavior. |

---

## 6. Key Concepts & Glossary

| Term | Definition |
|---|---|
| **The System** | The AI-driven development task orchestration product described herein. |
| **The CLI** | The System's command-line binary, invoked as `the-cli <command>`. Short aliases may be configured. |
| **Agent integration interface** | A standardized machine-readable tool-integration interface (a stdio-based tool server) exposing the System's operations as programmatically-callable tools for AI assistants. |
| **The project configuration directory** | The per-project directory holding configuration, the task store, templates, reports, and docs. |
| **The structured task store** | The persistent, tag-keyed JSON file holding all tasks and subtasks. |
| **Task** | A unit of work with an ID, title, description, details, test strategy, priority, status, dependencies, and subtasks. |
| **Subtask** | A child unit of work nested under a task, addressed via dot notation `parent.child` (e.g. `5.2`). |
| **Dependency** | A prerequisite relationship; a task/subtask cannot start until its dependencies are complete. |
| **Status** | A task/subtask's lifecycle state, drawn from a fixed enumeration. |
| **Complexity score** | An AI-assigned 1–10 difficulty rating used to recommend decomposition. |
| **Complexity report** | A machine-readable artifact scoring tasks and recommending subtask counts and tailored decomposition prompts. |
| **Context / Tag** | A named, isolated task list (workstream) within the task store. The active tag determines default scope. |
| **Role-based model configuration** | Assignment of AI work to three independent roles: **main**, **research**, and **fallback**. |
| **Main role** | Primary model for generation/update operations. |
| **Research role** | Model specialized for fresh-information retrieval and research-augmented operations. |
| **Fallback role** | Model used automatically when the main role's call fails. |
| **Project root** | The absolute directory of the project; required explicitly by the agent integration interface. |
| **Operating mode** | `solo` (local file storage) or `team` (cloud/API-backed collaboration storage). |
| **Storage backend** | `file` (local task store) or `api` (cloud-managed remote store). |
| **Rule/integration profile** | Editor/assistant-specific integration files (rule files + tool-integration config) the System can install. |
| **Telemetry data** | Per-AI-call usage record (tokens, cost, model, provider, command). |
| **Autonomous TDD workflow** | An agent-facing state machine driving RED/GREEN/REFACTOR/COMMIT/FINALIZE test-driven development. |

---

## 7. User Stories / Jobs-to-be-Done

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-1 | Solo developer | bootstrap a new project in one command | I get the full structure, config, and templates instantly. |
| US-2 | Solo developer | parse my specification into tasks automatically | I don't have to hand-author a task list. |
| US-3 | Any developer | ask "what should I work on next?" | I always pick an unblocked, high-priority task. |
| US-4 | Any developer | mark tasks done as I finish | progress is tracked and dependents unblock. |
| US-5 | Tech lead | analyze task complexity | I know which tasks need breaking down. |
| US-6 | Any developer | expand a complex task into subtasks | I can implement it step by step. |
| US-7 | Any developer | log findings onto a subtask iteratively | I keep a running implementation journal. |
| US-8 | Tech lead | manage dependencies and validate them | the plan stays internally consistent. |
| US-9 | Developer | research a topic with project context | I get current, project-aware guidance without leaving my workflow. |
| US-10 | Team developer | keep separate task lists per branch/feature | parallel work doesn't collide. |
| US-11 | Operator | choose and tune AI providers per role | I balance capability, cost, and privacy. |
| US-12 | AI agent | call task operations programmatically | I can drive the plan from inside the editor. |
| US-13 | AI agent | run an autonomous TDD loop on a task | I implement subtasks with tests, commits, and finalize automatically. |
| US-14 | Operator | see token/cost per AI call | I can budget and audit spend. |
| US-15 | Non-English user | get AI output in my language | the content is usable for my team. |
| US-16 | Maintainer of legacy project | migrate to the new layout | I adopt the System without manual file shuffling. |

---

## 8. Functional Requirements

> Requirement convention: Each requirement states **Behavior** and **Acceptance Criteria (AC)**. "MUST" denotes mandatory behavior. Where the source capability is named by a specific verb, a generic command/verb equivalent is given in §9 and the Appendix.

### 8.a Project Initialization & Setup

#### FR-1 — One-command project bootstrap
**Behavior:** The CLI MUST provide an `init` operation that scaffolds a complete project in the current working directory: creates the project configuration directory and its subdirectories (tasks, docs, reports, templates), generates a configuration file and a runtime state file, copies specification templates (a simple template and a complex/structured template), copies an environment-variable example file, optionally initializes version control, optionally installs editor/agent integration profiles, and optionally adds short shell aliases for the CLI.

**AC:**
- FR-1.1 Running bootstrap creates: project config dir; subdirs `tasks/`, `docs/`, `reports/`, `templates/`; a configuration file; a runtime state file; an environment-variable example file; a version-control ignore file (created or merged).
- FR-1.2 The runtime state file MUST be initialized with: current tag = the default tag name (`master`), last-switched timestamp = creation time (ISO), an empty branch→tag mapping object, and a migration-notice-shown flag = false.
- FR-1.3 Two specification templates MUST be copied into the templates directory (one simple, one complex/structured).
- FR-1.4 Existing files MUST be preserved: the version-control ignore file MUST be merged (new entries appended under a clearly labeled header); other existing files MUST be skipped rather than overwritten; a separate System-specific README file MUST be written if a project README already exists.
- FR-1.5 A configuration template placeholder (e.g. a year token) MUST be substituted at creation.
- FR-1.6 Model maximum-token defaults MUST be corrected against the model catalog after the template is copied.
- FR-1.7 Bootstrap MUST support a dry-run mode that logs all intended actions (including version-control and task-storage behavior) and makes no changes.

#### FR-2 — Interactive vs non-interactive setup
**Behavior:** Bootstrap MUST run interactively by default and support a fully non-interactive mode.

**AC:**
- FR-2.1 Non-interactive mode is enabled when a "skip prompts" flag is set OR when both project name and description are supplied.
- FR-2.2 Interactive mode MUST prompt, in order: (1) storage backend choice; (2) for local storage only: version-control init (default Yes), then store-tasks-in-version-control (default Yes); (3) install editor/agent integration profiles (default No); (4) preferred response language (default English); (5) a settings summary with a final confirmation (default Yes). Declining the confirmation MUST cancel and exit cleanly (exit code 0).
- FR-2.3 Non-interactive defaults: a default project name, a default description, a default version (`0.1.0`), a default author; local storage; version-control init = true; store-tasks-in-version-control = true; language = English; no remote authentication; integration profiles skipped unless explicitly requested.
- FR-2.4 An interruption (Ctrl+C / prompt cancellation) during storage selection MUST default to local storage.
- FR-2.5 Shell aliases MUST be added regardless of interactivity unless explicitly disabled (see FR-6).

#### FR-3 — Storage backend selection
**Behavior:** Bootstrap MUST let the user choose between local file storage (solo) and a cloud-managed collaboration backend (team).

**AC:**
- FR-3.1 The first interactive prompt MUST offer a local option (default) and a cloud option.
- FR-3.2 Local selection sets storage type = `file` and operating mode = `solo`.
- FR-3.3 Cloud selection sets storage type = `api`, operating mode = `team`, and an API endpoint (from environment override or a default), then triggers a browser-based OAuth flow with multi-factor support and organization selection. On auth failure, the System MUST log an error and fall back to local storage.
- FR-3.4 Cloud storage MUST skip storing tasks in version control (tasks live in the cloud) but MAY still initialize a version-control repo for code.
- FR-3.5 Cloud storage MUST skip local model setup (models are managed remotely).
- FR-3.6 Silent/programmatic (agent) bootstrap MUST always default to local storage.
- FR-3.7 Remote authentication tokens MUST be persisted outside the project configuration file, in a user-scoped credentials location — never in the project configuration file.

#### FR-4 — Editor/agent integration profiles
**Behavior:** The System MUST support installing editor- and assistant-specific integration profiles (rule files plus tool-integration config). A fixed set of supported profiles MUST be enumerated (14 profiles).

**AC:**
- FR-4.1 A canonical enumeration of valid profile identifiers MUST exist and be shared by both the CLI and the agent integration interface. A validation helper MUST reject identifiers not in the set.
- FR-4.2 When profiles are explicitly requested at bootstrap, they MUST be installed (creating per-profile rule directories and tool-integration config), filtered by operating mode (solo/team).
- FR-4.3 Without an explicit request, interactive bootstrap MUST ask whether to set up integration profiles; answering yes launches interactive profile selection.
- FR-4.4 Profile requests MUST accept comma- or space-separated lists. Unknown profile names MUST log a warning and be skipped.
- FR-4.5 A standalone profile-management operation MUST support `add`, `remove`, and interactive `setup`:
  - `add` creates the profile/rules directory and installs rules; with no profiles and no auto-confirm, it opens interactive selection with auto-detected environments pre-selected; with auto-confirm it auto-detects installed environments (via on-disk markers) and installs without prompting (printing guidance if none detected).
  - `remove` deletes the profile/rules directory and associated tool-integration config; a force flag skips the removal confirmation; a safety guard MUST prevent removing the last remaining profile unless forced.
  - `setup` launches interactive selection without re-initializing the project or touching shell aliases.
- FR-4.6 Profile management MUST accept an operating-mode option to filter rules/commands, auto-detected from config when omitted.
- FR-4.7 Profile definitions MUST be produced by a single profile factory with per-profile overrides (display name, profile directory, rules directory, tool-integration config name/path, file extensions, file mappings, subdirectory support, default-rules inclusion, and lifecycle hooks). The factory MUST apply sensible defaults so a new editor is added with a minimal override file.

#### FR-5 — Programmatic (silent) bootstrap
**Behavior:** When invoked through the agent integration interface, bootstrap MUST run silently.

**AC:**
- FR-5.1 Banner, dependency-install output, interactive model setup, profile setup, and language setup MUST be suppressed.
- FR-5.2 Storage MUST default to local.
- FR-5.3 The System MUST advise configuring models afterward (via the model-configuration operation).

#### FR-6 — Shell aliases
**Behavior:** Bootstrap MUST optionally append short shell aliases for the CLI to the user's shell profile.

**AC:**
- FR-6.1 Aliases MUST be appended to the detected shell profile under a dated, labeled comment block; only missing aliases are added.
- FR-6.2 A disable flag MUST skip alias creation.
- FR-6.3 If the shell cannot be determined or the profile file does not exist, aliases MUST be silently skipped; failures MUST be logged at debug level only.
- FR-6.4 The System MUST self-heal by removing stale aliases that point to the CLI but are managed by a different (external) tool, and clean up empty alias comment blocks.

#### FR-7 — Version control & task storage choice
**Behavior:** Bootstrap MUST optionally initialize version control and decide whether tasks are tracked in version control.

**AC:**
- FR-7.1 A force-init flag MUST initialize version control unless already inside a work tree (then skipped); a skip flag MUST skip it; with no flag, interactive prompts decide and otherwise it auto-inits only when no repo is detected.
- FR-7.2 The store-tasks-in-version-control choice (prompt or flags) MUST control whether the task store/dir is excluded in the generated ignore file.
- FR-7.3 If version control is unavailable, init MUST be skipped with a warning.

#### FR-8 — Chained model & language setup
**Behavior:** For local storage in interactive bootstrap, the System MUST chain into interactive model setup and apply the chosen response language.

**AC:**
- FR-8.1 Interactive, non-silent, non-dry-run local bootstrap MUST launch interactive model selection and persist the chosen response language.
- FR-8.2 Cloud storage MUST display a notice that models are managed remotely instead of running model setup.
- FR-8.3 Non-interactive bootstrap MUST skip model/language setup and use defaults.
- FR-8.4 If model setup fails, the System MUST advise running model setup manually.

#### FR-9 — Legacy migration
**Behavior:** The System MUST provide a `migrate` operation that moves legacy project layouts into the project configuration directory structure.

**AC:**
- FR-9.1 Migration MUST relocate: legacy task store → new task store path; individual task files → new tasks dir; legacy spec/requirements files → docs dir; legacy templates → templates dir; legacy complexity report → reports dir; legacy config file → new config file.
- FR-9.2 Migration MUST support: force (overwrite/migrate even if the new dir exists), backup, cleanup (remove legacy files, with a sensible default), skip-confirmation, dry-run (preview), and debug output.
- FR-9.3 For existing projects, the System MUST read both legacy and new locations to allow gradual adoption; new projects always use the new layout.
- FR-9.4 Loading a legacy config file MUST emit a deprecation warning recommending migration. The migration-notice-shown flag tracks one-time display.

#### FR-10 — First-run onboarding output
**Behavior:** After bootstrap, the System MUST display next-step guidance tailored to the storage choice (suppressed in silent mode).

**AC:**
- FR-10.1 Local next steps MUST guide: configure models + add API keys; write a specification using a template; parse the spec; analyze complexity; expand tasks; find next task; set up integration profiles.
- FR-10.2 Cloud next steps MUST guide: create a brief in the web UI; set up integration profiles; set context to a brief; list briefs; list tasks; find next task; perform status updates.
- FR-10.3 A debug environment flag MUST enable a bootstrap debug log; log level MUST be controllable via an environment variable (debug/info/warn/error/success; default info).

#### FR-11 — Project root detection
**Behavior:** The System MUST detect a project root from a defined set of markers.

**AC:**
- FR-11.1 Markers MUST include the project config dir, the legacy config file, the task store (legacy and new locations), and version-control directories.

---

### 8.b Specification Ingestion & Automated Task Generation

#### FR-12 — Parse specification into tasks
**Behavior:** The System MUST provide a `parse-spec` operation (CLI and agent tool) that reads a plain-text/markdown specification, sends it plus a generation prompt to an AI model, validates the structured response, and writes generated tasks into the task store under a target tag.

**AC:**
- FR-12.1 The CLI MUST accept the specification path as a positional argument or via an input option; the input option takes precedence, then the positional.
- FR-12.2 Default input path MUST be the docs spec file in the project config dir; default output MUST be the task store path; the output directory MUST be created if missing.
- FR-12.3 The AI response MUST be validated against a strict schema (see FR-16). On success the CLI MUST print a summary (count of new tasks, total tasks, and a "research-backed" note if research was used) plus suggested next steps.
- FR-12.4 The agent tool MUST require an explicit absolute project root and MUST be marked as a destructive (state-changing) operation. It MUST support progress reporting and return structured JSON.
- FR-12.5 An empty or unreadable specification MUST raise a clear error ("input file is empty or could not be read").
- FR-12.6 Generation MUST use non-streaming structured generation by default; a streaming path with automatic non-streaming fallback MUST exist behind a feature flag (default off). A streaming timeout default of 180 seconds MUST apply when streaming is active.

#### FR-13 — Number-of-tasks control
**Behavior:** The user MUST control how many top-level tasks are generated.

**AC:**
- FR-13.1 A num-tasks option MUST default to a configured value (default 10).
- FR-13.2 A value of 0 MUST instruct the System to determine the count from specification complexity.
- FR-13.3 The System MUST advise against very large values (e.g. above 50) due to context-window limits.

#### FR-14 — Append vs overwrite (force guard)
**Behavior:** The System MUST protect against accidental overwrite while allowing append and forced overwrite.

**AC:**
- FR-14.1 Without append or force, if the target tag already contains tasks, the operation MUST fail with a clear message ("tag already contains N tasks; use force to overwrite or append to add"). In the CLI this exits non-zero; through the agent interface it raises an error.
- FR-14.2 Append MUST concatenate new tasks after existing ones, continuing IDs from `max(existing)+1`.
- FR-14.3 Force MUST overwrite existing tasks in the target tag only.
- FR-14.4 All other tags MUST always be preserved (the store is read, and only the target tag's entry is replaced/updated).

#### FR-15 — Research-augmented parsing
**Behavior:** The System MUST optionally route generation through the research role for a more informed breakdown.

**AC:**
- FR-15.1 A research flag MUST select the research role/model and change the prompt variant; it requires an appropriate provider key.
- FR-15.2 When research is enabled and a codebase-analysis-capable provider is configured, the prompt MUST incorporate codebase analysis.
- FR-15.3 The CLI success summary MUST note "with research-backed analysis" when research is on.

#### FR-16 — Generated task structure & ID/dependency processing
**Behavior:** Every generated task MUST conform to a fixed, validatable schema and undergo deterministic ID/dependency processing.

**AC:**
- FR-16.1 Each task MUST have: `id` (number), `title` (non-empty), `description` (non-empty), `details` (string), `testStrategy` (string), `priority` (enum: high|medium|low), `dependencies` (number array), `status` (string), and `subtasks` (array, added during processing).
- FR-16.2 During processing: tasks receive sequential IDs starting at the next available ID; status defaults to `pending`; priority defaults to the configured default (`medium`); dependencies default to `[]`.
- FR-16.3 AI-returned IDs MUST be unique, positive, contiguous, and sequential starting at the expected next ID; violations MUST raise an error.
- FR-16.4 Dependencies MUST be remapped to new IDs and filtered so each is non-null, references an earlier task, and points to an existing/created task; forward and dangling references MUST be dropped; non-array dependencies MUST be coerced to `[]`.
- FR-16.5 Missing fields MUST be backfilled with empty strings/defaults.

#### FR-17 — Input/output paths & tag scoping
**Behavior:** Parsing MUST be tag-scoped and use standardized default paths.

**AC:**
- FR-17.1 Input, output, and tag MUST be overridable via options.
- FR-17.2 The task store MUST be a tag-keyed object; each tag holds `{ tasks: [...], metadata: { created, updated, description } }`.
- FR-17.3 Target tag resolution MUST be: explicit tag → current tag → default tag (`master`).
- FR-17.4 An unparseable existing store MUST be treated as empty for loading (next ID = 1) and as a fresh object for saving.
- FR-17.5 Per-task export file naming MUST follow a zero-padded pattern `task_<NNN>`.

---

### 8.c Task Data Model & Persistence

#### FR-18 — Task store format
**Behavior:** The structured task store MUST be a tag-keyed JSON document.

**AC:**
- FR-18.1 Top-level keys MUST be tag names; each maps to `{ tasks: [Task], metadata: {...} }`.
- FR-18.2 A **Task** MUST have: `id` (number, unique within tag), `title` (string), `description` (string), `details` (string), `testStrategy` (string), `status` (string from the status enum), `priority` (high|medium|low, default medium), `dependencies` (array of IDs), `subtasks` (array).
- FR-18.3 A **Subtask** MUST have: `id` (number, unique within parent), `title`, `description`, `details`, `status`, `dependencies` (may reference sibling subtasks or top-level task IDs), and optional `metadata`. Subtasks typically omit priority and testStrategy.
- FR-18.4 Subtasks MUST be addressed externally via dot notation `parentId.subtaskId`.
- FR-18.5 The remote/API storage backend MUST additionally allow string-form IDs (e.g. external keys).
- FR-18.6 Persistence MUST preserve and merge all non-target tags on every write.

#### FR-19 — Persistence integrity & validation
**Behavior:** The store MUST maintain referential and structural integrity.

**AC:**
- FR-19.1 Validation MUST enforce: unique task IDs within a tag; unique subtask IDs within a parent; valid status values; dependency references that exist within the tag; optional circular-dependency detection.
- FR-19.2 Writes MUST use stable, human-readable JSON formatting.
- FR-19.3 Legacy single-list stores MUST be auto-migrated under the default `master` tag (see FR-46).

#### FR-20 — Runtime state file
**Behavior:** Runtime context MUST be persisted in a state file in the project config dir.

**AC:**
- FR-20.1 The state file MUST track: `currentTag` (active context, default `master`), `lastSwitched` (ISO timestamp), `migrationNoticeShown` (boolean), and a branch→tag mapping.
- FR-20.2 The state file MUST be auto-created and MUST NOT require manual editing.

---

### 8.d Task Lifecycle, Status & Navigation

#### FR-21 — List tasks
**Behavior:** The System MUST provide a `list` operation showing tasks in the active (or specified) tag, optionally filtered by status and optionally including subtasks.

**AC:**
- FR-21.1 With no flags, all tasks MUST be listed.
- FR-21.2 A status filter MUST narrow to one status; an include-subtasks flag MUST nest subtasks; both MUST be combinable.
- FR-21.3 Standard displayed fields MUST be: id, title, status, priority, dependencies (plus subtasks when requested).
- FR-21.4 A file-path override and a tag option MUST be available.

#### FR-22 — Show task detail
**Behavior:** The System MUST provide a `show` operation to inspect one or many tasks/subtasks.

**AC:**
- FR-22.1 IDs MUST be acceptable as positional or via an id option; comma-separated multiple IDs and mixed parent/subtask queries MUST be supported; subtasks MUST use dot notation.
- FR-22.2 A single ID MUST render a detailed view including full implementation details; multiple IDs MUST render a compact summary table plus an action menu with copy-paste-ready batch commands.

#### FR-23 — Find next task
**Behavior:** The System MUST provide a `next` operation that selects the single most appropriate actionable task using a dependency- and priority-aware algorithm.

**AC:**
- FR-23.1 Only tasks/subtasks with status `pending` or `in-progress` (case-insensitive) MUST be eligible.
- FR-23.2 A task/subtask is eligible only if every dependency is completed (status `done` or `completed`).
- FR-23.3 Selection MUST be two-stage: Stage 1 prefers eligible subtasks of `in-progress` parents; Stage 2 (if none) evaluates top-level tasks.
- FR-23.4 Ranking within a stage MUST be: (1) priority (high=3 > medium=2 > low=1), (2) fewest dependencies, (3) lowest numeric ID (for subtasks: parent ID then subtask ID).
- FR-23.5 If a complexity report exists, the returned task MUST be annotated with its complexity score.
- FR-23.6 If nothing is eligible, the operation MUST report "none found" rather than erroring.

#### FR-24 — Set task status
**Behavior:** The System MUST provide a `set-status` operation to advance the lifecycle of one or many tasks/subtasks.

**AC:**
- FR-24.1 An id option MUST accept comma-separated multiple IDs and subtask dot notation; a status option MUST accept only enumerated values.
- FR-24.2 Marking a parent task `done` MUST cascade `done` to all its subtasks.
- FR-24.3 Invalid status values MUST be rejected by enum validation.

#### FR-25 — Status enumeration
**Behavior:** A single fixed enumeration of six statuses MUST govern all status inputs and filters.

**AC:**
- FR-25.1 The statuses MUST be exactly: `pending`, `done`, `in-progress`, `review`, `deferred`, `cancelled`.
- FR-25.2 A validation helper MUST return true only for these values.
- FR-25.3 For dependency-satisfaction checks only, `completed` MUST be treated as equivalent to `done`, even though `completed` is not in the canonical six-value enum.
- FR-25.4 Next-task eligibility MUST be limited to `pending` and `in-progress`.

| Status | Meaning |
|---|---|
| `pending` | Not started; eligible for next-task selection. |
| `in-progress` | Actively being worked; eligible; its subtasks get Stage-1 priority. |
| `done` | Completed; satisfies dependencies. |
| `review` | Awaiting review. |
| `deferred` | Postponed. |
| `cancelled` | Abandoned. |

---

### 8.e Task Authoring, Editing & Moving

#### FR-26 — Add task (AI-assisted or manual)
**Behavior:** The System MUST provide an `add-task` operation creating a new top-level task, either from explicit fields (manual) or from a natural-language prompt (AI).

**AC:**
- FR-26.1 If both title and description are supplied, manual creation MUST build the task directly (details/testStrategy default to empty).
- FR-26.2 Otherwise the prompt MUST be sent to the main (or research) model to synthesize a complete task.
- FR-26.3 Options MUST include: prompt, title, description, details, dependencies (comma-separated), priority (default medium), research flag, file, tag.
- FR-26.4 The new task MUST receive the next available ID in the active tag with status `pending` and an empty subtasks array; AI runs MUST report telemetry.
- FR-26.5 Validation MUST error if neither prompt nor both title+description are provided; if no task store exists, the System MUST instruct the user to bootstrap first.

#### FR-27 — Bulk update from an ID
**Behavior:** The System MUST provide an `update` operation revising all tasks with ID ≥ a starting ID based on an AI prompt.

**AC:**
- FR-27.1 Options MUST include: from (default 1), prompt (required), research flag, file, tag.
- FR-27.2 The operation MUST guard against the common mistake of passing an id option, erroring and pointing to single-task update.
- FR-27.3 A missing prompt MUST error.

#### FR-28 — Single task update or append
**Behavior:** The System MUST provide an `update-task` operation targeting one task by ID, replacing content or appending a timestamped note.

**AC:**
- FR-28.1 ID and prompt MUST be acceptable as positional or via options; positional takes priority.
- FR-28.2 An append flag MUST add timestamped information to the task's details instead of rewriting.
- FR-28.3 IDs MUST accept numeric, dotted subtask, and string-form storage IDs.
- FR-28.4 A research flag MUST be supported. Missing resolvable ID MUST error with usage examples.

#### FR-29 — Update subtask (append timestamped notes)
**Behavior:** The System MUST provide an `update-subtask` operation that appends timestamped content to a subtask's details, never overwriting prior content.

**AC:**
- FR-29.1 The target MUST be a subtask in dot notation; in API storage, non-dotted string IDs are valid.
- FR-29.2 A prompt MUST be required (unless only metadata is updated); content MUST be appended with a timestamp.
- FR-29.3 Through the agent interface, an optional metadata parameter (JSON merged into subtask metadata) MUST be gated behind an explicit environment flag.
- FR-29.4 Validation MUST error if neither prompt nor metadata is provided.

#### FR-30 — Add subtask (new or convert)
**Behavior:** The System MUST provide an `add-subtask` operation that either creates a new subtask under a parent or converts an existing task into a subtask.

**AC:**
- FR-30.1 A parent option MUST be required. With a title, a new subtask is created; with an existing-task-id option, an existing task is converted.
- FR-30.2 Options MUST include: parent, existing-task-id, title, description, details, dependencies, status (default pending), and a regenerate-files flag.
- FR-30.3 Dependency IDs containing a dot MUST be kept as strings; otherwise parsed as integers.
- FR-30.4 The new subtask MUST receive the next ID within the parent.
- FR-30.5 Through the agent interface, CLI's parent maps to the tool's `id`, CLI's existing-task-id maps to `taskId`, and file regeneration is opt-out (`skipGenerate`) versus the CLI's opt-in regenerate flag.

#### FR-31 — Remove subtask (delete or promote)
**Behavior:** The System MUST provide a `remove-subtask` operation that deletes a subtask or promotes it to a standalone task.

**AC:**
- FR-31.1 The id option MUST accept comma-separated subtask IDs in dot notation; an ID without a dot MUST error.
- FR-31.2 A convert flag MUST promote the subtask to a standalone task instead of deleting it.
- FR-31.3 A regenerate-files flag (CLI opt-in / agent opt-out) MUST be supported.

#### FR-32 — Remove task (permanent delete with safeguard)
**Behavior:** The System MUST provide a `remove-task` operation permanently deleting one or more tasks/subtasks.

**AC:**
- FR-32.1 The id option MUST accept comma-separated task and/or subtask IDs.
- FR-32.2 Before deletion the System MUST identify which IDs exist, count subtasks that would be deleted, and surface dependent-task warnings.
- FR-32.3 A confirmation MUST be required unless a yes flag is given.
- FR-32.4 Missing/empty IDs or an empty store MUST error.

#### FR-33 — Clear subtasks (bulk strip)
**Behavior:** The System MUST provide a `clear-subtasks` operation emptying the subtasks array of targeted tasks.

**AC:**
- FR-33.1 The id option (comma-separated) or an all flag MUST select targets; providing neither MUST error.
- FR-33.2 The all flag MUST clear every task in the active tag.

#### FR-34 — Move (reorder/relocate within and across tags)
**Behavior:** The System MUST provide a `move` operation to reposition tasks/subtasks within a tag and across tags.

**AC:**
- FR-34.1 Within-tag moves (from/to) MUST support: task→subtask, subtask→standalone task, subtask→different parent, reorder within parent, and move to a new ID position (creating a placeholder if it does not exist).
- FR-34.2 Bulk moves MUST require equal counts in from and to.
- FR-34.3 Cross-tag moves (from-tag/to-tag) MUST auto-create the target tag if missing; if from-tag is omitted, the current tag is the source.
- FR-34.4 Subtasks MUST NOT be moved directly between tags; they MUST first be promoted (via remove-subtask convert) or moved with their parent.
- FR-34.5 Dependency handling flags MUST be supported: with-dependencies (move dependents, preserve links) and ignore-dependencies (break cross-tag links). They MUST be mutually exclusive. A legacy force-move flag MUST NOT be supported.
- FR-34.6 Identical source/target tags MUST error. Cross-tag dependency conflicts MUST produce detailed errors listing conflicts and numbered resolution options.

#### FR-35 — Scope up / scope down
**Behavior:** The System MUST provide `scope-up` and `scope-down` operations that increase or decrease task/subtask complexity/detail via AI.

**AC:**
- FR-35.1 An id option (comma-separated) MUST be required; omission MUST error with a usage example.
- FR-35.2 A strength option MUST accept `light`, `regular` (default), `heavy`.
- FR-35.3 A custom-prompt option and a research flag MUST be supported; a tag option MUST scope the operation.

---

### 8.f Subtask Management & Task Expansion

#### FR-36 — Expand a task into subtasks
**Behavior:** The System MUST provide an `expand` operation that uses AI to generate subtasks for one task.

**AC:**
- FR-36.1 Options MUST include: id, num (count), prompt (extra guidance), research flag, force flag, file, complexity-report path, tag.
- FR-36.2 If a complexity report exists, the recommended subtask count and tailored expansion prompt MUST be used by default; a num value overrides it; `num=0` generates a dynamic count ignoring the report.
- FR-36.3 Generated subtasks MUST be appended to the parent's subtasks array.
- FR-36.4 Without force, expanding a task that already has subtasks MUST be a no-op for that task.

#### FR-37 — Expand all pending tasks
**Behavior:** The System MUST provide an `expand-all` operation expanding every eligible pending task.

**AC:**
- FR-37.1 Options MUST include: all flag, force, research, num, prompt, file, tag.
- FR-37.2 Only pending tasks MUST be targeted; per-task complexity recommendations MUST be applied when available, otherwise defaults.
- FR-37.3 Without force, tasks that already have subtasks MUST be skipped.

#### FR-38 — Force re-expansion
**Behavior:** A force flag MUST regenerate/replace subtasks for tasks that already have them, on both expand and expand-all.

**AC:**
- FR-38.1 Force MUST default to false.
- FR-38.2 Force MUST pair naturally with clear-subtasks for a full reset workflow.

#### FR-39 — Research-augmented expansion
**Behavior:** A research flag MUST route expansion (and update-subtask) through the research role.

**AC:**
- FR-39.1 The research flag MUST default to false and require a configured research provider and key.

#### FR-40 — Default subtask count
**Behavior:** A configured default subtask count MUST serve as the fallback when no explicit count and no complexity recommendation are available.

**AC:**
- FR-40.1 The default MUST be configurable (default 5); an invalid resolved count MUST fall back to 3.

---

### 8.g Dependency Management & Validation

#### FR-41 — Add dependency
**Behavior:** The System MUST provide an `add-dependency` operation declaring that a task/subtask depends on another.

**AC:**
- FR-41.1 An id and a depends-on option MUST both be required; both MUST support dotted subtask notation.
- FR-41.2 The dependencies array MUST be sorted (numeric IDs ascending, then dotted IDs by parent then child) and persisted.
- FR-41.3 The operation MUST reject: a missing target/parent, a non-existent dependency, self-dependency, and any addition that would create a cycle (via recursive cycle detection).
- FR-41.4 An already-existing dependency MUST log a warning and make no change.

#### FR-42 — Remove dependency
**Behavior:** The System MUST provide a `remove-dependency` operation removing a prerequisite link.

**AC:**
- FR-42.1 The id and depends-on options MUST both be required; dotted notation MUST be supported.
- FR-42.2 If the task has no dependencies or the link is absent, the operation MUST be idempotent (no error).

#### FR-43 — Validate dependencies (read-only)
**Behavior:** The System MUST provide a `validate-dependencies` operation that audits the dependency graph without changing files.

**AC:**
- FR-43.1 It MUST count tasks/subtasks and detect three issue types: `self`, `missing`, `circular`.
- FR-43.2 On a clean graph it MUST report success with counts; on problems it MUST report each issue with a type tag and a failure summary.
- FR-43.3 It MUST NOT modify files. (Note: current non-zero exit behavior on failure is unspecified — see Risks.)

#### FR-44 — Fix dependencies (automated repair)
**Behavior:** The System MUST provide a `fix-dependencies` operation that repairs the graph.

**AC:**
- FR-44.1 It MUST: (1) remove duplicate dependencies; (2) remove invalid/non-existent references and subtask self-dependencies; (3) detect and break circular chains.
- FR-44.2 It MUST write only if changes occurred, and print a summary of counts (invalid removed, self removed, duplicates removed, circular fixed, tasks fixed, subtasks fixed).

#### FR-45 — Dependency-driven ordering & cross-tag handling
**Behavior:** Dependencies MUST drive next-task selection (FR-23) and cross-tag moves (FR-34).

**AC:**
- FR-45.1 A dependency MUST reference an existing task within the same tag; cross-tag references MUST surface conflicts.
- FR-45.2 An internal repair helper MUST ensure at least one subtask per task has no dependencies (clearing the first subtask's dependencies if none are independent), guaranteeing an entry point (used internally, e.g. after expansion).
- FR-45.3 Dependencies MUST be displayed with status indicators (completed vs pending) in task views.

---

### 8.h Complexity Analysis & Reporting

#### FR-46 — Analyze complexity
**Behavior:** The System MUST provide an `analyze-complexity` operation that has an AI score each task 1–10, recommend a subtask count, and produce a tailored expansion prompt and reasoning, written to a complexity report.

**AC:**
- FR-46.1 It MUST filter to active tasks (status pending/blocked/in-progress; skip done/cancelled/deferred), gather project context via fuzzy search, call the AI, and write a report to the reports dir.
- FR-46.2 Options MUST include: output path, model override, threshold (1–10, default 5), file, research flag, id (comma-separated), from, to, tag.
- FR-46.3 The report MUST contain `meta` and `complexityAnalysis`. `meta` MUST hold: generatedAt, tasksAnalyzed, totalTasks, analysisCount, thresholdScore, projectName, usedResearch.
- FR-46.4 Each analysis entry MUST conform to a strict schema: taskId (positive int), taskTitle, complexityScore (1–10), recommendedSubtasks (≥0), expansionPrompt, reasoning. No extra fields allowed.
- FR-46.5 If the AI omits requested tasks, a default analysis MUST be injected (score 5, recommendedSubtasks 3, generic prompt, reasoning noting auto-addition).
- FR-46.6 If ID/range filters match no active tasks, the existing report MUST be retained (or an empty report written) with a warning.
- FR-46.7 On provider-key errors the System MUST advise configuring keys and running model setup. The CLI MUST exit non-zero on error; the agent interface MUST rethrow.

#### FR-47 — Tag-aware report merging
**Behavior:** Complexity reports MUST be tag-specific and support partial re-analysis without losing other entries.

**AC:**
- FR-47.1 Report filenames MUST be tag-suffixed for non-default tags (default tag uses the unsuffixed name).
- FR-47.2 Re-analysis MUST overwrite entries for re-analyzed task IDs and retain existing entries only for task IDs belonging to the current tag (cross-tag entries dropped).
- FR-47.3 A corrupt/unreadable existing report MUST be treated as none, with a warning; legacy report locations MUST also be searched.

#### FR-48 — View complexity report
**Behavior:** The System MUST provide a `complexity-report` operation rendering the report.

**AC:**
- FR-48.1 It MUST render: a distribution summary (Low/Medium/High counts and percentages), a "Tasks Needing Expansion" table (at/above threshold) with ready-to-run expansion commands, a "Simple Tasks" table (below threshold) with reasoning, and suggested actions.
- FR-48.2 Distribution buckets MUST be: Low < 5, Medium 5–<8, High ≥8. Score color coding MUST be: green ≤3, yellow ≤6, red otherwise. Table membership MUST be driven by the report's threshold, not the fixed buckets.
- FR-48.3 Options MUST include file and tag.

#### FR-49 — Complexity-driven expansion
**Behavior:** Expansion MUST consume the complexity report to choose per-task subtask count and prompt.

**AC:**
- FR-49.1 Subtask-count precedence MUST be: explicit num (≥0) → report's recommendedSubtasks → configured default; invalid/negative results fall back to 3.
- FR-49.2 If an entry has an expansion prompt, expansion MUST switch to the complexity-report prompt variant and inject the entry's reasoning as extra context. Expansion prompts MUST be accepted as a string or an object with a text field.

#### FR-50 — Research-backed analysis
**Behavior:** A research flag MUST run analysis under the research role and set `usedResearch=true`.

---

### 8.i AI-Assisted Research with Project Context

#### FR-51 — Research query
**Behavior:** The System MUST provide a `research` operation running a free-form AI query augmented with project context, always using the research role.

**AC:**
- FR-51.1 The CLI MUST accept the query positionally; the agent interface MUST require a query string. An empty query MUST be rejected.
- FR-51.2 The CLI MUST stream the answer, strip internal reasoning sections, and render cleaned markdown with a header showing query and detail level. The agent interface MUST use non-streaming generation and return the result text.
- FR-51.3 The result MUST expose: query, result, context size, context tokens, token breakdown, system/user/total input tokens, detail level, telemetry, and tag info.
- FR-51.4 If project root cannot be determined, the operation MUST error.

#### FR-52 — Context augmentation sources
**Behavior:** Research MUST be augmentable from multiple context sources.

**AC:**
- FR-52.1 **Task/subtask IDs** (comma-separated; parent and dotted forms) MUST include those tasks' content; invalid ID formats MUST be reported.
- FR-52.2 **Automatic relevant-task discovery** MUST run a fuzzy search over the active tag (max 8 results, including recent and category matches), appending discovered IDs not already provided; errors MUST be silently tolerated (best-effort).
- FR-52.3 **File context** (comma-separated paths) MUST include file contents with per-file token/size reporting; paths MUST be validated for existence.
- FR-52.4 **Custom free-text context** MUST be injectable.
- FR-52.5 **Project file tree** MUST be optionally includable (default off), with file/dir counts reported.

#### FR-53 — Detail level
**Behavior:** A detail-level option MUST control answer depth.

**AC:**
- FR-53.1 Values MUST be `low`, `medium` (default), `high`; invalid values MUST be rejected.

#### FR-54 — Save findings to a task/subtask
**Behavior:** Research MUST optionally persist a formatted conversation thread onto a task or subtask (append mode).

**AC:**
- FR-54.1 A save-to option MUST accept an ID matching task or subtask form; a subtask uses subtask-update, a task uses task-update in append mode.
- FR-54.2 Missing store/parent/subtask/task MUST produce clear errors.

#### FR-55 — Save findings to a markdown file
**Behavior:** Research MUST optionally write a markdown record under the docs research directory.

**AC:**
- FR-55.1 The directory MUST be created if absent; the filename MUST be `<YYYY-MM-DD>_<query-slug>` (slug lowercased, special chars stripped, spaces→hyphens, truncated to 50 chars).
- FR-55.2 The file MUST include YAML front matter (title, query, date, time, timestamp, exchange count), an initial-query section, follow-up sections, and a footer.
- FR-55.3 Through the agent interface, when file-save is requested, the returned object MUST include the saved file path.

#### FR-56 — Interactive follow-up loop (CLI only)
**Behavior:** The CLI MUST offer an interactive follow-up loop preserving cumulative conversation context.

**AC:**
- FR-56.1 After an initial query, the CLI MUST offer: ask follow-up, save to file, save to task/subtask, quit.
- FR-56.2 Follow-ups MUST prepend full conversation history and preserve original custom context; explicitly-provided task IDs MUST be cleared so fuzzy discovery re-runs.
- FR-56.3 If the interactive prompt is unavailable (non-interactive terminal), the loop MUST be silently skipped.

#### FR-57 — Research token/cost breakdown
**Behavior:** The CLI MUST display a context-analysis breakdown and a usage/cost summary; telemetry MUST be captured.

---

### 8.j Multi-Context / Tagged Task Lists

#### FR-58 — Create a tag
**Behavior:** The System MUST provide an `add-tag` operation creating a new isolated task list.

**AC:**
- FR-58.1 Options MUST include: description, derive-from-branch (ignores the provided name), copy-from-current, copy-from-source-tag.
- FR-58.2 A new tag MUST be empty by default unless a copy option is given.

#### FR-59 — Switch active tag
**Behavior:** The System MUST provide a `use-tag` operation setting the active context.

**AC:**
- FR-59.1 It MUST persist `currentTag` and `lastSwitched` in the state file; subsequent default operations MUST scope to it.

#### FR-60 — List tags
**Behavior:** The System MUST provide a `list-tags` operation showing all tags with task counts, completion percentage, and ready-task counts.

**AC:**
- FR-60.1 A show-metadata option MUST display per-tag metadata.

#### FR-61 — Rename, copy, delete tags
**Behavior:** The System MUST provide `rename-tag`, `copy-tag`, and `delete-tag`.

**AC:**
- FR-61.1 Rename MUST preserve all tasks.
- FR-61.2 Copy MUST duplicate all tasks and metadata into a new isolated tag; an optional description MUST be settable.
- FR-61.3 Delete MUST remove the tag and its tasks; the CLI MUST prompt for confirmation unless a yes flag is given; through the agent interface, confirmation defaults to skipped.

#### FR-62 — Global tag option & isolation
**Behavior:** Most task operations MUST accept a tag option to target a tag for a single command without switching the active context, and each tag MUST be fully isolated.

**AC:**
- FR-62.1 Operations in one tag MUST NOT affect others.
- FR-62.2 Cross-tag listing/operations MUST require explicit opt-in.

#### FR-63 — Branch-aware contexts (opt-in)
**Behavior:** The System MUST support deriving a tag name from the current version-control branch (opt-in; no automatic switching).

#### FR-64 — Cross-tag movement
**Behavior:** Covered by FR-34 (move within/across tags with dependency handling).

#### FR-65 — Automatic legacy migration to default tag
**Behavior:** Legacy single-list stores MUST be transparently migrated under a default `master` tag.

**AC:**
- FR-65.1 Existing data MUST be preserved; a one-time migration notice MUST be shown (tracked by `migrationNoticeShown`).

---

### 8.k Role-Based AI Provider & Model Configuration

#### FR-66 — Three model roles
**Behavior:** The System MUST assign AI work to three independently-configured roles: main, research, fallback.

**AC:**
- FR-66.1 Each role MUST store: provider, model ID, max tokens, temperature, and optional base URL.
- FR-66.2 Main MUST be the primary generation/update model; research MUST serve research-augmented operations; fallback MUST be used automatically when main fails.
- FR-66.3 Fallback MUST be honored only if both provider and model ID are present, else treated as unset.

#### FR-67 — View configuration
**Behavior:** The model-configuration operation with no flags (or a list subcommand) MUST display current role assignments, per-provider key presence/status, and available built-in models.

#### FR-68 — Interactive setup wizard
**Behavior:** A setup mode MUST launch interactive selection of providers/models per role (including custom/local), then persist selections.

#### FR-69 — Direct role assignment with provider inference
**Behavior:** Set-main, set-research, and set-fallback options MUST assign a model to a role, inferring the provider when the model ID is a known built-in.

#### FR-70 — Provider-specifier flags
**Behavior:** Provider-specifier flags MUST pair with a set-* assignment to declare the provider for custom/ambiguous model IDs.

**AC:**
- FR-70.1 Supported specifier flags MUST include at least: local-runtime, OpenAI-compatible-router, cloud-managed (Azure/Bedrock/Vertex), local-CLI/OAuth assistant runtimes, OpenAI-compatible custom, and a base-URL override.
- FR-70.2 Using more than one provider flag simultaneously MUST error.
- FR-70.3 Custom model IDs MUST bypass built-in validation; the user is responsible for validity.

#### FR-71 — Per-role parameters
**Behavior:** Each role MUST accept max-tokens and temperature.

**AC:**
- FR-71.1 Default temperatures: 0.2 for main/fallback, 0.1 for research. Max tokens vary by model.
- FR-71.2 Role max-tokens MUST be reconciled against per-model catalog limits (use the minimum); model-specific temperature overrides MUST apply where defined; custom router models not in the catalog MUST receive a conservative cap.
- FR-71.3 Base URL resolution per role MUST prefer an explicit role base URL, then the provider's base-URL environment variable.

#### FR-72 — Provider categories
**Behavior:** The System MUST support the following provider categories (described in implementation-neutral terms):

| Category | Description | Auth |
|---|---|---|
| Hosted commercial LLM APIs | Major commercial model APIs | API key via environment |
| Cloud-managed model services | Enterprise cloud deployments (deployment names, regions, managed identity) | Managed credentials/keys + project/region settings |
| Local/self-hosted runtimes | Locally-run models | No API key; local endpoint (default `http://localhost:11434/api`), overridable |
| OpenAI-compatible custom endpoints | Any OpenAI-API-compatible service via custom base URL | Optional key/base URL |
| Local CLI / OAuth subscription runtimes | Assistant runtimes using OAuth/subscriptions, no per-token API key | OAuth/subscription |
| Host-session sampling provider | Use the host agent session's own model via sampling | Session-based, no key |

**AC:**
- FR-72.1 A model catalog MUST be the single source of truth, per provider, with per-model fields: id, optional display name, benchmark score (nullable), cost-per-million-tokens {input, output} (nullable), allowed roles (subset of main/fallback/research), max tokens, supported (boolean), optional reason (when unsupported), optional reasoning-effort levels, optional temperature override, optional API-type marker.
- FR-72.2 A model MUST be assignable to a role only if that role is in its allowed roles; unsupported models MUST be blocked.
- FR-72.3 Provider/model selection MUST validate against catalog-listed providers OR an allow-list of always-permitted custom providers (e.g. cloud-managed, router, local runtimes).
- FR-72.4 At least one usable provider credential (or a no-key provider) MUST be required to operate.

#### FR-73 — Secret handling via environment
**Behavior:** API keys and sensitive endpoints MUST be read from the environment (an env file for the CLI or the agent host's env block), never stored in the project configuration file.

**AC:**
- FR-73.1 Key resolution priority MUST be: process environment → agent session environment → project env file.
- FR-73.2 Key validation MUST reject empty and placeholder values.
- FR-73.3 No-key providers (local runtimes, cloud-managed via managed credentials, CLI/OAuth runtimes, host-session sampling) MUST report key-status OK.
- FR-73.4 Non-secret provider settings (base URLs, project/region) MAY live in the global configuration; secrets MUST NOT.

#### FR-74 — Provider-specific advanced config sub-objects
**Behavior:** The configuration MUST support per-provider advanced sub-objects for CLI/agent-style providers.

**AC:**
- FR-74.1 Each sub-object MUST be schema-validated; invalid settings MUST warn and fall back to empty.
- FR-74.2 Sub-objects MUST support a command-specific override map keyed by valid AI-command names (merged over base settings per command); invalid keys MUST fail validation.
- FR-74.3 Advanced fields MUST include (per provider) at least: executable path, working directory, approval/permission/sandbox modes, allowed/disallowed tools, reasoning effort, and host tool-integration server definitions, as applicable.

---

### 8.l Programmatic Agent/Editor Integration Interface

#### FR-75 — Agent integration server
**Behavior:** The System MUST ship an agent integration server exposing its operations as machine-readable tools over a standard transport (stdio), launchable on demand.

**AC:**
- FR-75.1 On startup it MUST register a selected set of tools and return structured JSON for each call.
- FR-75.2 Individual tool-registration failures MUST be logged without preventing startup; "already registered" MUST be treated as success.
- FR-75.3 Provider keys MUST be read from the host's env block or a project env file.
- FR-75.4 A configurable timeout MUST be supported (1–3600s; default 60s; ~300s recommended for long operations).

#### FR-76 — Host environments
**Behavior:** The same server MUST be wireable into multiple compatible editor and agent environments via a per-host configuration block.

**AC:**
- FR-76.1 The host configuration block MUST supply command, args, an env section (keys + tool-loading mode), an optional timeout, and (where required) a transport type field.
- FR-76.2 The System MUST accommodate hosts that use a differently-named top-level config key and require a per-server transport type field.
- FR-76.3 At least one host integration (an OAuth-based assistant runtime) MUST require no separate provider key.

#### FR-77 — Tool-loading modes
**Behavior:** A tool-loading mode (set via an environment variable) MUST control which tools register, to manage context-window cost.

**AC:**
- FR-77.1 Modes MUST include: `core`/`lean` (default; 7 tools), `standard` (14 tools = core + 7), `all` (full registry), and a custom comma-separated list.
- FR-77.2 Matching MUST be case-insensitive and normalize underscores/hyphens, with an alias map.
- FR-77.3 The **core** set MUST be: list tasks, next task, get task, set status, update subtask, parse spec, expand task.
- FR-77.4 The **standard** set MUST add: bootstrap, analyze complexity, expand all, add subtask, remove task, add task, complexity report.
- FR-77.5 Unknown names in a custom list MUST be dropped with a warning; if a custom list resolves to zero tools, the server MUST fall back to loading all tools; an unparseable mode value MUST fall back to all tools.

#### FR-78 — Tool catalog & CLI parity
**Behavior:** The tool registry MUST map every tool name to a registration function, with each tool a thin wrapper around the corresponding CLI capability returning structured JSON.

**AC:**
- FR-78.1 The registry MUST cover all task, subtask, dependency, tag, complexity, research, model, profile, generation, and autonomous-workflow operations (a catalog on the order of ~44–45 tools).
- FR-78.2 Tool name casing/hyphenation MUST be normalized on lookup.

#### FR-79 — Calling conventions vs CLI
**Behavior:** Agent tools MUST be invoked via the host's tool-call mechanism, return structured JSON, and require an explicit absolute project root (no implicit working directory).

**AC:**
- FR-79.1 Long-running tools MUST be usable within a raised timeout.
- FR-79.2 Project-root resolution MUST follow precedence: environment → call args → session fallback (decoding URIs and converting platform-specific paths).

#### FR-80 — Uniform response envelope
**Behavior:** Every agent tool MUST return a uniform response envelope.

**AC:**
- FR-80.1 Internal results MUST be `{ success, data?, error?:{code,message} }`; the wrapper MUST attach version metadata and produce host-compatible content `{ content:[{type:'text', text}] }` (objects JSON-stringified with indentation).
- FR-80.2 Error responses MUST set an error flag and carry `{error:{code,message}}`, plus version and optional tag metadata.
- FR-80.3 A higher-order wrapper MUST ensure the project root is present/normalized for every tool.

#### FR-81 — Host-session sampling as an AI provider
**Behavior:** The System MUST optionally use the host session's model via sampling instead of a direct provider key.

**AC:**
- FR-81.1 It MUST require an active session whose client advertises sampling capability; it MUST support text, schema-driven structured output, and spec parsing via sampling.
- FR-81.2 It MUST fail clearly outside a sampling-capable session, and a non-sampling fallback provider SHOULD be configured.

#### FR-82 — Autonomous TDD workflow tools (agent-facing)
**Behavior:** The System MUST expose an agent-facing, resumable TDD workflow state machine over a task's subtasks, with version-control integration. This is also available as a CLI parent command with subcommands.

**AC (state machine):** Phases MUST be RED, GREEN, REFACTOR, COMMIT, FINALIZE. Workflow state MUST persist on disk: phase, TDD phase, task ID, subtasks, max attempts, branch name, attempts, progress, test results, coverage, org slug, tag.

- FR-82.1 **start** MUST validate the task (main task ID only; not a subtask), ensure no existing workflow (unless forced), require subtasks, create a feature branch (derived from tag or org slug), initialize state, and return branch/phase/TDD-phase/progress/current-subtask/next-action. Options: max attempts (default 3), force (default false).
- FR-82.2 **next** MUST return the next action for the active workflow.
- FR-82.3 **complete** MUST validate test results to advance RED (requires ≥1 failing test; zero failures auto-completes the subtask) or GREEN (requires all passing); it MUST reject calls during COMMIT phase, directing to the commit tool. Inputs: test results `{total, passed, failed, skipped?}`, optional coverage.
- FR-82.4 **commit** MUST confirm COMMIT phase and a current subtask, stage changes (specified files or all), generate a conventional commit message from subtask context and TDD phase (test for RED, feat for GREEN) or use a custom message, embed metadata (task/subtask/phase), commit, and advance state.
- FR-82.5 **finalize** MUST require FINALIZE phase and a clean working tree, finalize the workflow, and mark the main task done.
- FR-82.6 **status** MUST return phase/progress/subtask/history.
- FR-82.7 **resume** MUST reload a saved/paused workflow (error if none); **abort** MUST cancel the active workflow (CLI confirms unless forced or JSON mode) and note that branch and commits remain for manual cleanup.
- FR-82.8 All autonomous tools MUST require an absolute project root and error with a prompt to start when no active workflow exists.

#### FR-83 — Long-running operation status
**Behavior:** The System SHOULD provide a tool to query the status of long-running background operations (available under the all/custom tool sets).

---

### 8.m Task File Generation & Export

#### FR-84 — Generate per-task files
**Behavior:** The System MUST provide a `generate` operation producing individual per-task files from the task store.

**AC:**
- FR-84.1 Options MUST include: tag, output directory (default the tasks dir), project root (auto-detected if omitted), format (`text` default, or `json`).
- FR-84.2 It MUST report counts of generated files, the output directory, and any orphaned files removed (task files no longer present in the store).
- FR-84.3 Generated files MUST include sections for overview, tag context, implementation details, subtask breakdown, and dependency status indicators (completed/pending).
- FR-84.4 `text` format MUST render styled success/warning/error boxes; `json` MUST emit structured output. Errors MUST trigger cleanup then non-zero exit.

#### FR-85 — Sync task list to README
**Behavior:** The System MUST provide a `sync-readme` operation writing the current task list into the project README.

**AC:**
- FR-85.1 Options MUST include: file, with-subtasks, status filter, tag (default master).
- FR-85.2 Failure MUST print an error and exit non-zero.

---

### 8.n Usage/Cost Telemetry & Logging

#### FR-86 — Per-call AI telemetry
**Behavior:** Every AI call MUST return a telemetry record.

**AC:**
- FR-86.1 The record MUST contain: timestamp (ISO), user ID, command name, model used, provider name, input tokens, output tokens, total tokens, total cost (numeric), currency (USD).
- FR-86.2 In CLI text mode, a usage summary MUST be auto-displayed after the main output; through the agent interface, telemetry MUST be passed through `{ success, data:{ ...operationData, telemetryData } }` with no auto-display.
- FR-86.3 Cost MUST derive from the catalog's per-model input/output cost-per-million-tokens.

#### FR-87 — Anonymous telemetry opt-out
**Behavior:** Anonymous usage telemetry (for local storage) MUST be controllable.

**AC:**
- FR-87.1 The setting MUST default to on (opt-in by default) and be disable-able; the System MUST honor an explicit off value.

#### FR-88 — Logging level & debug
**Behavior:** Output verbosity MUST be controllable.

**AC:**
- FR-88.1 A log level (default info; values debug/info/warn/error/success) MUST control verbosity; a debug flag (default false) MUST gate debug logs; the log level MUST be overridable via an environment variable.
- FR-88.2 The debug flag MUST be coerced to strict boolean (true only when exactly true).

#### FR-89 — User ID for telemetry
**Behavior:** A stable user identifier MUST be available for telemetry.

**AC:**
- FR-89.1 If absent, the System MUST set and persist a default identifier; a write failure MUST log a warning and proceed with the in-memory default.

---

### 8.o Localization / Response Language

#### FR-90 — Response language
**Behavior:** The System MUST let users set a preferred natural language for AI-generated content via a `lang` operation.

**AC:**
- FR-90.1 A response option MUST set the language directly; a setup mode MUST prompt interactively (default English).
- FR-90.2 The setting MUST default to English and be stored in the global configuration; success MUST print confirmation, failure MUST exit non-zero.
- FR-90.3 The configured language MUST steer AI output across operations.

---

### 8.p Cross-Cutting: Configuration Loading, Modes & Utilities

#### FR-91 — Configuration loading & defaults
**Behavior:** Configuration MUST load with deep-merge over built-in defaults so partial/missing config still works.

**AC:**
- FR-91.1 On load, parsed config MUST be deep-merged onto defaults per section (each role, global, and provider sub-objects).
- FR-91.2 A missing config file MUST use defaults and warn to run model setup (warning suppressed in API/remote mode, during bootstrap, or when warnings are suppressed).
- FR-91.3 A parse error MUST log and reset to defaults; an invalid main/research provider MUST fall back for that role with a warning; an invalid fallback MUST clear the fallback role.
- FR-91.4 Configuration MUST be cached after first load, with a force-reload path.

#### FR-92 — Feature-flag toggles
**Behavior:** Optional behaviors MUST be toggleable with environment-override priority.

**AC:**
- FR-92.1 Codebase-analysis (default on) and proxy (default off) flags MUST resolve in priority: environment variable → agent session env → config.
- FR-92.2 Codebase-analysis availability MUST additionally require the active provider be one of the codebase-analysis-capable CLI/OAuth runtimes.

#### FR-93 — Operating mode (solo/team)
**Behavior:** Operating mode MUST resolve with defined precedence.

**AC:**
- FR-93.1 Precedence MUST be: explicit mode flag → config storage mode → auth fallback (authenticated → team, else solo); default solo.

#### FR-94 — Cloud/team collaboration surface
**Behavior:** Cloud/team collaboration MUST be surfaced through auth, context, and briefs operations (there is no standalone "cloud" or "team" command).

**AC:**
- FR-94.1 **auth** (with login/logout/status/refresh subcommands; top-level login/logout aliases) MUST support browser OAuth or token-based auth (for remote/SSH), handle MFA, optionally set up workspace context post-login, and support inviting teammates. Credentials and org/brief context MUST be stored locally.
- FR-94.2 **context** MUST manage the active organization (team) and brief: a default action that sets context from a brief ID/URL or displays current context, plus org/brief/set/clear subcommands. Changing org MUST clear the brief; selecting a brief MUST require an org first. A no-header option MUST suppress the banner.
- FR-94.3 **briefs** (alias brief) MUST list briefs (with status, updated date, task counts, current-brief marker), select a brief (interactive if no arg), and redirect brief creation to the web UI. All brief operations MUST require API/cloud storage and valid authentication.

#### FR-95 — Autonomous task loop (CLI)
**Behavior:** The System MUST provide a `loop` operation that runs an AI assistant in a loop, executing one task per iteration.

**AC:**
- FR-95.1 Options MUST include: iterations (default auto-derived from preset + pending count), prompt (preset name `default`/`aggressive`/`careful` or a custom prompt file path; default `default`), progress-file (default a progress log in the config dir), tag, project root, sandbox flag, no-output flag, verbose flag.
- FR-95.2 With sandbox, it MUST validate sandbox authentication before running; only the default preset previews the next pending task.
- FR-95.3 It MUST read pending tasks (optionally tag-filtered), write a progress log, and print formatted final results including completion status.

#### FR-96 — Interactive shell (TUI/REPL)
**Behavior:** The System MUST provide a `tui` operation (alias `repl`) intended as an interactive shell; running the CLI with no arguments MUST launch it.

**AC:**
- FR-96.1 In the current version the interactive shell MUST gracefully fall back to showing help (auth-aware) with a "coming soon" notice. In a non-interactive terminal it MUST render briefly then exit with a hint.

#### FR-97 — Auto-update on launch
**Behavior:** Before running a command, the System MUST check for a newer version and, if needed, notify, update, and restart to run the user's command.

**AC:**
- FR-97.1 Auto-update MUST be skippable via an environment flag, in CI, or in test mode.
- FR-97.2 The startup banner MUST be suppressible (a no-banner flag, non-TTY, or for bootstrap/tui/repl).

---

### 8.q Interactive PRD Authoring & Spec Quality

> Front-of-funnel capabilities for **Project Builders**. The System historically assumed a spec already exists (FR-12 `parse-spec` reads one). These requirements add authoring and pre-parse quality gating.

#### FR-98 — Interactive PRD Builder
**Behavior:** The System MUST provide a `prd` operation (CLI and agent tool) that interactively builds a specification from a guided question-and-answer interview, using AI to ask **adaptive follow-up questions**, and writes a structured PRD/spec markdown file into the docs directory ready for `parse-spec`.

**AC:**
- FR-98.1 The interview MUST start from a seed: a one-line idea, a chosen template (the simple or complex template from FR-1.3), or an existing draft. It MUST proceed through a sequenced set of topic areas (problem/background, target users/personas, goals & non-goals, core features/scope, constraints & assumptions, success metrics).
- FR-98.2 Each round MUST send prior answers plus project context to the main (or research) model to generate **adaptive follow-up questions** that fill gaps and resolve ambiguity. The user MUST be able to answer, skip, or request a different question. A configurable stop condition (max rounds and/or an "enough detail" signal) MUST end the interview.
- FR-98.3 The builder MUST support interactive mode (CLI prompts / agent elicitation) and a **non-interactive batch mode** (answers supplied via a file/JSON), and MUST be **resumable** — partial interview state persists in the project config dir so a session can be paused and continued.
- FR-98.4 On completion the System MUST render a complete spec using the selected template structure, write it to the docs spec path used by `parse-spec` (FR-12.2; filename derived from a title slug), preserve any existing file per FR-1.4 semantics (no silent overwrite), and offer to chain into the spec-readiness check (FR-99) and `parse-spec` (FR-12).
- FR-98.5 A research flag MUST route question generation and drafting through the research role for landscape-informed prompts.
- FR-98.6 All AI calls MUST report telemetry (FR-86) and honor the configured response language (FR-90).
- FR-98.7 Through the agent interface the tool MUST require an absolute project root, be marked state-changing, support multi-turn elicitation (or a single-call batch mode carrying all answers), and return the saved file path in structured JSON.

#### FR-99 — Spec readiness / quality check
**Behavior:** The System MUST provide a `check-spec` operation that evaluates a specification for parse-readiness and reports a quality score with actionable gaps **before** task generation.

**AC:**
- FR-99.1 It MUST read a spec (positional or `--input`, defaulting to the docs spec path) and use AI to score defined dimensions — clarity, completeness, scoped-ness, testability, and implied structure — on a 1–10 scale, plus an overall readiness score and a pass/warn/block verdict against a configurable threshold (default 5, mirroring complexity-threshold semantics, FR-46.2).
- FR-99.2 The report MUST list concrete gaps/ambiguities with suggested fixes and, where possible, the missing section each maps to.
- FR-99.3 An empty/unreadable spec MUST raise the same clear error as FR-12.5.
- FR-99.4 The operation MUST be read-only with respect to the task store; it MAY optionally write a markdown report under the reports dir behind a flag.
- FR-99.5 It MUST define explicit non-zero exit / strict (CI) mode semantics (mirroring the R-1 resolution adopted in FR-43) so it can gate a pipeline.
- FR-99.6 The CLI summary and the agent JSON MUST both expose per-dimension scores, the overall verdict, and the gap list; AI calls MUST report telemetry.

---

### 8.r Visualization & Local Dashboard

> Local visual surfaces for **Developers**. Locally the System is CLI + agent only; a visual board currently exists **only** in the cloud/team web UI (FR-94). These requirements give solo/offline users the same visibility. Visual surfaces are **read-models over the same core logic** (NFR-22) and MUST NOT introduce behavior unavailable to the CLI/agent.

#### FR-100 — Local Kanban board visualizer
**Behavior:** The System MUST provide a `board` operation that starts a **local web server** rendering the active (or specified) tag's tasks as a Kanban board with one column per status, viewable in a browser.

**AC:**
- FR-100.1 Columns MUST correspond to the six-value status enum (FR-25.1) in lifecycle order (`pending, in-progress, review, done, deferred, cancelled`). Cards MUST show id, title, priority, a dependency-readiness indicator (FR-23/FR-45.3), and subtask progress.
- FR-100.2 The server MUST bind to localhost by default on a configurable port (`--port`, default auto-selected and printed), print the URL, and auto-open the browser unless disabled (`--no-open`); a host-binding option MUST exist (default localhost; NFR-19).
- FR-100.3 Dragging a card to another column MUST invoke the same core `set-status` logic (FR-24) — including the parent→subtask cascade (FR-24.2) — and persist via the storage layer; the board MUST NOT bypass validation (FR-19).
- FR-100.4 The board MUST be tag-aware (`--tag`) and MUST offer a tag switcher plus status/priority filters in the UI.
- FR-100.5 A read-only mode (`--read-only`) MUST disable all write affordances and refuse server-side writes (for sharing/demo).
- FR-100.6 The board MUST live-update when the store changes (FR-102) and MUST degrade to manual refresh if live updates are unavailable.
- FR-100.7 In team/api storage mode the board MUST read through the same repository interface (FR-18.5); it MUST NOT duplicate the cloud web UI's authentication surface.

#### FR-101 — Dependency-graph visualization
**Behavior:** The visualization server MUST additionally render a directed dependency graph (DAG) of tasks/subtasks for the active/specified tag.

**AC:**
- FR-101.1 Nodes MUST represent tasks (and, on toggle, subtasks); edges MUST represent dependency relationships; node styling MUST encode status and priority.
- FR-101.2 The graph MUST visually flag dependency issues detected by FR-43 (missing, circular, self) and highlight the critical path and the next actionable task (FR-23).
- FR-101.3 Selecting a node MUST show task detail at parity with `show` (FR-22) and provide quick actions (set-status, expand) that route through core logic.
- FR-101.4 The graph view MUST share the server, port, tag-scoping, and read-only mode of FR-100.

#### FR-102 — Watch / live-sync mode
**Behavior:** The System MUST provide a `watch` capability (a standalone command and the mode powering the board) that observes the task store / spec for changes and reacts in real time.

**AC:**
- FR-102.1 It MUST detect changes to the task store (and optionally a watched spec/docs file) and emit change events without polling-induced data races (debounced, atomic-read aware per FR-19.2).
- FR-102.2 When powering the board (FR-100/101), changes MUST push to connected browsers over a live channel (e.g. SSE/WebSocket) so views update without manual refresh.
- FR-102.3 As a standalone command, `watch` MUST optionally re-run a configured action on change (e.g. regenerate task files FR-84, sync README FR-85, re-validate dependencies FR-43), logging each run.
- FR-102.4 Watching MUST be resilient to transient mid-write file states and MUST stop cleanly on interrupt.

#### FR-103 — Roadmap / milestone view
**Behavior:** The System MUST support grouping tasks into milestones/phases and rendering a lightweight roadmap (CLI summary and a visualization-server view), without becoming a full PM/Gantt tool (NG-1).

**AC:**
- FR-103.1 Tasks MUST support an optional `milestone` (phase) label in task metadata; a `roadmap` operation MUST group tasks by milestone showing per-milestone counts, completion %, and ready/blocked counts (reusing FR-23 readiness).
- FR-103.2 Milestones MAY be inferred from dependency depth when unlabeled (a derived ordering), clearly marked as derived.
- FR-103.3 The roadmap MUST be tag-aware.
- FR-103.4 The roadmap MUST NOT introduce dates, durations, time tracking, or resourcing (NG-1); ordering is dependency- and milestone-based only.

---

### 8.s External Integrations & Eventing

> Bridges to where developers already work. The cloud/team backend (FR-94) is the System's **own** store; these requirements connect to **external** trackers and emit events outward.

#### FR-104 — External tracker / Git-platform sync
**Behavior:** The System MUST provide a `sync` operation that synchronizes tasks with external issue trackers / Git platforms (e.g. GitHub Issues, GitLab, Linear, Jira) through a provider-pluggable adapter interface.

**AC:**
- FR-104.1 A canonical, extensible set of sync providers MUST exist behind a single adapter interface (parity with the catalog/profile-factory extensibility model, §10.4) so a new provider is added without changing unrelated feature code.
- FR-104.2 Sync MUST support a configurable direction — push (tasks → external), pull (external → tasks), or two-way — with an explicit conflict policy (newest-wins / prefer-local / prefer-remote / report-only) and a dry-run preview (parity with FR-1.7).
- FR-104.3 A stable external-id mapping MUST be persisted (task metadata and/or a mapping file) so repeated syncs update rather than duplicate; status MUST map between the six-value enum (FR-25) and each provider's states via a documented, overridable mapping.
- FR-104.4 The System MUST optionally link tasks to branches/commits/PRs (extending autopilot's git use, FR-82) and MAY advance task status on PR merge / issue close when two-way sync is enabled.
- FR-104.5 All provider credentials MUST be resolved from the environment only (parity with FR-73 / NFR-9), never written to project config or version control.
- FR-104.6 Sync MUST be exposed via CLI and agent tool, require an absolute project root through the agent interface, and report a per-run summary (created/updated/skipped/conflicts).

#### FR-105 — Notifications & webhooks
**Behavior:** The System MUST emit events for significant state changes and MUST be able to deliver them to configured sinks (webhooks and/or local/desktop notifications).

**AC:**
- FR-105.1 A defined event taxonomy MUST exist: at minimum task created/updated/status-changed/removed, a task became actionable ("next-ready"), dependency-validation failures, and autopilot phase transitions (FR-82).
- FR-105.2 Webhook sinks MUST be configurable (URL, optional signing secret, event filter); delivery MUST be best-effort with retry/backoff and MUST never block or crash the originating operation (parity with NFR-7).
- FR-105.3 Webhook secrets/tokens MUST be resolved from the environment, never stored in project config (parity with FR-73).
- FR-105.4 Local/CLI notifications and the board's live channel (FR-102) MUST consume the same event stream; an opt-out / event filter MUST be honored (parity with FR-87).
- FR-105.5 Events MUST be emitted from the shared storage/core layer so the CLI and agent surfaces produce identical events (parity with NFR-3).

---

### 8.t Discovery, History & Export

#### FR-106 — Task search & advanced filtering
**Behavior:** The System MUST provide a `search` operation (aliases `find`/`query`) for full-text and fuzzy search plus advanced filtering across tasks/subtasks.

**AC:**
- FR-106.1 Search MUST cover title, description, details, and notes; fuzzy matching MUST reuse the existing fuzzy engine used for research/complexity context (FR-52.2).
- FR-106.2 Filters MUST combine: status (enum), priority, dependency-readiness (ready/blocked), has-subtasks, and tag (including a cross-tag / all-tags opt-in per FR-62.2), together with the free-text query.
- FR-106.3 Results MUST render in the standard list format (FR-21) with match highlighting, support result limits and sorting, and expose the same fields; the agent tool MUST return structured JSON.
- FR-106.4 An empty result MUST report "no matches" rather than erroring; invalid filter values MUST be rejected with actionable messages (NFR-2).

#### FR-107 — History / audit log & undo
**Behavior:** The System MUST maintain a durable history of task-store mutations and provide `history` and `undo` operations.

**AC:**
- FR-107.1 Every state-changing operation MUST append an audit entry (timestamp, operation, scope/ids, tag, and a before/after summary or reversible patch) to a history log in the project config dir; read operations MUST NOT be logged.
- FR-107.2 A `history` operation MUST list recent changes (filterable by tag/operation/id) with enough detail to identify each change.
- FR-107.3 An `undo` operation MUST revert the most recent change (or a selected reversible entry), restoring affected tasks while preserving non-target tags (parity with FR-18.6); irreversible/unsafe entries MUST be reported rather than partially applied.
- FR-107.4 History MUST be capped/rotated with configurable retention and MUST tolerate a corrupt/missing log by treating it as empty (parity with FR-17.4).
- FR-107.5 History MUST be emitted from the shared core/storage layer so CLI and agent mutations are both recorded (parity with NFR-3, NFR-15).

#### FR-108 — Export & reporting
**Behavior:** The System MUST provide an `export` operation producing task data and progress reports in multiple formats.

**AC:**
- FR-108.1 Export formats MUST include at least Markdown, JSON, and CSV; a board/column-grouped export (e.g. a Markdown Kanban) SHOULD be available.
- FR-108.2 A progress report MUST summarize counts by status, completion %, ready/blocked counts, and per-priority distribution for the active/specified tag (and, opt-in, across tags); it MUST reuse complexity data (FR-46) when present.
- FR-108.3 Reporting MUST stay within NG-1: no time tracking, durations, or resourcing — any burndown-style summary is limited to status counts over the recorded history (FR-107) where available.
- FR-108.4 Export MUST be tag-aware, support an output path/dir and a format flag (parity with FR-84), emit structured JSON through the agent interface, and exit non-zero on failure (parity with FR-84.4).

---

## 9. Command & Operation Surface

> Generic verb mapping. CLI commands are illustrative generic verbs; agent tool names are the structured-interface equivalents. All task-scoped commands accept `--file` and `--tag` unless noted.

| Capability area | CLI command (generic) | Agent tool (generic) | Key options |
|---|---|---|---|
| Bootstrap | `init` | `initialize_project` | `--yes`, `--name`, `--description`, `--version`, `--author`, `--rules`, `--skip-install`, `--dry-run`, `--aliases/--no-aliases`, `--git/--no-git`, `--git-tasks/--no-git-tasks` |
| Migrate | `migrate` | — | `--force`, `--backup`, `--cleanup`, `--yes`, `--dry-run`, `--debug` |
| Profiles | `rules add|remove|setup` | `rules` | `--force`, `--setup`, `--mode`, `--yes` |
| Parse spec | `parse-spec` | `parse_spec` | `--input`, `--output`, `--num-tasks`, `--force`, `--append`, `--research`, `--tag` |
| List | `list` | `get_tasks` | `--status`, `--with-subtasks` |
| Show | `show` | `get_task` | id(s), dot notation |
| Next | `next` | `next_task` | (global only) |
| Set status | `set-status` | `set_task_status` | `--id`, `--status` |
| Add task | `add-task` | `add_task` | `--prompt`, `--title`, `--description`, `--details`, `--dependencies`, `--priority`, `--research` |
| Bulk update | `update` | `update` | `--from`, `--prompt`, `--research` |
| Update task | `update-task` | `update_task` | id, prompt, `--append`, `--research` |
| Update subtask | `update-subtask` | `update_subtask` | `--id`, `--prompt`, `--research`, `--metadata` (gated) |
| Add subtask | `add-subtask` | `add_subtask` | `--parent`, `--task-id`, `--title`, `--description`, `--details`, `--status`, `--dependencies`, `--generate`/`skipGenerate` |
| Remove subtask | `remove-subtask` | `remove_subtask` | `--id`, `--convert`, `--generate`/`skipGenerate` |
| Remove task | `remove-task` | `remove_task` | `--id`, `--yes` |
| Clear subtasks | `clear-subtasks` | (core) | `--id`, `--all` |
| Move | `move` | `move_task` | `--from`, `--to`, `--from-tag`, `--to-tag`, `--with-dependencies`, `--ignore-dependencies` |
| Scope up/down | `scope-up`/`scope-down` | `scope_up_task`/`scope_down_task` | `--id`, `--strength`, `--prompt`, `--research` |
| Expand | `expand` | `expand_task` | `--id`, `--num`, `--prompt`, `--research`, `--force`, `--complexity-report` |
| Expand all | `expand --all` | `expand_all` | `--all`, `--force`, `--research`, `--num`, `--prompt` |
| Add dependency | `add-dependency` | `add_dependency` | `--id`, `--depends-on` |
| Remove dependency | `remove-dependency` | `remove_dependency` | `--id`, `--depends-on` |
| Validate deps | `validate-dependencies` | `validate_dependencies` | (global only) |
| Fix deps | `fix-dependencies` | `fix_dependencies` | (global only) |
| Analyze complexity | `analyze-complexity` | `analyze_project_complexity` | `--output`, `--model`, `--threshold`, `--research`, `--id`, `--from`, `--to` |
| View complexity | `complexity-report` | `complexity_report` | `--file`, `--tag` |
| Research | `research` | `research` | `--id`, `--files`, `--context`, `--tree`, `--detail`, `--save-to`, `--save-file` |
| Tags: create | `add-tag` | `add_tag` | `--description`, `--from-branch`, `--copy-from-current`, `--copy-from` |
| Tags: switch | `use-tag` | `use_tag` | name |
| Tags: list | `tags`/`list-tags` | `list_tags` | `--show-metadata` |
| Tags: rename | `rename-tag` | `rename_tag` | old, new |
| Tags: copy | `copy-tag` | `copy_tag` | source, target, `--description` |
| Tags: delete | `delete-tag` | `delete_tag` | name, `--yes` |
| Models | `models` | `models` | `--setup`, `--set-main`, `--set-research`, `--set-fallback`, provider flags, `--baseURL` |
| Language | `lang` | `response-language` | `--response`, `--setup` |
| Generate files | `generate` | `generate` | `--tag`, `--output`, `--project`, `--format` |
| Sync README | `sync-readme` | — | `--file`, `--with-subtasks`, `--status`, `--tag` |
| Loop | `loop` | — | `--iterations`, `--prompt`, `--progress-file`, `--tag`, `--project`, `--sandbox`, `--no-output`, `--verbose` |
| Autonomous TDD | `autopilot <sub>` | `autopilot_*` | start/resume/next/complete/commit/status/finalize/abort |
| Auth/context/briefs | `auth`, `context`, `briefs` | — | see FR-94 |
| Interactive shell | `tui`/`repl` | — | — |
| PRD builder | `prd` | `build_prd` | seed (idea/template/draft), `--research`, `--answers <file>`, `--resume` |
| Spec check | `check-spec` | `check_spec` | `--input`, `--threshold`, `--strict`, `--report` |
| Board | `board` | — | `--tag`, `--port`, `--no-open`, `--host`, `--read-only`, `--graph` |
| Dependency graph | `board --graph` | — | shares board options |
| Watch | `watch` | — | `--on-change <action>`, `--tag`, watched spec path |
| Roadmap | `roadmap` | `get_roadmap` | `--tag`, `--milestone` |
| Sync (external) | `sync` | `sync_tasks` | `--provider`, `--direction <push\|pull\|two-way>`, `--conflict`, `--dry-run` |
| Notifications | `notify` (config) | — | webhook URL/secret(env)/event filter, opt-out |
| Search | `search`/`find` | `search_tasks` | query, `--status`, `--priority`, `--ready`, `--has-subtasks`, `--all-tags`, `--limit`, `--sort` |
| History | `history` | `get_history` | `--id`, `--tag`, `--operation` |
| Undo | `undo` | `undo` | `[entry]`, `--yes` |
| Export | `export` | `export_tasks` | `--format <md\|json\|csv\|board>`, `--output`, `--tag`, `--all-tags` |

---

## 10. Configuration & Extensibility

### 10.1 Configuration file (project config dir)

The configuration file is JSON, deep-merged over built-in defaults, with these sections:

**`models.{main|research|fallback}`** — each: `provider` (required), `modelId` (required), `maxTokens`, `temperature`, optional `baseURL`.

| Role | Default provider category | Default temperature | Default max tokens (illustrative) |
|---|---|---|---|
| main | hosted commercial | 0.2 | high (model-dependent; corrected from catalog) |
| research | research-capable hosted | 0.1 | moderate |
| fallback | hosted commercial | 0.2 | high |

**`global`** keys & defaults:

| Key | Default |
|---|---|
| `logLevel` | `info` |
| `debug` | `false` |
| `defaultNumTasks` | `10` |
| `defaultSubtasks` | `5` |
| `defaultPriority` | `medium` |
| `defaultTag` | `master` |
| `projectName` | (project name) |
| `responseLanguage` | `English` |
| `ollamaBaseURL` (local runtime endpoint) | `http://localhost:11434/api` |
| `azureBaseURL` | (unset) |
| `vertexProjectId` | (unset) |
| `vertexLocation` | `us-central1` |
| `bedrockBaseURL` | (default regional endpoint) |
| `enableCodebaseAnalysis` | `true` |
| `enableProxy` | `false` |
| `anonymousTelemetry` | `true` |
| `userId` | (generated) |

**`storage`** — `type` (`file`|`api`), `apiEndpoint`, `operatingMode` (`solo`|`team`).

**Provider sub-objects** — advanced per-provider settings (executable paths, approval/permission/sandbox modes, allowed/disallowed tools, reasoning effort, host tool-integration definitions, and a command-specific override map).

### 10.2 Runtime state file

`{ currentTag, lastSwitched, migrationNoticeShown, branchTagMapping }` — auto-created, not hand-edited.

### 10.3 Secrets via environment

API keys and sensitive endpoints come from the environment (CLI env file or agent host env block), resolved process-env → session-env → project-env-file, with placeholder rejection. Non-secret endpoint/region settings live in `global`; a per-model `baseURL` overrides the corresponding global setting. Per-provider env keys MUST be supported for each provider category, plus endpoint/region/credential overrides.

### 10.4 Extensibility model

- **New model:** add an entry to the model catalog (per provider) — no feature-code change.
- **New editor/agent profile:** add a profile file with minimal overrides via the profile factory, and add its identifier to the canonical profile enumeration.
- **New agent tool:** add it to the tool registry; selection groups (core/standard/all/custom) gate exposure.

### 10.5 Defaults summary

| Setting | Default |
|---|---|
| Tasks per spec parse | 10 |
| Subtasks per expansion (fallback) | 5 → invalid falls back to 3 |
| Task priority | medium |
| Default tag | master |
| Complexity threshold | 5 |
| Research detail level | medium |
| Agent tool-loading mode | core (7 tools) |
| Agent server timeout | 60s (≈300s recommended for AI ops) |
| Streaming timeout | 180s |
| Autonomous TDD max attempts | 3 |
| Spec-readiness threshold | 5 |
| Board server host binding | localhost |
| Board server port | auto-selected (printed) |
| Sync conflict policy | report-only |
| History retention | bounded/rotated (configurable) |

### 10.6 Extended feature configuration (v1.1)

New config sections (all deep-merged over defaults per §10.1; **secrets remain env-only** per §10.3):

**`visualization`** — `port` (default auto), `host` (default `localhost`), `autoOpen` (default true), `readOnly` (default false). Powers `board`/graph/roadmap (FR-100–103).

**`integrations.<provider>`** — non-secret settings for each external sync provider (e.g. repo/org/project identifiers, default direction, conflict policy, and a status-mapping override table six-enum↔provider). Provider credentials/tokens MUST come from the environment (FR-104.5). New providers are added behind the adapter interface (§10.4) — no unrelated feature-code change.

**`notifications`** — `enabled` (default false), `events` (event-type filter), and `webhooks: [{ url, events, secretEnv }]` where `secretEnv` names an env var holding the signing secret (never the secret itself, FR-105.3). The board live channel and local notifications consume the same event stream (FR-105.4).

**`history`** — `enabled` (default true), `retention` (max entries / rotation policy). Audit log lives in the project config dir (FR-107.1, FR-107.4).

**`global` additions** — `milestone` labels are stored per-task in task metadata (FR-103.1), not in `global`; an optional `specReadinessThreshold` (default 5) MAY be set for `check-spec` (FR-99.1).

### 10.7 Extensibility model additions

- **New sync provider:** implement the sync adapter interface and register it; non-secret config lives under `integrations.<provider>`, credentials under environment variables.
- **New notification sink / event:** add the sink to the notifications config and/or extend the shared event taxonomy emitted from the core layer (FR-105.5).
- **New export format:** add a formatter to the export registry (FR-108.1).

---

## 11. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Usability | The CLI MUST provide guided interactive flows and rich, formatted output; non-interactive defaults MUST make every interactive flow scriptable. |
| NFR-2 | Usability | Error messages MUST be actionable, naming the offending input and the corrective command. |
| NFR-3 | Dual-surface parity | CLI and agent interface MUST share core logic so behavior is identical; the agent interface returns structured JSON and requires an explicit project root. |
| NFR-4 | Performance | Long-running AI operations MUST support raised timeouts and (where enabled) progress reporting; the agent default timeout MUST be configurable up to 3600s. |
| NFR-5 | Performance / Context cost | The agent interface MUST allow narrowing the exposed tool set (core/standard/all/custom) to reduce context-window cost. |
| NFR-6 | Reliability | A configured fallback model MUST be tried automatically when the main model fails. |
| NFR-7 | Reliability | Partial/missing/corrupt configuration MUST degrade to defaults with warnings, never crash the tool. |
| NFR-8 | Reliability | Destructive operations MUST require confirmation (or an explicit yes/force flag), and dependency-graph repair MUST be available. |
| NFR-9 | Security | Secrets MUST never be written to configuration files or version control; key resolution MUST follow the defined precedence and reject placeholders. |
| NFR-10 | Security | Remote auth tokens MUST be stored outside the project config in a user-scoped location; MFA MUST be supported. |
| NFR-11 | Portability | The System MUST detect shell and project root across platforms, handle platform-specific paths and file URIs, and work on common OSes. |
| NFR-12 | Offline/local operation | The System MUST support fully local operation with self-hosted runtimes and no-API-key/OAuth providers; cost reporting MUST show 0 for local/free models. |
| NFR-13 | Extensibility | Adding a model, profile, or tool MUST require editing only a catalog/registry, not feature code. |
| NFR-14 | Observability | Every AI call MUST emit telemetry (tokens, cost, model, provider, command); the CLI MUST display usage summaries; a debug log level MUST be available. |
| NFR-15 | Data integrity | The task store MUST enforce unique IDs, valid statuses, and intra-tag dependency references; non-target tags MUST always be preserved on write. |
| NFR-16 | Backward compatibility | Legacy layouts and single-list stores MUST auto-migrate with no data loss and a one-time notice. |
| NFR-17 | Privacy | Anonymous telemetry MUST be opt-out-able and honored. |
| NFR-18 | Determinism | Next-task selection and dependency validation MUST be deterministic given identical input. |
| NFR-19 | Security (local server) | The local visualization server MUST bind to localhost by default, support a read-only mode, never expose secrets, and route every write action through core validation (no validation bypass). |
| NFR-20 | Security (integrations) | External-integration and webhook credentials MUST follow env-only secret rules (NFR-9); outbound delivery MUST fail safe and never block or crash the originating operation. |
| NFR-21 | Data integrity (history) | Auditable history MUST record every state-changing mutation from both surfaces (CLI and agent), preserve non-target tags on undo, and report irreversible entries rather than partially applying them. |
| NFR-22 | Surface parity (visual) | Visual surfaces (board/graph/roadmap) MUST be read-models over the same core logic and MUST NOT introduce behavior unavailable to the CLI/agent. |

---

## 12. Primary End-to-End Workflows

### 12.1 Greenfield bootstrap from a spec
1. `init` → scaffold project, choose local storage, init version control, set language, run model setup.
2. Add provider keys to the env file; verify via `models`.
3. Write a specification using a template into the docs dir.
4. `parse-spec <spec>` → generate the initial task list under `master`.
5. `analyze-complexity --research` → produce the complexity report.
6. `expand --all --research` → decompose tasks per recommendations.
7. `next` → get the first actionable task. Begin work.

### 12.2 Daily task-execution loop
1. `next` → System returns the highest-priority unblocked task/subtask.
2. `set-status --id=<id> --status=in-progress`.
3. As work proceeds, `update-subtask --id=<p.s> --prompt="..."` to journal findings; optionally `research "<query>" --id=<id> --save-to=<id>`.
4. On completion, `set-status --id=<id> --status=done` (cascades to subtasks).
5. Repeat `next`.

### 12.3 Mid-project re-planning
1. Scope/direction changes.
2. `update --from=<id> --prompt="<new direction>"` to revise downstream tasks (or `update-task` for one).
3. `add-task --prompt="..."` for new work; `remove-task` for dropped work.
4. `validate-dependencies` → review issues; `fix-dependencies` → repair.
5. `analyze-complexity --id=<changed ids>` → refresh recommendations; `expand --force` to re-decompose.

### 12.4 Multi-branch / parallel work via contexts
1. Create a feature branch; `add-tag --from-branch` to mirror it.
2. `use-tag <feature>` to switch context (or use `--tag` per command).
3. Work in isolation; `move --from=<id> --from-tag=backlog --to-tag=<feature> --with-dependencies` to pull in related work.
4. After merge: `move`/`delete-tag` to clean up.

### 12.5 Agent-driven autonomous TDD
1. Agent calls `expand_task` to ensure the task has subtasks.
2. `autopilot_start` → creates a feature branch, enters RED.
3. Per subtask: write failing tests → `autopilot_complete` (RED) → implement → `autopilot_complete` (GREEN) → `autopilot_commit`.
4. When all subtasks complete → `autopilot_finalize` (clean tree) → main task marked done.

### 12.6 Idea → PRD → plan → board (v1.1)
1. `prd` → interactive interview with adaptive follow-ups authors a spec into the docs dir (FR-98).
2. `check-spec` → score readiness; iterate the interview until the verdict passes (FR-99).
3. `parse-spec` → generate the initial task list (FR-12); `analyze-complexity` + `expand --all` to decompose (FR-46, FR-36/37).
4. `board` → open the local Kanban board (and `--graph` for the dependency DAG); `watch` keeps it live (FR-100–102).
5. Work via `next` / drag cards to advance status (FR-23, FR-24); `search` to find work, `roadmap` to track milestones (FR-106, FR-103).
6. `sync --provider github --direction two-way` to mirror with the team's tracker (FR-104); webhooks notify on status changes (FR-105).
7. `export --format md` for a progress report; `undo` to revert a mistaken bulk change (FR-108, FR-107).

---

## 13. Success Metrics / KPIs

| ID | Metric | Target intent |
|---|---|---|
| KPI-1 | Time-to-first-task-plan (bootstrap → parsed task list) | Minimize (single-session bootstrap + parse). |
| KPI-2 | % of projects that parse a spec within first session | High adoption of automated planning. |
| KPI-3 | Next-task adoption (share of work started via `next`) | High — indicates trust in selection. |
| KPI-4 | Tasks decomposed via expansion / complexity report usage | High — granular, verifiable work. |
| KPI-5 | Dependency-validation pass rate after `fix-dependencies` | Near 100% clean graphs. |
| KPI-6 | Agent-interface tool-call volume vs CLI | Healthy programmatic usage. |
| KPI-7 | Autonomous-workflow completion rate (start → finalize) | High completion without abort. |
| KPI-8 | Provider diversity (share using non-default/local providers) | Demonstrates provider-neutrality value. |
| KPI-9 | Cost transparency engagement (telemetry surfaced) | Users aware of spend. |
| KPI-10 | Migration success rate for legacy projects | Near 100%, zero data loss. |

---

## 14. Assumptions, Dependencies & Risks

### 14.1 Assumptions
- Users have at least one usable AI provider credential or a no-key/local/OAuth runtime.
- The specification provided to the parser is detailed enough to yield meaningful tasks.
- The host editor/agent supports the standardized tool-integration interface (and, for sampling, advertises sampling capability).
- The project is under (or can adopt) version control for autonomous-workflow features.

### 14.2 Dependencies
- External AI model providers across the supported categories.
- Version-control tooling for init, branch-aware tags, and the autonomous workflow.
- A shell environment for alias installation.
- The cloud/team collaboration backend (for team operating mode).

### 14.3 Risks
| ID | Risk | Mitigation |
|---|---|---|
| R-1 | `validate-dependencies` non-zero-exit behavior on failure is unspecified, harming CI scripting. | Define and document explicit exit-code semantics; add a strict/CI mode. |
| R-2 | Provider/cost/model-catalog data drifts from reality. | Keep the catalog as a single, maintained source of truth; validate at load. |
| R-3 | Large `num-tasks` or large specs exceed context windows. | Enforce guidance/limits; warn above thresholds; support 0 = AI-determined. |
| R-4 | Streaming path disabled by flag; behavior differs if re-enabled. | Keep the non-streaming fallback authoritative; gate streaming behind a flag with timeout. |
| R-5 | Documentation drift (default tool mode, tool counts, removed/added commands). | Treat the registry/catalog as authoritative; regenerate docs from source. |
| R-6 | Secrets accidentally placed in config or tool-integration config. | Enforce env-only secret resolution; reject placeholders; document key handling. |
| R-7 | Cross-tag moves silently break dependencies. | Require explicit with/ignore-dependencies flags; surface detailed conflict resolution. |
| R-8 | Autonomous workflow leaves orphaned branches/commits on abort. | Clearly report manual-cleanup requirement; consider optional cleanup. |
| R-9 | Skip-install flag may not be honored in all bootstrap paths. | Verify and enforce skip-install handling. |

---

## 15. Future Considerations / Roadmap

- **Real interactive shell (TUI/REPL):** the interactive shell currently falls back to help; ship a full interactive experience.
- **Active anonymous telemetry pipeline:** bootstrap currently emits lifecycle events earmarked for a telemetry sink; complete the integration with documented data scope and opt-out honored.
- **Streaming generation by default:** mature and enable the streaming parse/expand path with fallback.
- **Additional transports for the agent interface:** evaluate HTTP/SSE in addition to stdio.
- **Richer cross-tag analytics:** unified "ready tasks across all contexts" views.
- **Expanded autonomous-workflow coverage:** REFACTOR-phase automation, coverage gating, and resumable multi-task runs.
- **Catalog-driven provider onboarding UX:** first-class flags/wizard coverage for every provider category (including cloud-managed) to reduce manual config editing.

### v1.1 forward-looking (beyond FR-98–FR-108)
- **Real-time, multi-user board:** the local board (FR-100) is the solo/offline counterpart to the future full TUI and the cloud web UI; a shared multi-user board is a later step.
- **Additional sync providers & richer field mapping:** broaden the FR-104 adapter set (e.g. Asana, Azure Boards) and map labels/assignees/estimates, not just status.
- **Bidirectional PR-driven automation:** combine FR-104 PR linking with autopilot (FR-82) so merges drive status without manual sync.
- **PRD Builder template library:** ship more interview templates and domain presets beyond the simple/complex pair (FR-98.1).
- **Pluggable export targets & scheduled reports:** push exports/reports to external sinks on a schedule, reusing the eventing layer (FR-105).

---

## 16. Appendix: Full Command & Option Reference

> Generic verbs; `[g]` = global options `--file`, `--tag` available. Agent tools require an absolute `projectRoot`.

### 16.1 Initialization & setup
- `init` — `--yes`, `--name <n>`, `--description <d>`, `--version <v>` (default 0.1.0), `--author <a>`, `--rules <list>`, `--skip-install`, `--dry-run`, `--aliases/--no-aliases`, `--git/--no-git`, `--git-tasks/--no-git-tasks`.
- `migrate` — `--force`, `--backup`, `--cleanup`, `--yes`, `--dry-run`, `--debug`.
- `rules add|remove|setup` — `--force`, `--setup`, `--mode <solo|team>`, `--yes`.

### 16.2 Spec ingestion
- `parse-spec [file]` — `--input <f>`, `--output <f>`, `--num-tasks <n>` (0 = AI-decided), `--force`, `--append`, `--research`, `--tag`.

### 16.3 Lifecycle & navigation `[g]`
- `list` — `--status <s>`, `--with-subtasks`.
- `show <id[,id...]>` — dot notation for subtasks.
- `next`.
- `set-status` — `--id <id[,id...]>`, `--status <s>` (enum).

### 16.4 Authoring/editing `[g]`
- `add-task` — `--prompt`, `--title`, `--description`, `--details`, `--dependencies`, `--priority` (default medium), `--research`.
- `update` — `--from <id>` (default 1), `--prompt`, `--research`.
- `update-task [id] [prompt...]` — `--id`, `--prompt`, `--append`, `--research`.
- `update-subtask` — `--id <p.s>`, `--prompt`, `--research`, `--metadata` (gated).
- `add-subtask` — `--parent`, `--task-id`, `--title`, `--description`, `--details`, `--status` (default pending), `--dependencies`, `--generate`.
- `remove-subtask` — `--id <p.s[,...]>`, `--convert`, `--generate`.
- `remove-task` — `--id <id[,...]>`, `--yes`.
- `clear-subtasks` — `--id <id[,...]>`, `--all`.
- `move` — `--from`, `--to`, `--from-tag`, `--to-tag`, `--with-dependencies`, `--ignore-dependencies`.
- `scope-up` / `scope-down` — `--id`, `--strength <light|regular|heavy>`, `--prompt`, `--research`.

### 16.5 Subtasks & expansion `[g]`
- `expand` — `--id`, `--num` (0 = dynamic), `--prompt`, `--research`, `--force`, `--complexity-report`.
- `expand --all` — `--all`, `--force`, `--research`, `--num`, `--prompt`.

### 16.6 Dependencies `[g]`
- `add-dependency` — `--id`, `--depends-on`.
- `remove-dependency` — `--id`, `--depends-on`.
- `validate-dependencies`.
- `fix-dependencies`.

### 16.7 Complexity `[g]`
- `analyze-complexity` — `--output`, `--model`, `--threshold <1-10>` (default 5), `--research`, `--id`, `--from`, `--to`.
- `complexity-report`.

### 16.8 Research `[g]`
- `research "<query>"` — `--id <ids>`, `--files <paths>`, `--context <text>`, `--tree`, `--detail <low|medium|high>` (default medium), `--save-to <id>`, `--save-file`.

### 16.9 Tags `[g where applicable]`
- `add-tag <name>` — `--description`, `--from-branch`, `--copy-from-current`, `--copy-from <tag>`.
- `use-tag <name>`.
- `tags` / `list-tags` — `--show-metadata`.
- `rename-tag <old> <new>`.
- `copy-tag <source> <target>` — `--description`.
- `delete-tag <name>` — `--yes`.

### 16.10 Models & language
- `models [list]` — `--setup`, `--set-main <id>`, `--set-research <id>`, `--set-fallback <id>`, provider flags (local-runtime, router, cloud-managed (azure/bedrock/vertex), CLI/OAuth runtimes, OpenAI-compatible, lmstudio), `--baseURL <url>`.
- `lang` — `--response <language>`, `--setup`.

### 16.11 Generation & export `[g where applicable]`
- `generate` — `--tag`, `--output <dir>`, `--project <path>`, `--format <text|json>`.
- `sync-readme` — `--file`, `--with-subtasks`, `--status`, `--tag` (default master).

### 16.12 Autonomy & collaboration
- `loop` — `--iterations`, `--prompt <preset|path>` (default/aggressive/careful), `--progress-file`, `--tag`, `--project`, `--sandbox`, `--no-output`, `--verbose`.
- `autopilot start <taskId>` — `--force`, `--max-attempts <n>` (default 3); inherits `--json`, `--projectRoot`, `--verbose`.
- `autopilot resume|next|status|finalize|abort` — inherited base options; `abort` adds `--force`.
- `autopilot complete` — `--results <json>`, `--coverage <pct>`.
- `autopilot commit`.
- `auth login [token]` (`--yes`, `--no-header`) | `auth logout|status|refresh` (`--no-header`); top-level `login`/`logout` aliases.
- `context [briefOrUrl]` (`--no-header`) | `context org|brief|set|clear`.
- `briefs` (alias `brief`) — list (`--show-metadata`), `select [briefOrUrl]`, `create [name]`.

### 16.13 Shell & global
- `tui` / `repl` — interactive shell (falls back to help in current version).
- Global: `--no-banner`; auto-update skippable via environment flag / CI / test mode.

### 16.14 Agent interface configuration
- Host config block: `command`, `args`, `env` (provider keys + `<TOOL-LOADING-MODE>`), `timeout` (1–3600s, default 60), optional transport `type`.
- Tool-loading mode env var: `core`/`lean` (7), `standard` (14), `all` (~55–56 incl. v1.1 tools), or custom comma-separated list (normalized, aliased).
- Response envelope: `{ success, data?, error:{code,message} }` → host content `{ content:[{type:'text', text}], isError? }` with version metadata.

### 16.15 Builder, visualization & developer experience (v1.1) `[g where applicable]`
- `prd` — interactive PRD Builder. Seed via positional idea / `--template <simple|complex>` / `--draft <file>`; `--research`, `--answers <file>` (batch), `--resume`. Writes to the docs spec path; offers to chain into `check-spec` + `parse-spec`.
- `check-spec [file]` — `--input <f>`, `--threshold <1-10>` (default 5), `--strict` (non-zero exit on block, CI), `--report` (write markdown report).
- `board` — `--tag`, `--port <n>` (default auto), `--host <addr>` (default localhost), `--no-open`, `--read-only`, `--graph` (dependency DAG view).
- `watch` — `--on-change <generate|sync-readme|validate-deps|none>`, `--tag`, optional watched spec/docs path.
- `roadmap` — `--tag`, `--milestone <name>`.
- `sync` — `--provider <github|gitlab|linear|jira|...>`, `--direction <push|pull|two-way>`, `--conflict <newest-wins|prefer-local|prefer-remote|report-only>`, `--dry-run`. Credentials via environment only.
- `notify` — manage webhook/notification config: webhook `url`, `--events <filter>`, signing secret via env var, opt-out.
- `search` / `find` — `<query>`, `--status`, `--priority`, `--ready`, `--has-subtasks`, `--tag`, `--all-tags`, `--limit <n>`, `--sort <field>`.
- `history` — `--id`, `--tag`, `--operation <op>`.
- `undo` — `[entry]`, `--yes`.
- `export` — `--format <md|json|csv|board>`, `--output <path>`, `--tag`, `--all-tags`.
- Agent tools added (v1.1): `build_prd`, `check_spec`, `get_roadmap`, `sync_tasks`, `search_tasks`, `get_history`, `undo`, `export_tasks` (all require an absolute `projectRoot`; state-changing tools marked destructive).

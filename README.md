# Imperial Commander

> Turn a product idea or spec into a living implementation plan, then work that plan from the terminal or an agent.

[![CI](https://github.com/mrlfarano/ImperialCommander/actions/workflows/ci.yml/badge.svg)](https://github.com/mrlfarano/ImperialCommander/actions/workflows/ci.yml)

Imperial Commander is an AI-assisted task orchestration system for software projects. It helps you draft PRDs, check whether a spec is ready, parse it into implementation tasks, manage dependencies and status, and expose the same workflow through both a CLI and an MCP-compatible server.

It is designed around a local-first workflow: task data lives in readable JSON, commands are scriptable, and agent integrations call the same core logic as the CLI.

## What You Get

| Area | Commands |
| --- | --- |
| Project setup | `init`, `models`, `lang` |
| Spec workflow | `prd`, `check-spec`, `parse-spec` |
| Task loop | `list`, `show`, `next`, `set-status` |
| Planning tools | `add-task`, `expand`, `expand-all`, `analyze-complexity`, `research` |
| Organization | `add-tag`, `use-tag`, `move`, `add-dependency`, `validate-dependencies` |
| Reporting | `search`, `roadmap`, `export`, `generate`, `sync-readme`, `sync`, `table` |
| Automation | `autopilot`, `loop`, `watch`, `history`, `undo` |
| Agent surface | `impcom-mcp` |

## Install

```bash
npm install -g imperial-commander
```

Then run:

```bash
impcom --help
```

You can also try it without a global install:

```bash
npx imperial-commander --help
```

## Quick Start

Create a project workspace:

```bash
impcom init \
  --name "My Project" \
  --description "What this project does"
```

To feed the project into Hermes Kanban automatically, enable the integration at
init time:

```bash
impcom init \
  --name "My Project" \
  --description "What this project does" \
  --hermes-kanban \
  --hermes-kanban-board my-project
```

That writes `.imperial-commander/config.json` with `integrations.hermesKanban`
enabled. Subsequent task-store writes (`parse-spec`, `add-task`, status changes,
dependency edits, etc.) debounce into a one-way Imperial Commander → Hermes
Kanban sync. Imperial Commander remains the planning/source graph; Hermes Kanban
is the execution/tracking board.

Draft or validate a spec:

```bash
impcom prd --idea "Build a task orchestration CLI" --chain
impcom check-spec .imperial-commander/docs/<spec-file>.md
```

Parse the spec into tasks:

```bash
impcom parse-spec .imperial-commander/docs/<spec-file>.md --force
```

Work the plan:

```bash
impcom list
impcom next
impcom show 1
impcom set-status 1 in-progress
impcom set-status 1 done
```

## Everyday Commands

```bash
# Add and expand work
impcom add-task --title "Wire auth" --description "Add local auth flow"
impcom expand --id 1 --num 5

# Find and inspect tasks
impcom search auth
impcom roadmap
impcom board --view board

# Export or generate project artifacts
impcom export --format markdown --output tasks-report.md
impcom generate
impcom sync-readme
```

## Hermes Kanban sync

Imperial Commander can feed Hermes Kanban as a read model without replacing the
Imperial task store:

```bash
# One-shot sync of open tasks to an existing or new Kanban board
impcom sync \
  --provider hermes-kanban \
  --board my-project \
  --project-root "$PWD" \
  --write
```

The sync uses stable idempotency keys of the form
`imperial:<project-root>:<tag>:<task-id>`, so re-running it updates the mapping
without creating duplicate Kanban cards. Dependency edges are linked after cards
are ensured. Imported cards default to **unassigned**; pass `--assignee <profile>`
when you intentionally want Hermes workers to pick them up.

Scopes:

- `--scope open` (default for Hermes Kanban): pending/in-progress/review/deferred
  tasks only.
- `--scope ready`: open tasks whose dependencies are complete.
- `--scope all`: every task in the tag.

## Task analysis (priority + complexity)

Every task-creating path assesses **priority** and **complexity** with the
configured AI provider and stores both on the task:

- `add-task` (manual or `--prompt`) and `parse-spec` require a provider. Pass an
  explicit `--priority` to `add-task` to override the assessed priority.
- Without a provider these commands fail with a clear error — run them under the
  MCP host (which supplies host-session sampling) or configure a model first.
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

## Live monitor (`impcom board`)

Run `impcom board` to start a local, read-only web monitor that shows the system
working through the task store in real time:

```bash
impcom board                        # start the monitor, prints the URL
impcom board --port 4399            # bind a fixed port
impcom board --read-only            # disable server-side writes (recommended)
impcom board --view board           # text summary instead of the server
impcom board --view graph           # dependency-graph summary
impcom board --json                 # structured board/graph data
```

The web view is built for glanceability — leave it open and watch progress:

- **Active now** hero surfaces in-progress tasks with a working indicator, and
  flips to a **stalled** state when nothing has moved for a few minutes.
- **Momentum strip** shows overall progress, active count, completions in the
  last 10 minutes, and a throughput sparkline.
- **Live updates** stream over Server-Sent Events and patch only the cards that
  changed, animating column transitions (honors `prefers-reduced-motion`).
- **Connection heartbeat** indicates whether the event stream is live, so a
  silently dropped connection is obvious.
- **Dark theme by default** with a persisted light toggle; terminal columns
  (done/deferred/cancelled) are dimmed to keep focus on the active frontier.

Raw `board`, `graph`, and `roadmap` JSON remain available at `/api/board`,
`/api/graph`, and `/api/roadmap`.

## Data Model

Imperial Commander stores tasks in a tag-keyed JSON task store. Each task can include:

- status: `pending`, `in-progress`, `review`, `done`, `deferred`, or `cancelled`
- priority: `high`, `medium`, or `low`
- dependencies and subtasks
- implementation details and test strategy
- metadata used by roadmap, history, sync, and reporting features

The file backend preserves non-target tags on write and validates task IDs, dependency references, statuses, and subtask structure.

## MCP Server

Build output includes an MCP-compatible server:

```bash
impcom-mcp
```

When installed as a package, the intended binaries are:

```bash
impcom
impcom-mcp
```

The MCP server exposes task commands as in-process tool wrappers with structured success/error envelopes. Tool loading supports lean, standard, all, and custom tool selections.

When the MCP host supports session sampling, AI-backed tools can use the host model instead of requiring separate provider credentials. That means Claude Code, Codex, or another capable MCP client can call `impcom-mcp` as a tool server and let commands such as `add-task --prompt`, `research`, `prd`, and `check-spec` use the active host session for inference.

Example Claude Code setup:

```bash
claude mcp add --transport stdio imperial-commander -- impcom-mcp
```

For regular terminal use outside an MCP host, configure models with:

```bash
impcom models --set-main gpt-4.1
```

API keys are read from environment variables such as `OPENAI_API_KEY`; secrets are never stored in project config.

## Development

Requirements:

- Node.js 22 or newer
- npm

Useful scripts:

```bash
npm install
npm run build
node dist/impcom.js --help
npm run dev -- --help
npm run lint
npm run typecheck
npm test
npm run build
```

Build output is written to `dist/` and intentionally ignored by git.

## Status

This repository currently contains a local-first implementation with offline-safe skeletons for cloud/team storage, notifications, and autonomous workflows. Hermes Kanban sync is a real local integration: Imperial Commander can create/update Kanban cards and dependency edges through the `hermes` CLI while preserving Imperial as the source task graph. Other third-party tracker providers still need production credentials and provider-specific adapters.

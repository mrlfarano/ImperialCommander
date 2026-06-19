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
| Reporting | `search`, `roadmap`, `export`, `generate`, `sync-readme` |
| Automation | `autopilot`, `loop`, `watch`, `history`, `undo` |
| Agent surface | `impcom-mcp` |

## Quick Start

```bash
npm install
npm run build
```

Run the built CLI:

```bash
node dist/impcom.js --help
```

Create a project workspace:

```bash
node dist/impcom.js init \
  --name "My Project" \
  --description "What this project does"
```

Draft or validate a spec:

```bash
node dist/impcom.js prd --idea "Build a task orchestration CLI" --chain
node dist/impcom.js check-spec .imperial-commander/docs/<spec-file>.md
```

Parse the spec into tasks:

```bash
node dist/impcom.js parse-spec .imperial-commander/docs/<spec-file>.md --force
```

Work the plan:

```bash
node dist/impcom.js list
node dist/impcom.js next
node dist/impcom.js show 1
node dist/impcom.js set-status 1 in-progress
node dist/impcom.js set-status 1 done
```

## Everyday Commands

```bash
# Add and expand work
node dist/impcom.js add-task --title "Wire auth" --description "Add local auth flow"
node dist/impcom.js expand --id 1 --num 5

# Find and inspect tasks
node dist/impcom.js search auth
node dist/impcom.js roadmap
node dist/impcom.js board --view board

# Export or generate project artifacts
node dist/impcom.js export --format markdown --output tasks-report.md
node dist/impcom.js generate
node dist/impcom.js sync-readme
```

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
node dist/mcp-server.js
```

When installed as a package, the intended binaries are:

```bash
impcom
impcom-mcp
```

The MCP server exposes task commands as in-process tool wrappers with structured success/error envelopes. Tool loading supports lean, standard, all, and custom tool selections.

## Development

Requirements:

- Node.js 22 or newer
- npm

Useful scripts:

```bash
npm run dev -- --help
npm run lint
npm run typecheck
npm test
npm run build
```

Build output is written to `dist/` and intentionally ignored by git.

## Status

This repository currently contains a local-first implementation with offline-safe skeletons for cloud/team storage, external tracker sync, notifications, and autonomous workflows. Those surfaces are wired and testable, but real third-party service integrations still need production credentials and provider-specific adapters.


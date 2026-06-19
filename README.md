# Imperial Commander

AI-driven development task orchestration for turning specs into actionable task plans, managing task state, and exposing the same workflow through a CLI and MCP-compatible agent surface.

## Features

- `impcom` CLI for project bootstrap, spec parsing, task lifecycle, dependencies, tags, search, exports, and local dashboards.
- MCP server entrypoint for agent/editor integration.
- Local JSON task storage with tag isolation, validation, history, and undo support.
- PRD builder and spec readiness checks before task generation.
- Offline-safe provider, cloud, sync, notification, and autonomy skeletons for development and testing.
- TypeScript implementation with Vitest coverage and Biome linting.

## Requirements

- Node.js 22 or newer
- npm

## Install

```bash
npm install
npm run build
```

For local development without rebuilding:

```bash
npm run dev -- --help
```

After building, run the CLI directly:

```bash
node dist/impcom.js --help
```

When installed as a package, the binaries are:

```bash
impcom
impcom-mcp
```

## Quick Start

```bash
# Initialize project config
node dist/impcom.js init --name "My Project" --description "What this project does"

# Draft or validate a spec
node dist/impcom.js prd --idea "Build a task orchestration CLI" --chain
node dist/impcom.js check-spec .imperial-commander/docs/<spec-file>.md

# Parse a spec into tasks
node dist/impcom.js parse-spec .imperial-commander/docs/<spec-file>.md --force

# Work the plan
node dist/impcom.js list
node dist/impcom.js next
node dist/impcom.js show 1
node dist/impcom.js set-status 1 in-progress
node dist/impcom.js set-status 1 done
```

## Common Commands

```bash
node dist/impcom.js add-task --title "Wire auth" --description "Add local auth flow"
node dist/impcom.js expand --id 1 --num 5
node dist/impcom.js search auth
node dist/impcom.js board --view board
node dist/impcom.js roadmap
node dist/impcom.js export --format markdown --output tasks-report.md
node dist/impcom.js generate
```

## MCP Server

```bash
node dist/mcp-server.js
```

The MCP server exposes the task workflow as in-process tool wrappers with structured success/error envelopes.

## Development

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Build output is written to `dist/` and is intentionally ignored by git.

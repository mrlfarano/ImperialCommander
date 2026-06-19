# Changelog

## 0.1.0 - 2026-06-19

Initial implementation.

- Added MCP host-session sampling support for AI-backed `impcom-mcp` tools, allowing capable hosts such as Claude Code or Codex to provide inference without separate provider keys.
- Added the `impcom` CLI and `impcom-mcp` MCP server entrypoints.
- Added project bootstrap, configuration, model catalog, provider registry, environment resolution, telemetry, and logging foundations.
- Added local task storage with schema validation, tag-keyed task lists, repository abstraction, history, and undo.
- Added task lifecycle commands for listing, showing, next-task selection, status changes, dependencies, authoring, subtasks, moving, scoping, search, and export.
- Added PRD building, spec readiness checks, spec parsing, complexity analysis, expansion, research, task-file generation, and README sync.
- Added local board/graph/roadmap data views, watch actions, notification skeletons, and external sync skeletons.
- Added offline autonomy and cloud/team command skeletons: autopilot, loop, auth, context, briefs, and TUI fallback.
- Added Vitest test coverage and Biome/TypeScript/tsdown build tooling.

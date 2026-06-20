# Changelog

## 0.2.1 - 2026-06-20

- Reworked the `impcom board` web view into a read-only live monitor for watching the system work the task store.
- Added an "Active now" hero that highlights in-progress tasks and surfaces a stalled state when nothing moves for a few minutes.
- Added a momentum strip with overall progress, active count, completions in the last 10 minutes, and a throughput sparkline.
- Switched to diff-based rendering that patches only changed cards and animates column transitions over Server-Sent Events (honoring `prefers-reduced-motion`).
- Added a connection heartbeat so a dropped event stream is visible, and reordered columns into a logical flow with terminal columns dimmed.
- Added a dark theme by default with a persisted light toggle, and removed the inline status editor in favor of read-only monitoring.
- Kept the existing board, graph, roadmap, and task JSON endpoints available from the visualization server.

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

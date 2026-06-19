export type ToolLoadMode = "core" | "lean" | "standard" | "all";

export interface ToolSelection {
  mode: ToolLoadMode | "custom";
  tools: string[];
  warnings: string[];
}

export const coreTools = [
  "list",
  "next",
  "get-task",
  "set-status",
  "update-subtask",
  "parse-spec",
  "expand",
] as const;

export const standardTools = [
  ...coreTools,
  "bootstrap",
  "analyze-complexity",
  "expand-all",
  "add-subtask",
  "remove-task",
  "add-task",
  "complexity-report",
] as const;

const aliases = new Map<string, string>([
  ["show", "get-task"],
  ["init", "bootstrap"],
  ["setstatus", "set-status"],
  ["parsespec", "parse-spec"],
  ["complexityreport", "complexity-report"],
  ["login", "auth-login"],
  ["logout", "auth-logout"],
  ["brief", "briefs"],
  ["find", "search"],
  ["query", "search"],
  ["repl", "tui"],
]);

export function normalizeToolName(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/_/g, "-");
  return aliases.get(normalized.replace(/-/g, "")) ?? aliases.get(normalized) ?? normalized;
}

export function resolveToolSelection(
  input: string | undefined,
  availableTools: string[],
): ToolSelection {
  const all = [...new Set(availableTools.map(normalizeToolName))];
  const raw = input?.trim();

  if (!raw) {
    return { mode: "lean", tools: [...coreTools], warnings: [] };
  }

  const mode = raw.toLowerCase().replace(/_/g, "-");

  if (mode === "core" || mode === "lean") {
    return { mode: "lean", tools: [...coreTools], warnings: [] };
  }

  if (mode === "standard") {
    return { mode: "standard", tools: [...standardTools], warnings: [] };
  }

  if (mode === "all") {
    return { mode: "all", tools: all, warnings: [] };
  }

  const warnings: string[] = [];
  const requested = raw.split(",").map(normalizeToolName).filter(Boolean);

  if (requested.length === 0) {
    return { mode: "all", tools: all, warnings: ["Empty custom tool list; loaded all tools."] };
  }

  const selected = requested.filter((tool) => {
    const known = all.includes(tool);
    if (!known) {
      warnings.push(`Unknown tool "${tool}" was ignored.`);
    }
    return known;
  });

  return selected.length > 0
    ? { mode: "custom", tools: selected, warnings }
    : {
        mode: "all",
        tools: all,
        warnings: [...warnings, "No known custom tools; loaded all tools."],
      };
}

export function resolveTimeoutSeconds(value: string | number | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return 60;
  }

  return Math.min(3600, Math.max(1, Math.floor(parsed)));
}

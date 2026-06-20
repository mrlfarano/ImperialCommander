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
    {
      header: "STATUS",
      get: (row) => row.status,
      color: (row, text) => STATUS_COLOR[row.status](text),
    },
    {
      header: "PRI",
      get: (row) => row.priority,
      color: (row, text) => PRIORITY_COLOR[row.priority](text),
    },
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
  return `"${value.replace(/"/g, '""')}"`;
}

function toMarkdown(data: TaskTableData): string {
  const header = "| ID | Status | Priority | Complexity | Ready | Subtasks | Title |";
  const divider = "| --- | --- | --- | --- | --- | --- | --- |";
  const rows = data.rows.map((row) => {
    const cx =
      row.complexityScore === undefined || !row.complexityLevel
        ? "—"
        : `${row.complexityScore} (${row.complexityLevel})`;
    const sub = row.subtasksTotal === 0 ? "—" : `${row.subtasksDone}/${row.subtasksTotal}`;
    const title = row.title.replace(/\|/g, "\\|");
    return `| ${row.id} | ${row.status} | ${row.priority} | ${cx} | ${row.ready ? "yes" : "no"} | ${sub} | ${title} |`;
  });
  const summary = `**${data.footer.total} tasks** · ${data.footer.percentDone}% done · ${data.footer.ready} ready · ${data.footer.blocked} blocked`;
  return [`### Tasks · ${data.tag}`, "", header, divider, ...rows, "", summary].join("\n");
}

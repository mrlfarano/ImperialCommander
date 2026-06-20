import { formatTaskTable } from "../../src/table/format-table.js";
import type { TaskTableData } from "../../src/table/task-table.js";

const data: TaskTableData = {
  tag: "master",
  rows: [
    {
      id: "2",
      tag: "master",
      status: "in-progress",
      priority: "high",
      title: "Payment service",
      complexityScore: 9,
      complexityLevel: "high",
      dependencies: ["1"],
      blockedBy: [],
      ready: true,
      subtasksDone: 2,
      subtasksTotal: 4,
    },
    {
      id: "3",
      tag: "master",
      status: "pending",
      priority: "low",
      title: "Docs",
      dependencies: [],
      blockedBy: [],
      ready: true,
      subtasksDone: 0,
      subtasksTotal: 0,
    },
  ],
  footer: {
    total: 2,
    done: 0,
    percentDone: 0,
    byStatus: { "in-progress": 1, pending: 1 },
    byPriority: { high: 1, medium: 0, low: 1 },
    byComplexity: { low: 0, medium: 0, high: 1, unknown: 1 },
    avgComplexity: 9,
    ready: 2,
    blocked: 0,
    next: { id: "2", title: "Payment service" },
  },
};

describe("formatTaskTable", () => {
  it("renders a pretty table without color by default", () => {
    const out = formatTaskTable(data, { format: "pretty", color: false });
    expect(out).toContain("TASKS · master");
    expect(out).toContain("Payment service");
    expect(out).toContain("NEXT");
    expect(out).not.toContain("["); // no ANSI codes
  });

  it("emits json of the structured data", () => {
    const out = formatTaskTable(data, { format: "json" });
    expect(JSON.parse(out).footer.next.id).toBe("2");
  });

  it("emits csv with a header row and quoted titles", () => {
    const out = formatTaskTable(data, { format: "csv" });
    const lines = out.split("\n");
    expect(lines[0]).toBe(
      "id,status,priority,complexityScore,complexityLevel,ready,subtasks,title",
    );
    expect(lines[1]).toBe('2,in-progress,high,9,high,true,2/4,"Payment service"');
  });

  it("emits a markdown table plus a summary line", () => {
    const out = formatTaskTable(data, { format: "markdown" });
    expect(out).toContain("| ID | Status | Priority | Complexity | Ready | Subtasks | Title |");
    expect(out).toContain("| 2 | in-progress | high | 9 (high) | yes | 2/4 | Payment service |");
    expect(out).toContain("**2 tasks**");
  });
});

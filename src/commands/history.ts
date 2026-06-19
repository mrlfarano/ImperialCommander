import { filterHistory, readHistory } from "../history/audit-log.js";
import type { TaskCommandOptions } from "./tasks.js";

export interface HistoryCommandOptions extends TaskCommandOptions {
  operation?: string;
  id?: string;
  limit?: number;
}

export async function historyCommand(options: HistoryCommandOptions = {}): Promise<string> {
  const entries = filterHistory(await readHistory({ storePath: options.file }), {
    tag: options.tag,
    operation: options.operation,
    id: options.id,
    limit: options.limit ?? 20,
  });

  if (entries.length === 0) {
    return "No history entries found.";
  }

  return entries
    .map((entry) =>
      [
        entry.id,
        entry.timestamp,
        entry.operation,
        entry.tag ? `tag:${entry.tag}` : "tag:*",
        entry.taskIds.length > 0 ? `ids:${entry.taskIds.map(String).join(",")}` : "ids:none",
        entry.reversible ? "reversible" : "irreversible",
      ].join(" "),
    )
    .join("\n");
}

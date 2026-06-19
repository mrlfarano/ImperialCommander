import { FileTaskRepository } from "../storage/index.js";
import { buildBoardData, buildGraphData } from "../viz/data.js";
import { startVisualizationServer } from "../viz/server.js";
import type { TaskCommandOptions } from "./tasks.js";

export interface BoardCommandOptions extends TaskCommandOptions {
  host?: string;
  port?: number;
  readOnly?: boolean;
  open?: boolean;
  view?: "server" | "board" | "graph";
  json?: boolean;
}

export async function boardCommand(options: BoardCommandOptions = {}): Promise<string> {
  if (options.view === "board" || options.view === "graph" || options.json) {
    const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
    const data =
      options.view === "graph"
        ? await buildGraphData(repository, { tag: options.tag })
        : await buildBoardData(repository, { tag: options.tag });

    if (options.json) {
      return JSON.stringify(data, null, 2);
    }

    return options.view === "graph"
      ? summarizeGraph(data as Awaited<ReturnType<typeof buildGraphData>>)
      : summarizeBoard(data as Awaited<ReturnType<typeof buildBoardData>>);
  }

  const handle = await startVisualizationServer({
    file: options.file,
    tag: options.tag,
    host: options.host,
    port: options.port,
    readOnly: options.readOnly,
  });

  return `Visualization server listening at ${handle.url}`;
}

function summarizeBoard(data: Awaited<ReturnType<typeof buildBoardData>>): string {
  return data.columns.map((column) => `${column.status}: ${column.tasks.length}`).join("\n");
}

function summarizeGraph(data: Awaited<ReturnType<typeof buildGraphData>>): string {
  return [
    `Nodes: ${data.nodes.length}`,
    `Edges: ${data.edges.length}`,
    `Issues: ${data.issues.length}`,
    `Critical path: ${data.criticalPath.map(String).join(" -> ") || "none"}`,
  ].join("\n");
}

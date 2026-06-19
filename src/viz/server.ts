import { type Server, type ServerResponse, createServer } from "node:http";
import { URL } from "node:url";
import { buildRoadmap } from "../roadmap/roadmap.js";
import { isValidStatus } from "../schemas/status.js";
import { FileTaskRepository, onStorageChange } from "../storage/index.js";
import { setTaskStatus } from "../tasks/lifecycle.js";
import { buildBoardData, buildGraphData } from "./data.js";

export interface VisualizationServerOptions {
  file?: string;
  tag?: string;
  host?: string;
  port?: number;
  readOnly?: boolean;
}

export interface VisualizationServerHandle {
  url: string;
  server: Server;
  close(): Promise<void>;
}

export async function updateTaskStatusFromVisualization(
  repository: FileTaskRepository,
  input: { id?: string | number; status?: unknown; tag?: string; readOnly?: boolean },
) {
  if (input.readOnly) {
    return { ok: false as const, status: 403, error: "Server is read-only." };
  }

  if (input.id === undefined || !isValidStatus(input.status)) {
    return { ok: false as const, status: 400, error: "id and valid status are required." };
  }

  return {
    ok: true as const,
    status: 200,
    task: await setTaskStatus(repository, input.id, input.status, { tag: input.tag }),
  };
}

export async function startVisualizationServer(
  options: VisualizationServerOptions = {},
): Promise<VisualizationServerHandle> {
  const host = options.host ?? "127.0.0.1";
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const clients = new Set<ServerResponse>();
  const unsubscribe = onStorageChange((event) => {
    broadcast(clients, { type: "storage-change", event });
  });

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? host}`);

    try {
      if (request.method === "GET" && url.pathname === "/api/tasks") {
        return sendJson(response, {
          tasks: await repository.findAll({ tag: url.searchParams.get("tag") ?? options.tag }),
        });
      }

      if (request.method === "GET" && url.pathname === "/api/board") {
        return sendJson(
          response,
          await buildBoardData(repository, { tag: url.searchParams.get("tag") ?? options.tag }),
        );
      }

      if (request.method === "GET" && url.pathname === "/api/graph") {
        return sendJson(
          response,
          await buildGraphData(repository, { tag: url.searchParams.get("tag") ?? options.tag }),
        );
      }

      if (request.method === "GET" && url.pathname === "/api/roadmap") {
        return sendJson(response, {
          groups: await buildRoadmap(repository, {
            tag: url.searchParams.get("tag") ?? options.tag,
          }),
        });
      }

      if (request.method === "GET" && url.pathname === "/events") {
        response.writeHead(200, {
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Content-Type": "text/event-stream",
        });
        response.write("event: ready\ndata: {}\n\n");
        clients.add(response);
        request.on("close", () => clients.delete(response));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/tasks/status") {
        const body = await readJsonBody(request);
        const result = await updateTaskStatusFromVisualization(repository, {
          id: typeof body.id === "string" || typeof body.id === "number" ? body.id : undefined,
          status: body.status,
          tag: options.tag,
          readOnly: options.readOnly,
        });

        return sendJson(
          response,
          result.ok ? { task: result.task } : { error: result.error },
          result.status,
        );
      }

      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        return sendHtml(response, renderShell(options.readOnly === true));
      }

      return sendJson(response, { error: "Not found." }, 404);
    } catch (error) {
      return sendJson(
        response,
        { error: error instanceof Error ? error.message : "Unknown server error." },
        500,
      );
    }
  });

  await new Promise<void>((resolve) => server.listen(options.port ?? 0, host, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : options.port;

  return {
    url: `http://${host}:${port}`,
    server,
    close: async () => {
      unsubscribe();
      for (const client of clients) {
        client.end();
      }
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

function sendJson(response: ServerResponse, body: unknown, status = 200): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(`${JSON.stringify(body)}\n`);
}

function sendHtml(response: ServerResponse, body: string): void {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(body);
}

function broadcast(clients: Set<ServerResponse>, payload: unknown): void {
  const serialized = `event: message\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) {
    client.write(serialized);
  }
}

async function readJsonBody(request: NodeJS.ReadableStream): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  return chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function renderShell(readOnly: boolean): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Imperial Commander</title></head>
<body>
<main>
<h1>Imperial Commander</h1>
<nav><a href="/api/board">Board</a> <a href="/api/graph">Graph</a> <a href="/api/roadmap">Roadmap</a></nav>
<p>Mode: ${readOnly ? "read-only" : "read-write"}</p>
</main>
<script>new EventSource('/events').onmessage = () => window.dispatchEvent(new Event('imperial-change'));</script>
</body>
</html>`;
}

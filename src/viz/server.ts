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

      if (
        request.method === "GET" &&
        (url.pathname === "/" || url.pathname === "/index.html" || url.pathname === "/board")
      ) {
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
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Imperial Commander Board</title>
<style>
:root {
  color-scheme: light;
  --bg: #f5f7fb;
  --panel: #ffffff;
  --panel-2: #eef2f7;
  --ink: #152033;
  --muted: #637087;
  --line: #d9e0ea;
  --blue: #2266d4;
  --green: #167c52;
  --amber: #a15c00;
  --red: #b42318;
  --shadow: 0 10px 24px rgba(21, 32, 51, .08);
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
header {
  position: sticky;
  top: 0;
  z-index: 5;
  border-bottom: 1px solid var(--line);
  background: rgba(245, 247, 251, .94);
  backdrop-filter: blur(12px);
}
.wrap { max-width: 1500px; margin: 0 auto; padding: 18px 22px; }
.top { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
h1 { margin: 0; font-size: 22px; letter-spacing: 0; }
.subtitle { margin-top: 3px; color: var(--muted); font-size: 13px; }
.nav { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
.nav a {
  color: var(--ink);
  text-decoration: none;
  border: 1px solid var(--line);
  background: var(--panel);
  padding: 7px 10px;
  border-radius: 8px;
}
.nav a.active { border-color: var(--blue); color: var(--blue); box-shadow: inset 0 0 0 1px var(--blue); }
.metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(130px, 1fr));
  gap: 10px;
  margin-top: 16px;
}
.metric {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px 12px;
}
.metric strong { display: block; font-size: 20px; }
.metric span { color: var(--muted); font-size: 12px; }
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--muted);
  padding-top: 0;
}
.board {
  display: grid;
  grid-template-columns: repeat(4, minmax(280px, 1fr));
  gap: 14px;
  align-items: start;
}
.column {
  min-height: 220px;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px;
}
.column h2 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 10px;
  font-size: 13px;
  text-transform: uppercase;
  color: var(--muted);
  letter-spacing: .04em;
}
.count {
  min-width: 24px;
  text-align: center;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--panel);
  color: var(--ink);
  border: 1px solid var(--line);
}
.card {
  display: block;
  background: var(--panel);
  border: 1px solid var(--line);
  border-left: 4px solid #9aa7b8;
  border-radius: 8px;
  padding: 11px;
  margin-bottom: 10px;
  box-shadow: var(--shadow);
}
.card.high { border-left-color: var(--red); }
.card.medium { border-left-color: var(--amber); }
.card.low { border-left-color: var(--green); }
.card-title { font-weight: 700; font-size: 13px; margin: 0 0 8px; overflow-wrap: anywhere; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.chip {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 2px 7px;
  color: var(--muted);
  font-size: 12px;
  background: #f8fafc;
}
.chip.ready { color: var(--green); border-color: rgba(22,124,82,.35); background: #edf8f3; }
.chip.blocked { color: var(--amber); border-color: rgba(161,92,0,.35); background: #fff6e8; }
.status-select {
  width: 100%;
  margin-top: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  color: var(--ink);
  padding: 7px 8px;
}
.status-select:disabled { color: var(--muted); background: #f8fafc; }
.empty { color: var(--muted); padding: 18px 6px; text-align: center; border: 1px dashed #c6cfdb; border-radius: 8px; }
.error { color: var(--red); font-weight: 700; }
@media (max-width: 1180px) {
  .board { grid-template-columns: repeat(2, minmax(260px, 1fr)); }
  .metrics { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 680px) {
  .top, .toolbar { align-items: flex-start; flex-direction: column; }
  .board, .metrics { grid-template-columns: 1fr; }
}
</style>
</head>
<body>
<header>
<div class="wrap">
<div class="top">
<div>
<h1>Imperial Commander Board</h1>
<div class="subtitle">Local Kanban view over the active task store</div>
</div>
<nav class="nav">
<a class="active" href="/board">Board</a>
<a href="/api/board">Board JSON</a>
<a href="/api/graph">Graph JSON</a>
<a href="/api/roadmap">Roadmap JSON</a>
</nav>
</div>
<section class="metrics" id="metrics" aria-label="Board metrics"></section>
</div>
</header>
<main>
<section class="wrap toolbar">
<span>Mode: <strong>${readOnly ? "read-only" : "read-write"}</strong></span>
<span id="updated">Loading...</span>
</section>
<section class="wrap board" id="board" aria-live="polite"></section>
</main>
<script>
const readOnly = ${JSON.stringify(readOnly)};
const statuses = ["pending", "in-progress", "review", "done", "blocked", "deferred", "cancelled"];

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "disabled" && value) node.disabled = true;
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
    else if (value !== undefined && value !== false) node.setAttribute(key, String(value));
  }
  for (const child of children) node.append(child);
  return node;
}

function metric(value, label) {
  return el("div", { class: "metric" }, [
    el("strong", { text: String(value) }),
    el("span", { text: label }),
  ]);
}

async function setStatus(id, status) {
  const response = await fetch("/api/tasks/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Could not update task status");
  }
}

function renderCard(task) {
  const card = el("article", { class: "card " + task.priority });
  card.append(el("p", { class: "card-title", text: "#" + task.id + " " + task.title }));
  const chips = el("div", { class: "chips" }, [
    el("span", { class: "chip", text: task.priority }),
    el("span", { class: "chip " + (task.ready ? "ready" : "blocked"), text: task.ready ? "ready" : "blocked" }),
    el("span", { class: "chip", text: "subtasks " + task.subtaskProgress.done + "/" + task.subtaskProgress.total }),
  ]);
  card.append(chips);
  const select = el("select", {
    class: "status-select",
    disabled: readOnly,
    onchange: async (event) => {
      const previous = task.status;
      try {
        await setStatus(task.id, event.target.value);
        await load();
      } catch (error) {
        event.target.value = previous;
        alert(error instanceof Error ? error.message : String(error));
      }
    },
  });
  for (const status of statuses) {
    const option = el("option", { value: status, text: status });
    option.selected = status === task.status;
    select.append(option);
  }
  card.append(select);
  return card;
}

function render(data) {
  const board = document.getElementById("board");
  const metrics = document.getElementById("metrics");
  board.replaceChildren();
  metrics.replaceChildren();
  const tasks = data.columns.flatMap((column) => column.tasks);
  metrics.append(
    metric(tasks.length, "tasks"),
    metric(tasks.filter((task) => task.ready && task.status === "pending").length, "ready pending"),
    metric(tasks.filter((task) => task.priority === "high").length, "high priority"),
    metric(tasks.filter((task) => task.status === "done").length, "done"),
    metric(tasks.reduce((sum, task) => sum + task.subtaskProgress.total, 0), "subtasks"),
  );
  for (const column of data.columns) {
    const section = el("section", { class: "column" });
    section.append(el("h2", {}, [
      el("span", { text: column.status.replace("-", " ") }),
      el("span", { class: "count", text: String(column.tasks.length) }),
    ]));
    if (column.tasks.length === 0) {
      section.append(el("div", { class: "empty", text: "No tasks" }));
    } else {
      for (const task of column.tasks) section.append(renderCard(task));
    }
    board.append(section);
  }
  document.getElementById("updated").textContent = "Updated " + new Date().toLocaleTimeString();
}

async function load() {
  const response = await fetch("/api/board");
  if (!response.ok) throw new Error("Could not load board");
  render(await response.json());
}

load().catch((error) => {
  document.getElementById("board").replaceChildren(el("p", { class: "error", text: error.message }));
});

new EventSource("/events").onmessage = () => load().catch(() => undefined);
</script>
</body>
</html>`;
}

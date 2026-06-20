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
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Imperial Commander Monitor</title>
<style>
:root {
  color-scheme: dark;
  --bg: oklch(18% 0.015 255);
  --panel: oklch(23% 0.02 255);
  --panel-2: oklch(27% 0.022 255);
  --ink: oklch(95% 0.01 255);
  --muted: oklch(70% 0.02 255);
  --line: oklch(33% 0.02 255);
  --blue: oklch(72% 0.14 250);
  --green: oklch(74% 0.16 155);
  --amber: oklch(80% 0.14 75);
  --red: oklch(70% 0.19 25);
  --neutral: oklch(60% 0.02 255);
  --shadow: 0 10px 30px rgba(0, 0, 0, .42);
  --shadow-lift: 0 16px 40px rgba(0, 0, 0, .5);
}
[data-theme="light"] {
  color-scheme: light;
  --bg: oklch(97% 0.005 255);
  --panel: oklch(100% 0 0);
  --panel-2: oklch(95% 0.008 255);
  --ink: oklch(25% 0.03 255);
  --muted: oklch(50% 0.02 255);
  --line: oklch(88% 0.01 255);
  --blue: oklch(50% 0.18 255);
  --green: oklch(48% 0.14 155);
  --amber: oklch(58% 0.13 75);
  --red: oklch(52% 0.2 25);
  --neutral: oklch(65% 0.015 255);
  --shadow: 0 10px 24px rgba(20, 30, 50, .1);
  --shadow-lift: 0 16px 36px rgba(20, 30, 50, .16);
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.wrap { max-width: 1560px; margin: 0 auto; padding: 16px 22px; }
header {
  position: sticky;
  top: 0;
  z-index: 5;
  border-bottom: 1px solid var(--line);
  background: color-mix(in oklch, var(--bg) 88%, transparent);
  backdrop-filter: blur(12px);
}
.top { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
h1 { margin: 0; font-size: 21px; letter-spacing: -.01em; }
.subtitle { margin-top: 3px; color: var(--muted); font-size: 13px; }
.head-right { display: flex; align-items: center; gap: 14px; }
.heartbeat { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--muted); }
.dot { width: 9px; height: 9px; border-radius: 999px; background: var(--neutral); }
.heartbeat.live .dot { background: var(--green); animation: pulse 2.4s ease-in-out infinite; }
.heartbeat.down .dot { background: var(--red); }
.theme-toggle {
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--ink);
  border-radius: 8px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 13px;
}
.theme-toggle:hover { border-color: var(--blue); color: var(--blue); }

/* momentum strip */
.momentum { display: grid; grid-template-columns: 2.2fr repeat(4, 1fr); gap: 12px; margin-top: 16px; align-items: stretch; }
.tile {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 11px 13px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
}
.tile .label { color: var(--muted); font-size: 11.5px; text-transform: uppercase; letter-spacing: .05em; }
.tile .value { font-size: 22px; font-weight: 700; line-height: 1; }
.tile .value small { font-size: 13px; font-weight: 600; color: var(--muted); }
.progress-track { height: 9px; border-radius: 999px; background: var(--panel-2); overflow: hidden; }
.progress-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--blue), var(--green)); transform-origin: left; transition: transform .6s cubic-bezier(.16,1,.3,1); }
.tile.stall.is-stalled { border-color: var(--amber); }
.tile.stall.is-stalled .value { color: var(--amber); }
.spark { display: block; }
.spark polyline { fill: none; stroke: var(--green); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }

/* active-now hero */
.hero {
  margin-top: 16px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: linear-gradient(180deg, color-mix(in oklch, var(--blue) 10%, var(--panel)), var(--panel));
  padding: 14px 16px;
  box-shadow: var(--shadow);
}
.hero-head { display: flex; align-items: center; gap: 9px; margin-bottom: 10px; }
.hero-head .label { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.work-dot { width: 10px; height: 10px; border-radius: 999px; background: var(--blue); animation: pulse 1.5s ease-in-out infinite; }
.hero.idle .work-dot { background: var(--neutral); animation: none; }
.hero.stalled { border-color: var(--amber); background: linear-gradient(180deg, color-mix(in oklch, var(--amber) 12%, var(--panel)), var(--panel)); }
.hero.stalled .work-dot { background: var(--amber); animation: none; }
.hero-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 10px; }
.hero-card { background: var(--panel); border: 1px solid var(--line); border-left: 4px solid var(--blue); border-radius: 9px; padding: 12px 13px; }
.hero-card .t { font-weight: 700; font-size: 14px; overflow-wrap: anywhere; }
.hero-idle-msg { color: var(--muted); font-size: 13.5px; }

/* board */
.board { display: grid; grid-template-columns: repeat(6, minmax(220px, 1fr)); gap: 13px; align-items: start; }
.column { min-height: 180px; background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 10px; }
.column.dimmed { opacity: .62; }
.column h2 { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0 0 10px; font-size: 12px; text-transform: uppercase; color: var(--muted); letter-spacing: .05em; }
.col-name { display: flex; align-items: center; gap: 7px; }
.col-accent { width: 8px; height: 8px; border-radius: 999px; background: var(--neutral); }
.col-pending .col-accent { background: var(--neutral); }
.col-in-progress .col-accent { background: var(--blue); }
.col-review .col-accent { background: var(--amber); }
.col-done .col-accent { background: var(--green); }
.col-deferred .col-accent { background: var(--neutral); }
.col-cancelled .col-accent { background: var(--red); }
.count { min-width: 22px; text-align: center; padding: 2px 7px; border-radius: 999px; background: var(--panel); color: var(--ink); border: 1px solid var(--line); font-size: 12px; }
.card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-left: 4px solid var(--neutral);
  border-radius: 9px;
  padding: 11px;
  margin-bottom: 9px;
  box-shadow: var(--shadow);
  will-change: transform;
}
.card.high { border-left-color: var(--red); box-shadow: var(--shadow-lift); }
.card.medium { border-left-color: var(--amber); }
.card.low { border-left-color: var(--green); }
.card.terminal { opacity: .72; box-shadow: none; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 7px; }
.id-pill { font-size: 11.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
.prio-pill { font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; padding: 1px 7px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); }
.card.high .prio-pill { color: var(--red); border-color: color-mix(in oklch, var(--red) 45%, transparent); }
.card.medium .prio-pill { color: var(--amber); border-color: color-mix(in oklch, var(--amber) 45%, transparent); }
.card.low .prio-pill { color: var(--green); border-color: color-mix(in oklch, var(--green) 45%, transparent); }
.card-title { font-weight: 650; font-size: 13px; margin: 0; overflow-wrap: anywhere; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
.chip { border: 1px solid var(--line); border-radius: 999px; padding: 2px 7px; color: var(--muted); font-size: 11.5px; background: color-mix(in oklch, var(--panel-2) 60%, transparent); }
.chip.ready { color: var(--green); border-color: color-mix(in oklch, var(--green) 38%, transparent); }
.chip.blocked { color: var(--amber); border-color: color-mix(in oklch, var(--amber) 38%, transparent); }
.subbar { height: 5px; border-radius: 999px; background: var(--panel-2); overflow: hidden; margin-top: 9px; }
.subbar > span { display: block; height: 100%; background: var(--green); border-radius: 999px; }
.empty { color: var(--muted); padding: 16px 6px; text-align: center; border: 1px dashed var(--line); border-radius: 8px; font-size: 12.5px; }
.error { color: var(--red); font-weight: 700; }
footer { color: var(--muted); font-size: 12px; padding: 8px 22px 22px; max-width: 1560px; margin: 0 auto; display: flex; gap: 14px; flex-wrap: wrap; }
footer a { color: var(--muted); }

@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .4; transform: scale(.82); } }
@keyframes cardEnter { from { opacity: 0; transform: translateY(-8px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes cardMoved { 0% { transform: scale(1); } 35% { transform: scale(1.035); } 100% { transform: scale(1); } }
.card--enter { animation: cardEnter .32s cubic-bezier(.16,1,.3,1); }
.card--moved { animation: cardMoved .5s cubic-bezier(.16,1,.3,1); border-left-color: var(--blue) !important; }

@media (max-width: 1300px) { .board { grid-template-columns: repeat(3, minmax(220px, 1fr)); } .momentum { grid-template-columns: 1fr 1fr; } }
@media (max-width: 760px) { .top { flex-direction: column; } .board { grid-template-columns: 1fr; } .momentum { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
</style>
</head>
<body>
<header>
<div class="wrap">
<div class="top">
<div>
<h1>Imperial Commander Monitor</h1>
<div class="subtitle">Live view of the system working the task store &middot; ${readOnly ? "read-only" : "read-write"}</div>
</div>
<div class="head-right">
<div class="heartbeat" id="heartbeat"><span class="dot"></span><span id="hb-text">connecting</span></div>
<button class="theme-toggle" id="theme-toggle" type="button" aria-label="Toggle color theme">Light</button>
</div>
</div>
<section class="momentum" id="momentum" aria-label="System momentum"></section>
</div>
</header>
<main>
<section class="wrap"><div class="hero" id="hero" aria-live="polite"></div></section>
<section class="wrap board" id="board" aria-live="polite"></section>
</main>
<footer>
<span>Raw data:</span>
<a href="/api/board">board.json</a>
<a href="/api/graph">graph.json</a>
<a href="/api/roadmap">roadmap.json</a>
</footer>
<script>
var DISPLAY_ORDER = ["pending", "in-progress", "review", "done", "deferred", "cancelled"];
var DIMMED = { "done": true, "deferred": true, "cancelled": true };
var TERMINAL = { "done": true, "deferred": true, "cancelled": true };
var LABELS = { "pending": "Pending", "in-progress": "In Progress", "review": "Review", "done": "Done", "deferred": "Deferred", "cancelled": "Cancelled" };
var STALL_MS = 3 * 60 * 1000;
var WINDOW_MS = 10 * 60 * 1000;

var cardIndex = new Map();
var columnBody = new Map();
var columnCount = new Map();
var prevDone = new Set();
var completions = [];
var lastActivityAt = Date.now();
var lastEventAt = 0;
var connected = false;
var firstRender = true;
var heroSig = "";
var lastData = null;

function el(tag, attrs, children) {
  var node = document.createElement(tag);
  attrs = attrs || {};
  for (var key in attrs) {
    var value = attrs[key];
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (value !== undefined && value !== false) node.setAttribute(key, String(value));
  }
  (children || []).forEach(function (c) { node.append(c); });
  return node;
}

function signature(task) {
  return [task.id, task.title, task.priority, task.status, task.ready, task.subtaskProgress.done, task.subtaskProgress.total].join("|");
}

function fillCard(card, task) {
  card.className = "card " + task.priority + (TERMINAL[task.status] ? " terminal" : "");
  var pct = task.subtaskProgress.total > 0 ? Math.round((task.subtaskProgress.done / task.subtaskProgress.total) * 100) : 0;
  var children = [
    el("div", { class: "card-head" }, [
      el("span", { class: "id-pill", text: "#" + task.id }),
      el("span", { class: "prio-pill", text: task.priority }),
    ]),
    el("p", { class: "card-title", text: task.title }),
    el("div", { class: "chips" }, [
      el("span", { class: "chip " + (task.ready ? "ready" : "blocked"), text: task.ready ? "ready" : "blocked" }),
      el("span", { class: "chip", text: "subtasks " + task.subtaskProgress.done + "/" + task.subtaskProgress.total }),
    ]),
  ];
  if (task.subtaskProgress.total > 0) {
    children.push(el("div", { class: "subbar" }, [el("span", { style: "width:" + pct + "%" })]));
  }
  card.replaceChildren.apply(card, children);
}

function flash(node, cls) {
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
  node.addEventListener("animationend", function handler() {
    node.classList.remove(cls);
    node.removeEventListener("animationend", handler);
  });
}

function ensureSkeleton() {
  if (columnBody.size > 0) return;
  var board = document.getElementById("board");
  board.replaceChildren();
  DISPLAY_ORDER.forEach(function (status) {
    var count = el("span", { class: "count", text: "0" });
    var body = el("div", {});
    var section = el("section", { class: "column col-" + status + (DIMMED[status] ? " dimmed" : "") }, [
      el("h2", {}, [
        el("span", { class: "col-name" }, [el("span", { class: "col-accent" }), el("span", { text: LABELS[status] })]),
        count,
      ]),
      body,
    ]);
    columnBody.set(status, body);
    columnCount.set(status, count);
    board.append(section);
  });
}

function applyState(data) {
  lastData = data;
  ensureSkeleton();
  var tasks = data.columns.reduce(function (all, col) { return all.concat(col.tasks); }, []);
  var incoming = new Set(tasks.map(function (t) { return String(t.id); }));
  var now = Date.now();
  var activity = false;

  var doneNow = new Set();
  tasks.forEach(function (t) { if (t.status === "done") doneNow.add(String(t.id)); });
  doneNow.forEach(function (id) { if (!prevDone.has(id)) completions.push(now); });
  prevDone = doneNow;

  tasks.forEach(function (t) {
    var id = String(t.id);
    var sig = signature(t);
    var existing = cardIndex.get(id);
    if (!existing) {
      var node = el("article", {});
      fillCard(node, t);
      if (!firstRender) node.classList.add("card--enter");
      cardIndex.set(id, { node: node, status: t.status, sig: sig });
      activity = true;
    } else {
      if (existing.sig !== sig) { fillCard(existing.node, t); existing.sig = sig; }
      if (existing.status !== t.status) {
        existing.status = t.status;
        if (!firstRender) flash(existing.node, "card--moved");
        activity = true;
      }
    }
  });

  cardIndex.forEach(function (entry, id) { if (!incoming.has(id)) cardIndex.delete(id); });

  if (activity) lastActivityAt = now;

  DISPLAY_ORDER.forEach(function (status) {
    var colTasks = tasks.filter(function (t) { return t.status === status; });
    columnCount.get(status).textContent = String(colTasks.length);
    var body = columnBody.get(status);
    if (colTasks.length === 0) {
      body.replaceChildren(el("div", { class: "empty", text: "—" }));
    } else {
      var frag = document.createDocumentFragment();
      colTasks.forEach(function (t) { frag.append(cardIndex.get(String(t.id)).node); });
      body.replaceChildren(frag);
    }
  });

  renderMomentum(tasks, now);
  renderHero(tasks, now);
  firstRender = false;
}

function sparkline() {
  var now = Date.now();
  var buckets = new Array(10).fill(0);
  completions.forEach(function (ts) {
    var age = now - ts;
    if (age <= WINDOW_MS) {
      var idx = 9 - Math.floor(age / (WINDOW_MS / 10));
      if (idx >= 0 && idx < 10) buckets[idx] += 1;
    }
  });
  var max = Math.max(1, Math.max.apply(null, buckets));
  var w = 92, h = 26;
  var points = buckets.map(function (v, i) {
    var x = (i / 9) * w;
    var y = h - (v / max) * (h - 3) - 1.5;
    return x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");
  var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "spark");
  svg.setAttribute("width", String(w));
  svg.setAttribute("height", String(h));
  svg.setAttribute("viewBox", "0 0 " + w + " " + h);
  var line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  line.setAttribute("points", points);
  svg.append(line);
  return svg;
}

function tile(label, valueNode, extraClass, id) {
  var attrs = { class: "tile" + (extraClass ? " " + extraClass : "") };
  if (id) attrs.id = id;
  return el("div", attrs, [el("span", { class: "label", text: label }), valueNode]);
}

function renderMomentum(tasks, now) {
  var total = tasks.length;
  var done = tasks.filter(function (t) { return t.status === "done"; }).length;
  var active = tasks.filter(function (t) { return t.status === "in-progress"; }).length;
  var pct = total > 0 ? Math.round((done / total) * 100) : 0;
  var recent = completions.filter(function (ts) { return now - ts <= WINDOW_MS; }).length;
  var stalled = active > 0 && (now - lastActivityAt) > STALL_MS;

  var fill = el("div", { class: "progress-fill", style: "transform:scaleX(" + (pct / 100) + ")" });
  var progressTile = el("div", { class: "tile" }, [
    el("span", { class: "label", text: "Progress " + done + "/" + total + " (" + pct + "%)" }),
    el("div", { class: "progress-track" }, [fill]),
  ]);

  var activeVal = el("span", { class: "value", text: String(active) });
  var doneVal = el("span", { class: "value" });
  doneVal.append(document.createTextNode(String(recent)), el("small", { text: " /10m" }));
  var stallVal = el("span", { class: "value", text: stalled ? "stalled" : (active > 0 ? "working" : "idle") });

  var momentum = document.getElementById("momentum");
  momentum.replaceChildren(
    progressTile,
    tile("Active now", activeVal),
    tile("Completed", doneVal),
    tile("Throughput", sparkline()),
    tile("State", stallVal, stalled ? "stall is-stalled" : "stall")
  );
}

function heroCard(task) {
  return el("div", { class: "hero-card" }, [
    el("div", { class: "id-pill", text: "#" + task.id + " \\u00b7 " + task.priority }),
    el("div", { class: "t", text: task.title }),
  ]);
}

function renderHero(tasks, now) {
  var active = tasks.filter(function (t) { return t.status === "in-progress"; });
  var stalled = active.length > 0 && (now - lastActivityAt) > STALL_MS;
  var sig = stalled + "|" + active.map(function (t) { return signature(t); }).join("~");
  if (sig === heroSig) return;
  heroSig = sig;

  var hero = document.getElementById("hero");
  hero.className = "hero" + (active.length === 0 ? " idle" : "") + (stalled ? " stalled" : "");
  var labelText = active.length === 0 ? "Idle" : (stalled ? "Stalled" : "Working now");
  var head = el("div", { class: "hero-head" }, [
    el("span", { class: "work-dot" }),
    el("span", { class: "label", text: labelText }),
  ]);
  if (active.length === 0) {
    hero.replaceChildren(head, el("div", { class: "hero-idle-msg", text: "No task in progress." }));
  } else {
    var cards = el("div", { class: "hero-cards" }, active.map(heroCard));
    hero.replaceChildren(head, cards);
  }
}

function updateHeartbeat() {
  var hb = document.getElementById("heartbeat");
  var text = document.getElementById("hb-text");
  if (!connected) {
    hb.className = "heartbeat down";
    text.textContent = "disconnected";
    return;
  }
  hb.className = "heartbeat live";
  if (lastEventAt === 0) { text.textContent = "live"; return; }
  var secs = Math.round((Date.now() - lastEventAt) / 1000);
  text.textContent = secs < 2 ? "live" : "last event " + secs + "s ago";
}

function tick() {
  updateHeartbeat();
  if (lastData) {
    renderMomentum(lastData.columns.reduce(function (a, c) { return a.concat(c.tasks); }, []), Date.now());
    renderHero(lastData.columns.reduce(function (a, c) { return a.concat(c.tasks); }, []), Date.now());
  }
}

async function fetchAndApply() {
  var response = await fetch("/api/board");
  if (!response.ok) throw new Error("Could not load board");
  applyState(await response.json());
}

function initTheme() {
  var stored = null;
  try { stored = localStorage.getItem("impcom-theme"); } catch (e) {}
  var theme = stored || "dark";
  document.documentElement.setAttribute("data-theme", theme);
  var btn = document.getElementById("theme-toggle");
  btn.textContent = theme === "dark" ? "Light" : "Dark";
  btn.addEventListener("click", function () {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    btn.textContent = next === "dark" ? "Light" : "Dark";
    try { localStorage.setItem("impcom-theme", next); } catch (e) {}
  });
}

initTheme();
fetchAndApply().catch(function (error) {
  document.getElementById("board").replaceChildren(el("p", { class: "error", text: error.message }));
});

var source = new EventSource("/events");
source.onopen = function () { connected = true; updateHeartbeat(); };
source.onerror = function () { connected = false; updateHeartbeat(); };
source.onmessage = function () { lastEventAt = Date.now(); updateHeartbeat(); fetchAndApply().catch(function () {}); };

setInterval(tick, 1000);
</script>
</body>
</html>`;
}

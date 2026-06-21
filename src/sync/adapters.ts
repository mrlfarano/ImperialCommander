import { spawn } from "node:child_process";
import { basename, resolve } from "node:path";
import type { Task } from "../schemas/index.js";

export type SyncProviderName = "github" | "linear" | "jira" | "gitlab" | "local" | "hermes-kanban";
export type SyncScope = "all" | "open" | "ready";

export interface SyncCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type SyncCommandRunner = (command: string, args: string[]) => Promise<SyncCommandResult>;

export interface SyncAdapterOptions {
  dryRun?: boolean;
  projectRoot?: string;
  tag?: string;
  board?: string;
  scope?: SyncScope;
  assignee?: string;
  goal?: boolean;
  hermesCommand?: string;
  commandRunner?: SyncCommandRunner;
}

export interface ExternalSyncItem {
  externalId: string;
  title: string;
  status: string;
  url?: string;
}

export interface SyncAdapter {
  provider: SyncProviderName;
  dryRun: boolean;
  push(task: Task): Promise<ExternalSyncItem>;
  pull(): Promise<ExternalSyncItem[]>;
  linkDependencies?(tasks: Task[], taskIdToExternalId: Map<string, string>): Promise<number>;
}

const doneStatuses = new Set(["done", "completed", "cancelled", "canceled", "archived"]);
const priorityScore: Record<string, number> = {
  critical: 100,
  high: 80,
  medium: 50,
  low: 20,
};

export function createSyncAdapter(
  provider: SyncProviderName,
  options: SyncAdapterOptions = {},
): SyncAdapter {
  if (provider === "hermes-kanban") {
    return new HermesKanbanSyncAdapter(options);
  }
  return new LocalSkeletonSyncAdapter(provider, options.dryRun ?? true);
}

class LocalSkeletonSyncAdapter implements SyncAdapter {
  constructor(
    readonly provider: SyncProviderName,
    readonly dryRun: boolean,
  ) {}

  async push(task: Task): Promise<ExternalSyncItem> {
    return {
      externalId: `${this.provider}-${String(task.id)}`,
      title: task.title,
      status: task.status,
      url: `local://${this.provider}/${String(task.id)}`,
    };
  }

  async pull(): Promise<ExternalSyncItem[]> {
    return [];
  }
}

class HermesKanbanSyncAdapter implements SyncAdapter {
  readonly provider = "hermes-kanban" as const;
  readonly dryRun: boolean;
  private readonly projectRoot: string;
  private readonly tag: string;
  private readonly board: string;
  private readonly assignee?: string;
  private readonly goal: boolean;
  private readonly hermesCommand: string;
  private readonly commandRunner: SyncCommandRunner;
  private boardEnsured = false;
  private existingByKey: Map<string, string> | undefined;

  constructor(options: SyncAdapterOptions = {}) {
    this.dryRun = options.dryRun ?? true;
    this.projectRoot = resolve(options.projectRoot ?? process.cwd());
    this.tag = options.tag ?? "master";
    this.board = options.board ?? slugify(basename(this.projectRoot)) ?? "default";
    this.assignee = options.assignee;
    this.goal = options.goal === true;
    this.hermesCommand = options.hermesCommand ?? process.env.IMPCOM_HERMES_COMMAND ?? "hermes";
    this.commandRunner = options.commandRunner ?? defaultCommandRunner;
  }

  async push(task: Task): Promise<ExternalSyncItem> {
    await this.ensureBoard();
    const existing = await this.existingTasksByKey();
    const key = this.idempotencyKey(task);
    const title = this.taskTitle(task);
    const existingId = existing.get(key);

    if (existingId) {
      return { externalId: existingId, title, status: task.status, url: this.taskUrl(existingId) };
    }

    if (this.dryRun) {
      return {
        externalId: `dryrun-${String(task.id)}`,
        title,
        status: task.status,
        url: this.taskUrl(`dryrun-${String(task.id)}`),
      };
    }

    const args = [
      "kanban",
      "--board",
      this.board,
      "create",
      title,
      "--body",
      this.renderBody(task),
      "--workspace",
      `dir:${this.projectRoot}`,
      "--priority",
      String(priorityScore[String(task.priority).toLowerCase()] ?? 0),
      "--idempotency-key",
      key,
      "--created-by",
      "imperial-commander",
      "--json",
    ];

    if (this.assignee) {
      args.push("--assignee", this.assignee);
    }
    if (this.goal) {
      args.push("--goal");
    }

    const output = await this.run(args);
    const payload = extractJson(output.stdout);
    const taskId = extractKanbanTaskId(payload) ?? (await this.refreshAndFind(key));

    if (!taskId) {
      throw new Error(
        `Could not determine Hermes Kanban task id for Imperial task ${String(task.id)}.`,
      );
    }

    existing.set(key, taskId);
    return { externalId: taskId, title, status: task.status, url: this.taskUrl(taskId) };
  }

  async pull(): Promise<ExternalSyncItem[]> {
    return [];
  }

  async linkDependencies(tasks: Task[], taskIdToExternalId: Map<string, string>): Promise<number> {
    if (tasks.length === 0) {
      return 0;
    }

    await this.ensureBoard();
    let linked = 0;
    const selectedIds = new Set(tasks.map((task) => String(task.id)));

    for (const task of tasks) {
      const child = taskIdToExternalId.get(String(task.id));
      if (!child) {
        continue;
      }

      for (const dependency of task.dependencies) {
        const depId = String(dependency);
        if (!selectedIds.has(depId)) {
          continue;
        }
        const parent = taskIdToExternalId.get(depId);
        if (!parent) {
          continue;
        }

        if (this.dryRun) {
          linked += 1;
          continue;
        }

        const result = await this.commandRunner(this.hermesCommand, [
          "kanban",
          "--board",
          this.board,
          "link",
          parent,
          child,
        ]);
        const combined = `${result.stdout}\n${result.stderr}`.toLowerCase();
        if (result.exitCode === 0) {
          linked += 1;
        } else if (!combined.includes("already") && !combined.includes("unique")) {
          throw new Error(
            `Hermes Kanban link failed for ${parent} -> ${child}: ${result.stderr || result.stdout}`,
          );
        }
      }
    }

    return linked;
  }

  private async ensureBoard(): Promise<void> {
    if (this.boardEnsured) {
      return;
    }

    const output = await this.run(["kanban", "boards", "list", "--json"], { allowFailure: true });
    const boards = extractJson(output.stdout);
    const exists = Array.isArray(boards)
      ? boards.some((board) => isRecord(board) && board.slug === this.board)
      : false;

    if (!exists && !this.dryRun) {
      await this.run([
        "kanban",
        "boards",
        "create",
        this.board,
        "--description",
        "Imperial Commander feeds this board; Hermes Kanban executes/tracks work.",
        "--icon",
        "⚔️",
        "--color",
        "#8b5cf6",
        "--default-workdir",
        this.projectRoot,
      ]);
    }

    this.boardEnsured = true;
  }

  private async existingTasksByKey(): Promise<Map<string, string>> {
    if (this.existingByKey) {
      return this.existingByKey;
    }

    const map = new Map<string, string>();
    const output = await this.run(
      ["kanban", "--board", this.board, "list", "--json", "--archived"],
      { allowFailure: true },
    );
    const tasks = extractJson(output.stdout);

    if (Array.isArray(tasks)) {
      for (const task of tasks) {
        if (!isRecord(task)) {
          continue;
        }
        const key =
          task.idempotency_key ?? task.idempotencyKey ?? extractBodyIdempotencyKey(task.body);
        const id = task.id;
        if (typeof key === "string" && typeof id === "string") {
          map.set(key, id);
        }
      }
    }

    this.existingByKey = map;
    return map;
  }

  private async refreshAndFind(key: string): Promise<string | undefined> {
    this.existingByKey = undefined;
    return (await this.existingTasksByKey()).get(key);
  }

  private idempotencyKey(task: Task): string {
    return `imperial:${this.projectRoot}:${this.tag}:${String(task.id)}`;
  }

  private taskTitle(task: Task): string {
    return `IC#${String(task.id)} — ${task.title}`.slice(0, 240);
  }

  private renderBody(task: Task): string {
    const subtasks = task.subtasks ?? [];
    const lines = [
      "Imported from Imperial Commander. Imperial remains the planning/source graph; Hermes Kanban is the execution/tracking queue.",
      "",
      "## Imperial metadata",
      `- Project root: \`${this.projectRoot}\``,
      `- Tag: \`${this.tag}\``,
      `- Imperial task id: \`${String(task.id)}\``,
      `- Imperial status at import: \`${task.status}\``,
      `- Imperial priority: \`${task.priority}\``,
      `- Imperial dependencies: \`${JSON.stringify(task.dependencies)}\``,
      `- Idempotency key: \`${this.idempotencyKey(task)}\``,
      "",
      "## Description",
      task.description?.trim() || "(none)",
      "",
      "## Implementation details",
      task.details?.trim() || "(none)",
      "",
      "## Test strategy",
      task.testStrategy?.trim() || "(none)",
    ];

    if (subtasks.length > 0) {
      lines.push("", "## Imperial subtasks");
      for (const subtask of subtasks) {
        lines.push(`- \`${String(subtask.id)}\` [${subtask.status}] ${subtask.title}`);
      }
    }

    lines.push(
      "",
      "## Sync policy",
      "- One-way import: do not treat this card as the canonical Imperial task store.",
      "- Kanban comments/results are the execution audit trail.",
      "- Later writeback can call Imperial Commander MCP `set-status` after Kanban completion.",
    );

    return lines.join("\n");
  }

  private taskUrl(taskId: string): string {
    return `hermes-kanban://${this.board}/${taskId}`;
  }

  private async run(
    args: string[],
    options: { allowFailure?: boolean } = {},
  ): Promise<SyncCommandResult> {
    const result = await this.commandRunner(this.hermesCommand, args);
    if (result.exitCode !== 0 && !options.allowFailure) {
      throw new Error(
        `Hermes command failed: ${this.hermesCommand} ${args.join(" ")}\n${result.stderr}`,
      );
    }
    return result;
  }
}

export function filterTasksForSync(tasks: Task[], scope: SyncScope): Task[] {
  if (scope === "all") {
    return tasks;
  }

  const openTasks = tasks.filter((task) => !doneStatuses.has(task.status));
  if (scope === "open") {
    return openTasks;
  }

  const byId = new Map(tasks.map((task) => [String(task.id), task]));
  return openTasks.filter((task) =>
    task.dependencies.every((dependency) =>
      doneStatuses.has(byId.get(String(dependency))?.status ?? ""),
    ),
  );
}

async function defaultCommandRunner(command: string, args: string[]): Promise<SyncCommandResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolvePromise({ exitCode: code ?? 0, stdout, stderr });
    });
  });
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    // Some CLIs print banners around JSON; fall through to best-effort extraction.
  }

  const starts = [trimmed.indexOf("{"), trimmed.indexOf("[")].filter((index) => index >= 0);
  if (starts.length === 0) {
    return undefined;
  }
  const start = Math.min(...starts);
  for (let end = trimmed.length; end > start; end -= 1) {
    try {
      return JSON.parse(trimmed.slice(start, end));
    } catch {
      // Keep shrinking until a valid JSON payload is found.
    }
  }
  return undefined;
}

function extractKanbanTaskId(payload: unknown): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }
  const direct = payload.id ?? payload.task_id ?? payload.taskId;
  if (typeof direct === "string") {
    return direct;
  }
  if (isRecord(payload.task) && typeof payload.task.id === "string") {
    return payload.task.id;
  }
  return undefined;
}

function extractBodyIdempotencyKey(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return value.match(/Idempotency key: `([^`]+)`/)?.[1];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project"
  );
}

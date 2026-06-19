import { addTaskCommand } from "../commands/add-task.js";
import { authCommand } from "../commands/auth.js";
import { autopilotCommand } from "../commands/autopilot.js";
import { boardCommand } from "../commands/board.js";
import { briefsCommand } from "../commands/briefs.js";
import { checkSpecCommand } from "../commands/check-spec.js";
import { analyzeComplexityCommand, complexityReportCommand } from "../commands/complexity.js";
import { contextCommand } from "../commands/context.js";
import {
  addDependencyCommand,
  fixDependenciesCommand,
  removeDependencyCommand,
  validateDependenciesCommand,
} from "../commands/dependencies.js";
import { expandAllCommand, expandCommand } from "../commands/expand.js";
import { exportCommand } from "../commands/export.js";
import { generateCommand, syncReadmeCommand } from "../commands/generate.js";
import { historyCommand } from "../commands/history.js";
import { runInitCommand } from "../commands/init.js";
import { langCommand } from "../commands/lang.js";
import { loopCommand } from "../commands/loop.js";
import { modelsCommand } from "../commands/models.js";
import { moveCommand } from "../commands/move.js";
import { notificationsCommand } from "../commands/notifications.js";
import { parseSpecCommand } from "../commands/parse-spec.js";
import { prdCommand } from "../commands/prd.js";
import { researchCommand } from "../commands/research.js";
import { roadmapCommand } from "../commands/roadmap.js";
import { scopeCommand } from "../commands/scope.js";
import { searchCommand } from "../commands/search.js";
import {
  addSubtaskCommand,
  clearSubtasksCommand,
  removeSubtaskCommand,
  removeTaskCommand,
} from "../commands/subtasks.js";
import { syncCommand } from "../commands/sync.js";
import {
  addTagCommand,
  copyTagCommand,
  deleteTagCommand,
  listTagsCommand,
  renameTagCommand,
  useTagCommand,
} from "../commands/tags.js";
import {
  listTasksCommand,
  nextTaskCommand,
  setStatusCommand,
  showTaskCommand,
} from "../commands/tasks.js";
import { tuiCommand } from "../commands/tui.js";
import { undoCommand } from "../commands/undo.js";
import { updateCommand, updateSubtaskCommand, updateTaskCommand } from "../commands/update.js";
import { watchCommand } from "../commands/watch.js";
import { type HostToolResponse, wrapAgentCall } from "./envelope.js";

export interface AgentToolContext {
  projectRoot: string;
}

export interface AgentToolDefinition {
  name: string;
  destructive?: boolean;
  handler: (args: Record<string, unknown>, context: AgentToolContext) => Promise<HostToolResponse>;
}

type CommandArgs = Record<string, unknown>;

export const toolRegistry: Record<string, AgentToolDefinition> = {
  bootstrap: tool("bootstrap", true, async (args) =>
    runInitCommand({
      projectRoot: requiredString(args.projectRoot, "projectRoot"),
      name: optionalString(args.name),
      description: optionalString(args.description),
      dryRun: booleanArg(args.dryRun),
    }),
  ),
  list: tool("list", false, async (args) =>
    listTasksCommand({ file: optionalString(args.file), tag: optionalString(args.tag) }),
  ),
  "get-task": tool("get-task", false, async (args) =>
    showTaskCommand(requiredString(args.id, "id"), {
      file: optionalString(args.file),
      tag: optionalString(args.tag),
    }),
  ),
  next: tool("next", false, async (args) =>
    nextTaskCommand({ file: optionalString(args.file), tag: optionalString(args.tag) }),
  ),
  "set-status": tool("set-status", true, async (args) =>
    setStatusCommand(
      requiredString(args.id, "id"),
      requiredString(args.status, "status") as never,
      {
        file: optionalString(args.file),
        tag: optionalString(args.tag),
      },
    ),
  ),
  "parse-spec": tool("parse-spec", true, async (args) =>
    parseSpecCommand(requiredString(args.specFile, "specFile"), {
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      append: booleanArg(args.append),
      force: booleanArg(args.force),
      numTasks: optionalNumber(args.numTasks),
    }),
  ),
  expand: tool("expand", true, async (args) =>
    expandCommand({
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      id: requiredString(args.id, "id"),
      num: optionalNumber(args.num),
      prompt: optionalString(args.prompt),
      force: booleanArg(args.force),
      complexityReport: optionalString(args.complexityReport),
    }),
  ),
  "expand-all": tool("expand-all", true, async (args) =>
    expandAllCommand({
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      num: optionalNumber(args.num),
      prompt: optionalString(args.prompt),
      force: booleanArg(args.force),
      complexityReport: optionalString(args.complexityReport),
    }),
  ),
  "add-task": tool("add-task", true, async (args) =>
    addTaskCommand({
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      title: optionalString(args.title),
      description: optionalString(args.description),
      details: optionalString(args.details),
      testStrategy: optionalString(args.testStrategy),
      dependencies: optionalString(args.dependencies),
      priority: optionalString(args.priority) as never,
      prompt: optionalString(args.prompt),
      research: booleanArg(args.research),
    }),
  ),
  "add-subtask": tool("add-subtask", true, async (args) =>
    addSubtaskCommand({
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      parent: optionalString(args.parent ?? args.id),
      title: optionalString(args.title),
      existingTaskId: optionalString(args.existingTaskId ?? args.taskId),
      description: optionalString(args.description),
      details: optionalString(args.details),
    }),
  ),
  "remove-task": tool("remove-task", true, async (args) =>
    removeTaskCommand(requiredString(args.id, "id"), {
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      yes: booleanArg(args.yes) ?? true,
    }),
  ),
  "remove-subtask": tool("remove-subtask", true, async (args) =>
    removeSubtaskCommand(requiredString(args.id, "id"), {
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      convert: booleanArg(args.convert),
    }),
  ),
  "clear-subtasks": tool("clear-subtasks", true, async (args) =>
    clearSubtasksCommand({
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      ids: optionalString(args.id),
      all: booleanArg(args.all),
    }),
  ),
  update: tool("update", true, async (args) =>
    updateCommand({
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      prompt: requiredString(args.prompt, "prompt"),
      from: optionalNumber(args.from),
      id: optionalString(args.id),
    }),
  ),
  "update-task": tool("update-task", true, async (args) =>
    updateTaskCommand(requiredString(args.id, "id"), {
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      prompt: requiredString(args.prompt, "prompt"),
      append: booleanArg(args.append),
    }),
  ),
  "update-subtask": tool("update-subtask", true, async (args) =>
    updateSubtaskCommand(requiredString(args.id, "id"), {
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      prompt: requiredString(args.prompt, "prompt"),
    }),
  ),
  "analyze-complexity": tool("analyze-complexity", true, async (args) =>
    analyzeComplexityCommand({
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      output: optionalString(args.output),
      threshold: optionalNumber(args.threshold),
      id: optionalString(args.id),
      from: optionalNumber(args.from),
      to: optionalNumber(args.to),
      research: booleanArg(args.research),
    }),
  ),
  "complexity-report": tool("complexity-report", false, async (args) =>
    complexityReportCommand({
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      output: optionalString(args.output),
    }),
  ),
  "add-dependency": tool("add-dependency", true, async (args) =>
    addDependencyCommand(
      requiredString(args.id, "id"),
      requiredString(args.dependsOn, "dependsOn"),
      {
        file: optionalString(args.file),
        tag: optionalString(args.tag),
      },
    ),
  ),
  "remove-dependency": tool("remove-dependency", true, async (args) =>
    removeDependencyCommand(
      requiredString(args.id, "id"),
      requiredString(args.dependsOn, "dependsOn"),
      {
        file: optionalString(args.file),
        tag: optionalString(args.tag),
      },
    ),
  ),
  "validate-dependencies": tool("validate-dependencies", false, async (args) =>
    validateDependenciesCommand({ file: optionalString(args.file), tag: optionalString(args.tag) }),
  ),
  "fix-dependencies": tool("fix-dependencies", true, async (args) =>
    fixDependenciesCommand({ file: optionalString(args.file), tag: optionalString(args.tag) }),
  ),
  "add-tag": tool("add-tag", true, async (args) =>
    addTagCommand(requiredString(args.tagName ?? args.name, "tagName"), {
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      description: optionalString(args.description),
      copyFrom: optionalString(args.copyFrom),
      copyFromCurrent: booleanArg(args.copyFromCurrent),
      fromBranch: optionalString(args.fromBranch),
    }),
  ),
  "use-tag": tool("use-tag", true, async (args) =>
    useTagCommand(requiredString(args.tagName ?? args.name, "tagName"), {
      file: optionalString(args.file),
    }),
  ),
  "list-tags": tool("list-tags", false, async (args) =>
    listTagsCommand({
      file: optionalString(args.file),
      showMetadata: booleanArg(args.showMetadata),
    }),
  ),
  "rename-tag": tool("rename-tag", true, async (args) =>
    renameTagCommand(requiredString(args.from, "from"), requiredString(args.to, "to"), {
      file: optionalString(args.file),
    }),
  ),
  "copy-tag": tool("copy-tag", true, async (args) =>
    copyTagCommand(requiredString(args.from, "from"), requiredString(args.to, "to"), {
      file: optionalString(args.file),
      description: optionalString(args.description),
    }),
  ),
  "delete-tag": tool("delete-tag", true, async (args) =>
    deleteTagCommand(requiredString(args.tagName ?? args.name, "tagName"), {
      file: optionalString(args.file),
      yes: booleanArg(args.yes) ?? true,
    }),
  ),
  research: tool("research", false, async (args) =>
    researchCommand(requiredString(args.query, "query"), {
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      detail: optionalString(args.detail) as never,
      ids: optionalString(args.ids),
      files: optionalString(args.files),
      context: optionalString(args.context),
      tree: booleanArg(args.tree),
      saveTo: optionalString(args.saveTo),
      saveFile: booleanArg(args.saveFile),
    }),
  ),
  models: tool("models", true, async (args) =>
    modelsCommand({
      configPath: optionalString(args.configPath),
      setMain: optionalString(args.setMain),
      setResearch: optionalString(args.setResearch),
      setFallback: optionalString(args.setFallback),
      provider: optionalString(args.provider),
      baseURL: optionalString(args.baseURL),
    }),
  ),
  lang: tool("lang", true, async (args) =>
    langCommand({
      configPath: optionalString(args.configPath),
      response: optionalString(args.response),
    }),
  ),
  generate: tool("generate", true, async (args) =>
    generateCommand({
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      output: optionalString(args.output),
      format: optionalString(args.format) as never,
    }),
  ),
  "sync-readme": tool("sync-readme", true, async (args) =>
    syncReadmeCommand({
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      readme: optionalString(args.readme),
      withSubtasks: booleanArg(args.withSubtasks),
      status: optionalString(args.status) as never,
    }),
  ),
  move: tool("move", true, async (args) =>
    moveCommand({
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      from: optionalString(args.from),
      to: optionalString(args.to),
      fromTag: optionalString(args.fromTag),
      toTag: optionalString(args.toTag),
      before: optionalString(args.before),
      after: optionalString(args.after),
    }),
  ),
  "scope-up": tool("scope-up", true, async (args) =>
    scopeCommand("up", {
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      id: optionalString(args.id),
      strength: optionalString(args.strength) as never,
      prompt: optionalString(args.prompt),
    }),
  ),
  "scope-down": tool("scope-down", true, async (args) =>
    scopeCommand("down", {
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      id: optionalString(args.id),
      strength: optionalString(args.strength) as never,
      prompt: optionalString(args.prompt),
    }),
  ),
  prd: tool("prd", true, async (args) =>
    prdCommand({
      projectRoot: optionalString(args.projectRoot),
      configDir: optionalString(args.configDir),
      idea: optionalString(args.idea),
      title: optionalString(args.title),
      template: optionalString(args.template) as never,
      answers: optionalString(args.answers),
      resume: booleanArg(args.resume),
      output: optionalString(args.output),
      maxRounds: optionalNumber(args.maxRounds),
      research: booleanArg(args.research),
      chain: booleanArg(args.chain),
    }),
  ),
  "check-spec": tool("check-spec", true, async (args) =>
    checkSpecCommand({
      projectRoot: optionalString(args.projectRoot),
      configDir: optionalString(args.configDir),
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      input: optionalString(args.input ?? args.specFile),
      threshold: optionalNumber(args.threshold),
      report:
        typeof args.report === "boolean" || typeof args.report === "string"
          ? args.report
          : undefined,
      strict: booleanArg(args.strict),
    }),
  ),
  autopilot: tool("autopilot", true, async (args) =>
    autopilotCommand({
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      id: optionalString(args.id),
      prompt: optionalString(args.prompt),
      dryRun: booleanArg(args.dryRun),
      project: optionalString(args.project ?? args.projectRoot),
      stateFile: optionalString(args.stateFile),
    }),
  ),
  loop: tool("loop", true, async (args) =>
    loopCommand({
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      iterations: optionalNumber(args.iterations),
      prompt: optionalString(args.prompt),
      progressFile: optionalString(args.progressFile),
      project: optionalString(args.project ?? args.projectRoot),
      sandbox: booleanArg(args.sandbox),
      output: booleanArg(args.output),
      verbose: booleanArg(args.verbose),
    }),
  ),
  "auth-login": tool("auth-login", true, async (args) =>
    authCommand("login", {
      token: optionalString(args.token),
      endpoint: optionalString(args.endpoint),
      workspace: optionalString(args.workspace),
    }),
  ),
  "auth-logout": tool("auth-logout", true, async () => authCommand("logout")),
  "auth-status": tool("auth-status", false, async () => authCommand("status")),
  "auth-refresh": tool("auth-refresh", true, async () => authCommand("refresh")),
  context: tool("context", true, async (args) =>
    contextCommand((optionalString(args.action) as never) ?? "show", {
      org: optionalString(args.org),
      brief: optionalString(args.brief),
      noHeader: booleanArg(args.noHeader),
    }),
  ),
  briefs: tool("briefs", true, async (args) =>
    briefsCommand((optionalString(args.action) as never) ?? "list", {
      id: optionalString(args.id),
      title: optionalString(args.title),
    }),
  ),
  tui: tool("tui", false, async (args) =>
    tuiCommand({ interactive: booleanArg(args.interactive) }),
  ),
  board: tool("board", false, async (args) =>
    boardCommand({
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      host: optionalString(args.host),
      port: optionalNumber(args.port),
      readOnly: booleanArg(args.readOnly),
      open: booleanArg(args.open),
      view: optionalString(args.view) as never,
      json: booleanArg(args.json),
    }),
  ),
  roadmap: tool("roadmap", false, async (args) =>
    roadmapCommand({
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      json: booleanArg(args.json),
    }),
  ),
  watch: tool("watch", true, async (args) =>
    watchCommand({
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      specFile: optionalString(args.specFile),
      debounceMs: optionalNumber(args.debounceMs),
      onChange: optionalString(args.onChange) as never,
      once: booleanArg(args.once) ?? true,
    }),
  ),
  sync: tool("sync", true, async (args) =>
    syncCommand({
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      provider: optionalString(args.provider) as never,
      dryRun: booleanArg(args.dryRun),
      write: booleanArg(args.write),
      json: booleanArg(args.json),
      projectRoot: optionalString(args.projectRoot),
      mappingPath: optionalString(args.mappingPath),
    }),
  ),
  notifications: tool("notifications", true, async (args) =>
    notificationsCommand({
      type: optionalString(args.type) as never,
      id: optionalString(args.id),
      tag: optionalString(args.tag),
      fileSink: optionalString(args.fileSink),
      webhook: optionalString(args.webhook),
      signingSecretEnv: optionalString(args.signingSecretEnv),
      json: booleanArg(args.json),
    }),
  ),
  history: tool("history", false, async (args) =>
    historyCommand({
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      operation: optionalString(args.operation),
      id: optionalString(args.id),
      limit: optionalNumber(args.limit),
    }),
  ),
  undo: tool("undo", true, async (args) =>
    undoCommand({
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      entry: optionalString(args.entry),
    }),
  ),
  search: tool("search", false, async (args) =>
    searchCommand({
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      query: optionalString(args.query),
      status: optionalString(args.status),
      priority: optionalString(args.priority),
      ready: booleanArg(args.ready),
      blocked: booleanArg(args.blocked),
      hasSubtasks: booleanArg(args.hasSubtasks),
      noSubtasks: booleanArg(args.noSubtasks),
      allTags: booleanArg(args.allTags),
      limit: optionalNumber(args.limit),
      sort: optionalString(args.sort) as never,
      json: booleanArg(args.json),
    }),
  ),
  export: tool("export", true, async (args) =>
    exportCommand({
      file: optionalString(args.file),
      tag: optionalString(args.tag),
      format: optionalString(args.format) as never,
      output: optionalString(args.output),
      allTags: booleanArg(args.allTags),
      json: booleanArg(args.json),
    }),
  ),
};

export function lookupTool(name: string): AgentToolDefinition | undefined {
  const normalized = name.trim().toLowerCase().replace(/_/g, "-");
  return toolRegistry[normalized];
}

function tool(
  name: string,
  destructive: boolean,
  command: (args: CommandArgs) => Promise<unknown>,
): AgentToolDefinition {
  return {
    name,
    destructive,
    handler: (args, context) =>
      wrapAgentCall(
        async () => command({ ...args, projectRoot: context.projectRoot }),
        optionalString(args.tag),
      ),
  };
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function booleanArg(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

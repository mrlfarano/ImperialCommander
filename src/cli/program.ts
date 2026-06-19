import { Command } from "commander";
import { addTaskCommand } from "../commands/add-task.js";
import { authCommand } from "../commands/auth.js";
import { autopilotCommand } from "../commands/autopilot.js";
import { boardCommand } from "../commands/board.js";
import { briefsCommand } from "../commands/briefs.js";
import { CheckSpecStrictError, checkSpecCommand } from "../commands/check-spec.js";
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
import { VERSION } from "../version.js";
import { formatCliError } from "./error-formatter.js";
import { collectGlobalOptions } from "./global-options.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("impcom")
    .description("AI-driven development task orchestration CLI")
    .version(VERSION)
    .option("--file <path>", "Path to a task store file")
    .option("--tag <tag>", "Task tag/context to use")
    .option("--no-banner", "Suppress startup banner")
    .showHelpAfterError()
    .action(async () => {
      console.log(await tuiCommand({ interactive: Boolean(process.stdin.isTTY) }));
    });

  program
    .command("prd")
    .description("Build a PRD from an idea and structured answers")
    .option("--idea <idea>", "One-line product or feature idea")
    .option("--title <title>", "PRD title")
    .option("--template <template>", "simple or complex", "complex")
    .option("--answers <file>", "JSON answers file for batch mode")
    .option("--resume", "Resume saved PRD interview state")
    .option("--output <path>", "Spec output path")
    .option("--max-rounds <count>", "Maximum interview rounds", Number.parseInt)
    .option("--research", "Use research role for AI-assisted questions")
    .option("--chain", "Print next-step chain hint")
    .action(async (options: Parameters<typeof prdCommand>[0]) => {
      console.log(await prdCommand(options));
    });

  program
    .command("check-spec")
    .description("Check a spec for readiness before parsing")
    .argument("[specFile]", "Specification file path")
    .option("--input <path>", "Specification file path")
    .option("--threshold <score>", "Readiness threshold", Number.parseInt)
    .option("--report [path]", "Write a markdown readiness report")
    .option("--strict", "Throw when readiness blocks CI")
    .action(
      async (
        specFile: string | undefined,
        options: {
          input?: string;
          threshold?: number;
          report?: string | boolean;
          strict?: boolean;
        },
      ) => {
        const globalOptions = collectGlobalOptions(program);
        try {
          console.log(
            await checkSpecCommand({
              ...options,
              input: options.input ?? specFile,
              file: globalOptions.file,
              tag: globalOptions.tag,
            }),
          );
        } catch (error) {
          if (error instanceof CheckSpecStrictError) {
            process.exitCode = 1;
          }
          throw error;
        }
      },
    );

  program
    .command("autopilot")
    .description("Run the offline autonomous TDD workflow for one task")
    .option("--id <id>", "Task id")
    .option("--prompt <prompt>", "Additional implementation prompt")
    .option("--dry-run", "Plan and persist state without marking the task done")
    .option("--project <path>", "Project root for autopilot state")
    .option("--state-file <path>", "Explicit state file")
    .action(async (options: Parameters<typeof autopilotCommand>[0]) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(
        await autopilotCommand({
          ...options,
          file: globalOptions.file,
          tag: globalOptions.tag,
        }),
      );
    });

  program
    .command("loop")
    .description("Run an offline autonomous task loop")
    .option("--iterations <count>", "Iteration count", Number.parseInt)
    .option("--prompt <preset-or-file>", "Prompt preset or custom file", "default")
    .option("--progress-file <path>", "Progress log path")
    .option("--project <path>", "Project root")
    .option("--sandbox", "Require sandbox auth before running")
    .option("--no-output", "Suppress assistant output")
    .option("--verbose", "Print verbose progress")
    .action(async (options: Parameters<typeof loopCommand>[0]) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(
        await loopCommand({
          ...options,
          file: globalOptions.file,
          tag: globalOptions.tag,
        }),
      );
    });

  const auth = program.command("auth").description("Manage offline cloud credentials");
  auth
    .command("login")
    .option("--token <token>", "Token for remote/SSH login")
    .option("--endpoint <url>", "Cloud endpoint")
    .option("--workspace <id>", "Workspace id")
    .action(async (options: Parameters<typeof authCommand>[1]) => {
      console.log(await authCommand("login", options));
    });
  auth.command("logout").action(async () => {
    console.log(await authCommand("logout"));
  });
  auth.command("status").action(async () => {
    console.log(await authCommand("status"));
  });
  auth.command("refresh").action(async () => {
    console.log(await authCommand("refresh"));
  });

  program
    .command("login")
    .description("Alias for auth login")
    .option("--token <token>", "Token for remote/SSH login")
    .option("--endpoint <url>", "Cloud endpoint")
    .option("--workspace <id>", "Workspace id")
    .action(async (options: Parameters<typeof authCommand>[1]) => {
      console.log(await authCommand("login", options));
    });

  program
    .command("logout")
    .description("Alias for auth logout")
    .action(async () => {
      console.log(await authCommand("logout"));
    });

  const context = program.command("context").description("Manage active cloud org and brief");
  context.action(async () => {
    console.log(await contextCommand("show"));
  });
  context
    .command("org")
    .argument("[org]", "Org id")
    .action(async (org?: string) => {
      console.log(await contextCommand("org", { org }));
    });
  context
    .command("brief")
    .argument("[brief]", "Brief id or URL")
    .action(async (brief?: string) => {
      console.log(await contextCommand("brief", { brief }));
    });
  context
    .command("set")
    .option("--org <org>", "Org id")
    .option("--brief <brief>", "Brief id or URL")
    .option("--no-header", "Suppress header")
    .action(async (options: Parameters<typeof contextCommand>[1]) => {
      console.log(await contextCommand("set", options));
    });
  context.command("clear").action(async () => {
    console.log(await contextCommand("clear"));
  });

  const briefs = program.command("briefs").alias("brief").description("List and select briefs");
  briefs.action(async () => {
    console.log(await briefsCommand("list"));
  });
  briefs.command("list").action(async () => {
    console.log(await briefsCommand("list"));
  });
  briefs
    .command("select")
    .argument("[id]", "Brief id")
    .action(async (id?: string) => {
      console.log(await briefsCommand("select", { id }));
    });
  briefs
    .command("create")
    .option("--title <title>", "Brief title")
    .action(async (options: Parameters<typeof briefsCommand>[1]) => {
      console.log(await briefsCommand("create", options));
    });

  program
    .command("tui")
    .alias("repl")
    .description("Open the interactive shell fallback")
    .action(async () => {
      console.log(await tuiCommand({ interactive: Boolean(process.stdin.isTTY) }));
    });

  program
    .command("init")
    .description("Scaffold Imperial Commander project configuration")
    .option("--name <name>", "Project name")
    .option("--description <description>", "Project description")
    .option("--dry-run", "Print intended actions without writing files")
    .option("--store-tasks-in-vcs", "Track task files in version control")
    .option("--no-store-tasks-in-vcs", "Ignore task files from version control")
    .action(
      async (options: {
        name?: string;
        description?: string;
        dryRun?: boolean;
        storeTasksInVcs?: boolean;
      }) => {
        const result = await runInitCommand({
          name: options.name,
          description: options.description,
          dryRun: options.dryRun,
          storeTasksInVcs: options.storeTasksInVcs,
          log: (message) => console.log(message),
        });

        if (!result.dryRun) {
          console.log(`Initialized ${result.projectRoot}`);
        }
      },
    );

  program
    .command("analyze-complexity")
    .description("Re-assess task complexity and write it onto the tasks")
    .option("--threshold <score>", "Expansion threshold", Number.parseInt)
    .option("--id <csv>", "Comma-separated task ids")
    .option("--from <id>", "Start id", Number.parseInt)
    .option("--to <id>", "End id", Number.parseInt)
    .action(async (options: { threshold?: number; id?: string; from?: number; to?: number }) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(
        await analyzeComplexityCommand({
          ...options,
          file: globalOptions.file,
          tag: globalOptions.tag,
        }),
      );
    });

  program
    .command("complexity-report")
    .description("View the current complexity report")
    .option("--output <path>", "Report path")
    .action(async (options: { output?: string }) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(
        await complexityReportCommand({
          output: options.output,
          file: globalOptions.file,
          tag: globalOptions.tag,
        }),
      );
    });

  program
    .command("generate")
    .description("Generate per-task files")
    .option("--output <dir>", "Output directory")
    .option("--format <format>", "text or json", "text")
    .action(async (options: { output?: string; format?: "text" | "json" }) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(
        await generateCommand({
          ...options,
          file: globalOptions.file,
          tag: globalOptions.tag,
        }),
      );
    });

  program
    .command("sync-readme")
    .description("Sync current task list into README")
    .option("--readme <path>", "README path")
    .option("--with-subtasks", "Include subtasks")
    .option("--status <status>", "Filter by status")
    .action(
      async (options: {
        readme?: string;
        withSubtasks?: boolean;
        status?: "pending" | "done" | "in-progress" | "review" | "deferred" | "cancelled";
      }) => {
        const globalOptions = collectGlobalOptions(program);
        console.log(
          await syncReadmeCommand({
            ...options,
            file: globalOptions.file,
            tag: globalOptions.tag,
          }),
        );
      },
    );

  program
    .command("board")
    .description("Start the local visualization server or print board/graph data")
    .option("--host <host>", "Host to bind", "127.0.0.1")
    .option("--port <port>", "Port to bind", Number.parseInt)
    .option("--read-only", "Disable server-side writes")
    .option("--no-open", "Do not open a browser")
    .option("--view <view>", "server, board, or graph", "server")
    .option("--json", "Print JSON data")
    .action(async (options: Parameters<typeof boardCommand>[0]) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(
        await boardCommand({
          ...options,
          file: globalOptions.file,
          tag: globalOptions.tag,
        }),
      );
    });

  program
    .command("roadmap")
    .description("Summarize roadmap milestones")
    .option("--json", "Print JSON")
    .action(async (options: Parameters<typeof roadmapCommand>[0]) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(
        await roadmapCommand({
          ...options,
          file: globalOptions.file,
          tag: globalOptions.tag,
        }),
      );
    });

  program
    .command("watch")
    .description("Watch task/spec files and run a local action")
    .option("--spec-file <path>", "Optional spec/docs file to watch")
    .option("--debounce-ms <ms>", "Debounce window", Number.parseInt)
    .option("--on-change <action>", "generate, sync-readme, or validate-deps")
    .option("--once", "Run the on-change action once and exit")
    .action(async (options: Parameters<typeof watchCommand>[0]) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(
        await watchCommand({
          ...options,
          file: globalOptions.file,
          tag: globalOptions.tag,
        }),
      );
    });

  program
    .command("sync")
    .description("Run local external-sync adapter skeleton")
    .option("--provider <provider>", "github, linear, jira, gitlab, or local", "local")
    .option("--dry-run", "Plan only")
    .option("--write", "Write local sync mappings")
    .option("--json", "Print JSON")
    .action(async (options: Parameters<typeof syncCommand>[0]) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(
        await syncCommand({
          ...options,
          file: globalOptions.file,
          tag: globalOptions.tag,
        }),
      );
    });

  program
    .command("notifications")
    .description("Prepare a local notification/webhook event")
    .option("--type <type>", "Notification event type")
    .option("--id <id>", "Event id")
    .option("--file-sink <path>", "Append event JSON to a local file")
    .option("--webhook <url>", "Webhook URL skeleton target")
    .option("--signing-secret-env <name>", "Env var containing signing secret")
    .option("--json", "Print JSON")
    .action(async (options: Parameters<typeof notificationsCommand>[0]) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(await notificationsCommand({ ...options, tag: globalOptions.tag }));
    });

  program
    .command("history")
    .description("List audit history entries")
    .option("--operation <operation>", "Filter by operation")
    .option("--id <id>", "Filter by task id")
    .option("--limit <count>", "Maximum entries", Number.parseInt)
    .action(async (options: Parameters<typeof historyCommand>[0]) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(
        await historyCommand({
          ...options,
          file: globalOptions.file,
          tag: globalOptions.tag,
        }),
      );
    });

  program
    .command("undo")
    .description("Undo the most recent reversible history entry")
    .option("--entry <id>", "Specific history entry id")
    .action(async (options: Parameters<typeof undoCommand>[0]) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(
        await undoCommand({
          ...options,
          file: globalOptions.file,
          tag: globalOptions.tag,
        }),
      );
    });

  program
    .command("models")
    .description("View or update model configuration")
    .option("--set-main <model>", "Set main model")
    .option("--set-research <model>", "Set research model")
    .option("--set-fallback <model>", "Set fallback model")
    .option("--provider <provider>", "Explicit provider")
    .option("--baseURL <url>", "Provider base URL")
    .option("--local-runtime", "Use local runtime provider")
    .option("--openai-compatible", "Use OpenAI-compatible provider")
    .option("--azure", "Use Azure provider")
    .option("--bedrock", "Use Bedrock provider")
    .option("--vertex", "Use Vertex provider")
    .option("--local-cli", "Use local CLI/OAuth runtime")
    .action(async (options: Parameters<typeof modelsCommand>[0]) => {
      console.log(await modelsCommand(options));
    });

  program
    .command("lang")
    .description("View or set response language")
    .option("--response <language>", "Response language")
    .action(async (options: Parameters<typeof langCommand>[0]) => {
      console.log(await langCommand(options));
    });

  program
    .command("add-tag")
    .description("Create a task tag")
    .argument("<tag>", "Tag name")
    .option("--description <description>", "Tag description")
    .option("--copy-from <tag>", "Copy tasks from another tag")
    .option("--copy-from-current", "Copy tasks from the current tag")
    .option("--from-branch <branch>", "Derive tag name from branch")
    .action(
      async (
        tag: string,
        options: {
          description?: string;
          copyFrom?: string;
          copyFromCurrent?: boolean;
          fromBranch?: string;
        },
      ) => {
        const globalOptions = collectGlobalOptions(program);
        console.log(
          await addTagCommand(tag, {
            ...options,
            file: globalOptions.file,
            tag: globalOptions.tag,
          }),
        );
      },
    );

  program
    .command("use-tag")
    .description("Switch the current tag")
    .argument("<tag>", "Tag name")
    .action(async (tag: string) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(await useTagCommand(tag, { file: globalOptions.file }));
    });

  program
    .command("list-tags")
    .description("List task tags")
    .option("--show-metadata", "Show metadata")
    .action(async (options: { showMetadata?: boolean }) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(
        await listTagsCommand({
          file: globalOptions.file,
          showMetadata: options.showMetadata,
        }),
      );
    });

  program
    .command("rename-tag")
    .description("Rename a tag")
    .argument("<from>", "Current tag")
    .argument("<to>", "New tag")
    .action(async (from: string, to: string) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(await renameTagCommand(from, to, { file: globalOptions.file }));
    });

  program
    .command("copy-tag")
    .description("Copy a tag")
    .argument("<from>", "Source tag")
    .argument("<to>", "Target tag")
    .option("--description <description>", "New description")
    .action(async (from: string, to: string, options: { description?: string }) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(
        await copyTagCommand(from, to, {
          file: globalOptions.file,
          description: options.description,
        }),
      );
    });

  program
    .command("delete-tag")
    .description("Delete a tag")
    .argument("<tag>", "Tag name")
    .option("--yes", "Confirm deletion")
    .action(async (tag: string, options: { yes?: boolean }) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(await deleteTagCommand(tag, { file: globalOptions.file, yes: options.yes }));
    });

  program
    .command("research")
    .description("Run a research query with project context")
    .argument("<query>", "Research query")
    .option("--detail <level>", "low, medium, or high", "medium")
    .option("--ids <csv>", "Task ids to include as context")
    .option("--files <csv>", "Files to include as context")
    .option("--context <text>", "Custom context")
    .option("--tree", "Include project tree context")
    .option("--save-to <id>", "Append result to a task or subtask")
    .option("--save-file", "Save result as markdown")
    .action(async (query: string, options: Parameters<typeof researchCommand>[1]) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(
        await researchCommand(query, {
          ...options,
          file: globalOptions.file,
          tag: globalOptions.tag,
        }),
      );
    });

  program
    .command("expand")
    .description("Expand a task into subtasks")
    .requiredOption("--id <id>", "Task id")
    .option("--num <count>", "Subtask count", Number.parseInt)
    .option("--prompt <prompt>", "Expansion prompt")
    .option("--force", "Replace existing subtasks")
    .action(
      async (options: {
        id: string;
        num?: number;
        prompt?: string;
        force?: boolean;
      }) => {
        const globalOptions = collectGlobalOptions(program);
        console.log(
          await expandCommand({
            ...options,
            file: globalOptions.file,
            tag: globalOptions.tag,
          }),
        );
      },
    );

  program
    .command("expand-all")
    .description("Expand all pending tasks")
    .option("--num <count>", "Subtask count", Number.parseInt)
    .option("--prompt <prompt>", "Expansion prompt")
    .option("--force", "Replace existing subtasks")
    .action(
      async (options: {
        num?: number;
        prompt?: string;
        force?: boolean;
      }) => {
        const globalOptions = collectGlobalOptions(program);
        console.log(
          await expandAllCommand({
            ...options,
            file: globalOptions.file,
            tag: globalOptions.tag,
          }),
        );
      },
    );

  program
    .command("add-task")
    .description("Add a task manually or from an AI prompt")
    .option("--title <title>", "Task title")
    .option("--description <description>", "Task description")
    .option("--details <details>", "Task implementation details")
    .option("--test-strategy <strategy>", "Task test strategy")
    .option("--dependencies <csv>", "Comma-separated dependency ids")
    .option("--priority <priority>", "Override the assessed priority (high, medium, low)")
    .option("--prompt <prompt>", "AI generation prompt")
    .option("--research", "Use research role for AI generation")
    .action(
      async (options: {
        title?: string;
        description?: string;
        details?: string;
        testStrategy?: string;
        dependencies?: string;
        priority?: "high" | "medium" | "low";
        prompt?: string;
        research?: boolean;
      }) => {
        const globalOptions = collectGlobalOptions(program);
        console.log(
          await addTaskCommand({ ...options, file: globalOptions.file, tag: globalOptions.tag }),
        );
      },
    );

  program
    .command("search")
    .alias("find")
    .alias("query")
    .description("Search and filter tasks")
    .argument("[query]", "Search query")
    .option("--status <status>", "Filter by status")
    .option("--priority <priority>", "Filter by priority")
    .option("--ready", "Only tasks with satisfied dependencies")
    .option("--blocked", "Only tasks with unsatisfied dependencies")
    .option("--has-subtasks", "Only tasks with subtasks")
    .option("--no-subtasks", "Only tasks without subtasks")
    .option("--all-tags", "Search across all tags")
    .option("--limit <count>", "Maximum results", Number.parseInt)
    .option("--sort <field>", "id, priority, status, or title")
    .option("--json", "Print agent-friendly JSON")
    .action(
      async (
        query: string | undefined,
        options: NonNullable<Parameters<typeof searchCommand>[0]> = {},
      ) => {
        const globalOptions = collectGlobalOptions(program);
        console.log(
          await searchCommand({
            ...options,
            query: query ?? options.query,
            file: globalOptions.file,
            tag: globalOptions.tag,
          }),
        );
      },
    );

  program
    .command("export")
    .description("Export tasks and progress reports")
    .option("--format <format>", "markdown, json, csv, or board", "markdown")
    .option("--output <path>", "Write export to path")
    .option("--all-tags", "Export all tags")
    .option("--json", "Print agent-friendly JSON envelope")
    .action(async (options: Parameters<typeof exportCommand>[0]) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(
        await exportCommand({
          ...options,
          file: globalOptions.file,
          tag: globalOptions.tag,
        }),
      );
    });

  program
    .command("list")
    .description("List tasks")
    .action(async () => {
      const options = collectGlobalOptions(program);
      console.log(await listTasksCommand({ file: options.file, tag: options.tag }));
    });

  program
    .command("show")
    .description("Show task detail")
    .argument("<id>", "Task id")
    .action(async (id: string) => {
      const options = collectGlobalOptions(program);
      console.log(await showTaskCommand(id, { file: options.file, tag: options.tag }));
    });

  program
    .command("set-status")
    .description("Set task status")
    .argument("<id>", "Task id")
    .argument("<status>", "Task status")
    .action(
      async (
        id: string,
        status: "pending" | "done" | "in-progress" | "review" | "deferred" | "cancelled",
      ) => {
        const options = collectGlobalOptions(program);
        console.log(await setStatusCommand(id, status, { file: options.file, tag: options.tag }));
      },
    );

  program
    .command("next")
    .description("Show the next actionable task")
    .action(async () => {
      const options = collectGlobalOptions(program);
      console.log(await nextTaskCommand({ file: options.file, tag: options.tag }));
    });

  program
    .command("update")
    .description("Bulk update tasks from an id")
    .requiredOption("--prompt <prompt>", "Update prompt")
    .option("--from <id>", "Starting numeric task id", Number.parseInt)
    .option("--id <id>", "Invalid for bulk update; use update-task")
    .action(async (options: { prompt: string; from?: number; id?: string }) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(
        await updateCommand({
          file: globalOptions.file,
          tag: globalOptions.tag,
          prompt: options.prompt,
          from: options.from,
          id: options.id,
        }),
      );
    });

  program
    .command("update-task")
    .description("Update one task")
    .argument("<id>", "Task id")
    .requiredOption("--prompt <prompt>", "Update prompt")
    .option("--append", "Append timestamped note")
    .action(async (id: string, options: { prompt: string; append?: boolean }) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(
        await updateTaskCommand(id, {
          file: globalOptions.file,
          tag: globalOptions.tag,
          prompt: options.prompt,
          append: options.append,
        }),
      );
    });

  program
    .command("update-subtask")
    .description("Append a note to one subtask")
    .argument("<id>", "Dotted subtask id")
    .requiredOption("--prompt <prompt>", "Update prompt")
    .action(async (id: string, options: { prompt: string }) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(
        await updateSubtaskCommand(id, {
          file: globalOptions.file,
          tag: globalOptions.tag,
          prompt: options.prompt,
        }),
      );
    });

  program
    .command("add-subtask")
    .description("Add a subtask")
    .requiredOption("--parent <id>", "Parent task id")
    .option("--title <title>", "Subtask title")
    .option("--existing-task-id <id>", "Convert existing task to subtask")
    .option("--description <description>", "Subtask description")
    .option("--details <details>", "Subtask details")
    .option("--status <status>", "Subtask status")
    .option("--dependencies <csv>", "Subtask dependencies")
    .action(async (options: Parameters<typeof addSubtaskCommand>[0]) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(
        await addSubtaskCommand({ ...options, file: globalOptions.file, tag: globalOptions.tag }),
      );
    });

  program
    .command("remove-subtask")
    .description("Remove a subtask")
    .argument("<id>", "Dotted subtask id")
    .option("--convert", "Promote removed subtask to standalone task")
    .action(async (id: string, options: { convert?: boolean }) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(
        await removeSubtaskCommand(id, {
          file: globalOptions.file,
          tag: globalOptions.tag,
          convert: options.convert,
        }),
      );
    });

  program
    .command("remove-task")
    .description("Remove one or more tasks")
    .requiredOption("--id <csv>", "Comma-separated task ids")
    .option("--yes", "Confirm deletion")
    .action(async (options: { id: string; yes?: boolean }) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(
        await removeTaskCommand(options.id, {
          file: globalOptions.file,
          tag: globalOptions.tag,
          yes: options.yes,
        }),
      );
    });

  program
    .command("clear-subtasks")
    .description("Clear subtasks from tasks")
    .option("--id <csv>", "Comma-separated task ids")
    .option("--all", "Clear all subtasks")
    .action(async (options: { id?: string; all?: boolean }) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(
        await clearSubtasksCommand({
          file: globalOptions.file,
          tag: globalOptions.tag,
          ids: options.id,
          all: options.all,
        }),
      );
    });

  program
    .command("move")
    .description("Move or reorder a task")
    .requiredOption("--from <id>", "Source task id")
    .option("--to <id>", "Target task id to insert before")
    .option("--from-tag <tag>", "Source tag")
    .option("--to-tag <tag>", "Target tag")
    .option("--before <id>", "Insert before task id")
    .option("--after <id>", "Insert after task id")
    .action(async (options: Parameters<typeof moveCommand>[0]) => {
      const globalOptions = collectGlobalOptions(program);
      console.log(
        await moveCommand({ ...options, file: globalOptions.file, tag: globalOptions.tag }),
      );
    });

  program
    .command("scope-up")
    .description("Increase detail/scope for tasks")
    .requiredOption("--id <csv>", "Comma-separated task ids")
    .option("--strength <strength>", "light, regular, or heavy", "regular")
    .option("--prompt <prompt>", "Custom scope prompt")
    .action(
      async (options: {
        id: string;
        strength?: "light" | "regular" | "heavy";
        prompt?: string;
      }) => {
        const globalOptions = collectGlobalOptions(program);
        console.log(
          await scopeCommand("up", {
            ...options,
            file: globalOptions.file,
            tag: globalOptions.tag,
          }),
        );
      },
    );

  program
    .command("scope-down")
    .description("Decrease detail/scope for tasks")
    .requiredOption("--id <csv>", "Comma-separated task ids")
    .option("--strength <strength>", "light, regular, or heavy", "regular")
    .option("--prompt <prompt>", "Custom scope prompt")
    .action(
      async (options: {
        id: string;
        strength?: "light" | "regular" | "heavy";
        prompt?: string;
      }) => {
        const globalOptions = collectGlobalOptions(program);
        console.log(
          await scopeCommand("down", {
            ...options,
            file: globalOptions.file,
            tag: globalOptions.tag,
          }),
        );
      },
    );

  program
    .command("add-dependency")
    .description("Add a task dependency")
    .argument("<id>", "Task id")
    .argument("<dependsOn>", "Dependency task id")
    .action(async (id: string, dependsOn: string) => {
      const options = collectGlobalOptions(program);
      console.log(
        await addDependencyCommand(id, dependsOn, { file: options.file, tag: options.tag }),
      );
    });

  program
    .command("remove-dependency")
    .description("Remove a task dependency")
    .argument("<id>", "Task id")
    .argument("<dependsOn>", "Dependency task id")
    .action(async (id: string, dependsOn: string) => {
      const options = collectGlobalOptions(program);
      console.log(
        await removeDependencyCommand(id, dependsOn, { file: options.file, tag: options.tag }),
      );
    });

  program
    .command("validate-dependencies")
    .description("Validate task dependencies")
    .action(async () => {
      const options = collectGlobalOptions(program);
      console.log(await validateDependenciesCommand({ file: options.file, tag: options.tag }));
    });

  program
    .command("fix-dependencies")
    .description("Remove invalid dependency references")
    .action(async () => {
      const options = collectGlobalOptions(program);
      console.log(await fixDependenciesCommand({ file: options.file, tag: options.tag }));
    });

  program
    .command("parse-spec")
    .description("Parse a specification into tasks")
    .argument("<specFile>", "Specification file path")
    .option("--append", "Append generated tasks")
    .option("--force", "Overwrite existing tasks")
    .option("--num-tasks <count>", "Maximum number of tasks", Number.parseInt)
    .action(
      async (
        specFile: string,
        options: { append?: boolean; force?: boolean; numTasks?: number },
      ) => {
        const globalOptions = collectGlobalOptions(program);
        console.log(
          await parseSpecCommand(specFile, {
            file: globalOptions.file,
            tag: globalOptions.tag,
            append: options.append,
            force: options.force,
            numTasks: options.numTasks,
          }),
        );
      },
    );

  program
    .command("health")
    .description("Print a CLI health check")
    .action(() => {
      collectGlobalOptions(program);
      console.log("ok");
    });

  program.exitOverride();
  program.configureOutput({
    outputError: (message, write) => {
      write(formatCliError(message));
    },
  });

  return program;
}

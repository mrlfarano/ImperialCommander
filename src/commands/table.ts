import { TaskPrioritySchema, TaskStatusSchema } from "../schemas/index.js";
import { FileTaskRepository } from "../storage/index.js";
import { type FormatTaskTableOptions, formatTaskTable } from "../table/format-table.js";
import { type BuildTaskTableOptions, buildTaskTable } from "../table/task-table.js";
import type { TaskCommandOptions } from "./tasks.js";

const SORT_FIELDS = ["id", "priority", "status", "title", "complexity"] as const;
const GROUP_FIELDS = ["status", "priority", "complexity", "tag"] as const;
const FORMATS = ["pretty", "json", "csv", "markdown"] as const;

export interface TableCommandOptions extends TaskCommandOptions {
  query?: string;
  status?: string;
  priority?: string;
  ready?: boolean;
  blocked?: boolean;
  hasSubtasks?: boolean;
  noSubtasks?: boolean;
  allTags?: boolean;
  limit?: number;
  minComplexity?: number;
  sort?: string;
  groupBy?: string;
  format?: string;
  json?: boolean;
  color?: boolean;
  wide?: boolean;
}

export async function tableCommand(options: TableCommandOptions = {}): Promise<string> {
  const { build, format } = parseTableOptions(options);
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const data = await buildTaskTable(repository, { ...build, tag: options.tag });
  return formatTaskTable(data, format);
}

export function parseTableOptions(options: TableCommandOptions): {
  build: BuildTaskTableOptions;
  format: FormatTaskTableOptions;
} {
  if (options.ready && options.blocked) {
    throw new Error("Use either --ready or --blocked, not both.");
  }
  if (options.hasSubtasks && options.noSubtasks) {
    throw new Error("Use either --has-subtasks or --no-subtasks, not both.");
  }

  const status = options.status ? TaskStatusSchema.safeParse(options.status) : undefined;
  if (status && !status.success) {
    throw new Error(
      "Invalid --status. Use pending, in-progress, review, done, deferred, or cancelled.",
    );
  }
  const priority = options.priority ? TaskPrioritySchema.safeParse(options.priority) : undefined;
  if (priority && !priority.success) {
    throw new Error("Invalid --priority. Use high, medium, or low.");
  }
  const sort = parseEnum(options.sort, SORT_FIELDS, "--sort");
  const groupBy = parseEnum(options.groupBy, GROUP_FIELDS, "--group-by");
  const format = options.json
    ? "json"
    : (parseEnum(options.format, FORMATS, "--format") ?? "pretty");

  return {
    build: {
      query: options.query,
      status: status?.success ? status.data : undefined,
      priority: priority?.success ? priority.data : undefined,
      readiness: options.ready ? "ready" : options.blocked ? "blocked" : undefined,
      hasSubtasks: options.hasSubtasks ? true : options.noSubtasks ? false : undefined,
      allTags: options.allTags,
      limit: options.limit,
      minComplexity: options.minComplexity,
      sort,
      groupBy,
    },
    format: { format, color: options.color, wide: options.wide },
  };
}

function parseEnum<T extends readonly string[]>(
  value: string | undefined,
  allowed: T,
  flag: string,
): T[number] | undefined {
  if (!value) {
    return undefined;
  }
  if ((allowed as readonly string[]).includes(value)) {
    return value as T[number];
  }
  throw new Error(`Invalid ${flag}. Use ${allowed.join(", ")}.`);
}

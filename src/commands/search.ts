import { TaskPrioritySchema, TaskStatusSchema } from "../schemas/index.js";
import { renderSearchResults, searchTasks } from "../search/search.js";
import { FileTaskRepository } from "../storage/index.js";
import type { TaskCommandOptions } from "./tasks.js";

const searchSortFields = ["id", "priority", "status", "title"] as const;

export interface SearchCommandOptions extends TaskCommandOptions {
  query?: string;
  status?: string;
  priority?: string;
  ready?: boolean;
  blocked?: boolean;
  hasSubtasks?: boolean;
  noSubtasks?: boolean;
  allTags?: boolean;
  limit?: number;
  sort?: "id" | "priority" | "status" | "title";
  json?: boolean;
}

export async function searchCommand(options: SearchCommandOptions = {}): Promise<string> {
  if (options.ready && options.blocked) {
    throw new Error("Use either --ready or --blocked, not both.");
  }
  if (options.hasSubtasks && options.noSubtasks) {
    throw new Error("Use either --has-subtasks or --no-subtasks, not both.");
  }

  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const status = options.status
    ? TaskStatusSchema.safeParse(options.status)
    : { success: true as const, data: undefined };
  const priority = options.priority
    ? TaskPrioritySchema.safeParse(options.priority)
    : { success: true as const, data: undefined };
  const sort = parseSort(options.sort);

  if (!status.success) {
    throw new Error(
      "Invalid --status. Use pending, in-progress, review, done, deferred, or cancelled.",
    );
  }
  if (!priority.success) {
    throw new Error("Invalid --priority. Use high, medium, or low.");
  }

  const results = await searchTasks(repository, {
    query: options.query,
    status: status.data,
    priority: priority.data,
    readiness: options.ready ? "ready" : options.blocked ? "blocked" : undefined,
    hasSubtasks: options.hasSubtasks ? true : options.noSubtasks ? false : undefined,
    allTags: options.allTags,
    tag: options.tag,
    limit: options.limit,
    sort,
  });

  if (options.json) {
    return `${JSON.stringify(results, null, 2)}`;
  }
  return renderSearchResults(results);
}

function parseSort(sort: SearchCommandOptions["sort"]): SearchCommandOptions["sort"] {
  if (!sort) {
    return undefined;
  }
  if (searchSortFields.includes(sort)) {
    return sort;
  }
  throw new Error("Invalid --sort. Use id, priority, status, or title.");
}

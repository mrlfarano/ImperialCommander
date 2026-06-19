import type { Task, TaskPriority, TaskStatus } from "../schemas/index.js";
import type { TaskRepository } from "../storage/index.js";

export interface SearchFilters {
  query?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  readiness?: "ready" | "blocked";
  hasSubtasks?: boolean;
}

export interface SearchOptions extends SearchFilters {
  tag?: string;
  allTags?: boolean;
  limit?: number;
  sort?: "id" | "priority" | "status" | "title";
}

export interface SearchResult {
  task: Task;
  tag: string;
  score: number;
  highlights: string[];
}

const priorityWeight: Record<TaskPriority, number> = { high: 3, medium: 2, low: 1 };

export async function searchTasks(
  repository: TaskRepository,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  const tags = options.allTags ? await repository.listTags() : [options.tag ?? "master"];
  const results: SearchResult[] = [];

  for (const tag of tags) {
    const tasks = await repository.findAll({ tag });
    const completed = new Set(
      tasks.filter((task) => task.status === "done").map((task) => String(task.id)),
    );

    for (const task of tasks) {
      if (!matchesFilters(task, completed, options)) {
        continue;
      }

      const match = matchQuery(task, options.query);
      if (!match.matched) {
        continue;
      }

      results.push({ task, tag, score: match.score, highlights: match.highlights });
    }
  }

  return sortResults(results, options.sort).slice(0, options.limit ?? results.length);
}

export function renderSearchResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return "No matches.";
  }

  return results
    .map((result) => {
      const highlight =
        result.highlights.length > 0 ? ` match:${result.highlights.join(", ")}` : "";
      return `${String(result.task.id)} [${result.task.status}] (${result.task.priority}) ${result.task.title} tag:${result.tag}${highlight}`;
    })
    .join("\n");
}

function matchesFilters(task: Task, completed: Set<string>, options: SearchOptions): boolean {
  if (options.status && task.status !== options.status) {
    return false;
  }
  if (options.priority && task.priority !== options.priority) {
    return false;
  }
  if (options.hasSubtasks !== undefined && task.subtasks.length > 0 !== options.hasSubtasks) {
    return false;
  }
  if (options.readiness) {
    const ready = task.dependencies.every((dependency) => completed.has(String(dependency)));
    if (options.readiness === "ready" && !ready) {
      return false;
    }
    if (options.readiness === "blocked" && ready) {
      return false;
    }
  }
  return true;
}

function matchQuery(
  task: Task,
  query?: string,
): { matched: boolean; score: number; highlights: string[] } {
  if (!query?.trim()) {
    return { matched: true, score: 0, highlights: [] };
  }

  const needle = normalize(query);
  const fields = [
    task.title,
    task.description,
    task.details,
    task.testStrategy,
    ...task.subtasks.map((subtask) => `${subtask.title} ${subtask.description} ${subtask.details}`),
  ];
  let best = 0;
  const highlights: string[] = [];

  for (const field of fields) {
    const haystack = normalize(field);
    const score = haystack.includes(needle) ? 100 : fuzzyScore(needle, haystack);
    if (score > 0) {
      highlights.push(highlight(field, query));
    }
    best = Math.max(best, score);
  }

  return { matched: best > 0, score: best, highlights: highlights.slice(0, 3) };
}

function fuzzyScore(needle: string, haystack: string): number {
  let index = 0;
  for (const char of haystack) {
    if (char === needle[index]) {
      index += 1;
    }
    if (index === needle.length) {
      return Math.max(1, 80 - (haystack.length - needle.length));
    }
  }
  return 0;
}

function sortResults(results: SearchResult[], sort: SearchOptions["sort"]): SearchResult[] {
  return [...results].sort((left, right) => {
    if (sort === "priority") {
      return priorityWeight[right.task.priority] - priorityWeight[left.task.priority];
    }
    if (sort === "status") {
      return left.task.status.localeCompare(right.task.status);
    }
    if (sort === "title") {
      return left.task.title.localeCompare(right.task.title);
    }
    if (sort === "id") {
      return String(left.task.id).localeCompare(String(right.task.id), undefined, {
        numeric: true,
      });
    }
    return (
      right.score - left.score ||
      String(left.task.id).localeCompare(String(right.task.id), undefined, { numeric: true })
    );
  });
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function highlight(value: string, query: string): string {
  return value.replace(new RegExp(escapeRegExp(query), "ig"), (match) => `[${match}]`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

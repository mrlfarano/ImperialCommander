import type { Task } from "../schemas/index.js";
import type { TaskRepository } from "../storage/index.js";

export interface RoadmapGroup {
  milestone: string;
  derived: boolean;
  total: number;
  done: number;
  completionPercent: number;
  ready: number;
  blocked: number;
  tasks: Array<{
    id: Task["id"];
    title: string;
    status: Task["status"];
    priority: Task["priority"];
  }>;
}

export async function buildRoadmap(
  repository: TaskRepository,
  options: { tag?: string } = {},
): Promise<RoadmapGroup[]> {
  const tasks = await repository.findAll({ tag: options.tag });
  const completed = new Set(
    tasks.filter((task) => task.status === "done").map((task) => String(task.id)),
  );
  const depthById = calculateDependencyDepths(tasks);
  const groups = new Map<string, { derived: boolean; tasks: Task[] }>();

  for (const task of tasks) {
    const milestone = readMilestone(task);
    const key = milestone ?? `Phase ${String((depthById.get(String(task.id)) ?? 0) + 1)}`;
    const existing = groups.get(key) ?? { derived: milestone === undefined, tasks: [] };
    existing.derived = existing.derived && milestone === undefined;
    existing.tasks.push(task);
    groups.set(key, existing);
  }

  return Array.from(groups.entries()).map(([milestone, group]) => {
    const done = group.tasks.filter((task) => task.status === "done").length;
    const ready = group.tasks.filter((task) =>
      task.dependencies.every((dependency) => completed.has(String(dependency))),
    ).length;

    return {
      milestone,
      derived: group.derived,
      total: group.tasks.length,
      done,
      completionPercent:
        group.tasks.length === 0 ? 0 : Math.round((done / group.tasks.length) * 100),
      ready,
      blocked: group.tasks.length - ready,
      tasks: group.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
      })),
    };
  });
}

function readMilestone(task: Task): string | undefined {
  const metadata = task.metadata ?? {};
  const milestone = metadata.milestone ?? metadata.phase;
  return typeof milestone === "string" && milestone.trim() ? milestone : undefined;
}

function calculateDependencyDepths(tasks: Task[]): Map<string, number> {
  const byId = new Map(tasks.map((task) => [String(task.id), task]));
  const memo = new Map<string, number>();

  const depth = (task: Task, seen: Set<string>): number => {
    const key = String(task.id);
    const existing = memo.get(key);

    if (existing !== undefined) {
      return existing;
    }

    if (seen.has(key)) {
      return 0;
    }

    const nextSeen = new Set(seen).add(key);
    const value =
      task.dependencies.length === 0
        ? 0
        : 1 +
          Math.max(
            ...task.dependencies.map((dependency) => {
              const dependencyTask = byId.get(String(dependency));
              return dependencyTask ? depth(dependencyTask, nextSeen) : 0;
            }),
          );
    memo.set(key, value);
    return value;
  };

  for (const task of tasks) {
    depth(task, new Set());
  }

  return memo;
}

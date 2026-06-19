import type { Task, TaskStatus } from "../schemas/index.js";
import { TASK_STATUSES } from "../schemas/status.js";
import type { TaskRepository } from "../storage/index.js";
import { validateDependencies } from "../tasks/dependencies.js";
import { findNextTask } from "../tasks/lifecycle.js";

export interface BoardColumn {
  status: TaskStatus;
  tasks: BoardCard[];
}

export interface BoardCard {
  id: Task["id"];
  title: string;
  priority: Task["priority"];
  status: TaskStatus;
  ready: boolean;
  subtaskProgress: { done: number; total: number };
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  issues: Array<{ taskId: Task["id"]; dependencyId: Task["id"]; type: string }>;
  nextTaskId?: Task["id"];
  criticalPath: Array<Task["id"]>;
}

export interface GraphNode {
  id: string;
  taskId: Task["id"];
  label: string;
  status: TaskStatus;
  priority: Task["priority"];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

export async function buildBoardData(
  repository: TaskRepository,
  options: { tag?: string; status?: TaskStatus; priority?: Task["priority"] } = {},
): Promise<{ columns: BoardColumn[] }> {
  const tasks = await repository.findAll({ tag: options.tag });
  const completed = new Set(
    tasks.filter((task) => task.status === "done").map((task) => String(task.id)),
  );
  const cards = tasks
    .filter((task) => !options.status || task.status === options.status)
    .filter((task) => !options.priority || task.priority === options.priority)
    .map((task) => toBoardCard(task, completed));

  return {
    columns: TASK_STATUSES.map((status) => ({
      status,
      tasks: cards.filter((card) => card.status === status),
    })),
  };
}

export async function buildGraphData(
  repository: TaskRepository,
  options: { tag?: string; includeSubtasks?: boolean } = {},
): Promise<GraphData> {
  const tasks = await repository.findAll({ tag: options.tag });
  const issues = await validateDependencies(repository, { tag: options.tag });
  const next = await findNextTask(repository, { tag: options.tag });
  const nodes: GraphNode[] = tasks.flatMap((task) => [
    toGraphNode(task),
    ...(options.includeSubtasks
      ? task.subtasks.map((subtask) => ({
          id: `${String(task.id)}.${String(subtask.id)}`,
          taskId: `${String(task.id)}.${String(subtask.id)}`,
          label: subtask.title,
          status: subtask.status,
          priority: task.priority,
        }))
      : []),
  ]);
  const edges = tasks.flatMap((task) =>
    task.dependencies.map((dependency) => ({
      id: `${String(dependency)}->${String(task.id)}`,
      source: String(dependency),
      target: String(task.id),
    })),
  );

  return {
    nodes,
    edges,
    issues,
    nextTaskId: next?.task.id,
    criticalPath: deriveCriticalPath(tasks, next?.task.id),
  };
}

function toBoardCard(task: Task, completed: Set<string>): BoardCard {
  return {
    id: task.id,
    title: task.title,
    priority: task.priority,
    status: task.status,
    ready: task.dependencies.every((dependency) => completed.has(String(dependency))),
    subtaskProgress: {
      done: task.subtasks.filter((subtask) => subtask.status === "done").length,
      total: task.subtasks.length,
    },
  };
}

function toGraphNode(task: Task): GraphNode {
  return {
    id: String(task.id),
    taskId: task.id,
    label: task.title,
    status: task.status,
    priority: task.priority,
  };
}

function deriveCriticalPath(tasks: Task[], seed?: Task["id"]): Array<Task["id"]> {
  const byId = new Map(tasks.map((task) => [String(task.id), task]));
  const path: Array<Task["id"]> = [];
  let cursor = seed ? byId.get(String(seed)) : tasks.find((task) => task.status !== "done");

  while (cursor && !path.some((id) => String(id) === String(cursor?.id))) {
    path.unshift(cursor.id);
    cursor = cursor.dependencies
      .map((dependency) => byId.get(String(dependency)))
      .find((task): task is Task => task !== undefined);
  }

  return path;
}

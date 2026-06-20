import { readFile } from "node:fs/promises";
import { type TaskAssessor, assessMany } from "../analysis/assess.js";
import type { Task } from "../schemas/index.js";
import type { TaskRepository } from "../storage/index.js";

export interface ParseSpecOptions {
  append?: boolean;
  force?: boolean;
  numTasks?: number;
  tag?: string;
  assessor?: TaskAssessor;
}

export interface ParseSpecResult {
  tasks: Task[];
  appended: boolean;
  overwritten: boolean;
}

export async function parseSpecFile(
  repository: TaskRepository,
  filePath: string,
  options: ParseSpecOptions = {},
): Promise<ParseSpecResult> {
  const contents = await readFile(filePath, "utf8");
  return parseSpecText(repository, contents, options);
}

export async function parseSpecText(
  repository: TaskRepository,
  contents: string,
  options: ParseSpecOptions = {},
): Promise<ParseSpecResult> {
  const existing = await repository.findAll({ tag: options.tag });

  if (existing.length > 0 && !options.append && !options.force) {
    throw new Error("Task store already contains tasks. Use append or force to continue.");
  }

  const nextId = options.force && !options.append ? 1 : nextNumericId(existing);
  const seeds = extractTaskSeeds(contents)
    .slice(0, options.numTasks)
    .map((seed, index) => taskFromSeed(nextId + index, seed));
  const assessments = await assessMany(
    options.assessor,
    seeds.map((task) => ({
      title: task.title,
      description: task.description,
      details: task.details,
      dependencies: task.dependencies,
    })),
  );
  const generated = seeds.map((task, index) => ({
    ...task,
    priority: assessments[index].priority,
    complexity: assessments[index].complexity,
  }));

  if (!options.append && options.force) {
    for (const task of [...existing].reverse()) {
      await repository.delete(task.id, { tag: options.tag });
    }
  }

  for (const task of generated) {
    await repository.create(task, { tag: options.tag });
  }

  return {
    tasks: generated,
    appended: options.append === true,
    overwritten: existing.length > 0 && options.force === true && options.append !== true,
  };
}

function extractTaskSeeds(contents: string): string[] {
  const candidates = contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /^[-*]\s+/.test(line) || /^#{2,4}\s+/.test(line))
    .map((line) =>
      line
        .replace(/^[-*]\s+/, "")
        .replace(/^#{2,4}\s+/, "")
        .trim(),
    )
    .filter((line) => !/^requirements?$/i.test(line) && !/^goals?$/i.test(line));

  if (candidates.length > 0) {
    return candidates;
  }

  const fallback = contents
    .trim()
    .split(/\n\s*\n/)
    .find(Boolean)
    ?.trim();
  return fallback ? [fallback] : ["Review specification"];
}

function taskFromSeed(id: number, seed: string): Task {
  const title = seed.length > 80 ? `${seed.slice(0, 77)}...` : seed;

  return {
    id,
    title,
    description: seed,
    details: `Implement: ${seed}`,
    testStrategy: `Verify ${title}`,
    status: "pending",
    priority: "medium",
    dependencies: id === 1 ? [] : [id - 1],
    subtasks: [],
  };
}

function nextNumericId(tasks: Task[]): number {
  const numericIds = tasks
    .map((task) => task.id)
    .filter((id): id is number => typeof id === "number");

  return numericIds.length === 0 ? 1 : Math.max(...numericIds) + 1;
}

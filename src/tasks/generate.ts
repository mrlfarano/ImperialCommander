import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Task } from "../schemas/index.js";
import type { TaskRepository } from "../storage/index.js";
import { toYaml } from "./yaml.js";

export interface GenerateOptions {
  outputDir: string;
  tag?: string;
}

export interface GenerateResult {
  tasks: number;
  removed: number;
  outputDir: string;
  file: string;
}

const GENERATED_FILE = "tasks.generated.yaml";
const legacyPrefix = "task_";

export async function generateTaskFiles(
  repository: TaskRepository,
  options: GenerateOptions,
): Promise<GenerateResult> {
  const tasks = await repository.findAll({ tag: options.tag });
  await mkdir(options.outputDir, { recursive: true });

  const document = toYaml({ tag: options.tag ?? "master", tasks });
  await writeFile(join(options.outputDir, GENERATED_FILE), document, "utf8");

  let removed = 0;
  for (const file of await readdir(options.outputDir)) {
    if (file.startsWith(legacyPrefix)) {
      await rm(join(options.outputDir, file), { force: true });
      removed += 1;
    }
  }

  return { tasks: tasks.length, removed, outputDir: options.outputDir, file: GENERATED_FILE };
}

export async function syncReadme(
  repository: TaskRepository,
  readmePath: string,
  options: { tag?: string; withSubtasks?: boolean; status?: Task["status"] } = {},
): Promise<void> {
  const tasks = (await repository.findAll({ tag: options.tag })).filter(
    (task) => !options.status || task.status === options.status,
  );
  const block = renderReadmeBlock(tasks, options);
  const existing = await readOptional(readmePath);
  const next = replaceGeneratedBlock(existing ?? "# Tasks\n", block);
  await writeFile(readmePath, next, "utf8");
}

function renderReadmeBlock(
  tasks: Task[],
  options: { tag?: string; withSubtasks?: boolean },
): string {
  const lines = [
    "<!-- imperial-commander:start -->",
    `## Imperial Commander Tasks (${options.tag ?? "master"})`,
    ...tasks.map(
      (task) => `- [${task.status === "done" ? "x" : " "}] ${String(task.id)} ${task.title}`,
    ),
  ];

  if (options.withSubtasks) {
    for (const task of tasks) {
      for (const subtask of task.subtasks) {
        lines.push(
          `  - [${subtask.status === "done" ? "x" : " "}] ${String(task.id)}.${String(subtask.id)} ${subtask.title}`,
        );
      }
    }
  }

  lines.push("<!-- imperial-commander:end -->");
  return `${lines.join("\n")}\n`;
}

function replaceGeneratedBlock(existing: string, block: string): string {
  const pattern = /<!-- imperial-commander:start -->[\s\S]*?<!-- imperial-commander:end -->\n?/;
  if (pattern.test(existing)) {
    return existing.replace(pattern, block);
  }
  return `${existing.trimEnd()}\n\n${block}`;
}

async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

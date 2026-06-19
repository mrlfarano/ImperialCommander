import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { FileTaskRepository } from "../storage/index.js";
import { findNextTask, setTaskStatus } from "../tasks/lifecycle.js";

export interface LoopCommandOptions {
  file?: string;
  tag?: string;
  iterations?: number;
  prompt?: string;
  progressFile?: string;
  project?: string;
  sandbox?: boolean;
  output?: boolean;
  verbose?: boolean;
}

const presetIterations: Record<string, number> = {
  default: 1,
  careful: 1,
  aggressive: 3,
};

export async function loopCommand(options: LoopCommandOptions = {}): Promise<string> {
  if (options.sandbox && process.env.IMPERIAL_SANDBOX_AUTH !== "ok") {
    throw new Error("Sandbox auth is required. Set IMPERIAL_SANDBOX_AUTH=ok or omit --sandbox.");
  }

  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const pending = (await repository.findAll({ tag: options.tag })).filter(
    (task) => task.status === "pending",
  );
  const prompt = await resolvePrompt(options.prompt);
  const iterations = deriveIterations(options.iterations, prompt.name, pending.length);
  const progressFile =
    options.progressFile ??
    join(options.project ?? process.cwd(), ".imperial", "loop-progress.log");
  const completed: string[] = [];

  for (let index = 0; index < iterations; index += 1) {
    const next = await findNextTask(repository, { tag: options.tag });
    if (!next) {
      break;
    }
    await setTaskStatus(repository, next.task.id, "done", { tag: options.tag });
    completed.push(String(next.task.id));
    await appendProgress(
      progressFile,
      `iteration=${index + 1} task=${String(next.task.id)} preset=${prompt.name}`,
    );
  }

  const preview =
    prompt.name === "default" && pending[0]
      ? `Next: ${String(pending[0].id)} ${pending[0].title}`
      : "Next preview skipped.";

  return [
    `Loop complete: ${completed.length}/${iterations} iterations finished.`,
    `Prompt: ${prompt.name}`,
    preview,
    `Tasks: ${completed.join(", ") || "none"}`,
    `Progress: ${progressFile}`,
  ].join("\n");
}

export function deriveIterations(
  explicit: number | undefined,
  promptName: string,
  pendingCount: number,
): number {
  if (explicit !== undefined) {
    return Math.max(0, explicit);
  }
  return Math.min(pendingCount, presetIterations[promptName] ?? presetIterations.default);
}

async function resolvePrompt(input: string | undefined): Promise<{ name: string; body: string }> {
  if (!input || input in presetIterations) {
    const name = input ?? "default";
    return { name, body: `${name} autonomous task loop` };
  }

  const body = await readFile(input, "utf8");
  return { name: "custom", body };
}

async function appendProgress(path: string, line: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const entry = `${new Date().toISOString()} ${line}\n`;
  try {
    const existing = await readFile(path, "utf8");
    await writeFile(path, `${existing}${entry}`, "utf8");
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      await writeFile(path, entry, "utf8");
      return;
    }
    throw error;
  }
}

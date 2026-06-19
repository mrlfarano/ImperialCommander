import { appendAutopilotState, resolveAutopilotStatePath } from "../autonomy/persistence.js";
import { createAutopilotPlan } from "../autonomy/state-machine.js";
import type { Task } from "../schemas/index.js";
import { FileTaskRepository } from "../storage/index.js";
import { findNextTask, setTaskStatus } from "../tasks/lifecycle.js";

export interface AutopilotCommandOptions {
  file?: string;
  tag?: string;
  id?: string;
  prompt?: string;
  dryRun?: boolean;
  project?: string;
  stateFile?: string;
}

export async function autopilotCommand(options: AutopilotCommandOptions = {}): Promise<string> {
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const task = options.id
    ? await repository.findById(parseCommandId(options.id), { tag: options.tag })
    : (await findNextTask(repository, { tag: options.tag }))?.task;

  if (!task) {
    return "Autopilot: no actionable task found.";
  }

  const plan = createAutopilotPlan(task, options.prompt);
  const stateFile = options.stateFile ?? resolveAutopilotStatePath(options.project);
  const status = options.dryRun ? "planned" : "passed";

  await appendAutopilotState(stateFile, {
    taskId: plan.taskId,
    phase: "commit",
    status,
    steps: plan.steps,
    commitMessage: plan.commitMessage,
    updatedAt: new Date().toISOString(),
  });

  if (!options.dryRun) {
    await setTaskStatus(repository, task.id, "done", { tag: options.tag });
  }

  return [
    `Autopilot ${status} for task ${plan.taskId}: ${plan.title}`,
    `Phases: ${plan.phases.join(" -> ")}`,
    ...plan.steps.map((step) => `- ${step}`),
    `Commit: ${plan.commitMessage}`,
    `State: ${stateFile}`,
  ].join("\n");
}

function parseCommandId(id: string): Task["id"] {
  const numeric = Number(id);
  return Number.isInteger(numeric) && numeric > 0 && String(numeric) === id ? numeric : id;
}

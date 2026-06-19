import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { type ProjectPathOptions, resolveRuntimeStatePath } from "../config/paths.js";

const DEFAULT_TAG = "master";

const runtimeStateSchema = z
  .object({
    currentTag: z.string().min(1),
    lastSwitched: z.string().datetime(),
    migrationNoticeShown: z.boolean(),
    branchTagMapping: z.record(z.string()),
  })
  .strict();

export type RuntimeState = z.infer<typeof runtimeStateSchema>;
export type RuntimeStateUpdate = Partial<RuntimeState>;

export interface RuntimeStateOptions extends ProjectPathOptions {
  now?: Date;
}

export function createDefaultRuntimeState(now = new Date()): RuntimeState {
  return {
    currentTag: DEFAULT_TAG,
    lastSwitched: now.toISOString(),
    migrationNoticeShown: false,
    branchTagMapping: {},
  };
}

export async function getRuntimeState(options: RuntimeStateOptions = {}): Promise<RuntimeState> {
  const statePath = resolveRuntimeStatePath(options);

  try {
    const contents = await readFile(statePath, "utf8");
    return runtimeStateSchema.parse(JSON.parse(contents));
  } catch (error) {
    if (isNodeFileError(error, "ENOENT")) {
      const state = createDefaultRuntimeState(options.now);
      await writeRuntimeStateFile(statePath, state);
      return state;
    }

    throw error;
  }
}

export async function setRuntimeState(
  state: RuntimeState,
  options: RuntimeStateOptions = {},
): Promise<RuntimeState> {
  const parsed = runtimeStateSchema.parse(state);
  await writeRuntimeStateFile(resolveRuntimeStatePath(options), parsed);
  return parsed;
}

export async function updateRuntimeState(
  update: RuntimeStateUpdate | ((current: RuntimeState) => RuntimeStateUpdate),
  options: RuntimeStateOptions = {},
): Promise<RuntimeState> {
  const current = await getRuntimeState(options);
  const nextUpdate = typeof update === "function" ? update(current) : update;
  const next = runtimeStateSchema.parse({ ...current, ...nextUpdate });

  await writeRuntimeStateFile(resolveRuntimeStatePath(options), next);
  return next;
}

async function writeRuntimeStateFile(statePath: string, state: RuntimeState): Promise<void> {
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function isNodeFileError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}

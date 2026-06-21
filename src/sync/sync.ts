import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { type ProjectPathOptions, resolveProjectConfigDir } from "../config/paths.js";
import type { TaskRepository } from "../storage/index.js";
import {
  type SyncAdapterOptions,
  type SyncCommandRunner,
  type SyncProviderName,
  type SyncScope,
  createSyncAdapter,
  filterTasksForSync,
} from "./adapters.js";

export type { SyncCommandRunner, SyncProviderName, SyncScope } from "./adapters.js";

export interface SyncOptions extends ProjectPathOptions, SyncAdapterOptions {
  provider: SyncProviderName;
  tag?: string;
  dryRun?: boolean;
  mappingPath?: string;
}

export interface SyncMapping {
  provider: SyncProviderName;
  taskId: string;
  externalId: string;
  url?: string;
  lastSyncedAt: string;
}

export interface SyncResult {
  provider: SyncProviderName;
  dryRun: boolean;
  pushed: number;
  pulled: number;
  linked: number;
  mappings: SyncMapping[];
}

export async function runExternalSync(
  repository: TaskRepository,
  options: SyncOptions,
): Promise<SyncResult> {
  const adapter = createSyncAdapter(options.provider, options);
  const scope = options.scope ?? (options.provider === "hermes-kanban" ? "open" : "all");
  const tasks = filterTasksForSync(await repository.findAll({ tag: options.tag }), scope);
  const existing = await readMappings(options);
  const mappings = [...existing];
  const now = new Date().toISOString();
  const taskIdToExternalId = new Map<string, string>();

  for (const task of tasks) {
    const item = await adapter.push(task);
    const taskId = String(task.id);
    taskIdToExternalId.set(taskId, item.externalId);
    const next: SyncMapping = {
      provider: options.provider,
      taskId,
      externalId: item.externalId,
      url: item.url,
      lastSyncedAt: now,
    };
    const index = mappings.findIndex(
      (mapping) => mapping.provider === next.provider && mapping.taskId === next.taskId,
    );

    if (index === -1) {
      mappings.push(next);
    } else {
      mappings[index] = next;
    }
  }

  const linked = (await adapter.linkDependencies?.(tasks, taskIdToExternalId)) ?? 0;
  const pulled = await adapter.pull();

  if (!options.dryRun) {
    await writeMappings(mappings, options);
  }

  return {
    provider: options.provider,
    dryRun: options.dryRun ?? true,
    pushed: tasks.length,
    pulled: pulled.length,
    linked,
    mappings,
  };
}

export function resolveSyncMappingPath(options: SyncOptions): string {
  return options.mappingPath ?? join(resolveProjectConfigDir(options), "sync-mappings.json");
}

async function readMappings(options: SyncOptions): Promise<SyncMapping[]> {
  try {
    const parsed = JSON.parse(await readFile(resolveSyncMappingPath(options), "utf8"));
    return Array.isArray(parsed) ? parsed.filter(isSyncMapping) : [];
  } catch {
    return [];
  }
}

async function writeMappings(mappings: SyncMapping[], options: SyncOptions): Promise<void> {
  const path = resolveSyncMappingPath(options);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(mappings, null, 2)}\n`, "utf8");
}

function isSyncMapping(value: unknown): value is SyncMapping {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as SyncMapping).provider === "string" &&
    typeof (value as SyncMapping).taskId === "string" &&
    typeof (value as SyncMapping).externalId === "string"
  );
}

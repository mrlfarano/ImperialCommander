import type { Task } from "../schemas/index.js";

export type SyncProviderName = "github" | "linear" | "jira" | "gitlab" | "local";

export interface ExternalSyncItem {
  externalId: string;
  title: string;
  status: string;
  url?: string;
}

export interface SyncAdapter {
  provider: SyncProviderName;
  dryRun: boolean;
  push(task: Task): Promise<ExternalSyncItem>;
  pull(): Promise<ExternalSyncItem[]>;
}

export function createSyncAdapter(provider: SyncProviderName, dryRun = true): SyncAdapter {
  return new LocalSkeletonSyncAdapter(provider, dryRun);
}

class LocalSkeletonSyncAdapter implements SyncAdapter {
  constructor(
    readonly provider: SyncProviderName,
    readonly dryRun: boolean,
  ) {}

  async push(task: Task): Promise<ExternalSyncItem> {
    return {
      externalId: `${this.provider}-${String(task.id)}`,
      title: task.title,
      status: task.status,
      url: `local://${this.provider}/${String(task.id)}`,
    };
  }

  async pull(): Promise<ExternalSyncItem[]> {
    return [];
  }
}

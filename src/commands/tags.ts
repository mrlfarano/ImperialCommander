import {
  addTag,
  copyTag,
  deleteTagWithConfirm,
  listTagMetrics,
  renameTag,
  useTag,
} from "../tasks/tags.js";
import type { TaskCommandOptions } from "./tasks.js";

export async function addTagCommand(
  tag: string,
  options: TaskCommandOptions & {
    description?: string;
    copyFrom?: string;
    copyFromCurrent?: boolean;
    fromBranch?: string;
  } = {},
): Promise<string> {
  const created = await addTag(tag, {
    storePath: options.file,
    currentTag: options.tag,
    description: options.description,
    copyFrom: options.copyFrom,
    copyFromCurrent: options.copyFromCurrent,
    fromBranch: options.fromBranch,
  });
  return `Created tag ${created}.`;
}

export async function useTagCommand(
  tag: string,
  options: TaskCommandOptions = {},
): Promise<string> {
  await useTag(tag, { storePath: options.file });
  return `Using tag ${tag}.`;
}

export async function listTagsCommand(
  options: TaskCommandOptions & { showMetadata?: boolean } = {},
): Promise<string> {
  const metrics = await listTagMetrics({ storePath: options.file });

  if (metrics.length === 0) {
    return "No tags found.";
  }

  return metrics
    .map((metric) => {
      const base = `${metric.tag}: ${metric.taskCount} tasks, ${metric.completionPercent}% done, ${metric.readyCount} ready`;
      return options.showMetadata
        ? `${base} (${metric.description || "no description"}) created:${metric.created}`
        : base;
    })
    .join("\n");
}

export async function renameTagCommand(
  from: string,
  to: string,
  options: TaskCommandOptions = {},
): Promise<string> {
  await renameTag(from, to, { storePath: options.file });
  return `Renamed tag ${from} to ${to}.`;
}

export async function copyTagCommand(
  from: string,
  to: string,
  options: TaskCommandOptions & { description?: string } = {},
): Promise<string> {
  await copyTag(from, to, { storePath: options.file, description: options.description });
  return `Copied tag ${from} to ${to}.`;
}

export async function deleteTagCommand(
  tag: string,
  options: TaskCommandOptions & { yes?: boolean } = {},
): Promise<string> {
  const deleted = await deleteTagWithConfirm(tag, { storePath: options.file, yes: options.yes });
  return deleted ? `Deleted tag ${tag}.` : `Tag ${tag} not found.`;
}

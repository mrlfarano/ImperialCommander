import { buildRoadmap } from "../roadmap/roadmap.js";
import { FileTaskRepository } from "../storage/index.js";
import type { TaskCommandOptions } from "./tasks.js";

export interface RoadmapCommandOptions extends TaskCommandOptions {
  json?: boolean;
}

export async function roadmapCommand(options: RoadmapCommandOptions = {}): Promise<string> {
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const groups = await buildRoadmap(repository, { tag: options.tag });

  if (options.json) {
    return JSON.stringify({ groups }, null, 2);
  }

  if (groups.length === 0) {
    return "No roadmap tasks found.";
  }

  return groups
    .map(
      (group) =>
        `${group.milestone}${group.derived ? " (derived)" : ""}: ${group.done}/${group.total} done (${group.completionPercent}%), ready ${group.ready}, blocked ${group.blocked}`,
    )
    .join("\n");
}

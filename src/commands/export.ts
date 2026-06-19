import { type ExportFormat, exportTasks } from "../export/export.js";
import { FileTaskRepository } from "../storage/index.js";
import type { TaskCommandOptions } from "./tasks.js";

const exportFormats = ["markdown", "json", "csv", "board"] as const;

export interface ExportCommandOptions extends TaskCommandOptions {
  format?: ExportFormat;
  output?: string;
  allTags?: boolean;
  json?: boolean;
}

export async function exportCommand(options: ExportCommandOptions = {}): Promise<string> {
  const repository = new FileTaskRepository({ storePath: options.file, currentTag: options.tag });
  const format = parseFormat(options.format);
  const result = await exportTasks(repository, {
    format,
    output: options.output,
    allTags: options.allTags,
    tag: options.tag,
  });

  if (options.json) {
    return JSON.stringify(result, null, 2);
  }

  if (result.output) {
    return `Wrote ${result.format} export: ${result.output}`;
  }

  return result.content;
}

function parseFormat(format: ExportCommandOptions["format"]): ExportFormat | undefined {
  if (!format) {
    return undefined;
  }
  if (exportFormats.includes(format)) {
    return format;
  }
  throw new Error("Invalid --format. Use markdown, json, csv, or board.");
}

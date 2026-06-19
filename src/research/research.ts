import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AiTelemetryRecord } from "../ai/ai-service.js";
import { type ProjectPathOptions, resolveDocsDir } from "../config/paths.js";
import type { TaskRepository } from "../storage/index.js";
import { parseCommandId, parseCsvIds } from "../tasks/ids.js";
import { updateSubtask, updateTask } from "../tasks/update.js";

export interface ResearchOptions extends ProjectPathOptions {
  query: string;
  detail?: "low" | "medium" | "high";
  ids?: string;
  files?: string;
  customContext?: string;
  includeTree?: boolean;
  saveTo?: string;
  saveFile?: boolean;
  tag?: string;
  now?: Date;
  generator?: ResearchGenerator;
}

export interface ResearchContextItem {
  source: string;
  content: string;
}

export interface ResearchResult {
  query: string;
  result: string;
  detail: "low" | "medium" | "high";
  context: ResearchContextItem[];
  savedPath?: string;
  telemetryData?: AiTelemetryRecord;
}

export type ResearchGenerator = (input: {
  query: string;
  detail: "low" | "medium" | "high";
  context: ResearchContextItem[];
}) => Promise<{ text: string; telemetryData?: AiTelemetryRecord }>;

export async function runResearch(
  repository: TaskRepository,
  options: ResearchOptions,
): Promise<ResearchResult> {
  if (!options.query.trim()) {
    throw new Error("Research query is required.");
  }

  const detail = options.detail ?? "medium";
  const context = await gatherResearchContext(repository, options);
  const generated = options.generator
    ? await options.generator({ query: options.query, detail, context })
    : { text: deterministicResearch(options.query, detail, context) };
  const result = stripInternalReasoning(generated.text);
  const researchResult: ResearchResult = {
    query: options.query,
    result,
    detail,
    context,
    telemetryData: generated.telemetryData,
  };

  if (options.saveTo) {
    await saveResearchToTask(repository, options.saveTo, result, options);
  }

  if (options.saveFile) {
    researchResult.savedPath = await saveResearchMarkdown(researchResult, options);
  }

  return researchResult;
}

export async function gatherResearchContext(
  repository: TaskRepository,
  options: ResearchOptions,
): Promise<ResearchContextItem[]> {
  const context: ResearchContextItem[] = [];

  for (const id of parseCsvIds(options.ids)) {
    const task = await repository.findById(id, { tag: options.tag });
    if (task) {
      context.push({
        source: `task:${String(task.id)}`,
        content: `${task.title}\n${task.description}\n${task.details}`,
      });
    }
  }

  for (const file of parseFileList(options.files)) {
    context.push({ source: `file:${file}`, content: await readFile(file, "utf8") });
  }

  if (options.customContext) {
    context.push({ source: "custom", content: options.customContext });
  }

  if (options.includeTree) {
    context.push({ source: "tree", content: "Project tree context requested." });
  }

  return context;
}

export function stripInternalReasoning(text: string): string {
  return text.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "").trim();
}

async function saveResearchToTask(
  repository: TaskRepository,
  id: string,
  result: string,
  options: ResearchOptions,
): Promise<void> {
  if (id.includes(".")) {
    await updateSubtask(repository, id, {
      prompt: formatResearchThread(options.query, result),
      tag: options.tag,
      now: options.now,
    });
    return;
  }

  await updateTask(repository, parseCommandId(id), {
    prompt: formatResearchThread(options.query, result),
    append: true,
    tag: options.tag,
    now: options.now,
  });
}

async function saveResearchMarkdown(
  result: ResearchResult,
  options: ResearchOptions,
): Promise<string> {
  const date = (options.now ?? new Date()).toISOString().slice(0, 10);
  const dir = join(resolveDocsDir(options), "research");
  const path = join(dir, `${date}_${slug(result.query)}.md`);
  await mkdir(dir, { recursive: true });
  await writeFile(
    path,
    `---\nquery: ${JSON.stringify(result.query)}\ndetail: ${result.detail}\n---\n\n# Research\n\n${result.result}\n`,
    "utf8",
  );
  return path;
}

function deterministicResearch(
  query: string,
  detail: "low" | "medium" | "high",
  context: ResearchContextItem[],
): string {
  return `Research (${detail}) for "${query}" using ${context.length} context items.`;
}

function formatResearchThread(query: string, result: string): string {
  return `Research query: ${query}\n\n${result}`;
}

function parseFileList(files: string | undefined): string[] {
  return files
    ? files
        .split(",")
        .map((file) => file.trim())
        .filter(Boolean)
    : [];
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "research"
  );
}

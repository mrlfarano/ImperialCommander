import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { defaultConfig } from "../config/config-manager.js";
import {
  DEFAULT_CONFIG_DIR_NAME,
  resolveProjectConfigDir,
  resolveProjectConfigPath,
} from "../config/paths.js";
import { createDefaultRuntimeState, setRuntimeState } from "../state/runtime-state.js";

export interface InitCommandOptions {
  projectRoot?: string;
  name?: string;
  description?: string;
  dryRun?: boolean;
  storeTasksInVcs?: boolean;
  forceInitGit?: boolean;
  skipGit?: boolean;
  hermesKanban?: boolean;
  hermesKanbanBoard?: string;
  hermesKanbanAutoSync?: boolean;
  now?: Date;
  log?: (message: string) => void;
}

export interface InitResult {
  projectRoot: string;
  actions: string[];
  created: string[];
  skipped: string[];
  dryRun: boolean;
}

const gitignoreHeader = "# Imperial Commander";

const taskTrackedIgnoreEntries = [".env", "dist/", "coverage/"];
const taskUntrackedIgnoreEntries = [
  ...taskTrackedIgnoreEntries,
  `${DEFAULT_CONFIG_DIR_NAME}/tasks/`,
  `${DEFAULT_CONFIG_DIR_NAME}/reports/`,
];

const simpleSpecTemplate = `# Project Specification

## Summary
Describe the feature or product you want to build.

## Goals
- Goal 1
- Goal 2

## Requirements
- Requirement 1
- Requirement 2
`;

const complexSpecTemplate = `# Product Requirements Document

## Problem

## Users

## Functional Requirements

## Non-Functional Requirements

## Milestones
`;

export async function runInitCommand(options: InitCommandOptions = {}): Promise<InitResult> {
  const projectRoot = options.projectRoot ?? process.cwd();
  const actions: string[] = [];
  const created: string[] = [];
  const skipped: string[] = [];
  const dryRun = options.dryRun === true;
  const log = options.log ?? (() => {});
  const configDir = resolveProjectConfigDir({ projectRoot });
  const projectName = options.name ?? "Imperial Commander Project";
  const projectDescription =
    options.description ?? "AI-driven development task orchestration project";

  async function createDirectory(path: string): Promise<void> {
    actions.push(`create directory ${path}`);
    if (!dryRun) {
      await mkdir(path, { recursive: true });
    }
    created.push(path);
  }

  async function writeFileIfMissing(path: string, contents: string): Promise<void> {
    if (await fileExists(path)) {
      skipped.push(path);
      actions.push(`skip existing file ${path}`);
      return;
    }

    actions.push(`write file ${path}`);
    if (!dryRun) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, contents, "utf8");
    }
    created.push(path);
  }

  for (const directory of [
    configDir,
    join(configDir, "tasks"),
    join(configDir, "docs"),
    join(configDir, "reports"),
    join(configDir, "templates"),
  ]) {
    await createDirectory(directory);
  }

  await writeFileIfMissing(
    resolveProjectConfigPath({ projectRoot }),
    `${JSON.stringify(buildInitialConfig(projectName, projectDescription, options), null, 2)}\n`,
  );

  if (!dryRun) {
    await setRuntimeState(createDefaultRuntimeState(options.now), { projectRoot });
  } else {
    actions.push("write runtime state");
  }

  await writeFileIfMissing(join(configDir, "templates", "spec-simple.md"), simpleSpecTemplate);
  await writeFileIfMissing(join(configDir, "templates", "spec-structured.md"), complexSpecTemplate);
  await writeFileIfMissing(join(projectRoot, ".env.example"), defaultEnvExample());
  await writeReadme(projectRoot, dryRun, actions, created, skipped);
  await mergeGitignore(projectRoot, options.storeTasksInVcs !== false, dryRun, actions, created);

  if (options.skipGit) {
    actions.push("skip git init");
  } else if (options.forceInitGit) {
    actions.push("git init requested");
  }

  for (const action of actions) {
    log(action);
  }

  return { projectRoot, actions, created, skipped, dryRun };
}

function defaultEnvExample(): string {
  return `# AI provider credentials are read from the environment, never project config.
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
`;
}

function buildInitialConfig(
  projectName: string,
  projectDescription: string,
  options: InitCommandOptions,
): typeof defaultConfig {
  const config = {
    ...defaultConfig,
    project: {
      ...defaultConfig.project,
      name: projectName,
      description: projectDescription,
    },
  };

  if (options.hermesKanban) {
    config.integrations = {
      ...defaultConfig.integrations,
      hermesKanban: {
        ...defaultConfig.integrations.hermesKanban,
        enabled: true,
        board: options.hermesKanbanBoard ?? slugify(projectName),
        scope: "open",
        autoSync: options.hermesKanbanAutoSync ?? true,
        assignee: null,
        goal: false,
      },
    };
  }

  return config;
}

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project"
  );
}

async function writeReadme(
  projectRoot: string,
  dryRun: boolean,
  actions: string[],
  created: string[],
  skipped: string[],
): Promise<void> {
  const readmePath = join(projectRoot, "README.md");
  const systemReadmePath = join(projectRoot, "IMPERIAL_COMMANDER.md");
  const target = (await fileExists(readmePath)) ? systemReadmePath : readmePath;

  if (await fileExists(target)) {
    skipped.push(target);
    actions.push(`skip existing file ${target}`);
    return;
  }

  actions.push(`write file ${target}`);
  if (!dryRun) {
    await writeFile(
      target,
      `# Imperial Commander

This project is configured for AI-driven task orchestration.
`,
      "utf8",
    );
  }
  created.push(target);
}

async function mergeGitignore(
  projectRoot: string,
  storeTasksInVcs: boolean,
  dryRun: boolean,
  actions: string[],
  created: string[],
): Promise<void> {
  const path = join(projectRoot, ".gitignore");
  const entries = storeTasksInVcs ? taskTrackedIgnoreEntries : taskUntrackedIgnoreEntries;
  const existing = (await readOptionalFile(path)) ?? "";
  const missing = entries.filter((entry) => !existing.includes(entry));

  if (missing.length === 0) {
    actions.push(`skip existing ignore entries ${path}`);
    return;
  }

  const block = `\n${gitignoreHeader}\n${missing.join("\n")}\n`;
  actions.push(`merge ignore entries ${path}`);

  if (!dryRun) {
    await writeFile(path, existing ? `${existing.trimEnd()}\n${block}` : block.trimStart(), "utf8");
  }
  created.push(path);
}

async function readOptionalFile(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isNodeFileError(error, "ENOENT")) {
      return undefined;
    }
    throw error;
  }
}

async function fileExists(path: string): Promise<boolean> {
  return (await readOptionalFile(path)) !== undefined;
}

function isNodeFileError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}

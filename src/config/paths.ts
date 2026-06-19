import { join } from "node:path";

export const DEFAULT_CONFIG_DIR_NAME = ".imperial-commander";
export const PROJECT_CONFIG_FILE_NAME = "config.json";
export const RUNTIME_STATE_FILE_NAME = "runtime-state.json";
export const REPORTS_DIR_NAME = "reports";
export const DOCS_DIR_NAME = "docs";

export interface ProjectPathOptions {
  projectRoot?: string;
  configDir?: string;
}

export function resolveProjectConfigDir(options: ProjectPathOptions = {}): string {
  return options.configDir ?? join(options.projectRoot ?? process.cwd(), DEFAULT_CONFIG_DIR_NAME);
}

export function resolveRuntimeStatePath(options: ProjectPathOptions = {}): string {
  return join(resolveProjectConfigDir(options), RUNTIME_STATE_FILE_NAME);
}

export function resolveProjectConfigPath(options: ProjectPathOptions = {}): string {
  return join(resolveProjectConfigDir(options), PROJECT_CONFIG_FILE_NAME);
}

export function resolveReportsDir(options: ProjectPathOptions = {}): string {
  return join(resolveProjectConfigDir(options), REPORTS_DIR_NAME);
}

export function resolveDocsDir(options: ProjectPathOptions = {}): string {
  return join(resolveProjectConfigDir(options), DOCS_DIR_NAME);
}

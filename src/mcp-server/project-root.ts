import { fileURLToPath } from "node:url";

export interface ProjectRootOptions {
  env?: NodeJS.ProcessEnv;
  args?: { projectRoot?: string };
  sessionRoot?: string;
}

export function resolveAgentProjectRoot(options: ProjectRootOptions = {}): string {
  const value =
    options.env?.IMPERIAL_PROJECT_ROOT ??
    process.env.IMPERIAL_PROJECT_ROOT ??
    options.args?.projectRoot ??
    options.sessionRoot;

  if (!value) {
    throw new Error("An absolute project root is required.");
  }

  const decoded = value.startsWith("file://") ? fileURLToPath(value) : decodeURIComponent(value);

  if (!decoded.startsWith("/")) {
    throw new Error(`Project root must be absolute: ${decoded}`);
  }

  return decoded;
}

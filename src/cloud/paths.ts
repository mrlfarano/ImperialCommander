import { homedir } from "node:os";
import { join } from "node:path";

export function resolveCloudStateDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.IMPERIAL_CLOUD_STATE_DIR ?? join(homedir(), ".imperial-commander");
}

export function resolveCredentialsPath(env: NodeJS.ProcessEnv = process.env): string {
  return join(resolveCloudStateDir(env), "credentials.json");
}

export function resolveContextPath(env: NodeJS.ProcessEnv = process.env): string {
  return join(resolveCloudStateDir(env), "context.json");
}

export function resolveApiStorePath(
  endpoint: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const slug = (endpoint ?? "offline")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return join(resolveCloudStateDir(env), "api-storage", `${slug || "offline"}.json`);
}

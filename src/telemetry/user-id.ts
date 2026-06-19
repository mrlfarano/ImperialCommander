import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface UserIdOptions {
  configDir?: string;
  userIdPath?: string;
  warn?: (message: string) => void;
}

export async function getOrCreateUserId(options: UserIdOptions = {}): Promise<string> {
  const userIdPath = resolveUserIdPath(options);

  try {
    const existing = (await readFile(userIdPath, "utf8")).trim();

    if (existing) {
      return existing;
    }
  } catch (error) {
    if (!isNodeFileError(error, "ENOENT")) {
      options.warn?.("Could not read telemetry user id; using in-memory id.");
      return randomUUID();
    }
  }

  const next = randomUUID();

  try {
    await mkdir(dirname(userIdPath), { recursive: true });
    await writeFile(userIdPath, `${next}\n`, "utf8");
  } catch {
    options.warn?.("Could not persist telemetry user id; using in-memory id.");
  }

  return next;
}

function resolveUserIdPath(options: UserIdOptions): string {
  return options.userIdPath ?? join(options.configDir ?? ".imperial-commander", "user-id");
}

function isNodeFileError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}

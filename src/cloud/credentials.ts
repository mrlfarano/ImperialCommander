import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { resolveCredentialsPath } from "./paths.js";

const CredentialSchema = z.object({
  token: z.string().min(1),
  endpoint: z.string().default("offline"),
  userId: z.string().default("local-user"),
  workspaceId: z.string().optional(),
  expiresAt: z.string().optional(),
  createdAt: z.string(),
});

export type CloudCredentials = z.infer<typeof CredentialSchema>;

export async function readCredentials(
  path = resolveCredentialsPath(),
): Promise<CloudCredentials | undefined> {
  try {
    return CredentialSchema.parse(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    if (isNotFound(error)) {
      return undefined;
    }
    throw error;
  }
}

export async function writeCredentials(
  credentials: Omit<CloudCredentials, "createdAt"> & { createdAt?: string },
  path = resolveCredentialsPath(),
): Promise<CloudCredentials> {
  const next = CredentialSchema.parse({
    ...credentials,
    createdAt: credentials.createdAt ?? new Date().toISOString(),
  });
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return next;
}

export async function clearCredentials(path = resolveCredentialsPath()): Promise<boolean> {
  try {
    await rm(path);
    return true;
  } catch (error) {
    if (isNotFound(error)) {
      return false;
    }
    throw error;
  }
}

export function hasValidCredentials(
  credentials: CloudCredentials | undefined,
  now = new Date(),
): boolean {
  if (!credentials) {
    return false;
  }
  return !credentials.expiresAt || new Date(credentials.expiresAt).getTime() > now.getTime();
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

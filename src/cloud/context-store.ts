import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { resolveContextPath } from "./paths.js";

const CloudContextSchema = z.object({
  orgId: z.string().optional(),
  briefId: z.string().optional(),
  updatedAt: z.string(),
});

export type CloudContext = z.infer<typeof CloudContextSchema>;

export async function readCloudContext(path = resolveContextPath()): Promise<CloudContext> {
  try {
    return CloudContextSchema.parse(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    if (isNotFound(error)) {
      return { updatedAt: new Date(0).toISOString() };
    }
    throw error;
  }
}

export async function writeCloudContext(
  context: Omit<CloudContext, "updatedAt"> & { updatedAt?: string },
  path = resolveContextPath(),
): Promise<CloudContext> {
  const next = CloudContextSchema.parse({
    ...context,
    updatedAt: context.updatedAt ?? new Date().toISOString(),
  });
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return next;
}

export async function clearCloudContext(path = resolveContextPath()): Promise<void> {
  try {
    await rm(path);
  } catch (error) {
    if (!isNotFound(error)) {
      throw error;
    }
  }
}

export function extractBriefId(input: string): string {
  try {
    const url = new URL(input);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.at(-1) ?? input;
  } catch {
    return input;
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

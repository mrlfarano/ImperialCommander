import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface AutopilotRunRecord {
  taskId: string;
  phase: string;
  status: "planned" | "running" | "passed" | "failed";
  steps: string[];
  commitMessage: string;
  updatedAt: string;
}

export function resolveAutopilotStatePath(projectRoot = process.cwd()): string {
  return join(projectRoot, ".imperial", "autopilot-state.json");
}

export async function readAutopilotState(path: string): Promise<AutopilotRunRecord[]> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    return Array.isArray(parsed.runs) ? parsed.runs : [];
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function appendAutopilotState(
  path: string,
  record: AutopilotRunRecord,
): Promise<void> {
  const runs = await readAutopilotState(path);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify({ runs: [...runs, record] }, null, 2)}\n`, "utf8");
}

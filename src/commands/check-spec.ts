import {
  type SpecReadiness,
  checkSpecReadiness,
  renderSpecReadinessMarkdown,
} from "../prd/check-spec.js";
import type { TaskCommandOptions } from "./tasks.js";

export class CheckSpecStrictError extends Error {
  constructor(readonly readiness: SpecReadiness) {
    super(`Spec readiness ${readiness.verdict}: ${readiness.overall}/10.`);
    this.name = "CheckSpecStrictError";
  }
}

export interface CheckSpecCommandOptions extends TaskCommandOptions {
  input?: string;
  threshold?: number;
  report?: string | boolean;
  strict?: boolean;
  projectRoot?: string;
  configDir?: string;
  scorer?: (contents: string) => Promise<SpecReadiness>;
}

export async function checkSpecCommand(options: CheckSpecCommandOptions = {}): Promise<string> {
  const result = await checkSpecReadiness(options);
  if (options.strict && result.readiness.verdict === "block") {
    throw new CheckSpecStrictError(result.readiness);
  }

  return [
    `Spec: ${result.input}`,
    renderSpecReadinessMarkdown(result.readiness).trim(),
    result.reportPath ? `Report: ${result.reportPath}` : undefined,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

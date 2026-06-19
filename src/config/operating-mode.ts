import type { ProjectConfig } from "./config-manager.js";

export type OperatingMode = "solo" | "team";

export interface OperatingModeOptions {
  explicitMode?: OperatingMode;
  authenticated?: boolean;
}

export function resolveOperatingMode(
  config: Pick<ProjectConfig, "storage">,
  options: OperatingModeOptions = {},
): OperatingMode {
  return (
    options.explicitMode ??
    config.storage.operatingMode ??
    (options.authenticated ? "team" : "solo")
  );
}

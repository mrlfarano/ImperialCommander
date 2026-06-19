import type { ProjectConfig } from "./config-manager.js";

export interface FeatureFlagOptions {
  processEnv?: NodeJS.ProcessEnv;
  sessionEnv?: Record<string, string | undefined>;
  activeProviderSupportsCodebaseAnalysis?: boolean;
}

export interface ResolvedFeatureFlags {
  enableCodebaseAnalysis: boolean;
  enableProxy: boolean;
}

export function resolveFeatureFlags(
  config: Pick<ProjectConfig, "featureFlags">,
  options: FeatureFlagOptions = {},
): ResolvedFeatureFlags {
  const enableCodebaseAnalysis =
    resolveBooleanOverride("IMPERIAL_ENABLE_CODEBASE_ANALYSIS", options) ??
    config.featureFlags.enableCodebaseAnalysis;
  const enableProxy =
    resolveBooleanOverride("IMPERIAL_ENABLE_PROXY", options) ?? config.featureFlags.enableProxy;

  return {
    enableCodebaseAnalysis:
      enableCodebaseAnalysis && options.activeProviderSupportsCodebaseAnalysis !== false,
    enableProxy,
  };
}

function resolveBooleanOverride(name: string, options: FeatureFlagOptions): boolean | undefined {
  const value = options.processEnv?.[name] ?? process.env[name] ?? options.sessionEnv?.[name];

  if (value === undefined) {
    return undefined;
  }

  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(value.toLowerCase())) {
    return false;
  }

  return undefined;
}

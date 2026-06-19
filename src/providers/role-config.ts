import {
  type ModelRole,
  assertModelRoleEligible,
  reconcileMaxTokens,
  resolveTemperature,
} from "../catalog/model-catalog.js";
import type { ProjectConfig } from "../config/config-manager.js";
import {
  type EnvResolverOptions,
  getProviderKeyStatus,
  resolveProviderSecret,
} from "../config/env-resolver.js";
import { type ProviderRuntime, hasUsableProvider, requireProviderDefinition } from "./registry.js";

export interface ResolvedRoleConfig {
  role: ModelRole;
  provider: string;
  modelId: string;
  maxTokens: number;
  temperature: number;
  baseURL?: string;
  apiKey?: string;
  runtime: ProviderRuntime;
}

export interface RoleResolutionOptions extends EnvResolverOptions {
  providerBaseUrls?: Record<string, string | undefined>;
}

export function resolveRoleConfig(
  config: ProjectConfig,
  role: ModelRole,
  options: RoleResolutionOptions = {},
): ResolvedRoleConfig {
  const roleConfig = config.models[role];

  if (!roleConfig.provider || !roleConfig.modelId) {
    throw new Error(`Role "${role}" is incomplete.`);
  }

  assertModelRoleEligible(roleConfig.provider, roleConfig.modelId, role);

  const definition = requireProviderDefinition(roleConfig.provider);
  const keyStatus = getProviderKeyStatus(roleConfig.provider, options);

  if (definition.requiresKey && !keyStatus.ok) {
    throw new Error(`Provider "${roleConfig.provider}" is missing ${keyStatus.envVar}.`);
  }

  const baseURL = resolveBaseURL(roleConfig.provider, roleConfig.baseURL, options);
  const apiKey = resolveProviderSecret(roleConfig.provider, options);

  return {
    role,
    provider: roleConfig.provider,
    modelId: roleConfig.modelId,
    maxTokens: reconcileMaxTokens(roleConfig.provider, roleConfig.modelId, roleConfig.maxTokens),
    temperature: resolveTemperature(
      roleConfig.provider,
      roleConfig.modelId,
      roleConfig.temperature,
    ),
    baseURL,
    apiKey,
    runtime: definition.create({ apiKey, baseURL }),
  };
}

export function resolveFallbackRoleConfig(
  config: ProjectConfig,
  options: RoleResolutionOptions = {},
): ResolvedRoleConfig | undefined {
  if (!config.models.fallback.provider || !config.models.fallback.modelId) {
    return undefined;
  }

  return resolveRoleConfig(config, "fallback", options);
}

export function assertAtLeastOneUsableRole(
  config: ProjectConfig,
  options: RoleResolutionOptions = {},
): void {
  const providers = [config.models.main.provider, config.models.research.provider].filter(Boolean);
  const statuses = new Map(
    providers.map((provider) => [provider, getProviderKeyStatus(provider, options)]),
  );

  if (!hasUsableProvider(providers, statuses)) {
    throw new Error("No usable provider credentials or no-key providers are configured.");
  }
}

function resolveBaseURL(
  provider: string,
  explicitBaseURL: string | undefined,
  options: RoleResolutionOptions,
): string | undefined {
  return (
    explicitBaseURL ??
    options.providerBaseUrls?.[provider] ??
    providerBaseUrlFromEnv(provider, options)
  );
}

function providerBaseUrlFromEnv(
  provider: string,
  options: RoleResolutionOptions,
): string | undefined {
  const envKey = `${provider.toUpperCase().replaceAll("-", "_")}_BASE_URL`;
  return options.processEnv?.[envKey] ?? process.env[envKey] ?? options.sessionEnv?.[envKey];
}

import { assertModelRoleEligible, inferProviderForModel } from "../catalog/model-catalog.js";
import { type ProjectConfig, getConfig, updateConfig } from "../config/config-manager.js";
import { getProviderKeyStatus } from "../config/env-resolver.js";

export interface ModelsCommandOptions {
  configPath?: string;
  setMain?: string;
  setResearch?: string;
  setFallback?: string;
  provider?: string;
  baseURL?: string;
  localRuntime?: boolean;
  openaiCompatible?: boolean;
  azure?: boolean;
  bedrock?: boolean;
  vertex?: boolean;
  localCli?: boolean;
}

export async function modelsCommand(options: ModelsCommandOptions = {}): Promise<string> {
  const provider = resolveProviderFlag(options);

  if (options.setMain || options.setResearch || options.setFallback) {
    const role = options.setMain ? "main" : options.setResearch ? "research" : "fallback";
    const modelId = options.setMain ?? options.setResearch ?? options.setFallback;
    if (!modelId) {
      throw new Error("Model id is required.");
    }

    await setRoleModel(role, modelId, { ...options, provider });
  }

  const config = await getConfig({ configPath: options.configPath, forceReload: true });
  return formatModelConfig(config);
}

async function setRoleModel(
  role: "main" | "research" | "fallback",
  modelId: string,
  options: ModelsCommandOptions & { provider?: string },
): Promise<void> {
  const provider = options.provider ?? inferProviderForModel(modelId);

  if (!provider) {
    throw new Error("Provider could not be inferred; pass a provider flag.");
  }

  if (!options.provider) {
    assertModelRoleEligible(provider, modelId, role);
  }

  await updateConfig(
    (config) => ({
      ...config,
      models: {
        ...config.models,
        [role]: {
          ...config.models[role],
          provider,
          modelId,
          baseURL: options.baseURL ?? config.models[role].baseURL,
        },
      },
    }),
    { configPath: options.configPath },
  );
}

function resolveProviderFlag(options: ModelsCommandOptions): string | undefined {
  const selected = [
    options.provider,
    options.localRuntime ? "ollama" : undefined,
    options.openaiCompatible ? "openai-compatible" : undefined,
    options.azure ? "azure" : undefined,
    options.bedrock ? "bedrock" : undefined,
    options.vertex ? "vertex" : undefined,
    options.localCli ? "local-cli" : undefined,
  ].filter((value): value is string => Boolean(value));

  if (selected.length > 1) {
    throw new Error("Only one provider flag may be supplied.");
  }

  return selected[0];
}

function formatModelConfig(config: ProjectConfig): string {
  const roles = (["main", "research", "fallback"] as const).map((role) => {
    const model = config.models[role];
    const keyStatus = model.provider
      ? getProviderKeyStatus(model.provider, { processEnv: {} })
      : undefined;
    return `${role}: ${model.provider ?? "unset"}/${model.modelId ?? "unset"} key:${keyStatus?.source ?? "missing"}`;
  });
  return roles.join("\n");
}

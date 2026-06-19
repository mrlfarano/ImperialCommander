import { type ProviderKeyStatus, getProviderKeyStatus } from "../config/env-resolver.js";

export interface ProviderFactoryContext {
  apiKey?: string;
  baseURL?: string;
}

export interface ProviderRuntime {
  id: string;
  apiKey?: string;
  baseURL?: string;
}

export interface ProviderDefinition {
  id: string;
  displayName: string;
  requiresKey: boolean;
  supportsCodebaseAnalysis: boolean;
  create: (context: ProviderFactoryContext) => ProviderRuntime;
}

const providerDefinitions = new Map<string, ProviderDefinition>();

registerProvider({
  id: "openai",
  displayName: "OpenAI",
  requiresKey: true,
  supportsCodebaseAnalysis: false,
  create: (context) => ({ id: "openai", ...context }),
});

registerProvider({
  id: "anthropic",
  displayName: "Anthropic",
  requiresKey: true,
  supportsCodebaseAnalysis: false,
  create: (context) => ({ id: "anthropic", ...context }),
});

registerProvider({
  id: "openai-compatible",
  displayName: "OpenAI-compatible",
  requiresKey: false,
  supportsCodebaseAnalysis: false,
  create: (context) => ({ id: "openai-compatible", ...context }),
});

registerProvider({
  id: "azure",
  displayName: "Azure OpenAI",
  requiresKey: true,
  supportsCodebaseAnalysis: false,
  create: (context) => ({ id: "azure", ...context }),
});

registerProvider({
  id: "bedrock",
  displayName: "Amazon Bedrock",
  requiresKey: true,
  supportsCodebaseAnalysis: false,
  create: (context) => ({ id: "bedrock", ...context }),
});

registerProvider({
  id: "vertex",
  displayName: "Google Vertex AI",
  requiresKey: true,
  supportsCodebaseAnalysis: false,
  create: (context) => ({ id: "vertex", ...context }),
});

registerProvider({
  id: "openrouter",
  displayName: "OpenRouter",
  requiresKey: true,
  supportsCodebaseAnalysis: false,
  create: (context) => ({ id: "openrouter", ...context }),
});

registerProvider({
  id: "ollama",
  displayName: "Ollama",
  requiresKey: false,
  supportsCodebaseAnalysis: false,
  create: (context) => ({ id: "ollama", baseURL: context.baseURL ?? "http://localhost:11434/api" }),
});

registerProvider({
  id: "local-cli",
  displayName: "Local CLI/OAuth runtime",
  requiresKey: false,
  supportsCodebaseAnalysis: true,
  create: (context) => ({ id: "local-cli", ...context }),
});

registerProvider({
  id: "host-session",
  displayName: "Host-session sampling",
  requiresKey: false,
  supportsCodebaseAnalysis: false,
  create: (context) => ({ id: "host-session", ...context }),
});

registerProvider({
  id: "cloud-managed",
  displayName: "Cloud-managed credentials",
  requiresKey: false,
  supportsCodebaseAnalysis: false,
  create: (context) => ({ id: "cloud-managed", ...context }),
});

export function registerProvider(definition: ProviderDefinition): void {
  providerDefinitions.set(definition.id, definition);
}

export function getProviderDefinition(provider: string): ProviderDefinition | undefined {
  return providerDefinitions.get(provider);
}

export function listProviderDefinitions(): ProviderDefinition[] {
  return [...providerDefinitions.values()];
}

export function requireProviderDefinition(provider: string): ProviderDefinition {
  const definition = getProviderDefinition(provider);

  if (!definition) {
    throw new Error(`Provider "${provider}" is not registered.`);
  }

  return definition;
}

export function hasUsableProvider(
  providers: string[],
  keyStatuses: Map<string, ProviderKeyStatus> = new Map(),
): boolean {
  return providers.some((provider) => {
    const definition = getProviderDefinition(provider);

    if (!definition) {
      return false;
    }

    return (
      !definition.requiresKey || (keyStatuses.get(provider) ?? getProviderKeyStatus(provider)).ok
    );
  });
}

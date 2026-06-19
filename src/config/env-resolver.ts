export type ProviderId =
  | "openai"
  | "anthropic"
  | "azure"
  | "bedrock"
  | "vertex"
  | "openai-compatible"
  | "openrouter"
  | "ollama"
  | "host-session"
  | "cloud-managed"
  | "local-cli";

export interface EnvResolverOptions {
  processEnv?: NodeJS.ProcessEnv;
  sessionEnv?: Record<string, string | undefined>;
  dotenvEnv?: Record<string, string | undefined>;
}

export interface ProviderKeyStatus {
  provider: string;
  ok: boolean;
  source: "process" | "session" | "dotenv" | "not-required" | "missing";
  envVar?: string;
}

const providerKeyEnvNames: Record<string, string | undefined> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  azure: "AZURE_OPENAI_API_KEY",
  bedrock: "AWS_ACCESS_KEY_ID",
  vertex: "GOOGLE_APPLICATION_CREDENTIALS",
  "openai-compatible": "OPENAI_COMPATIBLE_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  ollama: undefined,
  "host-session": undefined,
  "cloud-managed": undefined,
  "local-cli": undefined,
};

const placeholderValues = new Set([
  "",
  "changeme",
  "change-me",
  "placeholder",
  "your-api-key",
  "your_api_key",
  "insert-key-here",
]);

export function resolveProviderSecret(
  provider: string,
  options: EnvResolverOptions = {},
): string | undefined {
  const envVar = providerKeyEnvNames[provider];

  if (!envVar) {
    return undefined;
  }

  return resolveEnvValue(envVar, options)?.value;
}

export function getProviderKeyStatus(
  provider: string,
  options: EnvResolverOptions = {},
): ProviderKeyStatus {
  const envVar = providerKeyEnvNames[provider];

  if (!envVar) {
    return { provider, ok: true, source: "not-required" };
  }

  const resolved = resolveEnvValue(envVar, options);

  return {
    provider,
    ok: resolved !== undefined,
    source: resolved?.source ?? "missing",
    envVar,
  };
}

export function getProviderKeyEnvName(provider: string): string | undefined {
  return providerKeyEnvNames[provider];
}

function resolveEnvValue(
  key: string,
  options: EnvResolverOptions,
): { value: string; source: "process" | "session" | "dotenv" } | undefined {
  const candidates = [
    { source: "process" as const, value: options.processEnv?.[key] ?? process.env[key] },
    { source: "session" as const, value: options.sessionEnv?.[key] },
    { source: "dotenv" as const, value: options.dotenvEnv?.[key] },
  ];

  for (const candidate of candidates) {
    if (isUsableSecret(candidate.value)) {
      return { source: candidate.source, value: candidate.value };
    }
  }

  return undefined;
}

function isUsableSecret(value: string | undefined): value is string {
  if (value === undefined) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return !placeholderValues.has(normalized);
}

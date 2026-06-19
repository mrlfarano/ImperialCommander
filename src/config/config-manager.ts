import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { isAllowedProvider } from "../catalog/model-catalog.js";
import { type ProjectPathOptions, resolveProjectConfigPath } from "./paths.js";

export const modelRoleConfigSchema = z.object({
  provider: z.string().min(1),
  modelId: z.string().min(1),
  maxTokens: z.number().int().positive(),
  temperature: z.number().min(0).max(2),
  baseURL: z.string().url().optional(),
});

export const projectConfigSchema = z.object({
  project: z.object({
    name: z.string(),
    description: z.string(),
    version: z.string(),
    author: z.string(),
  }),
  models: z.object({
    main: modelRoleConfigSchema,
    research: modelRoleConfigSchema,
    fallback: modelRoleConfigSchema.partial({
      provider: true,
      modelId: true,
    }),
  }),
  global: z.object({
    responseLanguage: z.string(),
    logLevel: z.enum(["debug", "info", "warn", "error", "success"]),
    telemetryEnabled: z.boolean(),
  }),
  storage: z.object({
    type: z.enum(["file", "api"]),
    operatingMode: z.enum(["solo", "team"]),
  }),
  providers: z.record(z.record(z.unknown())),
  featureFlags: z.object({
    enableCodebaseAnalysis: z.boolean(),
    enableProxy: z.boolean(),
  }),
});

export type ProjectConfig = z.infer<typeof projectConfigSchema>;
export type ProjectConfigInput = PartialDeep<ProjectConfig>;

type PartialDeep<T> = T extends object
  ? {
      [K in keyof T]?: PartialDeep<T[K]>;
    }
  : T;

export interface ConfigLoadOptions extends ProjectPathOptions {
  configPath?: string;
  forceReload?: boolean;
  suppressWarnings?: boolean;
  templateValues?: Record<string, string | number>;
  warn?: (message: string) => void;
}

const currentYear = new Date().getFullYear();

export const defaultConfig: ProjectConfig = {
  project: {
    name: "Imperial Commander Project",
    description: "AI-driven task orchestration project",
    version: "0.1.0",
    author: "",
  },
  models: {
    main: {
      provider: "openai",
      modelId: "gpt-4.1",
      maxTokens: 32768,
      temperature: 0.2,
    },
    research: {
      provider: "openai",
      modelId: "gpt-4.1",
      maxTokens: 32768,
      temperature: 0.1,
    },
    fallback: {
      provider: "openai",
      modelId: "gpt-4.1-mini",
      maxTokens: 32768,
      temperature: 0.2,
    },
  },
  global: {
    responseLanguage: "English",
    logLevel: "info",
    telemetryEnabled: true,
  },
  storage: {
    type: "file",
    operatingMode: "solo",
  },
  providers: {},
  featureFlags: {
    enableCodebaseAnalysis: true,
    enableProxy: false,
  },
};

let configCache: { path: string; config: ProjectConfig } | undefined;

export async function getConfig(options: ConfigLoadOptions = {}): Promise<ProjectConfig> {
  const configPath = options.configPath ?? resolveProjectConfigPath(options);

  if (!options.forceReload && configCache?.path === configPath) {
    return configCache.config;
  }

  const config = await loadConfigFile(configPath, options);
  configCache = { path: configPath, config };
  return config;
}

export async function getConfigSection<K extends keyof ProjectConfig>(
  section: K,
  options: ConfigLoadOptions = {},
): Promise<ProjectConfig[K]> {
  return (await getConfig(options))[section];
}

export function clearConfigCache(): void {
  configCache = undefined;
}

export async function saveConfig(
  config: ProjectConfig,
  options: ConfigLoadOptions = {},
): Promise<ProjectConfig> {
  const parsed = projectConfigSchema.parse(config);
  const configPath = options.configPath ?? resolveProjectConfigPath(options);
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  configCache = { path: configPath, config: parsed };
  return parsed;
}

export async function updateConfig(
  update: (current: ProjectConfig) => ProjectConfig,
  options: ConfigLoadOptions = {},
): Promise<ProjectConfig> {
  const current = await getConfig(options);
  return saveConfig(update(structuredClone(current)), options);
}

export function substituteConfigTemplateTokens(
  value: string,
  templateValues: Record<string, string | number> = {},
): string {
  const values: Record<string, string | number> = { year: currentYear, ...templateValues };

  return value.replaceAll(/\{\{\s*([A-Za-z0-9_-]+)\s*\}\}/g, (match, token: string) => {
    const replacement = values[token];
    return replacement === undefined ? match : String(replacement);
  });
}

async function loadConfigFile(
  configPath: string,
  options: ConfigLoadOptions,
): Promise<ProjectConfig> {
  let rawConfig: unknown = {};

  try {
    rawConfig = JSON.parse(
      substituteConfigTemplateTokens(await readFile(configPath, "utf8"), options.templateValues),
    );
  } catch (error) {
    if (!isNodeFileError(error, "ENOENT")) {
      warn(options, `Could not parse config at ${configPath}; using defaults.`);
    } else {
      warn(options, "Project config is missing; using defaults. Run model setup when ready.");
    }
  }

  const merged = deepMerge(defaultConfig, rawConfig);
  const validated = projectConfigSchema.safeParse(merged);

  if (!validated.success) {
    warn(options, "Project config is invalid after merging defaults; using built-in defaults.");
    return defaultConfig;
  }

  return normalizeProviders(validated.data, options);
}

function normalizeProviders(config: ProjectConfig, options: ConfigLoadOptions): ProjectConfig {
  const next = structuredClone(config);

  for (const role of ["main", "research"] as const) {
    if (!isAllowedProvider(next.models[role].provider)) {
      warn(
        options,
        `Provider "${next.models[role].provider}" for ${role} is not supported; using default ${role}.`,
      );
      next.models[role] = defaultConfig.models[role];
    }
  }

  if (next.models.fallback.provider && !isAllowedProvider(next.models.fallback.provider)) {
    warn(
      options,
      `Fallback provider "${next.models.fallback.provider}" is not supported; disabling fallback.`,
    );
    next.models.fallback = {
      maxTokens: defaultConfig.models.fallback.maxTokens,
      temperature: defaultConfig.models.fallback.temperature,
    };
  }

  if (!next.models.fallback.provider || !next.models.fallback.modelId) {
    next.models.fallback = {
      maxTokens: next.models.fallback.maxTokens,
      temperature: next.models.fallback.temperature,
    };
  }

  return next;
}

function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override === undefined ? structuredClone(base) : (override as T);
  }

  const result: Record<string, unknown> = { ...structuredClone(base) };

  for (const [key, value] of Object.entries(override)) {
    const baseValue = result[key];
    result[key] =
      isPlainObject(baseValue) && isPlainObject(value) ? deepMerge(baseValue, value) : value;
  }

  return result as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function warn(options: ConfigLoadOptions, message: string): void {
  if (!options.suppressWarnings) {
    options.warn?.(message);
  }
}

function isNodeFileError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}

import { z } from "zod";
import rawCatalog from "./supported-models.json" with { type: "json" };

export const modelRoleSchema = z.enum(["main", "research", "fallback"]);
export type ModelRole = z.infer<typeof modelRoleSchema>;

const costSchema = z.object({
  input: z.number().nonnegative().nullable(),
  output: z.number().nonnegative().nullable(),
});

export const modelInfoSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1).optional(),
  benchmarkScore: z.number().nullable(),
  cost: costSchema,
  allowedRoles: z.array(modelRoleSchema).min(1),
  maxTokens: z.number().int().positive(),
  supported: z.boolean(),
  reason: z.string().optional(),
  reasoningEffort: z.string().optional(),
  temperatureOverride: z.number().min(0).max(2).optional(),
  apiType: z.string().optional(),
});

export type ModelInfo = z.infer<typeof modelInfoSchema>;

const catalogSchema = z.record(z.string().min(1), z.record(z.string().min(1), modelInfoSchema));

export type ModelCatalog = z.infer<typeof catalogSchema>;

const customProviderAllowList = new Set([
  "azure",
  "bedrock",
  "vertex",
  "openai-compatible",
  "openrouter",
  "ollama",
  "cloud-managed",
  "router",
  "local",
]);

const unknownRouterModelMaxTokens = 4096;

export function loadModelCatalog(): ModelCatalog {
  return catalogSchema.parse(rawCatalog);
}

export function getModelInfo(provider: string, modelId: string): ModelInfo | undefined {
  return loadModelCatalog()[provider]?.[modelId];
}

export function inferProviderForModel(modelId: string): string | undefined {
  const catalog = loadModelCatalog();
  const matches = Object.entries(catalog)
    .filter(([, models]) => models[modelId] !== undefined)
    .map(([provider]) => provider);

  return matches.length === 1 ? matches[0] : undefined;
}

export function isAllowedProvider(provider: string): boolean {
  return provider in loadModelCatalog() || customProviderAllowList.has(provider);
}

export function assertModelRoleEligible(
  provider: string,
  modelId: string,
  role: ModelRole,
): ModelInfo {
  const model = getModelInfo(provider, modelId);

  if (!model) {
    throw new Error(`Unknown model "${modelId}" for provider "${provider}".`);
  }

  if (!model.supported) {
    throw new Error(model.reason ?? `Model "${modelId}" is not supported.`);
  }

  if (!model.allowedRoles.includes(role)) {
    throw new Error(`Model "${modelId}" is not allowed for the "${role}" role.`);
  }

  return model;
}

export function reconcileMaxTokens(provider: string, modelId: string, requested: number): number {
  const model = getModelInfo(provider, modelId);

  if (!model) {
    return Math.min(requested, unknownRouterModelMaxTokens);
  }

  return Math.min(requested, model.maxTokens);
}

export function resolveTemperature(
  provider: string,
  modelId: string,
  configuredTemperature: number,
): number {
  return getModelInfo(provider, modelId)?.temperatureOverride ?? configuredTemperature;
}

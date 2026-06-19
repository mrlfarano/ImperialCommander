import { getModelInfo } from "../catalog/model-catalog.js";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export function computeTokenCost(provider: string, modelId: string, usage: TokenUsage): number {
  const model = getModelInfo(provider, modelId);

  if (!model?.cost.input || !model.cost.output) {
    return 0;
  }

  return (
    (usage.inputTokens / 1_000_000) * model.cost.input +
    (usage.outputTokens / 1_000_000) * model.cost.output
  );
}

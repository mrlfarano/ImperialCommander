import type { z } from "zod";
import type { ProjectConfig } from "../config/config-manager.js";
import { resolveFallbackRoleConfig, resolveRoleConfig } from "../providers/role-config.js";
import type { ResolvedRoleConfig, RoleResolutionOptions } from "../providers/role-config.js";

export interface AiTelemetryRecord {
  timestamp: string;
  commandName: string;
  modelUsed: string;
  providerName: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalCost: number;
  currency: "USD";
}

export interface GenerateTextRequest {
  prompt: string;
  commandName: string;
  role?: "main" | "research";
  modelOverride?: {
    provider: string;
    modelId: string;
  };
  stream?: boolean;
}

export interface GenerateTextResult {
  text: string;
  role: "main" | "research" | "fallback";
  telemetryData: AiTelemetryRecord;
}

export interface AiProviderCall {
  roleConfig: ResolvedRoleConfig;
  prompt: string;
  stream: boolean;
  timeoutMs?: number;
}

export interface AiProviderResult {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
}

export type AiProviderInvoker = (call: AiProviderCall) => Promise<AiProviderResult>;

export interface AiServiceOptions extends RoleResolutionOptions {
  now?: () => Date;
  streamEnabled?: boolean;
  streamTimeoutMs?: number;
}

const defaultStreamTimeoutMs = 180_000;

export class AiService {
  constructor(
    private readonly config: ProjectConfig,
    private readonly invokeProvider: AiProviderInvoker,
    private readonly options: AiServiceOptions = {},
  ) {}

  async generateText(request: GenerateTextRequest): Promise<GenerateTextResult> {
    const requestedRole = request.role ?? "main";
    const primaryRole = this.resolveRequestRole(requestedRole, request.modelOverride);
    const prompt = this.withLanguageSteering(request.prompt);

    try {
      return await this.callProvider(primaryRole, prompt, request, requestedRole);
    } catch (error) {
      if (requestedRole !== "main") {
        throw error;
      }

      const fallback = resolveFallbackRoleConfig(this.config, this.options);

      if (!fallback) {
        throw error;
      }

      return this.callProvider(fallback, prompt, request, "fallback");
    }
  }

  async generateObject<T>(
    schema: z.ZodType<T>,
    request: GenerateTextRequest,
  ): Promise<GenerateTextResult & { object: T }> {
    const result = await this.generateText(request);
    const parsedJson = JSON.parse(result.text);
    const object = schema.parse(parsedJson);

    return { ...result, object };
  }

  private async callProvider(
    roleConfig: ResolvedRoleConfig,
    prompt: string,
    request: GenerateTextRequest,
    role: "main" | "research" | "fallback",
  ): Promise<GenerateTextResult> {
    const stream = Boolean(request.stream && this.options.streamEnabled);
    const result = await this.invokeProvider({
      roleConfig,
      prompt,
      stream,
      timeoutMs: stream ? (this.options.streamTimeoutMs ?? defaultStreamTimeoutMs) : undefined,
    });

    return {
      text: result.text,
      role,
      telemetryData: this.createTelemetry(request.commandName, roleConfig, result),
    };
  }

  private resolveRequestRole(
    role: "main" | "research",
    override?: GenerateTextRequest["modelOverride"],
  ): ResolvedRoleConfig {
    const resolved = resolveRoleConfig(this.config, role, this.options);

    if (!override) {
      return resolved;
    }

    return {
      ...resolved,
      provider: override.provider,
      modelId: override.modelId,
      runtime: {
        ...resolved.runtime,
        id: override.provider,
      },
    };
  }

  private withLanguageSteering(prompt: string): string {
    return `Respond in ${this.config.global.responseLanguage}.\n\n${prompt}`;
  }

  private createTelemetry(
    commandName: string,
    roleConfig: ResolvedRoleConfig,
    result: AiProviderResult,
  ): AiTelemetryRecord {
    const inputTokens = result.inputTokens ?? 0;
    const outputTokens = result.outputTokens ?? 0;

    return {
      timestamp: (this.options.now?.() ?? new Date()).toISOString(),
      commandName,
      modelUsed: roleConfig.modelId,
      providerName: roleConfig.provider,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      totalCost: 0,
      currency: "USD",
    };
  }
}

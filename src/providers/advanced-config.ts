import { z } from "zod";

export const aiCommandNameSchema = z.enum([
  "parse-spec",
  "add-task",
  "update",
  "update-task",
  "update-subtask",
  "expand",
  "expand-all",
  "analyze-complexity",
  "research",
  "prd",
  "check-spec",
]);

export type AiCommandName = z.infer<typeof aiCommandNameSchema>;

const commandOverrideSchema = z.object({
  modelId: z.string().min(1).optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  reasoningEffort: z.enum(["low", "medium", "high", "xhigh"]).optional(),
});

export const providerAdvancedConfigSchema = z
  .object({
    executablePath: z.string().min(1).optional(),
    workingDirectory: z.string().min(1).optional(),
    approvalMode: z.enum(["never", "on-request", "on-failure", "untrusted"]).optional(),
    permissionMode: z.enum(["readonly", "workspace-write", "full-access"]).optional(),
    sandboxMode: z.enum(["read-only", "workspace-write", "danger-full-access"]).optional(),
    allowedTools: z.array(z.string().min(1)).optional(),
    disallowedTools: z.array(z.string().min(1)).optional(),
    reasoningEffort: z.enum(["low", "medium", "high", "xhigh"]).optional(),
    hostToolIntegrations: z.record(z.unknown()).optional(),
    commandOverrides: z.record(aiCommandNameSchema, commandOverrideSchema).default({}),
  })
  .strict();

export type ProviderAdvancedConfig = z.infer<typeof providerAdvancedConfigSchema>;
export type CommandOverride = z.infer<typeof commandOverrideSchema>;

export function parseProviderAdvancedConfig(config: unknown): ProviderAdvancedConfig {
  return providerAdvancedConfigSchema.parse(config ?? {});
}

export function getCommandOverride(
  config: ProviderAdvancedConfig,
  commandName: AiCommandName,
): CommandOverride {
  return config.commandOverrides[commandName] ?? {};
}

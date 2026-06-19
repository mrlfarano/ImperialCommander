import { resolveTimeoutSeconds, resolveToolSelection } from "./tool-loader.js";
import { toolRegistry } from "./tool-registry.js";

export interface AgentServerConfig {
  toolMode?: string;
  timeoutSeconds?: string | number;
}

export interface AgentServerStartup {
  tools: string[];
  timeoutSeconds: number;
  warnings: string[];
}

export async function createAgentServer(
  config: AgentServerConfig = {},
): Promise<AgentServerStartup> {
  const selection = resolveToolSelection(
    config.toolMode ?? process.env.IMPERIAL_MCP_TOOLS,
    Object.keys(toolRegistry),
  );
  return {
    tools: selection.tools,
    timeoutSeconds: resolveTimeoutSeconds(
      config.timeoutSeconds ?? process.env.IMPERIAL_MCP_TIMEOUT,
    ),
    warnings: selection.warnings,
  };
}

export async function startAgentServer(config: AgentServerConfig = {}): Promise<void> {
  const startup = await createAgentServer(config);
  process.stderr.write(
    `Imperial Commander MCP server ready (${startup.tools.length} tools, timeout ${startup.timeoutSeconds}s)\n`,
  );
}

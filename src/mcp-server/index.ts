import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { VERSION } from "../version.js";
import { resolveAgentProjectRoot } from "./project-root.js";
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

const toolInputSchema = z.object({}).passthrough();

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
  const server = new McpServer({
    name: "imperial-commander",
    version: VERSION,
  });

  for (const name of startup.tools) {
    const tool = toolRegistry[name];
    if (!tool) {
      continue;
    }

    server.registerTool(
      name,
      {
        description: `${tool.destructive ? "Mutating" : "Read-only"} Imperial Commander command.`,
        inputSchema: toolInputSchema,
        annotations: {
          destructiveHint: tool.destructive === true,
          readOnlyHint: tool.destructive !== true,
        },
      },
      async (args) => {
        const response = await tool.handler(args, {
          projectRoot: resolveAgentProjectRoot({
            args,
            env: process.env,
            sessionRoot: process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
          }),
          samplingClient: {
            supportsSampling: Boolean(server.server.getClientCapabilities()?.sampling),
            sampleText: async (prompt) => {
              const response = await server.server.createMessage({
                messages: [
                  {
                    role: "user",
                    content: { type: "text", text: prompt },
                  },
                ],
                maxTokens: 4096,
              });

              return response.content.type === "text" ? response.content.text : "";
            },
          },
        });

        return { ...response };
      },
    );
  }

  process.stderr.write(
    `Imperial Commander MCP server ready (${startup.tools.length} tools, timeout ${startup.timeoutSeconds}s)\n`,
  );
  await server.connect(new StdioServerTransport());
}

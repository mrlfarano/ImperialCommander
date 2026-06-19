import { z } from "zod";
import {
  createErrorEnvelope,
  createSuccessEnvelope,
  toHostResponse,
} from "../../src/mcp-server/envelope.js";
import { createAgentServer } from "../../src/mcp-server/index.js";
import { resolveAgentProjectRoot } from "../../src/mcp-server/project-root.js";
import {
  HostSessionSamplingProvider,
  SamplingUnavailableError,
} from "../../src/mcp-server/providers/sampling.js";
import {
  coreTools,
  resolveTimeoutSeconds,
  resolveToolSelection,
  standardTools,
} from "../../src/mcp-server/tool-loader.js";
import { lookupTool, toolRegistry } from "../../src/mcp-server/tool-registry.js";

describe("mcp server", () => {
  it("resolves tool modes and custom lists", () => {
    const available = Object.keys(toolRegistry);

    expect(resolveToolSelection(undefined, available).tools).toEqual([...coreTools]);
    expect(resolveToolSelection("STANDARD", available).tools).toEqual([...standardTools]);
    expect(resolveToolSelection("list,show,unknown", available)).toMatchObject({
      mode: "custom",
      tools: ["list", "get-task"],
    });
    expect(resolveToolSelection("", available).tools).toEqual([...coreTools]);
  });

  it("bounds timeout configuration", () => {
    expect(resolveTimeoutSeconds(undefined)).toBe(60);
    expect(resolveTimeoutSeconds(0)).toBe(1);
    expect(resolveTimeoutSeconds(5000)).toBe(3600);
  });

  it("wraps success and error envelopes for host content", () => {
    expect(toHostResponse(createSuccessEnvelope({ ok: true })).content[0].text).toContain(
      '"success": true',
    );
    expect(toHostResponse(createErrorEnvelope(new Error("bad")))).toMatchObject({
      isError: true,
      error: { message: "bad" },
    });
  });

  it("resolves absolute project roots from env, args, session, and file URIs", () => {
    expect(resolveAgentProjectRoot({ env: { IMPERIAL_PROJECT_ROOT: "/tmp/project" } })).toBe(
      "/tmp/project",
    );
    expect(resolveAgentProjectRoot({ args: { projectRoot: "file:///tmp/project" } })).toBe(
      "/tmp/project",
    );
    expect(resolveAgentProjectRoot({ sessionRoot: "/tmp/session" })).toBe("/tmp/session");
    expect(() => resolveAgentProjectRoot({ args: { projectRoot: "relative" } })).toThrow(
      /absolute/,
    );
  });

  it("creates server startup config and exposes tool registry entries", async () => {
    await expect(createAgentServer({ toolMode: "core", timeoutSeconds: 5 })).resolves.toMatchObject(
      {
        timeoutSeconds: 5,
        tools: [...coreTools],
      },
    );
    expect(lookupTool("get_task")?.name).toBe("get-task");
    expect(toolRegistry["parse-spec"].destructive).toBe(true);
  });

  it("exposes late-phase CLI commands through agent tools", () => {
    for (const name of [
      "prd",
      "check-spec",
      "autopilot",
      "loop",
      "board",
      "roadmap",
      "watch",
      "sync",
      "notifications",
      "history",
      "undo",
      "search",
      "export",
    ]) {
      expect(toolRegistry[name], name).toBeDefined();
    }

    expect(resolveToolSelection("login,find,repl", Object.keys(toolRegistry)).tools).toEqual([
      "auth-login",
      "search",
      "tui",
    ]);
  });
});

describe("host-session sampling provider", () => {
  it("generates text and structured output through a sampling client", async () => {
    const provider = new HostSessionSamplingProvider({
      supportsSampling: true,
      sampleText: async (prompt) => (prompt === "json" ? '{"title":"Task"}' : "text"),
    });

    await expect(provider.generateText("hello")).resolves.toBe("text");
    await expect(provider.generateObject("json", z.object({ title: z.string() }))).resolves.toEqual(
      {
        title: "Task",
      },
    );
    expect(provider.keyStatus()).toEqual({ ok: true, source: "not-required" });
  });

  it("fails clearly when sampling is unavailable", async () => {
    const provider = new HostSessionSamplingProvider({ supportsSampling: false });
    await expect(provider.generateText("hello")).rejects.toThrow(SamplingUnavailableError);
  });
});

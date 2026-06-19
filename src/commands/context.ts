import { extractBriefId, readCloudContext, writeCloudContext } from "../cloud/context-store.js";

export interface ContextCommandOptions {
  org?: string;
  brief?: string;
  noHeader?: boolean;
}

export async function contextCommand(
  action: "show" | "org" | "brief" | "set" | "clear" = "show",
  options: ContextCommandOptions = {},
): Promise<string> {
  const current = await readCloudContext();

  if (action === "clear") {
    await writeCloudContext({});
    return "Context cleared.";
  }

  if (action === "org") {
    if (!options.org) {
      return formatContext(current, options.noHeader);
    }
    const next = await writeCloudContext({ orgId: options.org });
    return `Active org set to ${next.orgId}. Brief cleared.`;
  }

  if (action === "brief") {
    if (!options.brief) {
      return formatContext(current, options.noHeader);
    }
    if (!current.orgId) {
      throw new Error("Select an org before selecting a brief.");
    }
    const next = await writeCloudContext({
      orgId: current.orgId,
      briefId: extractBriefId(options.brief),
    });
    return `Active brief set to ${next.briefId}.`;
  }

  if (action === "set") {
    const orgId = options.org ?? current.orgId;
    if (options.brief && !orgId) {
      throw new Error("Select an org before selecting a brief.");
    }
    const next = await writeCloudContext({
      orgId,
      briefId: options.brief ? extractBriefId(options.brief) : current.briefId,
    });
    return formatContext(next, options.noHeader);
  }

  return formatContext(current, options.noHeader);
}

function formatContext(context: { orgId?: string; briefId?: string }, noHeader?: boolean): string {
  return [
    noHeader ? undefined : "Cloud context",
    `Org: ${context.orgId ?? "none"}`,
    `Brief: ${context.briefId ?? "none"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

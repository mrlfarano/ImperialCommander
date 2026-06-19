import { readCloudContext, writeCloudContext } from "../cloud/context-store.js";
import { hasValidCredentials, readCredentials } from "../cloud/credentials.js";

export interface BriefsCommandOptions {
  id?: string;
  title?: string;
}

export async function briefsCommand(
  action: "list" | "select" | "create" = "list",
  options: BriefsCommandOptions = {},
): Promise<string> {
  const credentials = await readCredentials();
  if (!hasValidCredentials(credentials)) {
    throw new Error("Briefs require cloud auth. Run login --token <token> first.");
  }

  const context = await readCloudContext();
  if (!context.orgId) {
    throw new Error("Briefs require an active org. Run context org <org> first.");
  }

  if (action === "create") {
    return `Create brief in web UI: ${credentials?.endpoint ?? "offline"}/orgs/${context.orgId}/briefs/new`;
  }

  const briefs = [
    { id: "brief-1", status: "active", updated: "offline", tasks: 0 },
    { id: "brief-2", status: "draft", updated: "offline", tasks: 0 },
  ];

  if (action === "select") {
    const selected = options.id ?? briefs[0]?.id;
    await writeCloudContext({ orgId: context.orgId, briefId: selected });
    return `Selected brief ${selected}.`;
  }

  return briefs
    .map(
      (brief) =>
        `${brief.id}${brief.id === context.briefId ? " *" : ""} [${brief.status}] updated:${brief.updated} tasks:${brief.tasks}`,
    )
    .join("\n");
}

import {
  clearCredentials,
  hasValidCredentials,
  readCredentials,
  writeCredentials,
} from "../cloud/credentials.js";

export interface AuthCommandOptions {
  token?: string;
  endpoint?: string;
  workspace?: string;
}

export async function authCommand(
  action: "login" | "logout" | "status" | "refresh",
  options: AuthCommandOptions = {},
): Promise<string> {
  if (action === "login") {
    const credentials = await writeCredentials({
      token: options.token ?? "offline-token",
      endpoint: options.endpoint ?? "offline",
      workspaceId: options.workspace,
      userId: "local-user",
    });
    return `Logged in to ${credentials.endpoint} as ${credentials.userId}.`;
  }

  if (action === "logout") {
    const removed = await clearCredentials();
    return removed ? "Logged out." : "Already logged out.";
  }

  if (action === "refresh") {
    const current = await readCredentials();
    if (!current) {
      return "Not authenticated.";
    }
    await writeCredentials({ ...current, token: `${current.token}-refreshed` });
    return "Credentials refreshed.";
  }

  const credentials = await readCredentials();
  if (!hasValidCredentials(credentials)) {
    return "Not authenticated.";
  }
  if (!credentials) {
    return "Not authenticated.";
  }
  return `Authenticated to ${credentials.endpoint} as ${credentials.userId}.`;
}

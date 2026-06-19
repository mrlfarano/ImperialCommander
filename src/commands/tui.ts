import { hasValidCredentials, readCredentials } from "../cloud/credentials.js";

export interface TuiCommandOptions {
  interactive?: boolean;
}

export async function tuiCommand(options: TuiCommandOptions = {}): Promise<string> {
  const credentials = await readCredentials();
  const auth = hasValidCredentials(credentials)
    ? `authenticated to ${credentials?.endpoint}`
    : "not authenticated";
  const lines = [
    "Interactive shell coming soon.",
    `Auth: ${auth}.`,
    "Use --help to list available commands.",
  ];

  if (!options.interactive) {
    lines.push("Non-interactive terminal detected; exiting after help fallback.");
  }

  return lines.join("\n");
}

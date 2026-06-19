export function formatCliError(message: string): string {
  const trimmed = message.trim();

  if (!trimmed) {
    return "Error: command failed.\n";
  }

  return `Error: ${trimmed.replace(/^error:\s*/i, "")}\nRun "impcom --help" for available commands.\n`;
}

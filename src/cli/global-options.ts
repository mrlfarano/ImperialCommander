import type { Command } from "commander";

export interface GlobalCliOptions {
  file?: string;
  tag?: string;
  banner: boolean;
}

export function collectGlobalOptions(program: Command): GlobalCliOptions {
  const options = program.opts<{ file?: string; tag?: string; banner?: boolean }>();

  return {
    file: options.file,
    tag: options.tag,
    banner: options.banner !== false,
  };
}

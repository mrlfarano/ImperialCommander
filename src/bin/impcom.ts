#!/usr/bin/env node
import { CommanderError } from "commander";
import { formatCliError } from "../cli/error-formatter.js";
import { createProgram } from "../cli/program.js";

try {
  await createProgram().parseAsync(process.argv);
} catch (error) {
  if (error instanceof CommanderError) {
    process.exitCode = error.exitCode;
  } else {
    process.stderr.write(formatCliError(error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  }
}

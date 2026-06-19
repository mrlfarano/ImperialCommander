#!/usr/bin/env node
import { CommanderError } from "commander";
import { createProgram } from "../cli/program.js";

try {
  await createProgram().parseAsync(process.argv);
} catch (error) {
  if (error instanceof CommanderError) {
    process.exitCode = error.exitCode;
  } else {
    throw error;
  }
}

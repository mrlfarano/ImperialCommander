import { access } from "node:fs/promises";
import { dirname, join, parse, resolve } from "node:path";
import { DEFAULT_CONFIG_DIR_NAME } from "../config/paths.js";

const rootMarkers = [
  DEFAULT_CONFIG_DIR_NAME,
  ".git",
  "tasks.json",
  join("tasks", "tasks.json"),
  ".taskmaster",
];

export async function findProjectRoot(start = process.cwd()): Promise<string | undefined> {
  let current = resolve(start);
  const root = parse(current).root;

  while (true) {
    if (await hasAnyMarker(current)) {
      return current;
    }

    if (current === root) {
      return undefined;
    }

    current = dirname(current);
  }
}

async function hasAnyMarker(directory: string): Promise<boolean> {
  for (const marker of rootMarkers) {
    if (await pathExists(join(directory, marker))) {
      return true;
    }
  }

  return false;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

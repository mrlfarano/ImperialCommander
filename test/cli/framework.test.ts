import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { shouldShowBanner, shouldSkipAutoUpdate } from "../../src/cli/auto-update.js";
import { formatCliError } from "../../src/cli/error-formatter.js";
import { collectGlobalOptions } from "../../src/cli/global-options.js";
import { createProgram } from "../../src/cli/program.js";
import { findProjectRoot } from "../../src/cli/root-detect.js";

describe("CLI framework", () => {
  it("parses global options", async () => {
    const program = createProgram();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await program.parseAsync(
        ["node", "impcom", "--file", "tasks.json", "--tag", "feature", "health"],
        {
          from: "node",
        },
      );
    } finally {
      log.mockRestore();
    }

    expect(collectGlobalOptions(program)).toEqual({
      file: "tasks.json",
      tag: "feature",
      banner: true,
    });
  });

  it("formats actionable errors", () => {
    expect(formatCliError("error: unknown command")).toContain('Run "impcom --help"');
  });

  it("detects project roots from markers", async () => {
    const root = await mkdtemp(join(tmpdir(), "imperial-root-"));
    const nested = join(root, "a", "b");
    await mkdir(join(root, ".imperial-commander"), { recursive: true });
    await mkdir(nested, { recursive: true });

    await expect(findProjectRoot(nested)).resolves.toBe(root);
  });

  it("detects legacy task store markers", async () => {
    const root = await mkdtemp(join(tmpdir(), "imperial-root-"));
    await writeFile(join(root, "tasks.json"), "{}", "utf8");

    await expect(findProjectRoot(root)).resolves.toBe(root);
  });

  it("skips auto-update and banner in non-interactive contexts", () => {
    expect(shouldSkipAutoUpdate({ env: { CI: "true" } })).toBe(true);
    expect(shouldShowBanner({ isTTY: false })).toBe(false);
    expect(shouldShowBanner({ isTTY: true, noBanner: true })).toBe(false);
  });
});

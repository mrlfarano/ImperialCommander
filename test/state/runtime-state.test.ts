import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveRuntimeStatePath } from "../../src/config/paths.js";
import {
  createDefaultRuntimeState,
  getRuntimeState,
  setRuntimeState,
  updateRuntimeState,
} from "../../src/state/runtime-state.js";

describe("runtime state", () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "imperial-runtime-state-"));
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("auto-creates the state file with defaults on first read", async () => {
    const now = new Date("2026-06-19T12:00:00.000Z");

    const state = await getRuntimeState({ projectRoot, now });

    expect(state).toEqual({
      currentTag: "master",
      lastSwitched: "2026-06-19T12:00:00.000Z",
      migrationNoticeShown: false,
      branchTagMapping: {},
    });

    const persisted = JSON.parse(await readFile(resolveRuntimeStatePath({ projectRoot }), "utf8"));
    expect(persisted).toEqual(state);
  });

  it("persists explicit state updates", async () => {
    const lastSwitched = "2026-06-19T13:00:00.000Z";

    await setRuntimeState(
      {
        ...createDefaultRuntimeState(new Date("2026-06-19T12:00:00.000Z")),
        currentTag: "feature/runtime-state",
        lastSwitched,
        migrationNoticeShown: true,
        branchTagMapping: { main: "master" },
      },
      { projectRoot },
    );

    await expect(getRuntimeState({ projectRoot })).resolves.toEqual({
      currentTag: "feature/runtime-state",
      lastSwitched,
      migrationNoticeShown: true,
      branchTagMapping: { main: "master" },
    });
  });

  it("merges partial updates with the current state", async () => {
    await getRuntimeState({
      projectRoot,
      now: new Date("2026-06-19T12:00:00.000Z"),
    });

    const updated = await updateRuntimeState(
      {
        currentTag: "release",
        lastSwitched: "2026-06-19T14:00:00.000Z",
      },
      { projectRoot },
    );

    expect(updated).toEqual({
      currentTag: "release",
      lastSwitched: "2026-06-19T14:00:00.000Z",
      migrationNoticeShown: false,
      branchTagMapping: {},
    });

    await expect(getRuntimeState({ projectRoot })).resolves.toEqual(updated);
  });
});

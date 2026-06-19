import { defaultConfig } from "../../src/config/config-manager.js";
import { resolveFeatureFlags } from "../../src/config/feature-flags.js";
import { resolveOperatingMode } from "../../src/config/operating-mode.js";

describe("feature flags", () => {
  it("resolves env overrides before session and config values", () => {
    expect(
      resolveFeatureFlags(defaultConfig, {
        processEnv: { IMPERIAL_ENABLE_PROXY: "true" },
        sessionEnv: { IMPERIAL_ENABLE_PROXY: "false" },
      }).enableProxy,
    ).toBe(true);

    expect(
      resolveFeatureFlags(defaultConfig, {
        processEnv: {},
        sessionEnv: { IMPERIAL_ENABLE_PROXY: "true" },
      }).enableProxy,
    ).toBe(true);
  });

  it("gates codebase analysis on provider capability", () => {
    expect(
      resolveFeatureFlags(defaultConfig, { activeProviderSupportsCodebaseAnalysis: false })
        .enableCodebaseAnalysis,
    ).toBe(false);
  });
});

describe("operating mode", () => {
  it("resolves explicit mode before config and auth fallback", () => {
    expect(
      resolveOperatingMode(defaultConfig, { explicitMode: "team", authenticated: false }),
    ).toBe("team");
  });

  it("uses config mode before auth fallback", () => {
    expect(resolveOperatingMode(defaultConfig, { authenticated: true })).toBe("solo");
  });
});

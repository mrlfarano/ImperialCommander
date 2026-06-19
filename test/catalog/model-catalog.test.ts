import {
  assertModelRoleEligible,
  inferProviderForModel,
  isAllowedProvider,
  loadModelCatalog,
  reconcileMaxTokens,
  resolveTemperature,
} from "../../src/catalog/model-catalog.js";

describe("model catalog", () => {
  it("validates the shipped catalog", () => {
    expect(loadModelCatalog().openai["gpt-4.1"].supported).toBe(true);
  });

  it("infers the provider for a unique model id", () => {
    expect(inferProviderForModel("gpt-4.1")).toBe("openai");
  });

  it("checks provider allow-list membership", () => {
    expect(isAllowedProvider("openai")).toBe(true);
    expect(isAllowedProvider("openai-compatible")).toBe(true);
    expect(isAllowedProvider("not-real")).toBe(false);
  });

  it("rejects role-ineligible models", () => {
    expect(() => assertModelRoleEligible("openai", "gpt-4.1-mini", "research")).toThrow(
      /not allowed/,
    );
  });

  it("caps requested tokens against known and unknown model limits", () => {
    expect(reconcileMaxTokens("openai", "gpt-4.1", 100_000)).toBe(32768);
    expect(reconcileMaxTokens("router", "unknown-model", 100_000)).toBe(4096);
  });

  it("uses a model temperature override when present", () => {
    expect(resolveTemperature("openai", "gpt-4.1", 0.2)).toBe(0.2);
  });
});

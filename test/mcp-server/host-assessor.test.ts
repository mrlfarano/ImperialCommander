import { createHostTaskAssessor } from "../../src/mcp-server/host-sampling.js";

describe("createHostTaskAssessor", () => {
  it("returns undefined when sampling is unavailable", () => {
    expect(createHostTaskAssessor({})).toBeUndefined();
    expect(createHostTaskAssessor({ samplingClient: { supportsSampling: false } })).toBeUndefined();
  });

  it("produces a validated raw assessment from host sampling", async () => {
    const assessor = createHostTaskAssessor({
      samplingClient: {
        supportsSampling: true,
        sampleText: async () =>
          JSON.stringify({
            priority: "high",
            complexityScore: 8,
            recommendedSubtasks: 4,
            reasoning: "auth + payments",
          }),
      },
    });

    if (!assessor) {
      throw new Error("expected an assessor when sampling is available");
    }

    const raw = await assessor({ title: "t", description: "d", details: "x", dependencies: [] });
    expect(raw).toMatchObject({ priority: "high", complexityScore: 8, recommendedSubtasks: 4 });
  });

  it("rejects a malformed assessment that violates the schema", async () => {
    const assessor = createHostTaskAssessor({
      samplingClient: {
        supportsSampling: true,
        sampleText: async () => JSON.stringify({ priority: "urgent", complexityScore: 99 }),
      },
    });

    if (!assessor) {
      throw new Error("expected an assessor when sampling is available");
    }

    await expect(
      assessor({ title: "t", description: "d", details: "x", dependencies: [] }),
    ).rejects.toBeTruthy();
  });
});

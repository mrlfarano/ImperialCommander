import {
  AssessmentRequiredError,
  DEFAULT_ASSESSMENT,
  type TaskAssessmentInput,
  assessMany,
  assessTask,
  complexityLevelForScore,
  toAssessment,
} from "../../src/analysis/assess.js";

const input: TaskAssessmentInput = { title: "t", description: "d", details: "x", dependencies: [] };

describe("assessor core", () => {
  it("derives complexity level from score thresholds", () => {
    expect(complexityLevelForScore(1)).toBe("low");
    expect(complexityLevelForScore(4)).toBe("low");
    expect(complexityLevelForScore(5)).toBe("medium");
    expect(complexityLevelForScore(7)).toBe("medium");
    expect(complexityLevelForScore(8)).toBe("high");
    expect(complexityLevelForScore(10)).toBe("high");
  });

  it("maps a raw assessment to a task assessment with derived level", () => {
    const assessment = toAssessment({
      priority: "high",
      complexityScore: 9,
      recommendedSubtasks: 5,
      reasoning: "big",
    });
    expect(assessment).toEqual({
      priority: "high",
      complexity: { score: 9, level: "high", recommendedSubtasks: 5, reasoning: "big" },
    });
  });

  it("assesses a task through an injected assessor", async () => {
    const assessment = await assessTask(
      async () => ({
        priority: "low",
        complexityScore: 2,
        recommendedSubtasks: 1,
        reasoning: "tiny",
      }),
      input,
    );
    expect(assessment.priority).toBe("low");
    expect(assessment.complexity.level).toBe("low");
  });

  it("uses a default assessment when no assessor is supplied", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(assessTask(undefined, input)).resolves.toEqual(DEFAULT_ASSESSMENT);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("No AI provider configured"));

    warn.mockRestore();
  });

  it("throws AssessmentRequiredError when AI is required", async () => {
    await expect(assessTask(undefined, input, { requireAi: true })).rejects.toBeInstanceOf(
      AssessmentRequiredError,
    );
  });

  it("assesses many inputs in order", async () => {
    const assessor = async (i: TaskAssessmentInput) => ({
      priority: "medium" as const,
      complexityScore: i.title.length,
      recommendedSubtasks: 0,
      reasoning: "len",
    });
    const results = await assessMany(assessor, [
      { ...input, title: "ab" },
      { ...input, title: "abcde" },
    ]);
    expect(results.map((r) => r.complexity.score)).toEqual([2, 5]);
  });

  it("does not require an assessor for an empty batch", async () => {
    await expect(assessMany(undefined, [])).resolves.toEqual([]);
  });
});

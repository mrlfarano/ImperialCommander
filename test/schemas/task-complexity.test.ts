import { TaskComplexitySchema, TaskSchema } from "../../src/schemas/index.js";

describe("task complexity schema", () => {
  it("accepts a valid complexity object", () => {
    const parsed = TaskComplexitySchema.parse({
      score: 8,
      level: "high",
      recommendedSubtasks: 4,
      reasoning: "Touches auth + payments.",
    });
    expect(parsed.level).toBe("high");
  });

  it("rejects out-of-range scores", () => {
    expect(() =>
      TaskComplexitySchema.parse({
        score: 11,
        level: "high",
        recommendedSubtasks: 4,
        reasoning: "x",
      }),
    ).toThrow();
  });

  it("loads a legacy task with no complexity field (back-compat)", () => {
    const task = TaskSchema.parse({
      id: 1,
      title: "Legacy",
      description: "d",
      details: "",
      testStrategy: "",
      status: "pending",
      priority: "medium",
      dependencies: [],
      subtasks: [],
    });
    expect(task.complexity).toBeUndefined();
  });

  it("accepts a task with embedded complexity", () => {
    const task = TaskSchema.parse({
      id: 1,
      title: "Modern",
      description: "d",
      details: "",
      testStrategy: "",
      status: "pending",
      priority: "high",
      dependencies: [],
      subtasks: [],
      complexity: { score: 3, level: "low", recommendedSubtasks: 2, reasoning: "small" },
    });
    expect(task.complexity?.score).toBe(3);
  });
});

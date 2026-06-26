import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TaskAssessor } from "../../src/analysis/assess.js";
import { FileTaskRepository } from "../../src/storage/index.js";
import { addTask } from "../../src/tasks/add-task.js";

const assessor: TaskAssessor = async () => ({
  priority: "low",
  complexityScore: 3,
  recommendedSubtasks: 2,
  reasoning: "assessed",
});

describe("add task", () => {
  let repository: FileTaskRepository;

  beforeEach(async () => {
    const storePath = join(await mkdtemp(join(tmpdir(), "imperial-add-task-")), "tasks.json");
    repository = new FileTaskRepository({ storePath });
  });

  it("assesses priority and complexity for manual tasks", async () => {
    const result = await addTask(repository, {
      title: "First",
      description: "One",
      assessor,
    });

    expect(result.task).toMatchObject({
      id: 1,
      priority: "low",
      complexity: { score: 3, level: "low", recommendedSubtasks: 2 },
    });
  });

  it("lets an explicit --priority override the assessed priority", async () => {
    await addTask(repository, { title: "First", description: "One", assessor });
    const result = await addTask(repository, {
      title: "Second",
      description: "Two",
      dependencies: "1",
      priority: "high",
      assessor,
    });

    expect(result.task).toMatchObject({ priority: "high", dependencies: [1] });
    expect(result.task.complexity?.level).toBe("low");
  });

  it("uses default assessment when no assessor is configured", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await addTask(repository, { title: "X", description: "Y" });

    expect(result.task).toMatchObject({
      priority: "medium",
      complexity: {
        score: 5,
        level: "medium",
        recommendedSubtasks: 0,
        reasoning: "Default assessment — no AI provider configured.",
      },
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("No AI provider configured"));

    warn.mockRestore();
  });

  it("skips assessment when noAi is set", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await addTask(repository, {
      title: "No AI",
      description: "Use manual defaults",
      noAi: true,
      priority: "high",
    });

    expect(result.task.priority).toBe("high");
    expect(result.task.complexity).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });

  it("requires manual title and description when no prompt is supplied", async () => {
    await expect(addTask(repository, { title: "Missing", assessor })).rejects.toThrow(
      /title and description/,
    );
  });

  it("assesses AI-generated tasks and returns telemetry", async () => {
    const result = await addTask(repository, {
      prompt: "Build auth",
      research: true,
      assessor,
      aiGenerator: async ({ prompt, nextId }) => ({
        task: {
          title: `${prompt} ${nextId}`,
          description: "Generated",
          details: "Generated details",
          testStrategy: "Generated tests",
          priority: "medium",
          dependencies: [],
        },
        telemetryData: {
          timestamp: "2026-06-19T12:00:00.000Z",
          commandName: "add-task",
          modelUsed: "test",
          providerName: "test",
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
          totalCost: 0,
          currency: "USD",
        },
      }),
    });

    expect(result.task.title).toBe("Build auth 1");
    expect(result.task.priority).toBe("low"); // assessment wins over generator's "medium"
    expect(result.task.complexity?.score).toBe(3);
    expect(result.telemetryData?.totalTokens).toBe(2);
  });
});

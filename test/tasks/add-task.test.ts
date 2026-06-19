import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileTaskRepository } from "../../src/storage/index.js";
import { addTask } from "../../src/tasks/add-task.js";

describe("add task", () => {
  let repository: FileTaskRepository;

  beforeEach(async () => {
    const storePath = join(await mkdtemp(join(tmpdir(), "imperial-add-task-")), "tasks.json");
    repository = new FileTaskRepository({ storePath });
  });

  it("adds manual tasks with next id and parsed dependencies", async () => {
    await addTask(repository, { title: "First", description: "One" });
    const result = await addTask(repository, {
      title: "Second",
      description: "Two",
      dependencies: "1",
      priority: "high",
    });

    expect(result.task).toMatchObject({
      id: 2,
      title: "Second",
      status: "pending",
      priority: "high",
      dependencies: [1],
      subtasks: [],
    });
  });

  it("requires manual title and description when no prompt is supplied", async () => {
    await expect(addTask(repository, { title: "Missing description" })).rejects.toThrow(
      /title and description/,
    );
  });

  it("supports injectable AI generation and returns telemetry", async () => {
    const result = await addTask(repository, {
      prompt: "Build auth",
      research: true,
      aiGenerator: async ({ prompt, research, nextId }) => ({
        task: {
          title: `${prompt} ${nextId}`,
          description: "Generated",
          details: "Generated details",
          testStrategy: "Generated tests",
          priority: research ? "high" : "medium",
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
    expect(result.task.priority).toBe("high");
    expect(result.telemetryData?.totalTokens).toBe(2);
  });
});

import {
  SubtaskSchema,
  TaskSchema,
  formatSubtaskId,
  formatTaskId,
  isDependencySatisfiedStatus,
  isValidStatus,
  parseTaskId,
} from "../../src/schemas/index.js";

describe("Task and Subtask schemas", () => {
  const validSubtask = {
    id: 1,
    title: "Write parser tests",
    description: "Cover parser inputs",
    details: "Use representative PRD sections",
    status: "pending",
    dependencies: [],
    metadata: { source: "generated" },
  };

  const validTask = {
    id: 5,
    title: "Parse PRD",
    description: "Convert a PRD into tasks",
    details: "Extract functional requirements",
    testStrategy: "Unit test parser fixtures",
    status: "in-progress",
    priority: "high",
    dependencies: [4],
    subtasks: [validSubtask],
  };

  it("accepts valid task and subtask shapes", () => {
    expect(TaskSchema.safeParse(validTask).success).toBe(true);
    expect(SubtaskSchema.safeParse(validSubtask).success).toBe(true);
  });

  it("rejects invalid status, priority, and empty title values", () => {
    expect(TaskSchema.safeParse({ ...validTask, status: "completed" }).success).toBe(false);
    expect(TaskSchema.safeParse({ ...validTask, priority: "urgent" }).success).toBe(false);
    expect(SubtaskSchema.safeParse({ ...validSubtask, title: "" }).success).toBe(false);
  });

  it("accepts string-form ids for API-backed records", () => {
    const task = {
      ...validTask,
      id: "task_5",
      dependencies: ["task_4"],
      subtasks: [
        {
          ...validSubtask,
          id: "subtask_5_1",
          dependencies: ["subtask_5_0"],
        },
      ],
    };

    expect(TaskSchema.safeParse(task).success).toBe(true);
  });
});

describe("status helpers", () => {
  it.each(["pending", "done", "in-progress", "review", "deferred", "cancelled"])(
    "recognizes %s as a valid task status",
    (status) => {
      expect(isValidStatus(status)).toBe(true);
    },
  );

  it("does not treat completed as a valid stored status", () => {
    expect(isValidStatus("completed")).toBe(false);
  });

  it("treats completed as done only for dependency satisfaction", () => {
    expect(isDependencySatisfiedStatus("done")).toBe(true);
    expect(isDependencySatisfiedStatus("completed")).toBe(true);
    expect(isDependencySatisfiedStatus("review")).toBe(false);
    expect(isDependencySatisfiedStatus("cancelled")).toBe(false);
  });
});

describe("dot-notation task ids", () => {
  it("parses parent task ids", () => {
    expect(parseTaskId("5")).toEqual({ taskId: 5 });
  });

  it("parses subtask ids", () => {
    expect(parseTaskId("5.2")).toEqual({ taskId: 5, subtaskId: 2 });
  });

  it("formats ids that parse back to the original numeric parts", () => {
    expect(parseTaskId(formatTaskId(5))).toEqual({ taskId: 5 });
    expect(parseTaskId(formatSubtaskId(5, 2))).toEqual({ taskId: 5, subtaskId: 2 });
  });

  it.each(["", "0", "5.", ".2", "5.0", "5.2.1", "task_5"])(
    "rejects invalid dot-notation id %s",
    (id) => {
      expect(() => parseTaskId(id)).toThrow(`Invalid task id: ${id}`);
    },
  );
});

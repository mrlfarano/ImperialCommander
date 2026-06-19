import { toYaml } from "../../src/tasks/yaml.js";

describe("toYaml", () => {
  it("emits scalars with safe double-quoting", () => {
    const yaml = toYaml({ title: 'He said: "hi"\nbye', count: 3, done: false, missing: null });
    expect(yaml).toContain('title: "He said: \\"hi\\"\\nbye"');
    expect(yaml).toContain("count: 3");
    expect(yaml).toContain("done: false");
    expect(yaml).toContain("missing: null");
  });

  it("inlines scalar arrays and blocks object arrays", () => {
    const yaml = toYaml({
      dependencies: [1, 2],
      empty: [],
      tasks: [{ id: 1, title: "A" }],
    });
    expect(yaml).toContain("dependencies: [1, 2]");
    expect(yaml).toContain("empty: []");
    expect(yaml).toContain("tasks:");
    expect(yaml).toContain("  - id: 1");
    expect(yaml).toContain('    title: "A"');
  });

  it("skips undefined object values and ends with a newline", () => {
    const yaml = toYaml({ a: 1, b: undefined });
    expect(yaml).not.toContain("b:");
    expect(yaml.endsWith("\n")).toBe(true);
  });

  it("emits empty objects as {}", () => {
    expect(toYaml({ meta: {} })).toContain("meta: {}");
  });
});

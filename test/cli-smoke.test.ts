import { createProgram } from "../src/cli/program.js";

describe("CLI smoke", () => {
  it("exposes the expected command name and version option", () => {
    const program = createProgram();

    expect(program.name()).toBe("impcom");
    expect(program.options.some((option) => option.long === "--version")).toBe(true);
  });
});

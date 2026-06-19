import { renderTable } from "../../src/table/render-table.js";

interface Row {
  id: string;
  title: string;
}

const columns = [
  { header: "ID", get: (r: Row) => r.id, align: "right" as const },
  { header: "TITLE", get: (r: Row) => r.title, flex: true },
];

describe("renderTable", () => {
  it("renders aligned, color-free rows with a separator", () => {
    const out = renderTable(columns, [
      { id: "1", title: "Alpha" },
      { id: "20", title: "Beta" },
    ]);
    const lines = out.split("\n");
    expect(lines[0]).toBe("ID TITLE");
    expect(lines[1]).toBe("── ─────");
    expect(lines[2]).toBe(" 1 Alpha");
    expect(lines[3]).toBe("20 Beta ");
  });

  it("truncates the flex column to fit maxWidth with an ellipsis", () => {
    const out = renderTable(columns, [{ id: "1", title: "A very long title indeed" }], {
      maxWidth: 12,
    });
    const dataLine = out.split("\n")[2];
    expect(dataLine.length).toBe(12);
    expect(dataLine.endsWith("…")).toBe(true);
  });
});

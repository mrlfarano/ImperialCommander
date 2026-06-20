export interface TableColumn<Row> {
  header: string;
  get: (row: Row) => string;
  align?: "left" | "right";
  /** At most one column should set flex; it absorbs/truncates to fit maxWidth. */
  flex?: boolean;
  /** Applied to the already-padded cell when color is enabled. */
  color?: (row: Row, text: string) => string;
}

export interface RenderTableOptions {
  color?: boolean;
  maxWidth?: number;
}

const MIN_FLEX_WIDTH = 8;
const COLUMN_GAP = 1;

export function renderTable<Row>(
  columns: TableColumn<Row>[],
  rows: Row[],
  options: RenderTableOptions = {},
): string {
  const color = options.color ?? false;
  const maxWidth = options.maxWidth ?? process.stdout.columns ?? 100;

  const widths = columns.map((column) =>
    Math.max(column.header.length, 1, ...rows.map((row) => column.get(row).length)),
  );

  const flexIndex = columns.findIndex((column) => column.flex);
  if (flexIndex >= 0) {
    const overhead = COLUMN_GAP * (columns.length - 1);
    const others = widths.reduce(
      (sum, width, index) => (index === flexIndex ? sum : sum + width),
      0,
    );
    const available = maxWidth - overhead - others;
    if (available < widths[flexIndex]) {
      // Truncation needed: enforce a minimum readable width
      widths[flexIndex] = Math.max(MIN_FLEX_WIDTH, available);
    }
    // else: natural width fits within maxWidth — leave it unchanged
  }

  const header = columns
    .map((column, index) => fit(column.header, widths[index], "left"))
    .join(" ");
  const separator = widths.map((width) => "─".repeat(width)).join(" ");
  const body = rows.map((row) =>
    columns
      .map((column, index) => {
        const padded = fit(column.get(row), widths[index], column.align ?? "left");
        return color && column.color ? column.color(row, padded) : padded;
      })
      .join(" "),
  );

  return [header, separator, ...body].join("\n");
}

function fit(text: string, width: number, align: "left" | "right"): string {
  const value = text.length > width ? `${text.slice(0, Math.max(0, width - 1))}…` : text;
  return align === "right" ? value.padStart(width) : value.padEnd(width);
}

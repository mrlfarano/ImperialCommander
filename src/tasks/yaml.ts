/**
 * Minimal YAML serializer for derived task exports. Every string scalar is emitted
 * via JSON.stringify, which produces a valid YAML double-quoted scalar (YAML's
 * double-quoted escapes are a superset of JSON's), so newlines/colons/quotes are safe.
 */
export function toYaml(value: unknown): string {
  return `${emit(value, 0).join("\n")}\n`;
}

const pad = (depth: number): string => "  ".repeat(depth);

function isScalar(value: unknown): boolean {
  return value === null || value === undefined || typeof value !== "object";
}

function scalar(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(String(value));
}

function emit(value: unknown, depth: number): string[] {
  if (Array.isArray(value)) {
    return emitArray(value, depth);
  }
  if (value && typeof value === "object") {
    return emitObject(value as Record<string, unknown>, depth);
  }
  return [`${pad(depth)}${scalar(value)}`];
}

function emitArray(items: unknown[], depth: number): string[] {
  const lines: string[] = [];
  for (const item of items) {
    if (isScalar(item)) {
      lines.push(`${pad(depth)}- ${scalar(item)}`);
      continue;
    }
    const child = emit(item, depth + 1);
    const firstContent = child[0].slice((depth + 1) * 2);
    lines.push(`${pad(depth)}- ${firstContent}`);
    lines.push(...child.slice(1));
  }
  return lines;
}

function emitObject(record: Record<string, unknown>, depth: number): string[] {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) {
      continue;
    }
    if (isScalar(value)) {
      lines.push(`${pad(depth)}${key}: ${scalar(value)}`);
    } else if (Array.isArray(value) && value.length === 0) {
      lines.push(`${pad(depth)}${key}: []`);
    } else if (Array.isArray(value) && value.every(isScalar)) {
      lines.push(`${pad(depth)}${key}: [${value.map(scalar).join(", ")}]`);
    } else if (
      !Array.isArray(value) &&
      Object.keys(value as Record<string, unknown>).length === 0
    ) {
      lines.push(`${pad(depth)}${key}: {}`);
    } else {
      lines.push(`${pad(depth)}${key}:`);
      lines.push(...emit(value, depth + 1));
    }
  }
  return lines;
}

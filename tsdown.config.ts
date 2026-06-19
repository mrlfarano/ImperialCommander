import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/bin/impcom.ts", "src/bin/mcp-server.ts"],
  format: ["esm"],
  platform: "node",
  target: "node18",
  clean: true,
  dts: true,
  sourcemap: true,
  shims: true,
});

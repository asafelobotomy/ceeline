import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@asafelobotomy/ceeline-schema": resolve(__dirname, "packages/schema/src/index.ts"),
      "@asafelobotomy/ceeline-core": resolve(__dirname, "packages/core/src/index.ts")
    }
  },
  test: {
    include: ["packages/*/src/**/*.test.ts", "adapters/*/src/**/*.test.ts"]
  }
});

import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@ceeline/schema": resolve(__dirname, "packages/schema/src/index.ts"),
      "@ceeline/core": resolve(__dirname, "packages/core/src/index.ts")
    }
  },
  test: {
    include: ["packages/*/src/**/*.test.ts"]
  }
});

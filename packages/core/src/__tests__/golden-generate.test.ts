/**
 * Generate golden compact text fixtures for all 8 surfaces × 3 densities.
 *
 * Usage: npx vitest run --reporter=verbose packages/core/src/__tests__/golden-generate.test.ts
 *
 * This test file writes .txt fixtures into packages/fixtures/compact/.
 * Run it once to create or update the golden files, then commit them.
 */
import { describe, it } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { renderCeelineCompact } from "../compact";
import { SURFACE_FACTORIES } from "./helpers.js";
import type { CompactDensity } from "@ceeline/schema";

const DENSITIES: CompactDensity[] = ["lite", "full", "dense"];
const FIXTURE_DIR = resolve(__dirname, "../../../../fixtures/compact");

describe("golden fixture generation", () => {
  it("generates all golden compact fixtures", () => {
    mkdirSync(FIXTURE_DIR, { recursive: true });

    for (const [surface, factory] of Object.entries(SURFACE_FACTORIES)) {
      for (const density of DENSITIES) {
        const env = factory();
        const result = renderCeelineCompact(env, density);
        if (!result.ok) {
          throw new Error(`Render failed for ${surface}/${density}: ${result.issues.map(i => i.message).join("; ")}`);
        }
        const filename = `${surface}.${density}.txt`;
        writeFileSync(resolve(FIXTURE_DIR, filename), result.value, "utf-8");
      }
    }
  });
});

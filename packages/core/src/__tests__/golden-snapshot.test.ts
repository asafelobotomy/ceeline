import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderCeelineCompact, parseCeelineCompact } from "../compact";
import { SURFACE_FACTORIES } from "./helpers.js";
import type { CompactDensity, CeelineSurface } from "@ceeline/schema";

const DENSITIES: CompactDensity[] = ["lite", "full", "dense"];
const FIXTURE_DIR = resolve(__dirname, "../../../../fixtures/compact");

function readFixture(surface: string, density: string): string {
  return readFileSync(resolve(FIXTURE_DIR, `${surface}.${density}.txt`), "utf-8");
}

describe("golden compact fixtures — byte-for-byte stability", () => {
  for (const [surface, factory] of Object.entries(SURFACE_FACTORIES)) {
    for (const density of DENSITIES) {
      it(`${surface}/${density} matches golden fixture`, () => {
        const env = factory();
        const result = renderCeelineCompact(env, density);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const golden = readFixture(surface, density);
        expect(result.value).toBe(golden);
      });
    }
  }
});

describe("golden compact fixtures — parse round-trip", () => {
  for (const [surface, factory] of Object.entries(SURFACE_FACTORIES)) {
    for (const density of DENSITIES) {
      it(`${surface}/${density} parses back correctly`, () => {
        const golden = readFixture(surface, density);
        const parsed = parseCeelineCompact(golden);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;

        const p = parsed.value;
        const env = factory();

        // Core fields
        expect(p.surface).toBe(env.surface);
        expect(p.intent).toBe(env.intent);
        expect(p.summary).toBe((env.payload as Record<string, unknown>).summary);

        // Surface-specific: just verify they exist
        switch (surface as CeelineSurface) {
          case "handoff":
            expect(p.surfaceFields.role).toBeDefined();
            expect(p.surfaceFields.target).toBeDefined();
            expect(p.surfaceFields.scope).toBeDefined();
            break;
          case "digest":
            expect(p.surfaceFields.window).toBeDefined();
            expect(p.surfaceFields.status).toBeDefined();
            break;
          case "memory":
            expect(p.surfaceFields.memory_kind).toBeDefined();
            expect(p.surfaceFields.durability).toBeDefined();
            expect(p.surfaceFields.citations).toBeDefined();
            break;
          case "reflection":
            expect(p.surfaceFields.reflection_type).toBeDefined();
            expect(p.surfaceFields.confidence).toBeDefined();
            expect(p.surfaceFields.revision).toBeDefined();
            break;
          case "tool_summary":
            expect(p.surfaceFields.tool_name).toBeDefined();
            expect(p.surfaceFields.outcome).toBeDefined();
            expect(p.surfaceFields.elapsed_ms).toBeDefined();
            break;
          case "routing":
            expect(p.surfaceFields.strategy).toBeDefined();
            expect(p.surfaceFields.candidates).toBeDefined();
            expect(p.surfaceFields.selected).toBeDefined();
            break;
          case "prompt_context":
            expect(p.surfaceFields.phase).toBeDefined();
            expect(p.surfaceFields.priority).toBeDefined();
            expect(p.surfaceFields.source_ref).toBeDefined();
            break;
          case "history":
            expect(p.surfaceFields.span).toBeDefined();
            expect(p.surfaceFields.turn_count).toBeDefined();
            expect(p.surfaceFields.anchor).toBeDefined();
            break;
        }
      });
    }
  }
});

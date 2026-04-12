import { describe, it, expect } from "vitest";
import { renderCeelineCompact } from "../compact";
import { makeHandoff, SURFACE_FACTORIES, withOverrides } from "./helpers.js";
import type { CompactDensity } from "@ceeline/schema";

describe("renderCeelineCompact", () => {
  // ─── Basic rendering succeeds for all surfaces × densities ──────────

  const DENSITIES: CompactDensity[] = ["lite", "full", "dense"];

  for (const [surface, factory] of Object.entries(SURFACE_FACTORIES)) {
    for (const density of DENSITIES) {
      it(`renders '${surface}' at '${density}' density`, () => {
        const env = factory();
        const result = renderCeelineCompact(env, density);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toContain("@cl1");
        }
      });
    }
  }

  // ─── token_budget_exceeded ──────────────────────────────────────────

  it("returns token_budget_exceeded when over budget", () => {
    const env = withOverrides(makeHandoff(), "constraints.max_render_tokens", 1);
    const result = renderCeelineCompact(env, "full");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0].code).toBe("token_budget_exceeded");
    }
  });

  it("succeeds when budget is sufficient", () => {
    const env = withOverrides(makeHandoff(), "constraints.max_render_tokens", 10000);
    const result = renderCeelineCompact(env, "full");
    expect(result.ok).toBe(true);
  });

  it("does not enforce budget when max_render_tokens is 0", () => {
    const env = withOverrides(makeHandoff(), "constraints.max_render_tokens", 0);
    const result = renderCeelineCompact(env, "full");
    expect(result.ok).toBe(true);
  });

  // ─── Integrity trailer ─────────────────────────────────────────────

  it("appends #n= trailer in full density", () => {
    const result = renderCeelineCompact(makeHandoff(), "full");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatch(/ ; #n=\d+$/);
    }
  });

  it("appends #n= trailer in lite density (newline separator)", () => {
    const result = renderCeelineCompact(makeHandoff(), "lite");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatch(/\n#n=\d+$/);
    }
  });

  it("appends #n= trailer in dense density", () => {
    const result = renderCeelineCompact(makeHandoff(), "dense");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatch(/ ; #n=\d+$/);
    }
  });

  // ─── Density differences ───────────────────────────────────────────

  it("lite output is multiline", () => {
    const result = renderCeelineCompact(makeHandoff(), "lite");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.split("\n").length).toBeGreaterThan(1);
    }
  });

  it("full output is single-line (semicolons)", () => {
    const result = renderCeelineCompact(makeHandoff(), "full");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain(" ; ");
      // Should be a single line (no newlines except possibly at end)
      const lines = result.value.trim().split("\n");
      expect(lines.length).toBe(1);
    }
  });

  it("dense is shorter than or equal to full", () => {
    const env = makeHandoff();
    const full = renderCeelineCompact(env, "full");
    const dense = renderCeelineCompact(env, "dense");
    expect(full.ok && dense.ok).toBe(true);
    if (full.ok && dense.ok) {
      expect(dense.value.length).toBeLessThanOrEqual(full.value.length);
    }
  });
});

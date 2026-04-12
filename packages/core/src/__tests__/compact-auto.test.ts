import { describe, it, expect } from "vitest";
import { renderCeelineCompactAuto, renderCeelineCompact } from "../compact";
import { makeHandoff, withOverrides } from "./helpers.js";

describe("renderCeelineCompactAuto", () => {
  // ─── No budget → defaults to full ──────────────────────────────────

  it("uses full density when max_render_tokens is 0", () => {
    const env = makeHandoff();
    const result = renderCeelineCompactAuto(env);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // full density uses ` ; ` separators, single line
      const lines = result.value.trim().split("\n");
      expect(lines.length).toBe(1);
      expect(result.value).toContain(" ; ");
    }
  });

  // ─── operator audience: tries lite first ───────────────────────────

  it("chooses lite for operator audience with large budget", () => {
    let env = withOverrides(makeHandoff(), "constraints.audience", "operator");
    env = withOverrides(env, "constraints.max_render_tokens", 10000);
    const result = renderCeelineCompactAuto(env);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // lite is multiline
      expect(result.value.split("\n").length).toBeGreaterThan(1);
    }
  });

  it("falls back to denser format for operator with tight budget", () => {
    // Measure lite token cost, then set budget between dense and lite
    let env = withOverrides(makeHandoff(), "constraints.audience", "operator");
    env = withOverrides(env, "constraints.max_render_tokens", 0); // no budget to measure

    const liteResult = renderCeelineCompact(env, "lite");
    const denseResult = renderCeelineCompact(env, "dense");
    expect(liteResult.ok && denseResult.ok).toBe(true);
    if (!liteResult.ok || !denseResult.ok) return;

    const liteTokens = Math.ceil(new TextEncoder().encode(liteResult.value).byteLength / 4);
    const denseTokens = Math.ceil(new TextEncoder().encode(denseResult.value).byteLength / 4);

    // Set budget that fits dense but not lite
    const budget = Math.floor((liteTokens + denseTokens) / 2);
    env = withOverrides(makeHandoff(), "constraints.audience", "operator");
    env = withOverrides(env, "constraints.max_render_tokens", budget);

    const result = renderCeelineCompactAuto(env);
    if (result.ok) {
      // If it succeeded it must be single-line (full or dense), not lite
      const lines = result.value.trim().split("\n");
      expect(lines.length).toBe(1);
    }
  });

  // ─── machine audience: tries full first (not lite) ─────────────────

  it("chooses full for machine audience with large budget", () => {
    let env = withOverrides(makeHandoff(), "constraints.audience", "machine");
    env = withOverrides(env, "constraints.max_render_tokens", 10000);
    const result = renderCeelineCompactAuto(env);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // full is single-line
      const lines = result.value.trim().split("\n");
      expect(lines.length).toBe(1);
    }
  });

  // ─── dense fallback ────────────────────────────────────────────────

  it("returns token_budget_exceeded when no density fits", () => {
    let env = withOverrides(makeHandoff(), "constraints.max_render_tokens", 1);
    const result = renderCeelineCompactAuto(env);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0].code).toBe("token_budget_exceeded");
    }
  });

  // ─── Successful result always has trailer ──────────────────────────

  it("includes #n= trailer in auto-selected output", () => {
    let env = withOverrides(makeHandoff(), "constraints.max_render_tokens", 10000);
    const result = renderCeelineCompactAuto(env);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatch(/#n=\d+$/);
    }
  });
});

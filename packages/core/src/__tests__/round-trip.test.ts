import { describe, it, expect } from "vitest";
import { renderCeelineCompact, parseCeelineCompact } from "../compact";
import { SURFACE_FACTORIES } from "./helpers.js";
import type { CompactDensity } from "@ceeline/schema";

const DENSITIES: CompactDensity[] = ["lite", "full", "dense"];

describe("round-trip fidelity (render → parse)", () => {
  for (const [surface, factory] of Object.entries(SURFACE_FACTORIES)) {
    for (const density of DENSITIES) {
      it(`round-trips '${surface}' at '${density}'`, () => {
        const env = factory();
        const rendered = renderCeelineCompact(env, density);
        expect(rendered.ok).toBe(true);
        if (!rendered.ok) return;

        const parsed = parseCeelineCompact(rendered.value);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;

        const p = parsed.value;

        // Core header fields
        expect(p.surface).toBe(env.surface);
        expect(p.intent).toBe(env.intent);
        expect(p.channel).toBe(env.channel);
        expect(p.mode).toBe(env.constraints.mode);
        expect(p.audience).toBe(env.constraints.audience);
        expect(p.fallback).toBe(env.constraints.fallback);
        expect(p.renderStyle).toBe(env.render.style);
        expect(p.sanitizer).toBe(env.render.sanitizer);

        // Common payload
        expect(p.summary).toBe((env.payload as Record<string, unknown>).summary);
        expect(p.facts.length).toBeGreaterThanOrEqual(1);
        expect(p.facts[0]).toBe((env.payload as Record<string, unknown>).facts
          ? ((env.payload as Record<string, unknown>).facts as string[])[0]
          : "");

        // Surface-specific fields
        switch (surface) {
          case "handoff": {
            const payload = env.payload as Record<string, unknown>;
            expect(p.surfaceFields.role).toBe(payload.role);
            expect(p.surfaceFields.target).toBe(payload.target);
            expect(p.surfaceFields.scope).toEqual(payload.scope);
            break;
          }
          case "digest": {
            const payload = env.payload as Record<string, unknown>;
            expect(p.surfaceFields.window).toBe(payload.window);
            expect(p.surfaceFields.status).toBe(payload.status);
            break;
          }
          case "memory": {
            const payload = env.payload as Record<string, unknown>;
            expect(p.surfaceFields.memory_kind).toBe(payload.memory_kind);
            expect(p.surfaceFields.durability).toBe(payload.durability);
            expect(p.surfaceFields.citations).toEqual(payload.citations);
            break;
          }
          case "reflection": {
            const payload = env.payload as Record<string, unknown>;
            expect(p.surfaceFields.reflection_type).toBe(payload.reflection_type);
            expect(p.surfaceFields.confidence).toBe(payload.confidence);
            expect(p.surfaceFields.revision).toBe(payload.revision);
            break;
          }
          case "tool_summary": {
            const payload = env.payload as Record<string, unknown>;
            expect(p.surfaceFields.tool_name).toBe(payload.tool_name);
            expect(p.surfaceFields.outcome).toBe(payload.outcome);
            expect(p.surfaceFields.elapsed_ms).toBe(payload.elapsed_ms);
            break;
          }
          case "routing": {
            const payload = env.payload as Record<string, unknown>;
            expect(p.surfaceFields.strategy).toBe(payload.strategy);
            expect(p.surfaceFields.candidates).toEqual(payload.candidates);
            expect(p.surfaceFields.selected).toBe(payload.selected);
            break;
          }
          case "prompt_context": {
            const payload = env.payload as Record<string, unknown>;
            expect(p.surfaceFields.phase).toBe(payload.phase);
            expect(p.surfaceFields.priority).toBe(payload.priority);
            expect(p.surfaceFields.source_ref).toBe(payload.source_ref);
            break;
          }
          case "history": {
            const payload = env.payload as Record<string, unknown>;
            expect(p.surfaceFields.span).toBe(payload.span);
            expect(p.surfaceFields.turn_count).toBe(payload.turn_count);
            expect(p.surfaceFields.anchor).toBe(payload.anchor);
            break;
          }
        }
      });
    }
  }

  // ─── Dialect version ─────────────────────────────────────────────────

  it("recovers dialect version 1", () => {
    const rendered = renderCeelineCompact(SURFACE_FACTORIES.handoff(), "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;

    const parsed = parseCeelineCompact(rendered.value);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.dialectVersion).toBe(1);
    }
  });

  // ─── Preserve tokens round-trip ──────────────────────────────────────

  it("round-trips preserve tokens", () => {
    const env = SURFACE_FACTORIES.handoff();
    env.preserve = { tokens: ["src/file.ts", "{{VAR}}"], classes: ["file_path", "placeholder"] };
    const rendered = renderCeelineCompact(env, "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;

    const parsed = parseCeelineCompact(rendered.value);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.preserveTokens).toContain("src/file.ts");
      expect(parsed.value.preserveTokens).toContain("{{VAR}}");
    }
  });

  it("round-trips dense prose around repeated protected tokens", () => {
    const env = SURFACE_FACTORIES.handoff();
    env.intent = "review.security";
    env.payload.summary = "Review src/core/codec.ts for security validation.";
    env.payload.facts = [
      "Use src/core/codec.ts and src/core/codec.ts as the source reference.",
      "The validation path must preserve src/core/codec.ts exactly.",
    ];
    env.payload.ask = "Return security findings for src/core/codec.ts.";
    env.preserve = { tokens: ["src/core/codec.ts"], classes: ["file_path"] };

    const rendered = renderCeelineCompact(env, "dense");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;

    const parsed = parseCeelineCompact(rendered.value);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.value.summary).toBe(env.payload.summary);
    expect(parsed.value.facts).toEqual(env.payload.facts);
    expect(parsed.value.ask).toBe(env.payload.ask);
  });

  // ─── Extension round-trip ────────────────────────────────────────────

  it("round-trips extension clauses", () => {
    const env = SURFACE_FACTORIES.handoff() as Record<string, unknown>;
    env.x_copilot_model = "gpt-4o";
    const rendered = renderCeelineCompact(env as any, "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;

    // Extension x_copilot_model → compact key x.copilot_model → parsed as extensions["copilot_model"]
    const parsed = parseCeelineCompact(rendered.value);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.extensions["copilot_model"]).toBe("gpt-4o");
    }
  });

  // ─── Domain round-trip ───────────────────────────────────────────────

  it("round-trips dom= with a single domain", () => {
    const env = SURFACE_FACTORIES.handoff();
    const rendered = renderCeelineCompact(env, "full", { domains: ["sec"] });
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;

    expect(rendered.value).toContain("dom=sec");

    const parsed = parseCeelineCompact(rendered.value);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.domains).toEqual(["sec"]);
    }
  });

  it("round-trips dom= with multiple domains", () => {
    const env = SURFACE_FACTORIES.handoff();
    const rendered = renderCeelineCompact(env, "full", { domains: ["sec", "perf"] });
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;

    expect(rendered.value).toContain("dom=sec+perf");

    const parsed = parseCeelineCompact(rendered.value);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.domains).toEqual(["sec", "perf"]);
    }
  });

  it("omits dom= when no domains specified", () => {
    const env = SURFACE_FACTORIES.handoff();
    const rendered = renderCeelineCompact(env, "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;

    expect(rendered.value).not.toContain("dom=");
  });
});

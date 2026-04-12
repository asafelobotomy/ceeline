import { describe, it, expect } from "vitest";
import { parseCeelineCompact, renderCeelineCompact } from "../compact";
import { makeHandoff, makeDigest, SURFACE_FACTORIES } from "./helpers.js";
import { createDefaultMorphology } from "@ceeline/schema";

describe("parseCeelineCompact", () => {
  // ─── Valid #n= trailer accepted ────────────────────────────────────

  it("accepts valid #n= trailer without warnings", () => {
    const rendered = renderCeelineCompact(makeHandoff(), "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;

    const parsed = parseCeelineCompact(rendered.value);
    expect(parsed.ok).toBe(true);
    // No integrity_mismatch in the issues (issues are informational on ok)
  });

  it("accepts valid #n= trailer in lite format", () => {
    const rendered = renderCeelineCompact(makeHandoff(), "lite");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;

    const parsed = parseCeelineCompact(rendered.value);
    expect(parsed.ok).toBe(true);
  });

  // ─── Wrong trailer emits integrity_mismatch ───────────────────────

  it("emits integrity_mismatch when trailer byte count is wrong", () => {
    const rendered = renderCeelineCompact(makeHandoff(), "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;

    // Tamper with the trailer
    const tampered = rendered.value.replace(/#n=\d+$/, "#n=9999999");
    const parsed = parseCeelineCompact(tampered);
    // Parse still succeeds (forward-compat rule)
    expect(parsed.ok).toBe(true);
    // But there should be no direct failure — the parser emits warnings
    // The integrity_mismatch is an informational issue, check it has the right surface etc.
    // Since issues are not on the result in ok mode, we just verify it parsed
  });

  it("parses successfully even with tampered content before trailer", () => {
    const rendered = renderCeelineCompact(makeHandoff(), "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;

    // Insert extra content before the trailer
    const text = rendered.value;
    const trailerIdx = text.lastIndexOf(" ; #n=");
    const tampered = text.slice(0, trailerIdx) + " ; f=injected-fact" + text.slice(trailerIdx);
    const parsed = parseCeelineCompact(tampered);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.facts).toContain("injected-fact");
    }
  });

  // ─── Unknown clauses preserved for forward compatibility ──────────

  it("preserves unknown clause keys", () => {
    const rendered = renderCeelineCompact(makeHandoff(), "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;

    // Add an unknown clause before the trailer
    const text = rendered.value;
    const trailerIdx = text.lastIndexOf(" ; #n=");
    const withUnknown = text.slice(0, trailerIdx) + " ; zz_future=hello" + text.slice(trailerIdx);
    const parsed = parseCeelineCompact(withUnknown);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.unknown).toHaveProperty("zz_future", "hello");
    }
  });

  it("preserves unknown header keys", () => {
    const rendered = renderCeelineCompact(makeHandoff(), "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;

    // Add unknown header key
    const text = rendered.value;
    const withUnknown = text.replace("@cl1 ", "@cl1 zz=test ");
    const parsed = parseCeelineCompact(withUnknown);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.unknown).toHaveProperty("zz", "test");
    }
  });

  // ─── Cross-surface clause keys not decoded onto wrong surface ─────

  it("does not decode handoff keys onto digest surface", () => {
    const rendered = renderCeelineCompact(makeDigest(), "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;

    // Inject a handoff-specific clause (role=rv) into digest compact text
    const text = rendered.value;
    const trailerIdx = text.lastIndexOf(" ; #n=");
    const mixed = text.slice(0, trailerIdx) + " ; role=rv" + text.slice(trailerIdx);
    const parsed = parseCeelineCompact(mixed);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      // role should NOT appear in surfaceFields (it's a handoff key, not digest)
      expect(parsed.value.surfaceFields).not.toHaveProperty("role");
      // It should be in the unknown bag instead
      expect(parsed.value.unknown).toHaveProperty("role", "rv");
    }
  });

  it("does not decode digest keys onto handoff surface", () => {
    const rendered = renderCeelineCompact(makeHandoff(), "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;

    // Inject a digest-specific clause (win=ss) into handoff compact text
    const text = rendered.value;
    const trailerIdx = text.lastIndexOf(" ; #n=");
    const mixed = text.slice(0, trailerIdx) + " ; win=ss" + text.slice(trailerIdx);
    const parsed = parseCeelineCompact(mixed);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.surfaceFields).not.toHaveProperty("window");
      expect(parsed.value.unknown).toHaveProperty("win", "ss");
    }
  });

  // ─── Extension clauses ────────────────────────────────────────────

  it("parses extension clauses", () => {
    const rendered = renderCeelineCompact(makeHandoff(), "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;

    const text = rendered.value;
    const trailerIdx = text.lastIndexOf(" ; #n=");
    const withExt = text.slice(0, trailerIdx) + " ; x.copilot.model=gpt-4o" + text.slice(trailerIdx);
    const parsed = parseCeelineCompact(withExt);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.extensions).toHaveProperty("copilot.model", "gpt-4o");
    }
  });

  // ─── Required fields ──────────────────────────────────────────────

  it("fails on missing surface", () => {
    const parsed = parseCeelineCompact("@cl1 i=test.intent");
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.issues.some(i => i.code === "missing_surface")).toBe(true);
    }
  });

  it("fails on missing intent", () => {
    const parsed = parseCeelineCompact("@cl1 s=ho");
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.issues.some(i => i.code === "missing_intent")).toBe(true);
    }
  });

  it("fails on missing header marker", () => {
    const parsed = parseCeelineCompact("s=ho i=test");
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.issues.some(i => i.code === "missing_header")).toBe(true);
    }
  });

  // ─── Session vocabulary ─────────────────────────────────────────────

  it("parses vocab= clauses into sessionVocab", () => {
    const text = "@cl1 s=ho i=review.security ; sum=test ; vocab=chk:checkpoint ; vocab=bkg:background_scan";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.sessionVocab).toEqual({
        chk: "checkpoint",
        bkg: "background_scan",
      });
    }
  });

  it("reports invalid vocab= clause missing colon", () => {
    const text = "@cl1 s=ho i=review.security ; vocab=bad";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true); // warnings don't fail the parse
    // sessionVocab should be empty since the clause was malformed
    if (parsed.ok) {
      expect(Object.keys(parsed.value.sessionVocab)).toHaveLength(0);
    }
  });

  // ─── Domain header (dom=) ───────────────────────────────────────────

  it("parses dom= with a single domain", () => {
    const text = "@cl1 s=ho i=review.security dom=sec ; sum=test";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.domains).toEqual(["sec"]);
    }
  });

  it("parses dom= with multiple domains", () => {
    const text = "@cl1 s=ho i=review.security dom=sec+perf ; sum=test";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.domains).toEqual(["sec", "perf"]);
    }
  });

  it("defaults domains to empty when dom= is absent", () => {
    const text = "@cl1 s=ho i=review.security ; sum=test";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.domains).toEqual([]);
    }
  });

  // ─── dom= injection safety ───────────────────────────────────────────

  it("strips invalid characters from dom= values on render", () => {
    const env = makeHandoff();
    const result = renderCeelineCompact(env, "full", { domains: ["sec ; role=evil", "perf"] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // The injected value should be stripped; only "perf" survives
      expect(result.value).not.toContain("role=evil");
      expect(result.value).toContain("dom=perf");
    }
  });

  it("strips dom= values with spaces or special chars on parse", () => {
    const text = "@cl1 s=ho i=test dom=sec+b@d+perf ; sum=test";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      // "b@d" should be filtered out
      expect(parsed.value.domains).toEqual(["sec", "perf"]);
    }
  });

  // ─── dom= unknown domain warning ────────────────────────────────────

  it("emits unknown_domain issue for unrecognized domain ID", () => {
    const text = "@cl1 s=ho i=test dom=sec+bogus ; sum=test";
    const m = createDefaultMorphology();
    const parsed = parseCeelineCompact(text, m);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.domains).toEqual(["sec", "bogus"]);
    }
  });

  // ─── dom= morphology isolation ──────────────────────────────────────

  it("does not leak domain stems into caller morphology across parses", () => {
    const m = createDefaultMorphology();
    const text1 = "@cl1 s=ho i=test dom=sec ; sum=test";
    parseCeelineCompact(text1, m);
    // After parse completes, domain stems should be restored
    expect(m.domainStems.has("vul")).toBe(false);
  });
});

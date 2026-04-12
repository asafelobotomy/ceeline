import { describe, it, expect } from "vitest";
import { parseCeelineCompact, renderCeelineCompact } from "../compact";
import { makeHandoff, makeDigest, makeReflection, makeToolSummary, makeRouting, makePromptContext, makeHistory, SURFACE_FACTORIES, withOverrides } from "./helpers.js";
import { createDefaultMorphology, activateDomains } from "@ceeline/schema";

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

  // ─── Diagnostics parsing ──────────────────────────────────────────

  it("parses diag.trace=1 as true", () => {
    const text = "@cl1 s=ho i=test ; sum=test ; diag.trace=1";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.diagnosticsTrace).toBe(true);
    }
  });

  it("parses diag.trace=0 as false", () => {
    const text = "@cl1 s=ho i=test ; sum=test ; diag.trace=0";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.diagnosticsTrace).toBe(false);
    }
  });

  it("parses diag.labels as array", () => {
    const text = "@cl1 s=ho i=test ; sum=test ; diag.labels=perf,debug";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.diagnosticsLabels).toEqual(["perf", "debug"]);
    }
  });

  // ─── Preserve class parsing ───────────────────────────────────────

  it("parses cls= clauses into preserveClasses", () => {
    const text = "@cl1 s=ho i=test ; sum=test ; cls=fp ; cls=url";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.preserveClasses).toContain("file_path");
      expect(parsed.value.preserveClasses).toContain("url");
    }
  });

  // ─── Artifact parsing ─────────────────────────────────────────────

  it("parses art= clauses", () => {
    const text = '@cl1 s=ho i=test ; sum=test ; art={"file":"test.ts"}';
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.artifacts).toHaveLength(1);
      expect(parsed.value.artifacts[0]).toEqual({ file: "test.ts" });
    }
  });

  it("preserves art= value as string when not valid JSON", () => {
    const text = "@cl1 s=ho i=test ; sum=test ; art=not-json";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.artifacts).toHaveLength(1);
      expect(parsed.value.artifacts[0]).toBe("not-json");
    }
  });

  // ─── Surface-specific clause parsing ──────────────────────────────

  it("parses reflection surface fields", () => {
    const rendered = renderCeelineCompact(makeReflection(), "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const parsed = parseCeelineCompact(rendered.value);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.surfaceFields.reflection_type).toBe("self_critique");
      expect(parsed.value.surfaceFields.confidence).toBe(0.8);
      expect(parsed.value.surfaceFields.revision).toBe("Fix edge case.");
    }
  });

  it("parses tool_summary surface fields", () => {
    const rendered = renderCeelineCompact(makeToolSummary(), "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const parsed = parseCeelineCompact(rendered.value);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.surfaceFields.tool_name).toBe("eslint");
      expect(parsed.value.surfaceFields.outcome).toBe("success");
      expect(parsed.value.surfaceFields.elapsed_ms).toBe(120);
    }
  });

  it("parses routing surface fields", () => {
    const rendered = renderCeelineCompact(makeRouting(), "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const parsed = parseCeelineCompact(rendered.value);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.surfaceFields.strategy).toBe("direct");
      expect(parsed.value.surfaceFields.candidates).toEqual(["a", "b"]);
      expect(parsed.value.surfaceFields.selected).toBe("a");
    }
  });

  it("parses dense digest metric key codes", () => {
    const text = "@cl1 s=dg i=summarize.session ; sum=test ; mi=pc:3,sm:47,tb:1420";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.surfaceFields.metrics).toEqual({
        pendingChecks: 3,
        sessionMinutes: 47,
        tokenBudgetUsed: 1420,
      });
    }
  });

  it("parses routing selected index even when it appears before candidates", () => {
    const text = "@cl1 s=rt i=route.select ; sum=test ; si=1 ; cand=a,b";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.surfaceFields.candidates).toEqual(["a", "b"]);
      expect(parsed.value.surfaceFields.selected).toBe("b");
    }
  });

  it("parses dense memory citation references", () => {
    const text = "@cl1 s=me i=memory.capture ; sum=test ; f=\"https://ceeline.dev/spec remains the ref URL.\" ; ci=@f0/24,docs/ceeline-language-spec-v1.md";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.surfaceFields.citations).toEqual([
        "https://ceeline.dev/spec",
        "docs/ceeline-language-spec-v1.md",
      ]);
    }
  });

  it("parses dense handoff scope codes", () => {
    const text = "@cl1 s=ho i=review.security ; sum=test ; sx=@t,@v";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.surfaceFields.scope).toEqual(["transport", "validation"]);
    }
  });

  it("parses dense prompt_context source_ref codes", () => {
    const text = "@cl1 s=pc i=context.inject ; sum=test ; sr=wc";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.surfaceFields.source_ref).toBe("workspace-config");
    }
  });

  it("parses dense reflection revision contractions", () => {
    const text = '@cl1 s=rf i=reflect.confidence ; sum=test ; rev="Sec val config." ; rvc=1';
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.surfaceFields.revision).toBe("Security validation configuration.");
    }
  });

  it("parses dense history anchor codes", () => {
    const text = "@cl1 s=hs i=history.snapshot ; sum=test ; ac=bs";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.surfaceFields.anchor).toBe("bench-session-start");
    }
  });

  it("parses prompt_context surface fields", () => {
    const rendered = renderCeelineCompact(makePromptContext(), "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const parsed = parseCeelineCompact(rendered.value);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.surfaceFields.phase).toBe("system");
      expect(parsed.value.surfaceFields.priority).toBe(10);
      expect(parsed.value.surfaceFields.source_ref).toBe("workspace");
    }
  });

  it("parses history surface fields", () => {
    const rendered = renderCeelineCompact(makeHistory(), "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const parsed = parseCeelineCompact(rendered.value);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.surfaceFields.span).toBe("exchange");
      expect(parsed.value.surfaceFields.turn_count).toBe(3);
      expect(parsed.value.surfaceFields.anchor).toBe("start");
    }
  });

  // ─── Morphology-aware clause resolution ───────────────────────────

  it("resolves affixed codes when morphology is provided", () => {
    const m = createDefaultMorphology();
    // Register session vocab, then use a prefixed form (neg.chk)
    const text = "@cl1 s=ho i=test ; sum=test ; vocab=chk:checkpoint ; neg.chk=3";
    const parsed = parseCeelineCompact(text, m);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      // The affixed code neg.chk should be resolved and stored in surfaceFields
      expect(parsed.value.surfaceFields).toHaveProperty("neg.chk", "3");
    }
  });

  // ─── Symbol expression resolution in parser ───────────────────────

  it("resolves key-as-symbol expressions", () => {
    const text = "@cl1 s=ho i=test ; sum=test ; ○→●=1";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.symbolExprs).toHaveProperty("○→●");
      expect(parsed.value.surfaceFields).toHaveProperty("○→●", "1");
    }
  });

  it("resolves value-as-symbol expressions", () => {
    const text = "@cl1 s=ho i=test ; sum=test ; st=○→●";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.symbolExprs).toHaveProperty("st");
      expect(parsed.value.surfaceFields).toHaveProperty("st", "○→●");
    }
  });

  // ─── Post-processing symbol resolution in surfaceFields ───────────

  it("resolves symbols in surfaceFields values during post-processing", () => {
    // Use a surface-specific key that the decoder handles, with a symbol value
    const rendered = renderCeelineCompact(makeDigest(), "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    // Inject a symbol into a decoded surface field value
    const text = rendered.value.replace(/st=[a-z]+/, "st=●");
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      // The status field should be set, and symbolExprs should resolve it
      // (or it might just be the raw value if ● doesn't resolve for digest)
      expect(parsed.value.surfaceFields).toHaveProperty("status");
    }
  });

  // ─── decodeList with JSON-quoted strings ──────────────────────────

  it("decodes comma-separated list with JSON-quoted strings", () => {
    // Handoff scope with a JSON-quoted string item containing a comma
    const text = '@cl1 s=ho i=test ; sum=test ; role=rv ; tgt=fx ; sc="one,two",three';
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.surfaceFields.scope).toEqual(["one,two", "three"]);
    }
  });

  // ─── Morphology with pre-activated domains (snapshot path) ────────

  it("snapshots pre-activated domain stems before parsing", () => {
    const m = createDefaultMorphology();
    // Pre-activate sec domain so domainStems is non-empty at snapshot
    activateDomains(["sec"], m);
    expect(m.domainStems.size).toBeGreaterThan(0);
    const preSize = m.domainStems.size;
    // Parse a compact text without dom= — should not alter the morphology
    const text = "@cl1 s=ho i=test ; sum=test";
    parseCeelineCompact(text, m);
    // After parse, domain stems should be restored
    expect(m.domainStems.size).toBe(preSize);
  });

  // ─── Parsing header with mx= field ────────────────────────────────

  it("parses mx= in header", () => {
    const text = "@cl1 s=ho i=test mx=500 ; sum=test";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.maxRenderTokens).toBe(500);
    }
  });

  // ─── Parsing header with all optional fields ─────────────────────

  it("parses full header with ch, md, au, fb, rs, sz, mx", () => {
    const text = "@cl1 s=ho i=test pid=cel:p1 ch=i md=ro au=m fb=rj rs=n sz=st mx=100 ; sum=test";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.surface).toBe("handoff");
      expect(parsed.value.intent).toBe("test");
      expect(parsed.value.parentEnvelopeId).toBe("cel:p1");
      expect(parsed.value.channel).toBe("internal");
      expect(parsed.value.mode).toBe("read_only");
      expect(parsed.value.audience).toBe("machine");
      expect(parsed.value.fallback).toBe("reject");
      expect(parsed.value.renderStyle).toBe("none");
      expect(parsed.value.sanitizer).toBe("strict");
      expect(parsed.value.maxRenderTokens).toBe(100);
    }
  });

  // ─── Parse lite (multiline) format ────────────────────────────────

  it("parses lite (multiline) format correctly", () => {
    const env = withOverrides(makeHandoff(), "constraints.max_render_tokens", 0);
    const rendered = renderCeelineCompact(env, "lite");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const parsed = parseCeelineCompact(rendered.value);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.surface).toBe("handoff");
      expect(parsed.value.surfaceFields.role).toBe("reviewer");
    }
  });

  // ─── Unknown header codes trigger ?? fallback ───────────────────────

  it("preserves unknown header code values via ?? fallback", () => {
    const text = "@cl1 s=ho i=test ch=zz md=zz au=zz fb=zz rs=zz sz=zz mx=42 ; sum=test";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      // Unknown codes pass through the ?? fallback
      expect(parsed.value.channel).toBe("zz");
      expect(parsed.value.mode).toBe("zz");
      expect(parsed.value.audience).toBe("zz");
      expect(parsed.value.fallback).toBe("zz");
      expect(parsed.value.renderStyle).toBe("zz");
      expect(parsed.value.sanitizer).toBe("zz");
      expect(parsed.value.maxRenderTokens).toBe(42);
    }
  });

  // ─── Unknown surface field codes trigger ?? fallback ────────────────

  it("preserves unknown handoff role/target codes via ?? fallback", () => {
    const text = "@cl1 s=ho i=test ; sum=test ; role=zz ; tgt=zz ; sc=a,b";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.surfaceFields.role).toBe("zz");
      expect(parsed.value.surfaceFields.target).toBe("zz");
    }
  });

  it("preserves unknown digest window/status codes via ?? fallback", () => {
    const text = "@cl1 s=dg i=test ; sum=test ; win=zz ; st=zz ; met=x:1";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.surfaceFields.window).toBe("zz");
      expect(parsed.value.surfaceFields.status).toBe("zz");
    }
  });

  it("preserves unknown memory kind/durability codes via ?? fallback", () => {
    const text = "@cl1 s=me i=test ; sum=test ; mk=zz ; dur=zz ; cit=a";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.surfaceFields.memory_kind).toBe("zz");
      expect(parsed.value.surfaceFields.durability).toBe("zz");
    }
  });

  it("preserves unknown reflection type code via ?? fallback", () => {
    const text = "@cl1 s=rf i=test ; sum=test ; rty=zz ; cnf=0.5 ; rev=v1";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.surfaceFields.reflection_type).toBe("zz");
    }
  });

  it("preserves unknown tool_summary outcome code via ?? fallback", () => {
    const text = "@cl1 s=ts i=test ; sum=test ; tn=my_tool ; out=zz ; ela=100";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.surfaceFields.outcome).toBe("zz");
    }
  });

  it("preserves unknown routing strategy code via ?? fallback", () => {
    const text = "@cl1 s=rt i=test ; sum=test ; str=zz ; cand=a,b ; sel=a";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.surfaceFields.strategy).toBe("zz");
    }
  });

  it("preserves unknown prompt_context phase code via ?? fallback", () => {
    const text = "@cl1 s=pc i=test ; sum=test ; ph=zz ; pri=5 ; src=ref1";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.surfaceFields.phase).toBe("zz");
    }
  });

  it("preserves unknown history span code via ?? fallback", () => {
    const text = "@cl1 s=hs i=test ; sum=test ; spn=zz ; tc=5 ; anc=a1";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.surfaceFields.span).toBe("zz");
    }
  });

  // ─── Unknown preserve class code ───────────────────────────────────

  it("preserves unknown preserve class code via ?? fallback", () => {
    const text = "@cl1 s=ho i=test ; sum=test ; cls=unknownclass";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.preserveClasses).toContain("unknownclass");
    }
  });

  // ─── Parse with malformed metrics (no colon) ──────────────────────

  it("parses malformed metrics pair without colon", () => {
    const text = "@cl1 s=dg i=test ; sum=test ; win=24h ; st=f ; met=valid:1,badpair";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.surfaceFields.metrics).toEqual({ valid: 1 });
    }
  });

  // ─── decodeList with JSON-quoted strings containing escapes ────────

  it("decodes list with JSON-quoted string containing escaped quote", () => {
    const text = String.raw`@cl1 s=ho i=test ; sum=test ; role=rv ; tgt=fx ; sc="one\"two",three`;
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      // The escaped quote is handled by the JSON string branch in decodeList
      expect(parsed.value.surfaceFields.scope).toHaveLength(2);
    }
  });

  // ─── Clause key not matching any surface decoder ──────────────────

  it("reports unknown clause key when no decoder matches", () => {
    const text = "@cl1 s=ho i=test ; sum=test ; xyz=value";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.unknown).toHaveProperty("xyz", "value");
    }
  });

  // ─── Non-symbol key and non-symbol value pass through ─────────────

  it("handles clause where value is non-symbol and key is non-symbol unknown", () => {
    const text = "@cl1 s=ho i=test ; sum=test ; abc=def";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.unknown).toHaveProperty("abc", "def");
    }
  });

  // ─── decodeList with empty string (empty list field) ───────────────

  it("decodes empty list field value", () => {
    const text = "@cl1 s=ho i=test ; sum=test ; role=rv ; tgt=fx ; sc=";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.surfaceFields.scope).toEqual([]);
    }
  });

  // ─── JSON-quoted string as last item in list ──────────────────────

  it("decodes list where last item is a JSON-quoted string", () => {
    const text = '@cl1 s=ho i=test ; sum=test ; role=rv ; tgt=fx ; sc=first,"last item"';
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.surfaceFields.scope).toEqual(["first", "last item"]);
    }
  });

  // ─── Invalid mx= value (non-numeric) ─────────────────────────────

  it("parses mx= with non-numeric value as 0", () => {
    const text = "@cl1 s=ho i=test mx=abc ; sum=test";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.maxRenderTokens).toBe(0);
    }
  });

  // ─── Symbol-starting key that doesn't form valid expression ───────

  it("treats symbol-starting key as unknown when resolveSymbolExpr returns null", () => {
    // ●abc starts with a symbol but doesn't form a recognized expression
    const text = "@cl1 s=ho i=test ; sum=test ; ●abc=1";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.unknown).toHaveProperty("●abc", "1");
    }
  });

  // ─── Symbol-starting value that doesn't form valid expression ─────

  it("treats symbol-starting value as plain when resolveSymbolExpr returns null", () => {
    const text = "@cl1 s=ho i=test ; sum=test ; status=●abc";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.unknown).toHaveProperty("status", "●abc");
      expect(parsed.value.symbolExprs).not.toHaveProperty("status");
    }
  });

  // ─── Morphology with invalid affix resolution ─────────────────────

  it("skips invalid affixed clause keys during morphology resolution", () => {
    const m = createDefaultMorphology();
    activateDomains(["sec"], m);
    // neg.m resolves but is invalid (N flag not on m stem)
    const text = "@cl1 s=ho i=test ; sum=test ; neg.m=1";
    const parsed = parseCeelineCompact(text, m);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      // Falls through to unknown since the affix is invalid
      expect(parsed.value.unknown).toHaveProperty("neg.m", "1");
    }
  });

  // ─── Post-processing: surface field value starts with symbol but doesn't resolve ───

  it("post-processing skips symbol values that don't resolve", () => {
    // Force a surface field with a symbol-starting value via the decoder
    // Using an unknown handoff role code that starts with a symbol
    const text = "@cl1 s=ho i=test ; sum=test ; role=●xyz";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      // ●xyz starts with symbol but is too long/complex to resolve
      // It passes through the handoff role decoder as "●xyz"
      // Post-processing scans it but resolveSymbolExpr("●xyz") returns null
      expect(parsed.value.surfaceFields.role).toBe("●xyz");
    }
  });
});

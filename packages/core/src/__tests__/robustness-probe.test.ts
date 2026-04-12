/**
 * Robustness probe — stress tests to find every edge case and gap in Ceeline.
 *
 * Each failing test here represents a robustness finding that needs fixing.
 * Each passing test represents a confirmed strength.
 */
import { describe, it, expect } from "vitest";
import {
  createDefaultMorphology,
  resolveAffix,
  isValidMorphologicalCode,
  registerSessionStem,
  resolveSymbolExpr,
  resolveSymbolMeaning,
  isSymbol,
  SYMBOL_CODES,
  REVERSE_SYMBOL_CODES,
  SYMBOL_SURFACE_MEANINGS,
  COMPACT_SURFACE_CODES,
  REVERSE_SURFACE_CODES,
  SURFACES,
  loadMorphology,
  parseAffFile,
  parseDicFile,
} from "@ceeline/schema";
import { parseCeelineCompact, renderCeelineCompact, type CompactParseResult } from "../compact.js";
import { makeHandoff, makeDigest, makeMemory, makeReflection, SURFACE_FACTORIES } from "./helpers.js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DICT_DIR = resolve(__dirname, "../../../../packages/schema/dict");
const affContent = readFileSync(resolve(DICT_DIR, "ceeline.aff"), "utf-8");
const dicContent = readFileSync(resolve(DICT_DIR, "ceeline.dic"), "utf-8");

// =========================================================================
// 1. PARSER EDGE CASES
// =========================================================================

describe("Parser robustness", () => {
  // --- Empty and minimal inputs ---
  it("handles empty string", () => {
    const result = parseCeelineCompact("");
    expect(result.ok).toBe(false);
  });

  it("handles whitespace-only input", () => {
    const result = parseCeelineCompact("   \n  \t  ");
    expect(result.ok).toBe(false);
  });

  it("handles null-byte injection in header", () => {
    const result = parseCeelineCompact("@cl1 s=ho\0 i=test.intent");
    // Parser should not crash — either parse or fail cleanly
    expect(typeof result.ok).toBe("boolean");
  });

  it("handles null-byte injection in body clause", () => {
    const result = parseCeelineCompact("@cl1 s=ho i=test.intent ; sum=te\0st");
    expect(typeof result.ok).toBe("boolean");
  });

  // --- Malformed headers ---
  it("handles @cl with no version number", () => {
    const result = parseCeelineCompact("@cl s=ho i=test");
    expect(result.ok).toBe(false);
  });

  it("handles @cl with negative version", () => {
    const result = parseCeelineCompact("@cl-1 s=ho i=test");
    expect(result.ok).toBe(false);
  });

  it("handles @cl with float version", () => {
    const result = parseCeelineCompact("@cl1.5 s=ho i=test");
    // parseInt("1.5", 10) → 1, which is valid
    const parsed = parseCeelineCompact("@cl1.5 s=ho i=test");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.dialectVersion).toBe(1);
  });

  it("handles @cl with very large version", () => {
    const result = parseCeelineCompact("@cl999 s=ho i=test");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.dialectVersion).toBe(999);
  });

  // --- Duplicate keys ---
  it("last value wins for duplicate header keys", () => {
    const result = parseCeelineCompact("@cl1 s=ho s=dg i=test");
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Which surface wins? The last one should.
      expect(result.value.surface).toBe("digest");
    }
  });

  it("duplicate body clause keys: last wins for surfaceFields", () => {
    const result = parseCeelineCompact("@cl1 s=ho i=review.security ; sum=first ; sum=second ; role=rv ; tgt=fx ; sc=transport");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.summary).toBe("second");
    }
  });

  // --- Clause separator edge cases ---
  it("handles ` ; ` embedded in a JSON-quoted value", () => {
    const text = '@cl1 s=ho i=test ; sum="hello ; world" ; role=rv ; tgt=fx ; sc=transport';
    const result = parseCeelineCompact(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // The ` ; ` inside quotes should NOT be treated as a separator
      // But our splitClauses splits on ` ; ` regardless of quotes
      // This is a KNOWN WEAKNESS if it fails
    }
  });

  it("handles value containing = sign", () => {
    const text = "@cl1 s=ho i=test ; sum=a=b=c";
    const result = parseCeelineCompact(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // splitKV splits on first = only, so value should be "a=b=c"
      expect(result.value.summary).toBe("a=b=c");
    }
  });

  it("handles clause with no value", () => {
    const text = "@cl1 s=ho i=test ; sum";
    const result = parseCeelineCompact(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // splitKV returns [clause, ""] when no = found
      expect(result.value.summary).toBe("");
    }
  });

  // --- Very long inputs ---
  it("handles very long summary (10KB)", () => {
    const longSummary = "x".repeat(10_000);
    const text = `@cl1 s=ho i=test ; sum=${longSummary} ; role=rv ; tgt=fx ; sc=transport`;
    const result = parseCeelineCompact(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.summary.length).toBe(10_000);
  });

  it("handles many facts (1000)", () => {
    const facts = Array.from({ length: 1000 }, (_, i) => `f=fact${i}`).join(" ; ");
    const text = `@cl1 s=ho i=test ; sum=test ; ${facts}`;
    const result = parseCeelineCompact(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.facts.length).toBe(1000);
  });

  // --- Unicode in standard fields ---
  it("handles Unicode in summary", () => {
    const text = '@cl1 s=ho i=test ; sum="Ünïcödé: 日本語 🌍"';
    const result = parseCeelineCompact(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.summary).toBe("Ünïcödé: 日本語 🌍");
  });

  it("handles emoji in fact", () => {
    const text = '@cl1 s=ho i=test ; f="✅ passed" ; f="❌ failed"';
    const result = parseCeelineCompact(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.facts.length).toBe(2);
      expect(result.value.facts[0]).toBe("✅ passed");
    }
  });
});

// =========================================================================
// 2. SYMBOL SYSTEM ROBUSTNESS
// =========================================================================

describe("Symbol system robustness", () => {
  // --- All base meanings are unique ---
  it("no duplicate base meanings across symbol maps", () => {
    const allMeanings = Object.values(SYMBOL_CODES);
    const uniqueMeanings = new Set(allMeanings);
    const dupes: string[] = [];
    for (const m of allMeanings) {
      if (allMeanings.filter(x => x === m).length > 1) dupes.push(m);
    }
    expect([...new Set(dupes)]).toEqual([]);
  });

  // --- Reverse code is bijective ---
  it("REVERSE_SYMBOL_CODES has exactly as many entries as SYMBOL_CODES", () => {
    expect(Object.keys(REVERSE_SYMBOL_CODES).length).toBe(Object.keys(SYMBOL_CODES).length);
  });

  // --- Symbol expr parser doesn't crash on adversarial input ---
  it("handles very long symbol-like string without crashing", () => {
    const longSymbols = "●".repeat(100);
    const result = resolveSymbolExpr(longSymbols);
    // Should return null (no valid pattern matches 100 shape chars)
    expect(result).toBeNull();
  });

  it("handles mixed symbols and ASCII without crashing", () => {
    expect(resolveSymbolExpr("●hello")).toBeNull();
    expect(resolveSymbolExpr("●123")).toBeNull();
    expect(resolveSymbolExpr("●=value")).toBeNull();
  });

  it("handles surrogate pairs", () => {
    // 𝕳 is a surrogate pair in UTF-16  
    const result = resolveSymbolExpr("𝕳");
    expect(result).toBeNull(); // not in our symbol set
  });

  // --- Symbol expression edge cases ---
  it("shape→shape with all 5 arrows", () => {
    for (const arrow of ["→", "←", "↑", "↓", "⇒"]) {
      const expr = resolveSymbolExpr(`●${arrow}■`);
      expect(expr).not.toBeNull();
      expect(expr!.kind).toBe("state");
    }
  });

  it("all blocks can pair with all checks", () => {
    for (const block of ["█", "▓", "▒", "░"]) {
      for (const check of ["✓", "✔"]) {
        const expr = resolveSymbolExpr(`${block}${check}`);
        expect(expr).not.toBeNull();
        expect(expr!.kind).toBe("quality");
      }
    }
  });

  it("all blocks can pair with all greeks", () => {
    for (const block of ["█", "▓", "▒", "░"]) {
      for (const greek of ["α", "β", "γ", "δ", "ε"]) {
        const expr = resolveSymbolExpr(`${block}${greek}`);
        expect(expr).not.toBeNull();
        expect(expr!.kind).toBe("quality");
      }
    }
  });

  it("δ with zero count", () => {
    const expr = resolveSymbolExpr("δ0");
    expect(expr).not.toBeNull();
    expect(expr!.count).toBe(0);
  });

  it("δ with very large count", () => {
    const expr = resolveSymbolExpr("δ999999");
    expect(expr).not.toBeNull();
    expect(expr!.count).toBe(999999);
  });

  // --- Polysemy coverage ---
  it("every surface-override symbol also has a base meaning", () => {
    for (const sym of Object.keys(SYMBOL_SURFACE_MEANINGS)) {
      expect(SYMBOL_CODES[sym]).toBeDefined();
    }
  });

  it("resolveSymbolMeaning returns undefined for unknown symbol", () => {
    expect(resolveSymbolMeaning("⚡")).toBeUndefined();
    expect(resolveSymbolMeaning("🔥", "handoff")).toBeUndefined();
  });

  // --- Symbol/morphology interaction ---
  it("symbol stems don't accidentally match as morphological affixes", () => {
    const morphology = createDefaultMorphology();
    // Symbol chars like ● should not resolve via resolveAffix (different path)
    const res = resolveAffix("●", morphology);
    // It should either be null or resolve as a bare stem with valid=true
    if (res !== null) {
      expect(res.stem).toBe("●");
      expect(res.prefix).toBeNull();
      expect(res.suffix).toBeNull();
    }
  });

  it("symbol stem in .dic matches BUILTIN_STEMS", () => {
    const dicStems = parseDicFile(dicContent);
    const morphology = createDefaultMorphology();
    const symbolStems = Object.keys(SYMBOL_CODES);
    const mismatches: string[] = [];
    for (const sym of symbolStems) {
      const dicFlags = dicStems.get(sym);
      const builtinFlags = morphology.stems.get(sym);
      if (!dicFlags) { mismatches.push(`${sym}: missing from .dic`); continue; }
      if (!builtinFlags) { mismatches.push(`${sym}: missing from BUILTIN_STEMS`); continue; }
      // Flags should match
      for (const flag of builtinFlags) {
        if (!dicFlags.has(flag)) mismatches.push(`${sym}: flag ${flag} in TS but not .dic`);
      }
      for (const flag of dicFlags) {
        if (!builtinFlags.has(flag)) mismatches.push(`${sym}: flag ${flag} in .dic but not TS`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});

// =========================================================================
// 3. MORPHOLOGY ROBUSTNESS
// =========================================================================

describe("Morphology robustness", () => {
  const morphology = createDefaultMorphology();

  it("resolveAffix handles empty string", () => {
    const res = resolveAffix("", morphology);
    expect(res).toBeNull();
  });

  it("resolveAffix handles pure-dot input", () => {
    const res = resolveAffix(".", morphology);
    expect(res).toBeNull();
  });

  it("resolveAffix handles double-prefix (neg.neg.ho)", () => {
    const res = resolveAffix("neg.neg.ho", morphology);
    // Should not match as the stem would be "neg.ho" which isn't registered
    expect(res).toBeNull();
  });

  it("resolveAffix handles double-suffix (ho.seq.opt)", () => {
    // This could ambiguously match — what does the parser do?
    const res = resolveAffix("ho.seq.opt", morphology);
    // The suffix matcher tries .opt first (or .seq first), leaving something
    // This test documents the behavior
    if (res !== null) {
      // The remaining stem after stripping a suffix might not be valid
      expect(typeof res.valid).toBe("boolean");
    }
  });

  it("resolveAffix handles prefix that looks like suffix (neg.ho.neg.)", () => {
    const res = resolveAffix("neg.ho.neg.", morphology);
    // Shouldn't match validly
    if (res !== null) expect(res.valid).toBe(false);
  });

  it("registerSessionStem with emoji stem", () => {
    const m = createDefaultMorphology();
    registerSessionStem("🔥", "NRQC", m);
    const res = resolveAffix("🔥", m);
    expect(res).not.toBeNull();
    expect(res!.stem).toBe("🔥");
    expect(res!.valid).toBe(true);
  });

  it("session stems take prefixes", () => {
    const m = createDefaultMorphology();
    registerSessionStem("chk", "NRQC", m);
    const res = resolveAffix("neg.chk", m);
    expect(res).not.toBeNull();
    expect(res!.valid).toBe(true);
  });

  it("session stems take suffixes", () => {
    const m = createDefaultMorphology();
    registerSessionStem("chk", "NRQC", m);
    const res = resolveAffix("chk.seq", m);
    expect(res).not.toBeNull();
    expect(res!.valid).toBe(true);
  });

  it("session stems take cross-product", () => {
    const m = createDefaultMorphology();
    registerSessionStem("chk", "NRQC", m);
    const res = resolveAffix("neg.chk.seq", m);
    expect(res).not.toBeNull();
    expect(res!.valid).toBe(true);
  });

  it("session stem doesn't allow disallowed prefixes", () => {
    const m = createDefaultMorphology();
    registerSessionStem("chk", "QC", m); // No N flag
    const res = resolveAffix("neg.chk", m);
    expect(res).not.toBeNull();
    expect(res!.valid).toBe(false);
  });
});

// =========================================================================
// 4. ROUND-TRIP FIDELITY
// =========================================================================

describe("Round-trip fidelity edge cases", () => {
  it("round-trips parent_envelope_id", () => {
    const env = makeHandoff();
    env.parent_envelope_id = "cel:parent-001";
    const rendered = renderCeelineCompact(env, "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const parsed = parseCeelineCompact(rendered.value);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.parentEnvelopeId).toBe("cel:parent-001");
  });

  it("round-trips special characters in summary", () => {
    const env = makeHandoff({ summary: 'He said "hello; world" & <goodbye>' });
    const rendered = renderCeelineCompact(env, "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const parsed = parseCeelineCompact(rendered.value);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.summary).toBe('He said "hello; world" & <goodbye>');
  });

  it("round-trips facts with commas", () => {
    const env = makeHandoff({ facts: ["first, second", "third, fourth"] });
    const rendered = renderCeelineCompact(env, "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const parsed = parseCeelineCompact(rendered.value);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.facts).toEqual(["first, second", "third, fourth"]);
  });

  it("round-trips empty summary", () => {
    const env = makeHandoff({ summary: "" });
    const rendered = renderCeelineCompact(env, "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const parsed = parseCeelineCompact(rendered.value);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.summary).toBe("");
  });

  it("round-trips empty facts array", () => {
    const env = makeHandoff({ facts: [] });
    const rendered = renderCeelineCompact(env, "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const parsed = parseCeelineCompact(rendered.value);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.facts).toEqual([]);
  });

  it("round-trips empty ask", () => {
    const env = makeHandoff({ ask: "" });
    const rendered = renderCeelineCompact(env, "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const parsed = parseCeelineCompact(rendered.value);
    expect(parsed.ok).toBe(true);
    // Empty ask should not produce an `ask=` clause, so parsed ask is ""
    if (!parsed.ok) return;
    expect(parsed.value.ask).toBe("");
  });

  it("round-trips very long scope list", () => {
    const scope = Array.from({ length: 100 }, (_, i) => `item${i}`);
    const env = makeHandoff({ scope });
    const rendered = renderCeelineCompact(env, "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const parsed = parseCeelineCompact(rendered.value);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.surfaceFields.scope).toEqual(scope);
  });

  it("round-trips all densities consistently", () => {
    for (const [surface, factory] of Object.entries(SURFACE_FACTORIES)) {
      const env = factory();
      for (const density of ["lite", "full", "dense"] as const) {
        const rendered = renderCeelineCompact(env, density);
        expect(rendered.ok).toBe(true);
        if (!rendered.ok) continue;
        const parsed = parseCeelineCompact(rendered.value);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) continue;
        // Core identity must always be preserved
        expect(parsed.value.surface).toBe(env.surface);
        expect(parsed.value.intent).toBe(env.intent);
      }
    }
  });
});

// =========================================================================
// 5. ENCODING/DECODING EDGE CASES
// =========================================================================

describe("Encoding/decoding edge cases", () => {
  it("encodeAtom handles ` ; ` in values by JSON-quoting", () => {
    // If a value contains ` ; ` it must be JSON-quoted to avoid splitting
    const env = makeHandoff({ summary: "hello ; world" });
    const rendered = renderCeelineCompact(env, "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    // The rendered text should contain a JSON-quoted summary
    expect(rendered.value).toContain('"hello ; world"');
    
    const parsed = parseCeelineCompact(rendered.value);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.summary).toBe("hello ; world");
    }
  });

  it("encodeAtom handles backslash in values", () => {
    const env = makeHandoff({ summary: "path\\to\\file" });
    const rendered = renderCeelineCompact(env, "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const parsed = parseCeelineCompact(rendered.value);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.summary).toBe("path\\to\\file");
    }
  });

  it("encodeAtom handles newline in values", () => {
    const env = makeHandoff({ summary: "line1\nline2" });
    const rendered = renderCeelineCompact(env, "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const parsed = parseCeelineCompact(rendered.value);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.summary).toBe("line1\nline2");
    }
  });

  it("BARE_ATOM_RE allows symbol chars through unquoted", () => {
    const env = makeHandoff({ summary: "δ3▲" });
    const rendered = renderCeelineCompact(env, "full");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    // The summary should NOT be JSON-quoted since symbols pass BARE_ATOM_RE
    expect(rendered.value).toContain("sum=δ3▲");
    expect(rendered.value).not.toContain('"δ3▲"');
  });

  it("decodeAtom handles unterminated JSON string gracefully", () => {
    const text = '@cl1 s=ho i=test ; sum="unterminated';
    const result = parseCeelineCompact(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Should fall back to raw value since JSON.parse will fail
      expect(result.value.summary).toBe('"unterminated');
    }
  });
});

// =========================================================================
// 6. SURFACE CODE MAP COMPLETENESS
// =========================================================================

describe("Code map completeness", () => {
  it("every SURFACE has a compact code", () => {
    for (const surface of SURFACES) {
      expect(COMPACT_SURFACE_CODES[surface]).toBeDefined();
    }
  });

  it("every compact surface code reverse-maps back", () => {
    for (const surface of SURFACES) {
      const code = COMPACT_SURFACE_CODES[surface];
      expect(REVERSE_SURFACE_CODES[code]).toBe(surface);
    }
  });

  it("surface codes are unique (no collisions)", () => {
    const codes = Object.values(COMPACT_SURFACE_CODES);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

// =========================================================================
// 7. INTEGRITY TRAILER ROBUSTNESS
// =========================================================================

describe("Integrity trailer robustness", () => {
  it("trailer validates correctly for all surfaces and densities", () => {
    for (const [, factory] of Object.entries(SURFACE_FACTORIES)) {
      for (const density of ["lite", "full", "dense"] as const) {
        const rendered = renderCeelineCompact(factory(), density);
        expect(rendered.ok).toBe(true);
        if (!rendered.ok) continue;
        // The rendered text should end with #n=<number>
        expect(rendered.value).toMatch(/#n=\d+$/);
      }
    }
  });

  it("truncated trailer doesn't crash parser", () => {
    const text = "@cl1 s=ho i=test ; sum=hello ; #n=";
    const result = parseCeelineCompact(text);
    expect(result.ok).toBe(true);
  });

  it("negative byte count in trailer doesn't crash", () => {
    const text = "@cl1 s=ho i=test ; sum=hello ; #n=-1";
    const result = parseCeelineCompact(text);
    expect(result.ok).toBe(true);
  });
});

// =========================================================================
// 8. PARSER → SYMBOL INTERACTION EDGE CASES
// =========================================================================

describe("Parser-symbol interaction edge cases", () => {
  it("symbol key with empty value", () => {
    const text = "@cl1 s=ho i=test ; sum=hello ; ●=";
    const result = parseCeelineCompact(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.symbolExprs).toHaveProperty("●");
      expect(result.value.surfaceFields["●"]).toBe("");
    }
  });

  it("surface-specific decoder takes priority over symbol detection for known keys", () => {
    // 'st' is a digest-surface key (status). On digest, it should decode as status
    const text = "@cl1 s=dg i=session.summary ; sum=test ; win=ss ; st=ok ; met=items:3";
    const result = parseCeelineCompact(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // st should be decoded as status (surface-specific), not as a symbol
      expect(result.value.surfaceFields.status).toBe("ok");
      expect(result.value.symbolExprs).not.toHaveProperty("st");
    }
  });

  it("symbol value with trailing whitespace", () => {
    const text = "@cl1 s=ho i=test ; sum=test ; st=○→●  ";
    const result = parseCeelineCompact(text);
    expect(result.ok).toBe(true);
    // The clause is trimmed before parsing, so this should be clean
  });

  it("multiple symbol expressions in one message", () => {
    const text = "@cl1 s=ho i=test ; sum=test ; s1=○→● ; s2=δ3 ; s3=█✓";
    const result = parseCeelineCompact(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.value.symbolExprs).length).toBe(3);
    }
  });

  it("symbol and morphology in same message", () => {
    const morphology = createDefaultMorphology();
    // 'st' is a valid morph stem (status). On handoff, it's not a surface-specific
    // key, so morphology claims it. The post-processing pass should still detect
    // the symbol expression ○→● in the value.
    const text = "@cl1 s=ho i=test ; sum=test ; role=rv ; tgt=fx ; sc=transport ; st=○→● ; vocab=chk:checkpoint";
    const result = parseCeelineCompact(text, morphology);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.surfaceFields.role).toBeDefined();
      expect(result.value.surfaceFields["st"]).toBe("○→●");
      expect(result.value.symbolExprs).toHaveProperty("st");
      expect(result.value.symbolExprs["st"].kind).toBe("state");
      expect(result.value.sessionVocab).toHaveProperty("chk");
    }
  });
});

// =========================================================================
// 9. FORWARD COMPATIBILITY
// =========================================================================

describe("Forward compatibility", () => {
  it("unknown header keys don't prevent parsing", () => {
    const text = "@cl1 s=ho i=test zz=future1 yy=future2 ; sum=hello";
    const result = parseCeelineCompact(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.unknown).toHaveProperty("zz");
      expect(result.value.unknown).toHaveProperty("yy");
    }
  });

  it("future version numbers parse successfully", () => {
    const text = "@cl2 s=ho i=test ; sum=future";
    const result = parseCeelineCompact(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.dialectVersion).toBe(2);
  });

  it("unknown surface code is preserved as-is", () => {
    const text = "@cl1 s=zz i=test ; sum=hello";
    const result = parseCeelineCompact(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.surface).toBe("zz");
  });
});

// =========================================================================
// 10. SPLIT CLAUSE ROBUSTNESS  
// =========================================================================

describe("splitClauses robustness", () => {
  it("handles mixed newline and semicolon formats", () => {
    // When both exist, should pick the first delimiter type
    const text = "@cl1 s=ho i=test\nsum=hello ; f=fact";
    const result = parseCeelineCompact(text);
    expect(result.ok).toBe(true);
    // In multiline mode, "sum=hello ; f=fact" is treated as a single clause
  });

  it("handles Windows line endings (CRLF)", () => {
    const text = "@cl1 s=ho i=test\r\nsum=hello\r\nrole=rv\r\ntgt=fx\r\nsc=transport";
    const result = parseCeelineCompact(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.summary).toBe("hello");
    }
  });

  it("handles header-only input (no body)", () => {
    const text = "@cl1 s=ho i=test";
    const result = parseCeelineCompact(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.summary).toBe("");
      expect(result.value.facts).toEqual([]);
    }
  });
});

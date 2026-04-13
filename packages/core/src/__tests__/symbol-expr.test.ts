import { describe, it, expect } from "vitest";
import {
  resolveSymbolExpr,
  resolveSymbolMeaning,
  isSymbol,
  SYMBOL_CODES,
  REVERSE_SYMBOL_CODES,
  SYMBOL_SURFACE_MEANINGS,
  type SymbolExpr,
} from "@asafelobotomy/ceeline-schema";
import { parseCeelineCompact } from "../compact.js";

// =========================================================================
// Layer 1 — Single symbol atoms
// =========================================================================

describe("Layer 1: single symbol atoms", () => {
  it("recognizes all Greek letters", () => {
    for (const [sym, meaning] of Object.entries({
      "α": "primary", "β": "secondary", "γ": "tertiary", "δ": "delta",
      "ε": "epsilon", "λ": "transform", "μ": "mean", "π": "pipeline",
      "σ": "standard", "ω": "final", "Σ": "sum",
    })) {
      expect(isSymbol(sym)).toBe(true);
      const expr = resolveSymbolExpr(sym);
      expect(expr).not.toBeNull();
      expect(expr!.kind).toBe("operator");
      expect(expr!.baseMeaning).toBe(meaning);
      expect(expr!.symbols).toEqual([sym]);
    }
  });

  it("recognizes all arrows", () => {
    for (const [sym, meaning] of Object.entries({
      "→": "to", "←": "from", "↑": "up", "↓": "down", "⇒": "implies",
    })) {
      expect(isSymbol(sym)).toBe(true);
      const expr = resolveSymbolExpr(sym);
      expect(expr).not.toBeNull();
      expect(expr!.kind).toBe("flow");
      expect(expr!.baseMeaning).toBe(meaning);
    }
  });

  it("recognizes all shapes", () => {
    for (const [sym, meaning] of Object.entries({
      "●": "active", "○": "pending", "■": "complete", "□": "paused",
      "▲": "high", "▼": "low", "▶": "process", "◆": "key", "◇": "optional",
    })) {
      expect(isSymbol(sym)).toBe(true);
      const expr = resolveSymbolExpr(sym);
      expect(expr).not.toBeNull();
      expect(expr!.kind).toBe("state");
      expect(expr!.baseMeaning).toBe(meaning);
    }
  });

  it("recognizes all block elements", () => {
    for (const [sym, meaning] of Object.entries({
      "█": "conf_full", "▓": "conf_high", "▒": "conf_med", "░": "conf_low",
    })) {
      expect(isSymbol(sym)).toBe(true);
      const expr = resolveSymbolExpr(sym);
      expect(expr).not.toBeNull();
      expect(expr!.kind).toBe("quality");
      expect(expr!.baseMeaning).toBe(meaning);
    }
  });

  it("recognizes check marks", () => {
    expect(isSymbol("✓")).toBe(true);
    expect(isSymbol("✔")).toBe(true);
  });

  it("resolves check marks as atom kind", () => {
    const expr1 = resolveSymbolExpr("✓");
    expect(expr1).not.toBeNull();
    expect(expr1!.kind).toBe("atom");
    expect(expr1!.baseMeaning).toBe("ok");
    const expr2 = resolveSymbolExpr("✔");
    expect(expr2).not.toBeNull();
    expect(expr2!.kind).toBe("atom");
    expect(expr2!.baseMeaning).toBe("confirmed");
  });

  it("reverse lookup round-trips", () => {
    for (const [sym, meaning] of Object.entries(SYMBOL_CODES)) {
      expect(REVERSE_SYMBOL_CODES[meaning]).toBe(sym);
    }
  });

  it("returns null for non-symbol text", () => {
    expect(resolveSymbolExpr("hello")).toBeNull();
    expect(resolveSymbolExpr("")).toBeNull();
    expect(resolveSymbolExpr("123")).toBeNull();
  });
});

// =========================================================================
// Layer 2 — Compound expressions
// =========================================================================

describe("Layer 2: compound expressions", () => {
  // -- State transitions --
  it("parses shape→shape as state transition", () => {
    const expr = resolveSymbolExpr("○→●");
    expect(expr).not.toBeNull();
    expect(expr!.kind).toBe("state");
    expect(expr!.symbols).toEqual(["○", "→", "●"]);
    expect(expr!.baseMeaning).toBe("pending_to_active");
  });

  it("parses ●→■ (active→complete)", () => {
    const expr = resolveSymbolExpr("●→■");
    expect(expr).not.toBeNull();
    expect(expr!.kind).toBe("state");
    expect(expr!.baseMeaning).toBe("active_to_complete");
  });

  it("parses □→● (paused→active)", () => {
    const expr = resolveSymbolExpr("□→●");
    expect(expr).not.toBeNull();
    expect(expr!.kind).toBe("state");
    expect(expr!.baseMeaning).toBe("paused_to_active");
  });

  // -- Flow expressions --
  it("parses →● as flow directive", () => {
    const expr = resolveSymbolExpr("→●");
    expect(expr).not.toBeNull();
    expect(expr!.kind).toBe("flow");
    expect(expr!.baseMeaning).toBe("to_active");
  });

  it("parses ←↑ as escalate-upstream", () => {
    const expr = resolveSymbolExpr("←↑");
    expect(expr).not.toBeNull();
    expect(expr!.kind).toBe("flow");
    expect(expr!.baseMeaning).toBe("from_up");
  });

  it("parses ⇒■ as implies-complete", () => {
    const expr = resolveSymbolExpr("⇒■");
    expect(expr).not.toBeNull();
    expect(expr!.kind).toBe("flow");
    expect(expr!.baseMeaning).toBe("implies_complete");
  });

  // -- Quality expressions --
  it("parses █✓ as conf_full-ok", () => {
    const expr = resolveSymbolExpr("█✓");
    expect(expr).not.toBeNull();
    expect(expr!.kind).toBe("quality");
    expect(expr!.baseMeaning).toBe("conf_full_ok");
  });

  it("parses ▒γ as conf_med-tertiary", () => {
    const expr = resolveSymbolExpr("▒γ");
    expect(expr).not.toBeNull();
    expect(expr!.kind).toBe("quality");
    expect(expr!.baseMeaning).toBe("conf_med_tertiary");
  });

  it("parses ░≈ as conf_low-approximately", () => {
    const expr = resolveSymbolExpr("░≈");
    expect(expr).not.toBeNull();
    expect(expr!.kind).toBe("quality");
    expect(expr!.baseMeaning).toBe("conf_low_approximately");
  });

  // -- Operator expressions --
  it("parses δ3 as delta-with-count", () => {
    const expr = resolveSymbolExpr("δ3");
    expect(expr).not.toBeNull();
    expect(expr!.kind).toBe("operator");
    expect(expr!.count).toBe(3);
    expect(expr!.baseMeaning).toBe("delta");
  });

  it("parses δ42 as delta-with-large-count", () => {
    const expr = resolveSymbolExpr("δ42");
    expect(expr).not.toBeNull();
    expect(expr!.count).toBe(42);
  });

  it("parses λ→μ as transform-to-mean", () => {
    const expr = resolveSymbolExpr("λ→μ");
    expect(expr).not.toBeNull();
    expect(expr!.kind).toBe("operator");
    expect(expr!.baseMeaning).toBe("transform_to_mean");
  });

  it("parses ε≤θ as epsilon-at_most-threshold", () => {
    const expr = resolveSymbolExpr("ε≤θ");
    expect(expr).not.toBeNull();
    expect(expr!.kind).toBe("operator");
    expect(expr!.baseMeaning).toBe("epsilon_at_most_threshold");
  });

  it("parses Σδ as sum-delta", () => {
    const expr = resolveSymbolExpr("Σδ");
    expect(expr).not.toBeNull();
    expect(expr!.kind).toBe("operator");
    expect(expr!.baseMeaning).toBe("sum_delta");
  });

  it("parses ∀σ as for_all-standard", () => {
    const expr = resolveSymbolExpr("∀σ");
    expect(expr).not.toBeNull();
    expect(expr!.kind).toBe("operator");
    expect(expr!.baseMeaning).toBe("for_all_standard");
  });
});

// =========================================================================
// Layer 3 — Surface-dependent polysemy
// =========================================================================

describe("Layer 3: surface-dependent polysemy", () => {
  it("● resolves differently per surface", () => {
    expect(resolveSymbolMeaning("●", "handoff")).toBe("claimed");
    expect(resolveSymbolMeaning("●", "routing")).toBe("live");
    expect(resolveSymbolMeaning("●", "digest")).toBe("confirmed");
    expect(resolveSymbolMeaning("●", "reflection")).toBe("certain");
    expect(resolveSymbolMeaning("●")).toBe("active"); // base
  });

  it("○ resolves differently per surface", () => {
    expect(resolveSymbolMeaning("○", "handoff")).toBe("unclaimed");
    expect(resolveSymbolMeaning("○", "routing")).toBe("inactive");
    expect(resolveSymbolMeaning("○", "digest")).toBe("unverified");
    expect(resolveSymbolMeaning("○")).toBe("pending"); // base
  });

  it("→ resolves differently per surface", () => {
    expect(resolveSymbolMeaning("→", "handoff")).toBe("transfers_to");
    expect(resolveSymbolMeaning("→", "routing")).toBe("routes_to");
    expect(resolveSymbolMeaning("→", "memory")).toBe("derived_from");
    expect(resolveSymbolMeaning("→")).toBe("to"); // base
  });

  it("δ resolves differently per surface", () => {
    expect(resolveSymbolMeaning("δ", "handoff")).toBe("changed");
    expect(resolveSymbolMeaning("δ", "digest")).toBe("diff");
    expect(resolveSymbolMeaning("δ", "reflection")).toBe("self_correction");
    expect(resolveSymbolMeaning("δ", "memory")).toBe("updated");
    expect(resolveSymbolMeaning("δ")).toBe("delta"); // base
  });

  it("▲ overrides per surface", () => {
    expect(resolveSymbolMeaning("▲", "handoff")).toBe("high_severity");
    expect(resolveSymbolMeaning("▲", "routing")).toBe("high_priority");
    expect(resolveSymbolMeaning("▲", "reflection")).toBe("confidence_up");
    expect(resolveSymbolMeaning("▲")).toBe("high"); // base
  });

  it("compound expression uses surface context", () => {
    // ○→● in handoff = unclaimed_transfers_to_claimed
    const expr = resolveSymbolExpr("○→●", "handoff");
    expect(expr).not.toBeNull();
    expect(expr!.baseMeaning).toBe("unclaimed_transfers_to_claimed");
  });

  it("δ3 in handoff means 3 changes", () => {
    const expr = resolveSymbolExpr("δ3", "handoff");
    expect(expr).not.toBeNull();
    expect(expr!.baseMeaning).toBe("changed");
    expect(expr!.count).toBe(3);
  });

  it("δ3 in reflection means 3 self-corrections", () => {
    const expr = resolveSymbolExpr("δ3", "reflection");
    expect(expr).not.toBeNull();
    expect(expr!.baseMeaning).toBe("self_correction");
    expect(expr!.count).toBe(3);
  });

  it("falls back to base meaning for unknown surface", () => {
    expect(resolveSymbolMeaning("●", "unknown_surface")).toBe("active");
    expect(resolveSymbolMeaning("→", "nonexistent")).toBe("to");
  });
});

// =========================================================================
// Parser integration — symbol expressions in compact text
// =========================================================================

describe("compact parser: symbol expressions", () => {
  it("parses symbol value in clause (st=○→●)", () => {
    const text = "@cl1 s=ho i=review.security ; sum=test ; st=○→●";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.symbolExprs).toHaveProperty("st");
    expect(parsed.value.symbolExprs["st"].kind).toBe("state");
    expect(parsed.value.symbolExprs["st"].baseMeaning).toBe("unclaimed_transfers_to_claimed");
    expect(parsed.value.surfaceFields).toHaveProperty("st", "○→●");
  });

  it("parses symbol key as clause key (●=1)", () => {
    const text = "@cl1 s=ho i=review.security ; sum=test ; ●=1";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.symbolExprs).toHaveProperty("●");
    expect(parsed.value.symbolExprs["●"].kind).toBe("state");
    expect(parsed.value.surfaceFields).toHaveProperty("●", "1");
  });

  it("parses compound symbol key (○→●=done)", () => {
    const text = "@cl1 s=ho i=review.security ; sum=test ; ○→●=done";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.symbolExprs).toHaveProperty("○→●");
    expect(parsed.value.symbolExprs["○→●"].kind).toBe("state");
    expect(parsed.value.surfaceFields).toHaveProperty("○→●", "done");
  });

  it("parses δ3 as operator in value", () => {
    const text = "@cl1 s=ho i=review.security ; sum=test ; changes=δ3";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.symbolExprs).toHaveProperty("changes");
    expect(parsed.value.symbolExprs["changes"].count).toBe(3);
  });

  it("parses quality expression in value (█✓)", () => {
    const text = "@cl1 s=ho i=review.security ; sum=test ; conf=█✓";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.symbolExprs).toHaveProperty("conf");
    expect(parsed.value.symbolExprs["conf"].kind).toBe("quality");
  });

  it("uses surface context for polysemy in parsed exprs", () => {
    // In digest surface, δ means "diff"
    const text = "@cl1 s=dg i=session.summary ; sum=test ; changes=δ3";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.symbolExprs["changes"].baseMeaning).toBe("diff");
  });

  it("non-symbol clauses still work alongside symbols", () => {
    const text = "@cl1 s=ho i=review.security ; sum=test ; role=rv ; st=○→● ; f=check_auth";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.surfaceFields).toHaveProperty("role");
    expect(parsed.value.symbolExprs).toHaveProperty("st");
    expect(parsed.value.facts).toContain("check_auth");
  });
});

// =========================================================================
// Symbol expression edge cases (coverage gaps)
// =========================================================================

describe("symbol expression edge cases", () => {
  it("returns null for empty string", () => {
    expect(resolveSymbolExpr("")).toBeNull();
  });

  it("returns null for non-symbol string", () => {
    expect(resolveSymbolExpr("hello")).toBeNull();
  });

  it("resolves block + math as quality expression (█≤)", () => {
    const expr = resolveSymbolExpr("█≤");
    expect(expr).not.toBeNull();
    expect(expr!.kind).toBe("quality");
    expect(expr!.baseMeaning).toContain("conf_full");
    expect(expr!.baseMeaning).toContain("at_most");
  });

  it("resolves block + check as quality expression (▒✓)", () => {
    const expr = resolveSymbolExpr("▒✓");
    expect(expr).not.toBeNull();
    expect(expr!.kind).toBe("quality");
    expect(expr!.baseMeaning).toContain("conf_med");
  });

  it("resolves math-led + greek as operator (≤δ)", () => {
    const expr = resolveSymbolExpr("≤δ");
    expect(expr).not.toBeNull();
    expect(expr!.kind).toBe("operator");
    expect(expr!.baseMeaning).toContain("at_most");
    expect(expr!.baseMeaning).toContain("delta");
  });

  it("resolves quantifier-led operator (∀σ)", () => {
    const expr = resolveSymbolExpr("∀σ");
    expect(expr).not.toBeNull();
    expect(expr!.kind).toBe("operator");
    expect(expr!.baseMeaning).toContain("for_all");
    expect(expr!.baseMeaning).toContain("standard");
  });

  it("resolves greek + math + greek comparison (ε≤σ)", () => {
    const expr = resolveSymbolExpr("ε≤σ");
    expect(expr).not.toBeNull();
    expect(expr!.kind).toBe("operator");
    expect(expr!.baseMeaning).toContain("epsilon");
    expect(expr!.baseMeaning).toContain("at_most");
    expect(expr!.baseMeaning).toContain("standard");
  });

  it("resolves greek pair as operator (Σδ)", () => {
    const expr = resolveSymbolExpr("Σδ");
    expect(expr).not.toBeNull();
    expect(expr!.kind).toBe("operator");
    expect(expr!.baseMeaning).toContain("sum");
    expect(expr!.baseMeaning).toContain("delta");
  });

  it("resolves arrow-led flow with multiple symbols (→●▲)", () => {
    const expr = resolveSymbolExpr("→●▲");
    expect(expr).not.toBeNull();
    expect(expr!.kind).toBe("flow");
  });

  it("returns null for block + 3 chars (no pattern match)", () => {
    // Block followed by three more symbols exceeds known patterns
    const expr = resolveSymbolExpr("█αβγ");
    expect(expr).toBeNull();
  });

  it("returns null for arrow + non-symbol char (flow with non-symbol)", () => {
    // → followed by ASCII 'a' — not all chars are symbols
    const expr = resolveSymbolExpr("→a");
    expect(expr).toBeNull();
  });

  it("returns null for greek + unknown combo length > 3", () => {
    // Greek followed by many symbols — no pattern match
    const expr = resolveSymbolExpr("δ●■□");
    expect(expr).toBeNull();
  });
});

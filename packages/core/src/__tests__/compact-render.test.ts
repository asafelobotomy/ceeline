import { describe, it, expect } from "vitest";
import { renderCeelineCompact } from "../compact";
import { makeHandoff, makeDigest, makeMemory, makeRouting, makePromptContext, makeHistory, makeReflection, makeToolSummary, SURFACE_FACTORIES, withOverrides } from "./helpers.js";
import type { CompactDensity, CeelineEnvelope } from "@asafelobotomy/ceeline-schema";

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

  // ─── Artifacts in lite mode ─────────────────────────────────────────

  it("includes artifact clauses in lite density", () => {
    const env = makeHandoff({ artifacts: [{ file: "test.ts", line: 10 }] });
    const result = renderCeelineCompact(env, "lite");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("art=");
    }
  });

  it("omits artifact clauses in full density", () => {
    const env = makeHandoff({ artifacts: [{ file: "test.ts" }] });
    const result = renderCeelineCompact(env, "full");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).not.toContain("art=");
    }
  });

  // ─── parent_envelope_id in header ──────────────────────────────────

  it("includes pid= in header when parent_envelope_id is set", () => {
    const env = makeHandoff() as Record<string, unknown>;
    env.parent_envelope_id = "cel:parent-001";
    const result = renderCeelineCompact(env as any, "full");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("pid=cel:parent-001");
    }
  });

  // ─── Extensions rendering ─────────────────────────────────────────

  it("renders x_ extension fields", () => {
    const env = makeHandoff() as Record<string, unknown>;
    env.x_copilot = "model-v2";
    const result = renderCeelineCompact(env as any, "full");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("x.copilot=model-v2");
    }
  });

  it("renders non-string extension values as JSON", () => {
    const env = makeHandoff() as Record<string, unknown>;
    env.x_meta = { key: "value" };
    const result = renderCeelineCompact(env as any, "full");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("x.meta=");
    }
  });

  // ─── Diagnostics rendering ─────────────────────────────────────────

  it("renders diagnostics.trace", () => {
    const env = makeHandoff() as Record<string, unknown>;
    env.diagnostics = { trace: true };
    const result = renderCeelineCompact(env as any, "full");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("diag.trace=1");
    }
  });

  it("renders diagnostics.labels", () => {
    const env = makeHandoff() as Record<string, unknown>;
    env.diagnostics = { labels: ["perf", "debug"] };
    const result = renderCeelineCompact(env as any, "full");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("diag.labels=perf,debug");
    }
  });

  // ─── Unknown surface ──────────────────────────────────────────────

  it("fails for unknown surface", () => {
    const env = withOverrides(makeHandoff(), "surface", "bogus");
    const result = renderCeelineCompact(env, "full");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0].code).toBe("unknown_surface");
    }
  });

  // ─── Preserve classes and tokens in different densities ────────────

  it("renders preserve classes in lite density", () => {
    const env = withOverrides(makeHandoff(), "preserve.classes", ["file_path", "url"]);
    const result = renderCeelineCompact(env, "lite");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("cls=");
    }
  });

  it("omits preserve classes in dense density", () => {
    const env = withOverrides(makeHandoff(), "preserve.classes", ["file_path"]);
    const result = renderCeelineCompact(env, "dense");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).not.toContain("cls=");
    }
  });

  it("renders preserve tokens in full density", () => {
    const env = withOverrides(makeHandoff(), "preserve.tokens", ["keepme"]);
    const result = renderCeelineCompact(env, "full");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("tok=keepme");
    }
  });

  it("omits preserve tokens in lite density", () => {
    const env = withOverrides(makeHandoff(), "preserve.tokens", ["keepme"]);
    const result = renderCeelineCompact(env, "lite");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).not.toContain("tok=keepme");
    }
  });

  // ─── Header defaults in different densities ────────────────────────

  it("includes default channel in lite density header", () => {
    const result = renderCeelineCompact(makeHandoff(), "lite");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("ch=");
    }
  });

  it("omits default channel in dense density header", () => {
    // The default channel is "internal", dense should omit it
    const result = renderCeelineCompact(makeHandoff(), "dense");
    expect(result.ok).toBe(true);
    if (result.ok) {
      // dense omits defaults — check the header doesn't have ch= if it's the default
      const header = result.value.split(" ; ")[0];
      expect(header).not.toContain("ch=");
    }
  });

  // ─── Domain rendering ─────────────────────────────────────────────

  it("includes dom= in header when domains are specified", () => {
    const result = renderCeelineCompact(makeHandoff(), "full", { domains: ["sec", "perf"] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("dom=sec+perf");
    }
  });

  it("omits dom= when domains array is empty", () => {
    const result = renderCeelineCompact(makeHandoff(), "full", { domains: [] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).not.toContain("dom=");
    }
  });

  // ─── Surface-specific rendering for all surfaces ───────────────────

  it("renders reflection payload fields", () => {
    const result = renderCeelineCompact(makeReflection(), "full");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("rty=");
      expect(result.value).toContain("cnf=");
      expect(result.value).toContain("rev=");
    }
  });

  it("renders tool_summary payload fields", () => {
    const result = renderCeelineCompact(makeToolSummary(), "full");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("tn=");
      expect(result.value).toContain("out=");
      expect(result.value).toContain("ela=");
    }
  });

  it("renders dense digest metrics with coded keys when shorter", () => {
    const env = makeDigest({ metrics: { pendingChecks: 3, sessionMinutes: 47, tokenBudgetUsed: 1420 } });
    const result = renderCeelineCompact(env, "dense");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("mi=pc:3,sm:47,tb:1420");
      expect(result.value).not.toContain("met=pendingChecks:3,sessionMinutes:47,tokenBudgetUsed:1420");
    }
  });

  it("renders dense routing selected as candidate index when shorter", () => {
    const env = makeRouting({
      candidates: ["security-specialist", "code-reviewer", "generalist"],
      selected: "security-specialist",
    });
    const result = renderCeelineCompact(env, "dense");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("cand=security-specialist,code-reviewer,generalist");
      expect(result.value).toContain("si=0");
      expect(result.value).not.toContain("sel=security-specialist");
    }
  });

  it("renders dense memory citations with inline references when shorter", () => {
    const env = makeMemory({
      facts: ["https://ceeline.dev/spec remains the reference URL."],
      citations: ["https://ceeline.dev/spec", "docs/ceeline-language-spec-v1.md"],
    });
    const result = renderCeelineCompact(env, "dense");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("ci=@f0/24,docs/ceeline-language-spec-v1.md");
      expect(result.value).not.toContain("cit=https://ceeline.dev/spec,docs/ceeline-language-spec-v1.md");
    }
  });

  it("renders dense handoff scope codes when shorter", () => {
    const env = makeHandoff({ scope: ["transport", "validation"] });
    const result = renderCeelineCompact(env, "dense");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("sx=@t,@v");
      expect(result.value).not.toContain("sc=transport,validation");
    }
  });

  it("renders dense prompt_context source_ref with a code when shorter", () => {
    const env = makePromptContext({ source_ref: "workspace-config" });
    const result = renderCeelineCompact(env, "dense");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("sr=wc");
      expect(result.value).not.toContain("src=workspace-config");
    }
  });

  it("renders dense reflection revision with reversible prose contractions when shorter", () => {
    const env = makeReflection({ revision: "Security validation configuration." });
    const result = renderCeelineCompact(env, "dense");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain('rev="Sec val config."');
      expect(result.value).toContain("rvc=1");
    }
  });

  it("renders dense history anchor with a code when shorter", () => {
    const env = makeHistory({ anchor: "bench-session-start" });
    const result = renderCeelineCompact(env, "dense");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("ac=bs");
      expect(result.value).not.toContain("anc=bench-session-start");
    }
  });

  it("renders routing payload fields", () => {
    const result = renderCeelineCompact(makeRouting(), "full");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("str=");
      expect(result.value).toContain("cand=");
      expect(result.value).toContain("sel=");
    }
  });

  it("renders prompt_context payload fields", () => {
    const result = renderCeelineCompact(makePromptContext(), "full");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("ph=");
      expect(result.value).toContain("pri=");
      expect(result.value).toContain("src=");
    }
  });

  it("renders history payload fields", () => {
    const result = renderCeelineCompact(makeHistory(), "full");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("spn=");
      expect(result.value).toContain("tc=");
      expect(result.value).toContain("anc=");
    }
  });

  // ─── Render surfaces with empty optional payload fields ─────────────

  for (const [surface, empty_fields] of [
    ["reflection", { reflection_type: undefined, confidence: undefined, revision: undefined }],
    ["tool_summary", { tool_name: undefined, outcome: undefined, elapsed_ms: undefined }],
    ["routing", { strategy: undefined, candidates: undefined, selected: undefined }],
    ["prompt_context", { phase: undefined, phase_label: undefined, priority: undefined, source_ref: undefined }],
    ["history", { span: undefined, turn_count: undefined, anchor: undefined }],
  ] as const) {
    it(`renders ${surface} with missing optional payload fields`, () => {
      const base = SURFACE_FACTORIES[surface as keyof typeof SURFACE_FACTORIES]();
      const env = { ...base, payload: { ...base.payload, summary: "test", facts: ["f1"], ...empty_fields } } as CeelineEnvelope;
      const result = renderCeelineCompact(env, "full");
      expect(result.ok).toBe(true);
      // Should still render, just without the optional fields
    });
  }

  // ─── Non-integer metric values ──────────────────────────────────────

  it("renders non-integer metric values without .toString()", () => {
    const env = makeDigest();
    (env.payload as Record<string, unknown>).metrics = { score: 0.95, count: 3 };
    const result = renderCeelineCompact(env, "full");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("met=");
      expect(result.value).toContain("0.95");
    }
  });

  // ─── Domain with invalid characters filtered ────────────────────────

  it("filters domains with invalid characters", () => {
    const env = makeHandoff();
    const result = renderCeelineCompact(env, "full", { domains: ["sec", "BAD!", "perf"] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("dom=sec+perf");
      expect(result.value).not.toContain("BAD");
    }
  });

  it("omits dom= header when all domain IDs are invalid", () => {
    const env = makeHandoff();
    const result = renderCeelineCompact(env, "full", { domains: ["BAD!", "NO@"] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).not.toContain("dom=");
    }
  });
});

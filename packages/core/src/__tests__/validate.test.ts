import { describe, it, expect } from "vitest";
import { validateEnvelope } from "../validate";
import {
  makeHandoff, makeDigest, makeMemory, makeReflection,
  makeToolSummary, makeRouting, makePromptContext, makeHistory,
  SURFACE_FACTORIES, withOverrides
} from "./helpers.js";

// ─── source.kind = "agent" ─────────────────────────────────────────────

describe("source.kind validation", () => {
  it("accepts source.kind = 'agent'", () => {
    const env = makeHandoff();
    const result = validateEnvelope(env);
    expect(result.ok).toBe(true);
  });

  for (const kind of ["host", "adapter", "agent", "test", "fixture"] as const) {
    it(`accepts source.kind = '${kind}'`, () => {
      const env = withOverrides(makeHandoff(), "source.kind", kind);
      const result = validateEnvelope(env);
      expect(result.ok).toBe(true);
    });
  }

  it("rejects invalid source.kind", () => {
    const env = withOverrides(makeHandoff(), "source.kind", "bogus");
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some(i => i.code === "invalid_source_kind")).toBe(true);
    }
  });
});

// ─── All 8 surfaces validate successfully ──────────────────────────────

describe("surface validation (all 8 surfaces)", () => {
  for (const [surface, factory] of Object.entries(SURFACE_FACTORIES)) {
    it(`validates '${surface}' with correct payload`, () => {
      const env = factory();
      const result = validateEnvelope(env);
      expect(result.ok).toBe(true);
    });
  }
});

// ─── Each surface rejects invalid surface-specific fields ──────────────

describe("handoff payload validation", () => {
  it("rejects invalid role", () => {
    const env = makeHandoff({ role: "invalid" });
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_handoff_role")).toBe(true);
  });

  it("rejects invalid target", () => {
    const env = makeHandoff({ target: "invalid" });
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_handoff_target")).toBe(true);
  });

  it("rejects non-array scope", () => {
    const env = makeHandoff({ scope: "not_an_array" });
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
  });
});

describe("digest payload validation", () => {
  it("rejects invalid window", () => {
    const env = makeDigest({ window: "invalid" });
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_digest_window")).toBe(true);
  });

  it("rejects invalid status", () => {
    const env = makeDigest({ status: "invalid" });
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_digest_status")).toBe(true);
  });

  it("rejects non-numeric metrics", () => {
    const env = makeDigest({ metrics: { bad: "string" } });
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_digest_metrics")).toBe(true);
  });
});

describe("memory payload validation", () => {
  it("rejects invalid memory_kind", () => {
    const env = makeMemory({ memory_kind: "invalid" });
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_memory_kind")).toBe(true);
  });

  it("rejects invalid durability", () => {
    const env = makeMemory({ durability: "invalid" });
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_memory_durability")).toBe(true);
  });
});

describe("reflection payload validation", () => {
  it("rejects invalid reflection_type", () => {
    const env = makeReflection({ reflection_type: "invalid" });
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_reflection_type")).toBe(true);
  });

  it("rejects confidence outside 0-1", () => {
    const env = makeReflection({ confidence: 1.5 });
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_reflection_confidence")).toBe(true);
  });

  it("rejects non-string revision", () => {
    const env = makeReflection({ revision: 123 });
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_reflection_revision")).toBe(true);
  });
});

describe("tool_summary payload validation", () => {
  it("rejects empty tool_name", () => {
    const env = makeToolSummary({ tool_name: "" });
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_tool_name")).toBe(true);
  });

  it("rejects invalid outcome", () => {
    const env = makeToolSummary({ outcome: "invalid" });
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_tool_outcome")).toBe(true);
  });

  it("rejects negative elapsed_ms", () => {
    const env = makeToolSummary({ elapsed_ms: -10 });
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_elapsed_ms")).toBe(true);
  });
});

describe("routing payload validation", () => {
  it("rejects invalid strategy", () => {
    const env = makeRouting({ strategy: "invalid" });
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_routing_strategy")).toBe(true);
  });

  it("rejects empty selected", () => {
    const env = makeRouting({ selected: "" });
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_routing_selected")).toBe(true);
  });
});

describe("prompt_context payload validation", () => {
  it("rejects invalid phase", () => {
    const env = makePromptContext({ phase: "invalid" });
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_prompt_context_phase")).toBe(true);
  });

  it("rejects non-numeric priority", () => {
    const env = makePromptContext({ priority: "high" });
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_prompt_context_priority")).toBe(true);
  });

  it("rejects empty source_ref", () => {
    const env = makePromptContext({ source_ref: "" });
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_prompt_context_source_ref")).toBe(true);
  });
});

describe("history payload validation", () => {
  it("rejects invalid span", () => {
    const env = makeHistory({ span: "invalid" });
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_history_span")).toBe(true);
  });

  it("rejects negative turn_count", () => {
    const env = makeHistory({ turn_count: -1 });
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_history_turn_count")).toBe(true);
  });

  it("rejects empty anchor", () => {
    const env = makeHistory({ anchor: "" });
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_history_anchor")).toBe(true);
  });
});

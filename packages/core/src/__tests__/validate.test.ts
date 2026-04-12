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

// ─── Non-envelope inputs ───────────────────────────────────────────────

describe("non-envelope inputs", () => {
  it("rejects null", () => {
    const result = validateEnvelope(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].code).toBe("invalid_envelope");
  });

  it("rejects a number", () => {
    const result = validateEnvelope(42);
    expect(result.ok).toBe(false);
  });

  it("rejects a string", () => {
    const result = validateEnvelope("not an envelope");
    expect(result.ok).toBe(false);
  });
});

// ─── Unknown top-level fields ──────────────────────────────────────────

describe("unknown top-level fields", () => {
  it("rejects unknown top-level keys that are not x_ prefixed", () => {
    const env = makeHandoff() as Record<string, unknown>;
    env.bogus_field = true;
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "unknown_top_level_field")).toBe(true);
  });

  it("allows x_ prefixed extension fields", () => {
    const env = makeHandoff() as Record<string, unknown>;
    env.x_custom = "hello";
    const result = validateEnvelope(env);
    expect(result.ok).toBe(true);
  });
});

// ─── Top-level field ordering ──────────────────────────────────────────

describe("top-level field ordering", () => {
  it("reports out-of-order top-level fields", () => {
    // Move "surface" before "ceeline_version" by rebuilding the object
    const env = makeHandoff();
    const { surface, ceeline_version, ...rest } = env as Record<string, unknown>;
    const reordered = { surface, ceeline_version, ...rest };
    const result = validateEnvelope(reordered);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "top_level_order")).toBe(true);
  });
});

// ─── Source info validation (individual checks) ────────────────────────

describe("source info validation", () => {
  it("rejects non-object source", () => {
    const env = withOverrides(makeHandoff(), "source", "not-an-object");
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_source")).toBe(true);
  });

  it("rejects missing source.name", () => {
    const env = makeHandoff();
    (env.source as Record<string, unknown>).name = "";
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "missing_source_name")).toBe(true);
  });

  it("rejects missing source.instance", () => {
    const env = makeHandoff();
    (env.source as Record<string, unknown>).instance = "";
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "missing_source_instance")).toBe(true);
  });

  it("rejects invalid timestamp", () => {
    const env = makeHandoff();
    (env.source as Record<string, unknown>).timestamp = "not-a-date";
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_source_timestamp")).toBe(true);
  });
});

// ─── Constraints validation (individual checks) ───────────────────────

describe("constraints validation", () => {
  it("rejects non-object constraints", () => {
    const env = withOverrides(makeHandoff(), "constraints", "not-an-object");
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_constraints")).toBe(true);
  });

  it("rejects invalid mode", () => {
    const env = withOverrides(makeHandoff(), "constraints.mode", "bogus");
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_constraint_mode")).toBe(true);
  });

  it("rejects invalid audience", () => {
    const env = withOverrides(makeHandoff(), "constraints.audience", "bogus");
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_constraint_audience")).toBe(true);
  });

  it("rejects missing max_render_tokens", () => {
    const env = makeHandoff();
    delete (env.constraints as Record<string, unknown>).max_render_tokens;
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_max_render_tokens")).toBe(true);
  });

  it("rejects non-integer max_render_tokens", () => {
    const env = withOverrides(makeHandoff(), "constraints.max_render_tokens", 1.5);
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_max_render_tokens")).toBe(true);
  });

  it("rejects negative max_render_tokens", () => {
    const env = withOverrides(makeHandoff(), "constraints.max_render_tokens", -1);
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_max_render_tokens")).toBe(true);
  });

  it("rejects non-boolean no_user_visible_output", () => {
    const env = withOverrides(makeHandoff(), "constraints.no_user_visible_output", "yes");
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_no_user_visible_output")).toBe(true);
  });

  it("rejects invalid fallback", () => {
    const env = withOverrides(makeHandoff(), "constraints.fallback", "bogus");
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_fallback")).toBe(true);
  });

  it("rejects pass_through fallback on controlled_ui channel", () => {
    let env = withOverrides(makeHandoff(), "channel", "controlled_ui");
    env = withOverrides(env, "constraints.fallback", "pass_through");
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "forbidden_fallback")).toBe(true);
  });
});

// ─── Preserve validation (individual checks) ──────────────────────────

describe("preserve validation", () => {
  it("rejects non-object preserve", () => {
    const env = withOverrides(makeHandoff(), "preserve", "not-an-object");
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_preserve")).toBe(true);
  });

  it("rejects non-array tokens", () => {
    const env = withOverrides(makeHandoff(), "preserve.tokens", "not-array");
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_preserve_tokens")).toBe(true);
  });

  it("rejects tokens with empty strings", () => {
    const env = withOverrides(makeHandoff(), "preserve.tokens", ["valid", ""]);
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_preserve_tokens")).toBe(true);
  });

  it("rejects invalid preserve classes", () => {
    const env = withOverrides(makeHandoff(), "preserve.classes", ["not_a_real_class"]);
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_preserve_classes")).toBe(true);
  });
});

// ─── Payload validation (individual checks) ───────────────────────────

describe("payload validation", () => {
  it("rejects non-object payload", () => {
    const env = withOverrides(makeHandoff(), "payload", "not-an-object");
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_payload")).toBe(true);
  });

  it("rejects non-string summary", () => {
    const env = makeHandoff({ summary: 123 });
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_payload_summary")).toBe(true);
  });

  it("rejects non-array facts", () => {
    const env = makeHandoff({ facts: "not-array" });
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_payload_facts")).toBe(true);
  });

  it("rejects non-string ask", () => {
    const env = makeHandoff({ ask: 999 });
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_payload_ask")).toBe(true);
  });

  it("rejects non-array artifacts", () => {
    const env = makeHandoff({ artifacts: "not-array" });
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_payload_artifacts")).toBe(true);
  });

  it("rejects non-object metadata", () => {
    const env = makeHandoff({ metadata: "not-object" });
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_payload_metadata")).toBe(true);
  });
});

// ─── Render validation (individual checks) ────────────────────────────

describe("render validation", () => {
  it("rejects non-object render", () => {
    const env = withOverrides(makeHandoff(), "render", "not-an-object");
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_render")).toBe(true);
  });

  it("rejects invalid render style", () => {
    const env = withOverrides(makeHandoff(), "render.style", "bogus");
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_render_style")).toBe(true);
  });

  it("rejects empty render locale", () => {
    const env = withOverrides(makeHandoff(), "render.locale", "");
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_render_locale")).toBe(true);
  });

  it("rejects invalid render sanitizer", () => {
    const env = withOverrides(makeHandoff(), "render.sanitizer", "bogus");
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_render_sanitizer")).toBe(true);
  });

  it("rejects user_facing render when no_user_visible_output is true", () => {
    let env = withOverrides(makeHandoff(), "constraints.no_user_visible_output", true);
    env = withOverrides(env, "render.style", "user_facing");
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "render_policy_conflict")).toBe(true);
  });
});

// ─── Diagnostics validation ───────────────────────────────────────────

describe("diagnostics validation", () => {
  it("accepts absent diagnostics", () => {
    const env = makeHandoff();
    // diagnostics is optional — base helper doesn't set it
    const result = validateEnvelope(env);
    expect(result.ok).toBe(true);
  });

  it("rejects non-object diagnostics", () => {
    const env = makeHandoff() as Record<string, unknown>;
    env.diagnostics = "not-an-object";
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_diagnostics")).toBe(true);
  });

  it("rejects non-boolean diagnostics.trace", () => {
    const env = makeHandoff() as Record<string, unknown>;
    env.diagnostics = { trace: "yes" };
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_diagnostics_trace")).toBe(true);
  });

  it("rejects non-array diagnostics.labels", () => {
    const env = makeHandoff() as Record<string, unknown>;
    env.diagnostics = { labels: "not-array" };
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_diagnostics_labels")).toBe(true);
  });

  it("rejects labels with non-string elements", () => {
    const env = makeHandoff() as Record<string, unknown>;
    env.diagnostics = { labels: [42] };
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_diagnostics_labels")).toBe(true);
  });

  it("accepts valid diagnostics", () => {
    const env = makeHandoff() as Record<string, unknown>;
    env.diagnostics = { trace: true, labels: ["perf", "debug"] };
    const result = validateEnvelope(env);
    expect(result.ok).toBe(true);
  });
});

// ─── Envelope-level field validation ──────────────────────────────────

describe("envelope-level field validation", () => {
  it("rejects invalid ceeline_version", () => {
    const env = withOverrides(makeHandoff(), "ceeline_version", "2.0");
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_version")).toBe(true);
  });

  it("rejects empty envelope_id", () => {
    const env = withOverrides(makeHandoff(), "envelope_id", "");
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_envelope_id")).toBe(true);
  });

  it("rejects empty parent_envelope_id when present", () => {
    const env = makeHandoff() as Record<string, unknown>;
    env.parent_envelope_id = "";
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_parent_envelope_id")).toBe(true);
  });

  it("rejects invalid surface", () => {
    const env = withOverrides(makeHandoff(), "surface", "bogus");
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_surface")).toBe(true);
  });

  it("rejects invalid channel", () => {
    const env = withOverrides(makeHandoff(), "channel", "bogus");
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_channel")).toBe(true);
  });

  it("rejects invalid intent format", () => {
    const env = withOverrides(makeHandoff(), "intent", "CAPS NOT ALLOWED");
    const result = validateEnvelope(env);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === "invalid_intent")).toBe(true);
  });

  it("accepts valid parent_envelope_id in correct field order", () => {
    // Must rebuild with parent_envelope_id in canonical order
    const env = makeHandoff();
    const { ceeline_version, envelope_id, ...rest } = env as Record<string, unknown>;
    const ordered = { ceeline_version, envelope_id, parent_envelope_id: "cel:parent-001", ...rest };
    const result = validateEnvelope(ordered);
    expect(result.ok).toBe(true);
  });
});

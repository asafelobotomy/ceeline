/**
 * Shared test helpers — envelope factories for all 8 surfaces.
 */
import { createPolicyDefaults, type CeelineEnvelope, type CeelineSurface } from "@ceeline/schema";

const TS = "2026-04-12T10:00:00Z";

function base(surface: CeelineSurface, overrides: Record<string, unknown> = {}): CeelineEnvelope {
  const defaults = createPolicyDefaults(surface, "internal");
  return {
    ceeline_version: "1.0",
    envelope_id: `cel:test-${surface}-001`,
    surface,
    channel: defaults.channel,
    intent: `test.${surface}`,
    source: { kind: "agent", name: "test-agent", instance: "test-inst", timestamp: TS },
    constraints: { ...defaults.constraints },
    preserve: { tokens: [], classes: [] },
    payload: {
      summary: `Test ${surface} summary.`,
      facts: ["Fact one."],
      ask: "Test ask.",
      artifacts: [],
      metadata: {},
      ...overrides
    },
    render: { ...defaults.render }
  } as CeelineEnvelope;
}

export function makeHandoff(overrides: Record<string, unknown> = {}): CeelineEnvelope {
  return base("handoff", { role: "reviewer", target: "fixer", scope: ["transport"], ...overrides });
}

export function makeDigest(overrides: Record<string, unknown> = {}): CeelineEnvelope {
  return base("digest", { window: "session", status: "ok", metrics: { items: 3 }, ...overrides });
}

export function makeMemory(overrides: Record<string, unknown> = {}): CeelineEnvelope {
  return base("memory", { memory_kind: "fact", durability: "persistent", citations: ["ref.md"], ...overrides });
}

export function makeReflection(overrides: Record<string, unknown> = {}): CeelineEnvelope {
  return base("reflection", { reflection_type: "self_critique", confidence: 0.8, revision: "Fix edge case.", ...overrides });
}

export function makeToolSummary(overrides: Record<string, unknown> = {}): CeelineEnvelope {
  return base("tool_summary", { tool_name: "eslint", outcome: "success", elapsed_ms: 120, ...overrides });
}

export function makeRouting(overrides: Record<string, unknown> = {}): CeelineEnvelope {
  return base("routing", { strategy: "direct", candidates: ["a", "b"], selected: "a", ...overrides });
}

export function makePromptContext(overrides: Record<string, unknown> = {}): CeelineEnvelope {
  return base("prompt_context", { phase: "system", priority: 10, source_ref: "workspace", ...overrides });
}

export function makeHistory(overrides: Record<string, unknown> = {}): CeelineEnvelope {
  return base("history", { span: "exchange", turn_count: 3, anchor: "start", ...overrides });
}

export const SURFACE_FACTORIES: Record<CeelineSurface, (o?: Record<string, unknown>) => CeelineEnvelope> = {
  handoff: makeHandoff,
  digest: makeDigest,
  memory: makeMemory,
  reflection: makeReflection,
  tool_summary: makeToolSummary,
  routing: makeRouting,
  prompt_context: makePromptContext,
  history: makeHistory
};

/** Deeply clone an envelope and apply nested overrides. */
export function withOverrides(envelope: CeelineEnvelope, path: string, value: unknown): CeelineEnvelope {
  const clone = JSON.parse(JSON.stringify(envelope)) as Record<string, unknown>;
  const parts = path.split(".");
  let target = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    target = target[parts[i]] as Record<string, unknown>;
  }
  target[parts[parts.length - 1]] = value;
  return clone as unknown as CeelineEnvelope;
}

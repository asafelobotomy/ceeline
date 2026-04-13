/**
 * Benchmark corpus — realistic envelopes across the active surfaces.
 *
 * Some surfaces intentionally include multiple variants when we want to track
 * different compression behaviors on the same payload type.
 *
 * Each envelope is a valid CeelineEnvelope that exercises the surface-specific
 * payload fields documented in the v1 language spec.
 */
import type { CeelineEnvelope } from "@asafelobotomy/ceeline-schema";

export const CORPUS: readonly CeelineEnvelope[] = [
  // ── handoff ──────────────────────────────────────────────────────────
  {
    ceeline_version: "1.0",
    envelope_id: "cel:bench-handoff-001",
    surface: "handoff",
    channel: "internal",
    intent: "review.security",
    source: { kind: "agent", name: "planner-v2", instance: "bench-planner", timestamp: "2026-04-12T10:00:00Z" },
    constraints: { mode: "read_only", audience: "machine", max_render_tokens: 500, no_user_visible_output: true, fallback: "reject" },
    preserve: { tokens: ["src/core/codec.ts", "{{PROJECT_ID}}", "GPT-5.4", "npm test"], classes: ["file_path", "placeholder", "model_name", "command"] },
    payload: {
      summary: "Review src/core/codec.ts for transport safety before release.",
      facts: ["Preserve {{PROJECT_ID}} exactly.", "Preserve GPT-5.4 exactly.", "The module handles all inbound byte streams from external agents."],
      ask: "Return severity-ordered findings only.",
      role: "reviewer",
      target: "fixer",
      scope: ["transport", "validation"],
      artifacts: [],
      metadata: { owner: "benchmark", priority: "high" }
    },
    render: { style: "none", locale: "en", sanitizer: "strict" }
  } as CeelineEnvelope,

  // ── digest ───────────────────────────────────────────────────────────
  {
    ceeline_version: "1.0",
    envelope_id: "cel:bench-digest-001",
    surface: "digest",
    channel: "internal",
    intent: "summarize.session",
    source: { kind: "agent", name: "orchestrator", instance: "bench-orch", timestamp: "2026-04-12T10:01:00Z" },
    constraints: { mode: "advisory", audience: "operator", max_render_tokens: 500, no_user_visible_output: true, fallback: "verbose" },
    preserve: { tokens: ["npm test", "$CI"], classes: ["command", "env_var"] },
    payload: {
      summary: "Summarize the latest internal session state for operator review.",
      facts: ["npm test has not run in this session.", "$CI was unset during the last pipeline run.", "Three pending security checks remain."],
      ask: "Render a compact operator digest with actionable items.",
      window: "session",
      status: "warn",
      metrics: { pendingChecks: 3, sessionMinutes: 47, tokenBudgetUsed: 1420 },
      artifacts: [],
      metadata: { sessionId: "sess-9a3f" }
    },
    render: { style: "terse", locale: "en", sanitizer: "strict" }
  } as CeelineEnvelope,

  // ── memory ───────────────────────────────────────────────────────────
  {
    ceeline_version: "1.0",
    envelope_id: "cel:bench-memory-001",
    surface: "memory",
    channel: "internal",
    intent: "memory.capture",
    source: { kind: "agent", name: "memory-agent", instance: "bench-mem", timestamp: "2026-04-12T10:02:00Z" },
    constraints: { mode: "advisory", audience: "machine", max_render_tokens: 500, no_user_visible_output: true, fallback: "reject" },
    preserve: { tokens: ["https://ceeline.dev/spec"], classes: ["url"] },
    payload: {
      summary: "Capture a stable product fact for future sessions.",
      facts: ["Ceeline v1 uses a canonical JSON envelope.", "https://ceeline.dev/spec remains the reference URL.", "The compact dialect supports three density levels."],
      ask: "Store a compact durable fact entry.",
      memory_kind: "fact",
      durability: "persistent",
      citations: ["https://ceeline.dev/spec", "docs/ceeline-language-spec-v1.md"],
      artifacts: [],
      metadata: { category: "product" }
    },
    render: { style: "normal", locale: "en", sanitizer: "strict" }
  } as CeelineEnvelope,

  // ── reflection ───────────────────────────────────────────────────────
  {
    ceeline_version: "1.0",
    envelope_id: "cel:bench-reflection-001",
    surface: "reflection",
    channel: "internal",
    intent: "reflect.confidence",
    source: { kind: "agent", name: "self-critic", instance: "bench-critic", timestamp: "2026-04-12T10:03:00Z" },
    constraints: { mode: "read_only", audience: "machine", max_render_tokens: 500, no_user_visible_output: true, fallback: "reject" },
    preserve: { tokens: ["validateEnvelope"], classes: ["code_span"] },
    payload: {
      summary: "Self-critique of the validation pipeline coverage.",
      facts: ["Edge case for empty payload.facts is not tested.", "Confidence in handoff validation is high.", "Confidence in digest metric parsing is moderate."],
      ask: "Identify the lowest-confidence validation path.",
      reflection_type: "confidence_check",
      confidence: 0.72,
      revision: "Add validation configuration tests for empty payload arrays.",
      artifacts: [],
      metadata: {}
    },
    render: { style: "none", locale: "en", sanitizer: "strict" }
  } as CeelineEnvelope,

  {
    ceeline_version: "1.0",
    envelope_id: "cel:bench-reflection-token-001",
    surface: "reflection",
    channel: "internal",
    intent: "reflect.confidence",
    source: { kind: "agent", name: "self-critic", instance: "bench-critic-token", timestamp: "2026-04-12T10:03:30Z" },
    constraints: { mode: "read_only", audience: "machine", max_render_tokens: 500, no_user_visible_output: true, fallback: "reject" },
    preserve: { tokens: ["validateEnvelope"], classes: ["code_span"] },
    payload: {
      summary: "Self-critique of the validation pipeline coverage.",
      facts: ["Edge case for empty payload.facts is not tested.", "Confidence in handoff validation is high.", "Confidence in digest metric parsing is moderate."],
      ask: "Identify the lowest-confidence validation path.",
      reflection_type: "confidence_check",
      confidence: 0.72,
      revision: "Add auth authz val config docs.",
      artifacts: [],
      metadata: {}
    },
    render: { style: "none", locale: "en", sanitizer: "strict" }
  } as CeelineEnvelope,

  // ── tool_summary ─────────────────────────────────────────────────────
  {
    ceeline_version: "1.0",
    envelope_id: "cel:bench-tool-001",
    surface: "tool_summary",
    channel: "internal",
    intent: "tool.report",
    source: { kind: "agent", name: "tool-runner", instance: "bench-tools", timestamp: "2026-04-12T10:04:00Z" },
    constraints: { mode: "read_only", audience: "machine", max_render_tokens: 500, no_user_visible_output: true, fallback: "reject" },
    preserve: { tokens: ["eslint", "typescript"], classes: ["tool_identifier"] },
    payload: {
      summary: "ESLint completed with partial results on the core package.",
      facts: ["12 files scanned.", "2 warnings found in compact.ts.", "No errors."],
      ask: "Summarize tool outcome for orchestrator routing.",
      tool_name: "eslint",
      outcome: "partial",
      elapsed_ms: 3420,
      artifacts: [],
      metadata: { exitCode: 0 }
    },
    render: { style: "none", locale: "en", sanitizer: "strict" }
  } as CeelineEnvelope,

  // ── routing ──────────────────────────────────────────────────────────
  {
    ceeline_version: "1.0",
    envelope_id: "cel:bench-routing-001",
    surface: "routing",
    channel: "internal",
    intent: "route.select",
    source: { kind: "agent", name: "router", instance: "bench-router", timestamp: "2026-04-12T10:05:00Z" },
    constraints: { mode: "advisory", audience: "machine", max_render_tokens: 500, no_user_visible_output: true, fallback: "reject" },
    preserve: { tokens: [], classes: [] },
    payload: {
      summary: "Select the best agent for a security review task.",
      facts: ["Three candidate agents are available.", "Security-specialist has highest match score.", "Generalist is fallback."],
      ask: "Choose the optimal routing for this intent.",
      strategy: "conditional",
      candidates: ["security-specialist", "code-reviewer", "generalist"],
      selected: "security-specialist",
      artifacts: [],
      metadata: { matchScore: 0.94 }
    },
    render: { style: "none", locale: "en", sanitizer: "strict" }
  } as CeelineEnvelope,

  // ── prompt_context ───────────────────────────────────────────────────
  {
    ceeline_version: "1.0",
    envelope_id: "cel:bench-prompt-001",
    surface: "prompt_context",
    channel: "internal",
    intent: "context.inject",
    source: { kind: "host", name: "copilot-host", instance: "bench-host", timestamp: "2026-04-12T10:06:00Z" },
    constraints: { mode: "read_only", audience: "machine", max_render_tokens: 500, no_user_visible_output: true, fallback: "reject" },
    preserve: { tokens: ["{{WORKSPACE_ROOT}}", "tsconfig.json"], classes: ["placeholder", "file_path"] },
    payload: {
      summary: "Inject workspace context into the system prompt for grounding.",
      facts: ["Workspace root is {{WORKSPACE_ROOT}}.", "TypeScript 5.x with composite project references.", "ESM-only with Bundler moduleResolution.", "Test runner is vitest."],
      ask: "Include these facts in the system section at priority 10.",
      phase: "system",
      priority: 10,
      source_ref: "workspace-config",
      artifacts: [],
      metadata: { injectedAt: "system" }
    },
    render: { style: "none", locale: "en", sanitizer: "strict" }
  } as CeelineEnvelope,

  // ── history ──────────────────────────────────────────────────────────
  {
    ceeline_version: "1.0",
    envelope_id: "cel:bench-history-001",
    surface: "history",
    channel: "controlled_ui",
    intent: "history.snapshot",
    source: { kind: "agent", name: "history-agent", instance: "bench-history", timestamp: "2026-04-12T10:07:00Z" },
    constraints: { mode: "read_only", audience: "machine", max_render_tokens: 500, no_user_visible_output: true, fallback: "reject" },
    preserve: { tokens: [], classes: [] },
    payload: {
      summary: "Snapshot of the current exchange for participant-local state.",
      facts: ["User asked about Ceeline benchmarking.", "Agent outlined metrics: byte ratio, token ratio, round-trip fidelity.", "User approved the approach."],
      ask: "Compact the exchange for future context injection.",
      span: "exchange",
      turn_count: 6,
      anchor: "bench-session-start",
      artifacts: [],
      metadata: { exchangeId: "ex-042" }
    },
    render: { style: "none", locale: "en", sanitizer: "strict" }
  } as CeelineEnvelope
];

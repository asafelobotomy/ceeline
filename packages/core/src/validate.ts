import {
  AUDIENCES,
  CEELINE_VERSION,
  type CeelineChannel,
  CHANNELS,
  CONSTRAINT_MODES,
  FALLBACKS,
  PRESERVE_CLASSES,
  RENDER_STYLES,
  SANITIZERS,
  SOURCE_KINDS,
  SURFACES,
  TOP_LEVEL_FIELD_ORDER,
  isRecord,
  type CeelineEnvelope,
  type CeelineSurface,
  type CommonPayload,
  type ConstraintSet,
  type DigestPayload,
  type Diagnostics,
  type HandoffPayload,
  type HistoryPayload,
  type MemoryPayload,
  type PreserveSet,
  type PromptContextPayload,
  type ReflectionPayload,
  type RenderConfig,
  type RoutingPayload,
  type SourceInfo,
  type ToolSummaryPayload
} from "@ceeline/schema";
import { fail, ok, type CeelineResult, type ValidationIssue } from "./result.js";

function issue(code: string, message: string, path: string): ValidationIssue {
  return { code, message, path };
}

function hasOnlyKnownTopLevelFields(envelope: Record<string, unknown>): ValidationIssue[] {
  return Object.keys(envelope)
    .filter((key) => !TOP_LEVEL_FIELD_ORDER.includes(key as (typeof TOP_LEVEL_FIELD_ORDER)[number]) && !key.startsWith("x_"))
    .map((key) => issue("unknown_top_level_field", `Unknown top-level field '${key}'.`, key));
}

function validateTopLevelOrder(envelope: Record<string, unknown>): ValidationIssue[] {
  let lastIndex = -1;
  const issues: ValidationIssue[] = [];

  for (const key of Object.keys(envelope)) {
    if (key.startsWith("x_")) {
      continue;
    }

    const currentIndex = TOP_LEVEL_FIELD_ORDER.indexOf(key as (typeof TOP_LEVEL_FIELD_ORDER)[number]);
    if (currentIndex === -1) {
      continue;
    }

    if (currentIndex < lastIndex) {
      issues.push(issue("top_level_order", `Top-level field '${key}' is out of canonical order.`, key));
    }

    lastIndex = currentIndex;
  }

  return issues;
}

function validateSourceInfo(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) {
    return [issue("invalid_source", "Source must be an object.", "source")];
  }

  const source = value as Partial<SourceInfo>;
  const issues: ValidationIssue[] = [];

  if (!source.kind || !SOURCE_KINDS.includes(source.kind)) {
    issues.push(issue("invalid_source_kind", "Source kind is invalid.", "source.kind"));
  }
  if (!source.name) {
    issues.push(issue("missing_source_name", "Source name is required.", "source.name"));
  }
  if (!source.instance) {
    issues.push(issue("missing_source_instance", "Source instance is required.", "source.instance"));
  }
  if (!source.timestamp || Number.isNaN(Date.parse(source.timestamp))) {
    issues.push(issue("invalid_source_timestamp", "Source timestamp must be an RFC 3339 date-time string.", "source.timestamp"));
  }

  return issues;
}

function validateConstraints(value: unknown, channel: unknown): ValidationIssue[] {
  if (!isRecord(value)) {
    return [issue("invalid_constraints", "Constraints must be an object.", "constraints")];
  }

  const constraints = value as Partial<ConstraintSet>;
  const issues: ValidationIssue[] = [];

  if (!constraints.mode || !CONSTRAINT_MODES.includes(constraints.mode)) {
    issues.push(issue("invalid_constraint_mode", "Constraint mode is invalid.", "constraints.mode"));
  }
  if (!constraints.audience || !AUDIENCES.includes(constraints.audience)) {
    issues.push(issue("invalid_constraint_audience", "Constraint audience is invalid.", "constraints.audience"));
  }
  if (!Number.isInteger(constraints.max_render_tokens) || (constraints.max_render_tokens ?? -1) < 0) {
    issues.push(issue("invalid_max_render_tokens", "max_render_tokens must be an integer greater than or equal to 0.", "constraints.max_render_tokens"));
  }
  if (typeof constraints.no_user_visible_output !== "boolean") {
    issues.push(issue("invalid_no_user_visible_output", "no_user_visible_output must be a boolean.", "constraints.no_user_visible_output"));
  }
  if (!constraints.fallback || !FALLBACKS.includes(constraints.fallback)) {
    issues.push(issue("invalid_fallback", "Fallback mode is invalid.", "constraints.fallback"));
  }
  if (channel === "controlled_ui" && constraints.fallback === "pass_through") {
    issues.push(issue("forbidden_fallback", "pass_through fallback is forbidden on controlled_ui channels.", "constraints.fallback"));
  }

  return issues;
}

function validatePreserve(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) {
    return [issue("invalid_preserve", "Preserve must be an object.", "preserve")];
  }

  const preserve = value as Partial<PreserveSet>;
  const issues: ValidationIssue[] = [];

  if (!Array.isArray(preserve.tokens) || preserve.tokens.some((token) => typeof token !== "string" || token.length === 0)) {
    issues.push(issue("invalid_preserve_tokens", "preserve.tokens must be a non-empty string array.", "preserve.tokens"));
  }
  if (!Array.isArray(preserve.classes) || preserve.classes.some((entry) => !PRESERVE_CLASSES.includes(entry))) {
    issues.push(issue("invalid_preserve_classes", "preserve.classes contains an invalid preserve class.", "preserve.classes"));
  }

  return issues;
}

function validatePayload(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) {
    return [issue("invalid_payload", "Payload must be an object.", "payload")];
  }

  const payload = value as Partial<CommonPayload>;
  const issues: ValidationIssue[] = [];

  if (typeof payload.summary !== "string") {
    issues.push(issue("invalid_payload_summary", "payload.summary must be a string.", "payload.summary"));
  }
  if (!Array.isArray(payload.facts) || payload.facts.some((fact) => typeof fact !== "string")) {
    issues.push(issue("invalid_payload_facts", "payload.facts must be a string array.", "payload.facts"));
  }
  if (typeof payload.ask !== "string") {
    issues.push(issue("invalid_payload_ask", "payload.ask must be a string.", "payload.ask"));
  }
  if (!Array.isArray(payload.artifacts)) {
    issues.push(issue("invalid_payload_artifacts", "payload.artifacts must be an array.", "payload.artifacts"));
  }
  if (!isRecord(payload.metadata)) {
    issues.push(issue("invalid_payload_metadata", "payload.metadata must be an object.", "payload.metadata"));
  }

  return issues;
}

function validateStringArray(value: unknown, path: string, message: string): ValidationIssue[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.length === 0)) {
    return [issue("invalid_string_array", message, path)];
  }

  return [];
}

function validateHandoffPayload(payload: CommonPayload): ValidationIssue[] {
  const handoff = payload as Partial<HandoffPayload>;
  const issues: ValidationIssue[] = [];

  if (!handoff.role || !["planner", "reviewer", "coordinator", "parent_agent"].includes(handoff.role)) {
    issues.push(issue("invalid_handoff_role", "handoff payload requires a valid role.", "payload.role"));
  }
  if (!handoff.target || !["implementer", "fixer", "subagent", "reviewer"].includes(handoff.target)) {
    issues.push(issue("invalid_handoff_target", "handoff payload requires a valid target.", "payload.target"));
  }
  issues.push(...validateStringArray(handoff.scope, "payload.scope", "handoff payload requires a non-empty scope string array."));

  return issues;
}

function validateDigestPayload(payload: CommonPayload): ValidationIssue[] {
  const digest = payload as Partial<DigestPayload>;
  const issues: ValidationIssue[] = [];

  if (!digest.window || !["turn", "session", "run"].includes(digest.window)) {
    issues.push(issue("invalid_digest_window", "digest payload requires a valid window.", "payload.window"));
  }
  if (!digest.status || !["ok", "warn", "error"].includes(digest.status)) {
    issues.push(issue("invalid_digest_status", "digest payload requires a valid status.", "payload.status"));
  }
  if (!isRecord(digest.metrics) || Object.values(digest.metrics).some((value) => typeof value !== "number" || !Number.isFinite(value))) {
    issues.push(issue("invalid_digest_metrics", "digest payload requires numeric metrics.", "payload.metrics"));
  }

  return issues;
}

function validateMemoryPayload(payload: CommonPayload): ValidationIssue[] {
  const memory = payload as Partial<MemoryPayload>;
  const issues: ValidationIssue[] = [];

  if (!memory.memory_kind || !["fact", "decision", "research"].includes(memory.memory_kind)) {
    issues.push(issue("invalid_memory_kind", "memory payload requires a valid memory_kind.", "payload.memory_kind"));
  }
  if (!memory.durability || !["session", "project", "persistent"].includes(memory.durability)) {
    issues.push(issue("invalid_memory_durability", "memory payload requires a valid durability.", "payload.durability"));
  }
  issues.push(...validateStringArray(memory.citations, "payload.citations", "memory payload requires a citations string array."));

  return issues;
}

function validateReflectionPayload(payload: CommonPayload): ValidationIssue[] {
  const r = payload as Partial<ReflectionPayload>;
  const issues: ValidationIssue[] = [];

  if (!r.reflection_type || !["self_critique", "hypothesis", "plan_revision", "confidence_check"].includes(r.reflection_type)) {
    issues.push(issue("invalid_reflection_type", "reflection payload requires a valid reflection_type.", "payload.reflection_type"));
  }
  if (typeof r.confidence !== "number" || r.confidence < 0 || r.confidence > 1) {
    issues.push(issue("invalid_reflection_confidence", "reflection payload requires confidence between 0 and 1.", "payload.confidence"));
  }
  if (typeof r.revision !== "string") {
    issues.push(issue("invalid_reflection_revision", "reflection payload requires a revision string.", "payload.revision"));
  }

  return issues;
}

function validateToolSummaryPayload(payload: CommonPayload): ValidationIssue[] {
  const r = payload as Partial<ToolSummaryPayload>;
  const issues: ValidationIssue[] = [];

  if (typeof r.tool_name !== "string" || r.tool_name.length === 0) {
    issues.push(issue("invalid_tool_name", "tool_summary payload requires a non-empty tool_name.", "payload.tool_name"));
  }
  if (!r.outcome || !["success", "failure", "partial", "skipped"].includes(r.outcome)) {
    issues.push(issue("invalid_tool_outcome", "tool_summary payload requires a valid outcome.", "payload.outcome"));
  }
  if (typeof r.elapsed_ms !== "number" || !Number.isInteger(r.elapsed_ms) || r.elapsed_ms < 0) {
    issues.push(issue("invalid_elapsed_ms", "tool_summary payload requires a non-negative integer elapsed_ms.", "payload.elapsed_ms"));
  }

  return issues;
}

function validateRoutingPayload(payload: CommonPayload): ValidationIssue[] {
  const r = payload as Partial<RoutingPayload>;
  const issues: ValidationIssue[] = [];

  if (!r.strategy || !["direct", "broadcast", "conditional", "fallback"].includes(r.strategy)) {
    issues.push(issue("invalid_routing_strategy", "routing payload requires a valid strategy.", "payload.strategy"));
  }
  issues.push(...validateStringArray(r.candidates, "payload.candidates", "routing payload requires a candidates string array."));
  if (typeof r.selected !== "string" || r.selected.length === 0) {
    issues.push(issue("invalid_routing_selected", "routing payload requires a non-empty selected.", "payload.selected"));
  }

  return issues;
}

function validatePromptContextPayload(payload: CommonPayload): ValidationIssue[] {
  const r = payload as Partial<PromptContextPayload>;
  const issues: ValidationIssue[] = [];

  if (!r.phase || !["system", "injection", "retrieval", "grounding"].includes(r.phase)) {
    issues.push(issue("invalid_prompt_context_phase", "prompt_context payload requires a valid phase.", "payload.phase"));
  }
  if (typeof r.priority !== "number" || !Number.isFinite(r.priority)) {
    issues.push(issue("invalid_prompt_context_priority", "prompt_context payload requires a numeric priority.", "payload.priority"));
  }
  if (typeof r.source_ref !== "string" || r.source_ref.length === 0) {
    issues.push(issue("invalid_prompt_context_source_ref", "prompt_context payload requires a non-empty source_ref.", "payload.source_ref"));
  }

  return issues;
}

function validateHistoryPayload(payload: CommonPayload): ValidationIssue[] {
  const r = payload as Partial<HistoryPayload>;
  const issues: ValidationIssue[] = [];

  if (!r.span || !["turn", "exchange", "session", "project"].includes(r.span)) {
    issues.push(issue("invalid_history_span", "history payload requires a valid span.", "payload.span"));
  }
  if (typeof r.turn_count !== "number" || !Number.isInteger(r.turn_count) || r.turn_count < 0) {
    issues.push(issue("invalid_history_turn_count", "history payload requires a non-negative integer turn_count.", "payload.turn_count"));
  }
  if (typeof r.anchor !== "string" || r.anchor.length === 0) {
    issues.push(issue("invalid_history_anchor", "history payload requires a non-empty anchor.", "payload.anchor"));
  }

  return issues;
}

function validateSurfacePayload(surface: CeelineSurface | undefined, payload: unknown): ValidationIssue[] {
  if (!surface || !isRecord(payload)) {
    return [];
  }

  const commonPayload = payload as CommonPayload;

  switch (surface) {
    case "handoff":
      return validateHandoffPayload(commonPayload);
    case "digest":
      return validateDigestPayload(commonPayload);
    case "memory":
      return validateMemoryPayload(commonPayload);
    case "reflection":
      return validateReflectionPayload(commonPayload);
    case "tool_summary":
      return validateToolSummaryPayload(commonPayload);
    case "routing":
      return validateRoutingPayload(commonPayload);
    case "prompt_context":
      return validatePromptContextPayload(commonPayload);
    case "history":
      return validateHistoryPayload(commonPayload);
    default:
      return [];
  }
}

function validateRender(value: unknown, constraints: unknown): ValidationIssue[] {
  if (!isRecord(value)) {
    return [issue("invalid_render", "Render must be an object.", "render")];
  }

  const render = value as Partial<RenderConfig>;
  const issues: ValidationIssue[] = [];

  if (!render.style || !RENDER_STYLES.includes(render.style)) {
    issues.push(issue("invalid_render_style", "Render style is invalid.", "render.style"));
  }
  if (typeof render.locale !== "string" || render.locale.length === 0) {
    issues.push(issue("invalid_render_locale", "Render locale must be a non-empty string.", "render.locale"));
  }
  if (!render.sanitizer || !SANITIZERS.includes(render.sanitizer)) {
    issues.push(issue("invalid_render_sanitizer", "Render sanitizer mode is invalid.", "render.sanitizer"));
  }
  if (isRecord(constraints)) {
    const constraintSet = constraints as Partial<ConstraintSet>;
    if (constraintSet.no_user_visible_output && render.style === "user_facing") {
      issues.push(issue("render_policy_conflict", "user_facing render is not allowed when no_user_visible_output is true.", "render.style"));
    }
  }

  return issues;
}

function validateDiagnostics(value: unknown): ValidationIssue[] {
  if (typeof value === "undefined") {
    return [];
  }

  if (!isRecord(value)) {
    return [issue("invalid_diagnostics", "Diagnostics must be an object when present.", "diagnostics")];
  }

  const diagnostics = value as Diagnostics;
  const issues: ValidationIssue[] = [];

  if (typeof diagnostics.trace !== "undefined" && typeof diagnostics.trace !== "boolean") {
    issues.push(issue("invalid_diagnostics_trace", "diagnostics.trace must be a boolean when present.", "diagnostics.trace"));
  }
  if (typeof diagnostics.labels !== "undefined" && (!Array.isArray(diagnostics.labels) || diagnostics.labels.some((label) => typeof label !== "string"))) {
    issues.push(issue("invalid_diagnostics_labels", "diagnostics.labels must be a string array when present.", "diagnostics.labels"));
  }

  return issues;
}

export function validateEnvelope(envelope: unknown): CeelineResult<CeelineEnvelope> {
  if (!isRecord(envelope)) {
    return fail(issue("invalid_envelope", "Envelope must be a JSON object.", "$"));
  }

  const record = envelope as Record<string, unknown>;
  const surface = typeof record.surface === "string" && SURFACES.includes(record.surface as CeelineSurface)
    ? (record.surface as CeelineSurface)
    : undefined;
  const channel = typeof record.channel === "string" && CHANNELS.includes(record.channel as CeelineChannel)
    ? (record.channel as CeelineChannel)
    : undefined;
  const issues: ValidationIssue[] = [];

  if (record.ceeline_version !== CEELINE_VERSION) {
    issues.push(issue("invalid_version", `ceeline_version must equal '${CEELINE_VERSION}'.`, "ceeline_version"));
  }
  if (typeof record.envelope_id !== "string" || record.envelope_id.length === 0) {
    issues.push(issue("invalid_envelope_id", "envelope_id must be a non-empty string.", "envelope_id"));
  }
  if (record.parent_envelope_id !== undefined && (typeof record.parent_envelope_id !== "string" || record.parent_envelope_id.length === 0)) {
    issues.push(issue("invalid_parent_envelope_id", "parent_envelope_id must be a non-empty string if present.", "parent_envelope_id"));
  }
  if (!surface) {
    issues.push(issue("invalid_surface", "surface contains an unsupported value.", "surface"));
  }
  if (!channel) {
    issues.push(issue("invalid_channel", "channel contains an unsupported value.", "channel"));
  }
  if (typeof record.intent !== "string" || !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(record.intent)) {
    issues.push(issue("invalid_intent", "intent must be a dotted identifier string.", "intent"));
  }

  issues.push(...hasOnlyKnownTopLevelFields(record));
  issues.push(...validateTopLevelOrder(record));
  issues.push(...validateSourceInfo(record.source));
  issues.push(...validateConstraints(record.constraints, channel));
  issues.push(...validatePreserve(record.preserve));
  issues.push(...validatePayload(record.payload));
  issues.push(...validateSurfacePayload(surface, record.payload));
  issues.push(...validateRender(record.render, record.constraints));
  issues.push(...validateDiagnostics(record.diagnostics));

  return issues.length > 0 ? fail(issues) : ok(record as unknown as CeelineEnvelope);
}

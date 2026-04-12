import envelopeV1Schema from "../schema/envelope-1.0.schema.json" with { type: "json" };
import digestPayloadV1Schema from "../schema/digest-payload-1.0.schema.json" with { type: "json" };
import handoffPayloadV1Schema from "../schema/handoff-payload-1.0.schema.json" with { type: "json" };
import historyPayloadV1Schema from "../schema/history-payload-1.0.schema.json" with { type: "json" };
import memoryPayloadV1Schema from "../schema/memory-payload-1.0.schema.json" with { type: "json" };
import promptContextPayloadV1Schema from "../schema/prompt-context-payload-1.0.schema.json" with { type: "json" };
import reflectionPayloadV1Schema from "../schema/reflection-payload-1.0.schema.json" with { type: "json" };
import routingPayloadV1Schema from "../schema/routing-payload-1.0.schema.json" with { type: "json" };
import toolSummaryPayloadV1Schema from "../schema/tool-summary-payload-1.0.schema.json" with { type: "json" };
export * from "./language.js";
export * from "./dict-parser.js";
export * from "./dialect.js";

export const CEELINE_VERSION = "1.0" as const;

export const TOP_LEVEL_FIELD_ORDER = [
  "ceeline_version",
  "envelope_id",
  "parent_envelope_id",
  "surface",
  "channel",
  "intent",
  "source",
  "constraints",
  "preserve",
  "payload",
  "render",
  "diagnostics"
] as const;

export const SURFACES = [
  "handoff",
  "digest",
  "memory",
  "reflection",
  "tool_summary",
  "routing",
  "prompt_context",
  "history"
] as const;

export const CHANNELS = ["internal", "controlled_ui"] as const;
export const SOURCE_KINDS = ["host", "adapter", "agent", "test", "fixture"] as const;
export const CONSTRAINT_MODES = ["read_only", "advisory", "mutating"] as const;
export const AUDIENCES = ["machine", "operator", "user"] as const;
export const FALLBACKS = ["reject", "verbose", "pass_through"] as const;
export const RENDER_STYLES = ["none", "terse", "normal", "user_facing"] as const;
export const SANITIZERS = ["strict", "standard"] as const;
export const PRESERVE_CLASSES = [
  "file_path",
  "tool_identifier",
  "agent_name",
  "model_name",
  "command",
  "env_var",
  "version",
  "schema_key",
  "placeholder",
  "section_label",
  "url",
  "code_span",
  "code_fence"
] as const;

export type CeelineSurface = (typeof SURFACES)[number];
export type CeelineChannel = (typeof CHANNELS)[number];
export type SourceKind = (typeof SOURCE_KINDS)[number];
export type ConstraintMode = (typeof CONSTRAINT_MODES)[number];
export type Audience = (typeof AUDIENCES)[number];
export type FallbackMode = (typeof FALLBACKS)[number];
export type RenderStyle = (typeof RENDER_STYLES)[number];
export type SanitizerMode = (typeof SANITIZERS)[number];
export type PreserveClass = (typeof PRESERVE_CLASSES)[number];

export interface SourceInfo {
  kind: SourceKind;
  name: string;
  instance: string;
  timestamp: string;
}

export interface ConstraintSet {
  mode: ConstraintMode;
  audience: Audience;
  max_render_tokens: number;
  no_user_visible_output: boolean;
  fallback: FallbackMode;
}

export interface PreserveSet {
  tokens: string[];
  classes: PreserveClass[];
}

export interface CommonPayload {
  summary: string;
  facts: string[];
  ask: string;
  artifacts: unknown[];
  metadata: Record<string, unknown>;
  [key: string]: unknown;
}

export interface HandoffPayload extends CommonPayload {
  role: "planner" | "reviewer" | "coordinator" | "parent_agent";
  target: "implementer" | "fixer" | "subagent" | "reviewer";
  scope: string[];
}

export interface DigestPayload extends CommonPayload {
  window: "turn" | "session" | "run";
  status: "ok" | "warn" | "error";
  metrics: Record<string, number>;
}

export interface MemoryPayload extends CommonPayload {
  memory_kind: "fact" | "decision" | "research";
  durability: "session" | "project" | "persistent";
  citations: string[];
}

export interface ReflectionPayload extends CommonPayload {
  reflection_type: "self_critique" | "hypothesis" | "plan_revision" | "confidence_check";
  confidence: number;
  revision: string;
}

export interface ToolSummaryPayload extends CommonPayload {
  tool_name: string;
  outcome: "success" | "failure" | "partial" | "skipped";
  elapsed_ms: number;
}

export interface RoutingPayload extends CommonPayload {
  strategy: "direct" | "broadcast" | "conditional" | "fallback";
  candidates: string[];
  selected: string;
}

export interface PromptContextPayload extends CommonPayload {
  phase: "system" | "injection" | "retrieval" | "grounding";
  priority: number;
  source_ref: string;
}

export interface HistoryPayload extends CommonPayload {
  span: "turn" | "exchange" | "session" | "project";
  turn_count: number;
  anchor: string;
}

export interface SurfacePayloadMap {
  handoff: HandoffPayload;
  digest: DigestPayload;
  memory: MemoryPayload;
  reflection: ReflectionPayload;
  tool_summary: ToolSummaryPayload;
  routing: RoutingPayload;
  prompt_context: PromptContextPayload;
  history: HistoryPayload;
}

export type PayloadForSurface<S extends CeelineSurface> = SurfacePayloadMap[S];

export interface RenderConfig {
  style: RenderStyle;
  locale: string;
  sanitizer: SanitizerMode;
}

export interface Diagnostics {
  trace?: boolean;
  labels?: string[];
  [key: string]: unknown;
}

export interface CeelineEnvelope<
  S extends CeelineSurface = CeelineSurface,
  P extends CommonPayload = PayloadForSurface<S>
> {
  ceeline_version: typeof CEELINE_VERSION;
  envelope_id: string;
  parent_envelope_id?: string;
  surface: S;
  channel: CeelineChannel;
  intent: string;
  source: SourceInfo;
  constraints: ConstraintSet;
  preserve: PreserveSet;
  payload: P;
  render: RenderConfig;
  diagnostics?: Diagnostics;
  [key: `x_${string}`]: unknown;
}

export const ceelineEnvelopeSchema = envelopeV1Schema;
export const handoffPayloadSchema = handoffPayloadV1Schema;
export const digestPayloadSchema = digestPayloadV1Schema;
export const historyPayloadSchema = historyPayloadV1Schema;
export const memoryPayloadSchema = memoryPayloadV1Schema;
export const promptContextPayloadSchema = promptContextPayloadV1Schema;
export const reflectionPayloadSchema = reflectionPayloadV1Schema;
export const routingPayloadSchema = routingPayloadV1Schema;
export const toolSummaryPayloadSchema = toolSummaryPayloadV1Schema;

export const SURFACE_PAYLOAD_SCHEMA_IDS = {
  handoff: handoffPayloadV1Schema.$id,
  digest: digestPayloadV1Schema.$id,
  memory: memoryPayloadV1Schema.$id,
  reflection: reflectionPayloadV1Schema.$id,
  tool_summary: toolSummaryPayloadV1Schema.$id,
  routing: routingPayloadV1Schema.$id,
  prompt_context: promptContextPayloadV1Schema.$id,
  history: historyPayloadV1Schema.$id
} as const;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

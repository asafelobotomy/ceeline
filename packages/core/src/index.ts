import {
  CEELINE_VERSION,
  type CeelineEnvelope,
  type CeelineSurface,
  type CommonPayload,
  type ConstraintSet,
  type DigestPayload,
  type Diagnostics,
  type HandoffPayload,
  type MemoryPayload,
  type PayloadForSurface,
  type PreserveClass,
  type PreserveSet,
  type RenderConfig,
  type SourceInfo
} from "@ceeline/schema";
import { extractPreserveTokens, validatePreservation } from "./preserve";
import { renderCeelineCompact, renderCeelineCompactAuto, parseCeelineCompact, type CompactParseResult } from "./compact";
import { decodeCanonical, detectLeaks, renderInternal, renderUserFacing, sanitizeUserFacing, type DecodedEnvelope, type LeakFinding } from "./render";
import { fail, ok, type CeelineResult, type ValidationIssue } from "./result";
import { validateEnvelope } from "./validate";

export type { CeelineResult, ValidationIssue, DecodedEnvelope, LeakFinding, CompactParseResult };

type OptionalCommonPayloadFields = "facts" | "ask" | "artifacts" | "metadata";

export type CanonicalPayloadInput<P extends CommonPayload> =
  Omit<P, OptionalCommonPayloadFields> & Partial<Pick<P, OptionalCommonPayloadFields>>;

export interface CanonicalInput<P extends CommonPayload = CommonPayload> {
  text?: string;
  intent: string;
  source: SourceInfo;
  constraints?: Partial<ConstraintSet>;
  preserve?: Partial<PreserveSet>;
  payload: CanonicalPayloadInput<P>;
  render?: Partial<RenderConfig>;
  diagnostics?: Diagnostics;
  extensions?: Record<`x_${string}`, unknown>;
}

export type CanonicalInputForSurface<S extends CeelineSurface> = CanonicalInput<PayloadForSurface<S>>;
export type HandoffCanonicalInput = CanonicalInput<HandoffPayload>;
export type DigestCanonicalInput = CanonicalInput<DigestPayload>;
export type MemoryCanonicalInput = CanonicalInput<MemoryPayload>;

function createEnvelopeId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `cel:${timestamp}${random}`;
}

function defaultConstraints(): ConstraintSet {
  return {
    mode: "read_only",
    audience: "machine",
    max_render_tokens: 0,
    no_user_visible_output: true,
    fallback: "reject"
  };
}

function defaultRender(): RenderConfig {
  return {
    style: "none",
    locale: "en",
    sanitizer: "strict"
  };
}

export function parseEnvelope(text: string): CeelineResult<CeelineEnvelope> {
  try {
    const parsed = JSON.parse(text) as unknown;
    return validateEnvelope(parsed);
  } catch {
    return fail({
      code: "invalid_json",
      message: "Input must be valid JSON.",
      path: "$"
    });
  }
}

export function encodeCanonical(input: HandoffCanonicalInput, surface: "handoff"): CeelineResult<CeelineEnvelope<"handoff", HandoffPayload>>;
export function encodeCanonical(input: DigestCanonicalInput, surface: "digest"): CeelineResult<CeelineEnvelope<"digest", DigestPayload>>;
export function encodeCanonical(input: MemoryCanonicalInput, surface: "memory"): CeelineResult<CeelineEnvelope<"memory", MemoryPayload>>;
export function encodeCanonical<S extends Exclude<CeelineSurface, "handoff" | "digest" | "memory">>(
  input: CanonicalInputForSurface<S>,
  surface: S
): CeelineResult<CeelineEnvelope<S>>;
export function encodeCanonical(
  input: CanonicalInput<CommonPayload>,
  surface: CeelineSurface
): CeelineResult<CeelineEnvelope>;
export function encodeCanonical<S extends CeelineSurface>(
  input: CanonicalInputForSurface<S>,
  surface: S
): CeelineResult<CeelineEnvelope<S>> {
  const sourceText = input.text ?? [input.payload.summary, ...(input.payload.facts ?? []), input.payload.ask ?? ""].join("\n");
  const extracted = extractPreserveTokens(sourceText, input.preserve?.classes ?? ([] as PreserveClass[]));
  const preserveTokens = Array.from(new Set([...(input.preserve?.tokens ?? []), ...extracted.tokens]));
  const preserveClasses = Array.from(new Set([...(input.preserve?.classes ?? []), ...extracted.classes]));

  const payload = {
    ...input.payload,
    facts: input.payload.facts ?? [],
    ask: input.payload.ask ?? "",
    artifacts: input.payload.artifacts ?? [],
    metadata: input.payload.metadata ?? {}
  } as PayloadForSurface<S>;

  const envelope: CeelineEnvelope<S> = {
    ceeline_version: CEELINE_VERSION,
    envelope_id: createEnvelopeId(),
    surface,
    channel: surface === "history" ? "controlled_ui" : "internal",
    intent: input.intent,
    source: input.source,
    constraints: {
      ...defaultConstraints(),
      ...input.constraints
    },
    preserve: {
      tokens: preserveTokens,
      classes: preserveClasses
    },
    payload,
    render: {
      ...defaultRender(),
      ...input.render
    },
    ...(input.diagnostics ? { diagnostics: input.diagnostics } : {}),
    ...(input.extensions ?? {})
  };

  return validateEnvelope(envelope) as CeelineResult<CeelineEnvelope<S>>;
}

export function decodeEnvelope(envelope: CeelineEnvelope): DecodedEnvelope {
  return decodeCanonical(envelope);
}

export {
  decodeCanonical,
  detectLeaks,
  extractPreserveTokens,
  parseCeelineCompact,
  renderCeelineCompact,
  renderCeelineCompactAuto,
  renderInternal,
  renderUserFacing,
  sanitizeUserFacing,
  validateEnvelope,
  validatePreservation
};

import {
  CEELINE_VERSION,
  createPolicyDefaults,
  type CeelineEnvelope,
  type CeelinePolicy,
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
} from "@asafelobotomy/ceeline-schema";
import { extractPreserveTokens, validatePreservation } from "./preserve.js";
import { renderCeelineCompact, renderCeelineCompactAuto, parseCeelineCompact, extractDialect, type CompactParseResult, type CompactRenderOptions } from "./compact.js";
import { decodeCanonical, detectLeaks, renderInternal, renderUserFacing, sanitizeUserFacing, type DecodedEnvelope, type LeakFinding } from "./render.js";
import { fail, ok, type CeelineResult, type ValidationIssue } from "./result.js";
import { validateEnvelope } from "./validate.js";

export type { CeelineResult, ValidationIssue, DecodedEnvelope, LeakFinding, CompactParseResult, CompactRenderOptions };

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

export interface EncodeCanonicalOptions {
  policy?: CeelinePolicy;
}

function createEnvelopeId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `cel:${timestamp}${random}`;
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

export function encodeCanonical(input: HandoffCanonicalInput, surface: "handoff", options?: EncodeCanonicalOptions): CeelineResult<CeelineEnvelope<"handoff", HandoffPayload>>;
export function encodeCanonical(input: DigestCanonicalInput, surface: "digest", options?: EncodeCanonicalOptions): CeelineResult<CeelineEnvelope<"digest", DigestPayload>>;
export function encodeCanonical(input: MemoryCanonicalInput, surface: "memory", options?: EncodeCanonicalOptions): CeelineResult<CeelineEnvelope<"memory", MemoryPayload>>;
export function encodeCanonical<S extends Exclude<CeelineSurface, "handoff" | "digest" | "memory">>(
  input: CanonicalInputForSurface<S>,
  surface: S,
  options?: EncodeCanonicalOptions
): CeelineResult<CeelineEnvelope<S>>;
export function encodeCanonical(
  input: CanonicalInput<CommonPayload>,
  surface: CeelineSurface,
  options?: EncodeCanonicalOptions
): CeelineResult<CeelineEnvelope>;
export function encodeCanonical<S extends CeelineSurface>(
  input: CanonicalInputForSurface<S>,
  surface: S,
  options: EncodeCanonicalOptions = {}
): CeelineResult<CeelineEnvelope<S>> {
  const policyDefaults = createPolicyDefaults(surface, options.policy ?? "internal");
  const parts = [input.payload.summary, ...(input.payload.facts ?? []), input.payload.ask ?? ""];
  // Extract preserve tokens from artifacts and metadata too
  for (const artifact of input.payload.artifacts ?? []) {
    if (typeof artifact === "string") parts.push(artifact);
    else parts.push(JSON.stringify(artifact));
  }
  if (input.payload.metadata) {
    for (const val of Object.values(input.payload.metadata)) {
      if (typeof val === "string") parts.push(val);
    }
  }
  const sourceText = input.text ?? parts.join("\n");
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
    channel: policyDefaults.channel,
    intent: input.intent,
    source: input.source,
    constraints: {
      ...policyDefaults.constraints,
      ...input.constraints
    },
    preserve: {
      tokens: preserveTokens,
      classes: preserveClasses
    },
    payload,
    render: {
      ...policyDefaults.render,
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
  createPolicyDefaults,
  decodeCanonical,
  detectLeaks,
  extractDialect,
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

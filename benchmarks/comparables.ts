import { compress as paktCompress, decompress as paktDecompress } from "@sriinnu/pakt";
import { decode as jtmlDecode, encode as jtmlEncode, inferSchema as inferJtmlSchema, schemaManager as jtmlSchemaManager } from "@jtml/core";
import { compressObject, createCompressionTable, decompressObject, type CompressionTable, type JsonSchema } from "jsonschema-key-compression";
import { jsonToTonl } from "tonl-mcp-bridge/dist/core/json-to-tonl.js";
import { tonlToJson } from "tonl-mcp-bridge/dist/core/tonl-to-json.js";
import { parse as zipsonParse, stringify as zipsonStringify } from "zipson";
import { parseCeelineCompact, renderCeelineCompact } from "@asafelobotomy/ceeline-core";
import {
  ceelineEnvelopeSchema,
  digestPayloadSchema,
  handoffPayloadSchema,
  historyPayloadSchema,
  memoryPayloadSchema,
  promptContextPayloadSchema,
  reflectionPayloadSchema,
  routingPayloadSchema,
  toolSummaryPayloadSchema,
  type CeelineEnvelope,
  type CeelineSurface,
} from "@asafelobotomy/ceeline-schema";
import { isDeepStrictEqual } from "node:util";

export interface ComparableFormatMetrics {
  format: string;
  bytes: number;
  tokensCl100k: number;
  tokensO200k: number;
  roundTripOk: boolean;
  error?: string;
}

export interface BatchComparison {
  surface: string;
  size: number;
  recordCount: number;
  formats: ComparableFormatMetrics[];
}

type TokenCounter = (text: string, encoding: "cl100k" | "o200k") => number;

const BATCH_SIZES = [10, 100] as const;
const COMMON_PAYLOAD_KEYS = new Set(["summary", "facts", "ask", "artifacts", "metadata"]);
const JTML_BLOB_MARKER = "__ceeline_json__";
const PAKT_LOSSLESS_PROFILES = [
  {
    name: "structural-only",
    options: {
      fromFormat: "json",
      layers: {
        structural: true,
        dictionary: false,
        tokenizerAware: false,
        semantic: false,
      },
      semanticBudget: 0,
    },
  },
  {
    name: "dictionary-only",
    options: {
      fromFormat: "json",
      layers: {
        structural: false,
        dictionary: true,
        tokenizerAware: false,
        semantic: false,
      },
      semanticBudget: 0,
    },
  },
] as const;

const PAYLOAD_SCHEMAS: Record<CeelineSurface, unknown> = {
  handoff: handoffPayloadSchema,
  digest: digestPayloadSchema,
  memory: memoryPayloadSchema,
  reflection: reflectionPayloadSchema,
  tool_summary: toolSummaryPayloadSchema,
  routing: routingPayloadSchema,
  prompt_context: promptContextPayloadSchema,
  history: historyPayloadSchema,
};

const compressionTableCache = new Map<CeelineSurface, CompressionTable>();

export function measureExternalComparables(
  envelope: CeelineEnvelope,
  countTokens: TokenCounter,
): ComparableFormatMetrics[] {
  return [
    measurePakt(envelope, countTokens),
    measureJtml(envelope, countTokens),
    measureZipson(envelope, countTokens),
    measureJsonSchemaKeyCompression(envelope, countTokens),
  ];
}

export function measureBatchComparisons(
  corpus: readonly CeelineEnvelope[],
  countTokens: TokenCounter,
): BatchComparison[] {
  const surfaces = [...new Set(corpus.map((entry) => entry.surface))];

  return surfaces.flatMap((surface) => {
    const seed = corpus.filter((entry) => entry.surface === surface);
    return BATCH_SIZES.map((size) => measureBatchGroup(surface, buildBatch(seed, size), countTokens));
  });
}

export function measureMixedBatchComparisons(
  corpus: readonly CeelineEnvelope[],
  countTokens: TokenCounter,
): BatchComparison[] {
  return BATCH_SIZES.map((size) => measureBatchGroup("mixed", buildBatch(corpus, size), countTokens));
}

function measureBatchGroup(
  surface: string,
  batch: readonly CeelineEnvelope[],
  countTokens: TokenCounter,
): BatchComparison {
  return {
    surface,
    size: batch.length,
    recordCount: batch.length,
    formats: [
      measureJsonBatch(batch, countTokens),
      measureCeelineBatch(batch, "full", countTokens),
      measureCeelineBatch(batch, "dense", countTokens),
      measurePaktBatch(surface, batch, countTokens),
      measureJtmlBatch(surface, batch, countTokens),
      measureJtmlSchemaReuseBatch(surface, batch, countTokens),
      measureZipsonBatch(batch, countTokens),
      measureJsonSchemaKeyCompressionBatch(batch[0]?.surface ?? "handoff", batch, countTokens),
      measureTonlBatch(surface, batch, countTokens),
    ],
  };
}

function measurePakt(envelope: CeelineEnvelope, countTokens: TokenCounter): ComparableFormatMetrics {
  return measureSafeComparable("pakt", countTokens, envelope, () => {
    return measureBestPaktComparable(envelope);
  });
}

function measureJtml(envelope: CeelineEnvelope, countTokens: TokenCounter): ComparableFormatMetrics {
  return measureSafeComparable("jtml", countTokens, envelope, () => {
    const text = jtmlEncode(prepareForJtml(envelope), {
      schemaId: `ceeline-${envelope.surface}-oneshot`,
      includeSchema: true,
    });
    const restored = normalizeAgainstTemplate(jtmlDecode(text), envelope);
    return { text, restored };
  });
}

function measureZipson(envelope: CeelineEnvelope, countTokens: TokenCounter): ComparableFormatMetrics {
  return measureSafeComparable("zipson", countTokens, envelope, () => {
    const text = zipsonStringify(envelope, { fullPrecisionFloats: true });
    const restored = zipsonParse(text);
    return { text, restored };
  });
}

function measureJsonSchemaKeyCompression(
  envelope: CeelineEnvelope,
  countTokens: TokenCounter,
): ComparableFormatMetrics {
  return measureSafeComparable("jsonschema-key-compression", countTokens, envelope, () => {
    const table = getCompressionTable(envelope.surface);
    const compressed = compressObject(table, envelope as unknown as Record<string, unknown>);
    const text = JSON.stringify(compressed);
    const restored = decompressObject(table, compressed as Record<string, unknown>);
    return { text, restored };
  });
}

function measureJsonBatch(batch: readonly CeelineEnvelope[], countTokens: TokenCounter): ComparableFormatMetrics {
  return measureSafeComparable("json", countTokens, batch, () => {
    const text = JSON.stringify(batch);
    return { text, restored: JSON.parse(text) as unknown };
  });
}

function measureCeelineBatch(
  batch: readonly CeelineEnvelope[],
  density: "full" | "dense",
  countTokens: TokenCounter,
): ComparableFormatMetrics {
  const format = `ceeline-${density}`;
  try {
    let bytes = 0;
    let tokensCl100k = 0;
    let tokensO200k = 0;
    let roundTripOk = true;

    for (const envelope of batch) {
      const renderResult = renderCeelineCompact(envelope, density);
      if (!renderResult.ok) {
        throw new Error(renderResult.issues.map((issue) => issue.message).join("; "));
      }

      const text = renderResult.value;
      bytes += Buffer.byteLength(text, "utf-8");
      tokensCl100k += countTokens(text, "cl100k");
      tokensO200k += countTokens(text, "o200k");

      const parsed = parseCeelineCompact(text);
      roundTripOk &&= parsed.ok && ceelineRoundTripMatches(parsed.value as unknown as Record<string, unknown>, envelope);
    }

    return { format, bytes, tokensCl100k, tokensO200k, roundTripOk };
  } catch (error) {
    return failureComparable(format, error);
  }
}

function measurePaktBatch(
  surface: string,
  batch: readonly CeelineEnvelope[],
  countTokens: TokenCounter,
): ComparableFormatMetrics {
  return measureSafeComparable("pakt", countTokens, batch, () => {
    return measureBestPaktComparable(batch);
  });
}

function measureJtmlBatch(
  surface: string,
  batch: readonly CeelineEnvelope[],
  countTokens: TokenCounter,
): ComparableFormatMetrics {
  return measureSafeComparable("jtml", countTokens, batch, () => {
    const prepared = prepareForJtml(batch);
    const text = jtmlEncode(prepared, {
      schemaId: `ceeline-${surface}-batch-${batch.length}`,
      includeSchema: true,
    });
    const restored = normalizeAgainstTemplate(jtmlDecode(text), batch);
    return { text, restored };
  });
}

function measureJtmlSchemaReuseBatch(
  surface: string,
  batch: readonly CeelineEnvelope[],
  countTokens: TokenCounter,
): ComparableFormatMetrics {
  const schemaId = `ceeline-${surface}-batch-ref-${batch.length}`;

  return measureSafeComparable("jtml-ref", countTokens, batch, () => {
    const prepared = prepareForJtml(batch);
    const schema = inferJtmlSchema(prepared, schemaId);
    if (!jtmlSchemaManager.has(schemaId)) {
      jtmlSchemaManager.register(schema);
    }
    const text = jtmlEncode(prepared, {
      schemaRef: schemaId,
      includeSchema: false,
    });
    const restored = normalizeAgainstTemplate(
      jtmlDecode(text, { schemaCache: new Map([[schemaId, schema]]) }),
      batch,
    );
    return { text, restored };
  });
}

function measureZipsonBatch(
  batch: readonly CeelineEnvelope[],
  countTokens: TokenCounter,
): ComparableFormatMetrics {
  return measureSafeComparable("zipson", countTokens, batch, () => {
    const text = zipsonStringify(batch, { fullPrecisionFloats: true });
    const restored = zipsonParse(text);
    return { text, restored };
  });
}

function measureJsonSchemaKeyCompressionBatch(
  surface: CeelineSurface,
  batch: readonly CeelineEnvelope[],
  countTokens: TokenCounter,
): ComparableFormatMetrics {
  return measureSafeComparable("jsonschema-key-compression", countTokens, batch, () => {
    const table = getCompressionTable(surface);
    const compressedBatch = batch.map((item) => compressObject(table, item as unknown as Record<string, unknown>));
    const text = JSON.stringify(compressedBatch);
    const restored = compressedBatch.map((item) => decompressObject(table, item as Record<string, unknown>));
    return { text, restored };
  });
}

function measureTonlBatch(
  surface: string,
  batch: readonly CeelineEnvelope[],
  countTokens: TokenCounter,
): ComparableFormatMetrics {
  return measureSafeComparable("tonl", countTokens, batch, () => {
    const rows = batch.map(toTonlRow);
    const text = jsonToTonl(rows, surface);
    const restored = tonlToJson(text).map(fromTonlRow);
    return { text, restored };
  });
}

function measureSafeComparable(
  format: string,
  countTokens: TokenCounter,
  original: unknown,
  measure: () => { text: string; restored: unknown },
): ComparableFormatMetrics {
  try {
    const { text, restored } = measure();
    return {
      format,
      bytes: Buffer.byteLength(text, "utf-8"),
      tokensCl100k: countTokens(text, "cl100k"),
      tokensO200k: countTokens(text, "o200k"),
      roundTripOk: jsonEqual(restored, original),
    };
  } catch (error) {
    return failureComparable(format, error);
  }
}

function failureComparable(format: string, error: unknown): ComparableFormatMetrics {
  return {
    format,
    bytes: 0,
    tokensCl100k: 0,
    tokensO200k: 0,
    roundTripOk: false,
    error: error instanceof Error ? error.message : String(error),
  };
}

function buildBatch(seed: readonly CeelineEnvelope[], size: number): CeelineEnvelope[] {
  return Array.from({ length: size }, (_, index) => cloneForBatch(seed[index % seed.length], index));
}

function cloneForBatch(envelope: CeelineEnvelope, index: number): CeelineEnvelope {
  const baseTimestamp = Date.parse(envelope.source.timestamp);
  const timestamp = Number.isNaN(baseTimestamp)
    ? envelope.source.timestamp
    : new Date(baseTimestamp + index * 1000).toISOString();

  return {
    ...envelope,
    envelope_id: `${envelope.envelope_id}-batch-${index + 1}`,
    parent_envelope_id: envelope.parent_envelope_id
      ? `${envelope.parent_envelope_id}-batch-${index + 1}`
      : undefined,
    source: {
      ...envelope.source,
      instance: `${envelope.source.instance}-${index + 1}`,
      timestamp,
    },
  };
}

function getCompressionTable(surface: CeelineSurface): CompressionTable {
  const existing = compressionTableCache.get(surface);
  if (existing) return existing;

  const baseEnvelopeSchema = normalizeJsonSchema(ceelineEnvelopeSchema as Record<string, unknown>);
  const payloadSchema = normalizeJsonSchema(PAYLOAD_SCHEMAS[surface]);
  const surfaceSchema: JsonSchema = {
    ...baseEnvelopeSchema,
    properties: {
      ...(baseEnvelopeSchema.properties ?? {}),
      surface: { enum: [surface] },
      payload: payloadSchema,
    },
  };

  const table = createCompressionTable(surfaceSchema);
  compressionTableCache.set(surface, table);
  return table;
}

function measureBestPaktComparable(original: unknown): { text: string; restored: unknown } {
  const json = JSON.stringify(original);
  let bestLossless: { text: string; restored: unknown } | undefined;
  let bestFallback: { text: string; restored: unknown } | undefined;
  let lastError: unknown;

  for (const profile of PAKT_LOSSLESS_PROFILES) {
    try {
      const compressed = paktCompress(json, profile.options).compressed;
      const restored = decodePaktJson(paktDecompress(compressed, "json").text);
      const candidate = { text: compressed, restored };

      if (!bestFallback || Buffer.byteLength(candidate.text, "utf-8") < Buffer.byteLength(bestFallback.text, "utf-8")) {
        bestFallback = candidate;
      }

      if (
        jsonEqual(restored, original)
        && (!bestLossless || Buffer.byteLength(candidate.text, "utf-8") < Buffer.byteLength(bestLossless.text, "utf-8"))
      ) {
        bestLossless = candidate;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (bestLossless) return bestLossless;
  if (bestFallback) return bestFallback;
  throw lastError ?? new Error("No PAKT profile produced a comparable result.");
}

function decodePaktJson(value: unknown): unknown {
  if (typeof value === "string") {
    return JSON.parse(value) as unknown;
  }
  return normalizeJsonValue(value);
}

function normalizeAgainstTemplate(value: unknown, template: unknown): unknown {
  if ((Array.isArray(template) || isRecord(template)) && typeof value === "string" && value.startsWith(JTML_BLOB_MARKER)) {
    return normalizeAgainstTemplate(decodeJtmlBlob(value), template);
  }

  if (template === undefined && value === null) {
    return undefined;
  }

  if (typeof template === "boolean") {
    if (value === 1 || value === "1") return true;
    if (value === 0 || value === "0") return false;
    return value;
  }

  if (typeof template === "string") {
    if (isIsoDateString(template)) {
      if (value instanceof Date) {
        const normalized = value.toISOString();
        return Date.parse(normalized) === Date.parse(template) ? template : normalized;
      }
      if (typeof value === "string" && !Number.isNaN(Date.parse(value)) && Date.parse(value) === Date.parse(template)) {
        return template;
      }
    }
    return value;
  }

  if (Array.isArray(template)) {
    if (!Array.isArray(value)) return value;
    if (template.length === 0) return value;
    return value.map((item, index) => normalizeAgainstTemplate(item, template[Math.min(index, template.length - 1)]));
  }

  if (isRecord(template) && isRecord(value)) {
    const normalized: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      normalized[key] = key in template
        ? normalizeAgainstTemplate(entry, template[key])
        : entry;
    }
    return normalized;
  }

  return value;
}

function isIsoDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
}

function prepareForJtml(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) {
    return depth === 0 ? value.map((entry) => prepareForJtml(entry, depth + 1)) : encodeJtmlBlob(value);
  }

  if (isRecord(value)) {
    if (depth <= 1) {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, prepareForJtml(entry, depth + 1)]),
      );
    }
    return encodeJtmlBlob(value);
  }

  return value;
}

function encodeJtmlBlob(value: unknown): string {
  return `${JTML_BLOB_MARKER}${Buffer.from(JSON.stringify(value), "utf8").toString("base64url")}`;
}

function decodeJtmlBlob(value: string): unknown {
  return JSON.parse(Buffer.from(value.slice(JTML_BLOB_MARKER.length), "base64url").toString("utf8")) as unknown;
}

function toTonlRow(envelope: CeelineEnvelope): Record<string, unknown> {
  const payloadExtras = Object.fromEntries(
    Object.entries(envelope.payload).filter(([key]) => !COMMON_PAYLOAD_KEYS.has(key)),
  );

  return {
    ceeline_version: envelope.ceeline_version,
    envelope_id: envelope.envelope_id,
    parent_envelope_id: envelope.parent_envelope_id ?? null,
    surface: envelope.surface,
    channel: envelope.channel,
    intent: envelope.intent,
    source_kind: envelope.source.kind,
    source_name: envelope.source.name,
    source_instance: envelope.source.instance,
    source_timestamp: envelope.source.timestamp,
    constraints_mode: envelope.constraints.mode,
    constraints_audience: envelope.constraints.audience,
    constraints_max_render_tokens: envelope.constraints.max_render_tokens,
    constraints_no_user_visible_output: envelope.constraints.no_user_visible_output,
    constraints_fallback: envelope.constraints.fallback,
    preserve_tokens_json: JSON.stringify(envelope.preserve.tokens),
    preserve_classes_json: JSON.stringify(envelope.preserve.classes),
    payload_summary: envelope.payload.summary,
    payload_facts_json: JSON.stringify(envelope.payload.facts),
    payload_ask: envelope.payload.ask,
    payload_artifacts_json: JSON.stringify(envelope.payload.artifacts),
    payload_metadata_json: JSON.stringify(envelope.payload.metadata),
    payload_extra_json: JSON.stringify(payloadExtras),
    render_style: envelope.render.style,
    render_locale: envelope.render.locale,
    render_sanitizer: envelope.render.sanitizer,
    diagnostics_json: envelope.diagnostics ? JSON.stringify(envelope.diagnostics) : null,
  };
}

function fromTonlRow(row: Record<string, unknown>): CeelineEnvelope {
  const surface = stringOrFallback(row.surface, "handoff") as CeelineSurface;
  const payload = buildTonlPayload(surface, row);

  return {
    ceeline_version: stringOrFallback(row.ceeline_version, "1.0") as CeelineEnvelope["ceeline_version"],
    envelope_id: stringOrFallback(row.envelope_id, ""),
    ...(row.parent_envelope_id == null || row.parent_envelope_id === ""
      ? {}
      : { parent_envelope_id: stringOrFallback(row.parent_envelope_id, "") }),
    surface,
    channel: stringOrFallback(row.channel, "internal") as CeelineEnvelope["channel"],
    intent: stringOrFallback(row.intent, ""),
    source: {
      kind: stringOrFallback(row.source_kind, "agent") as CeelineEnvelope["source"]["kind"],
      name: stringOrFallback(row.source_name, ""),
      instance: stringOrFallback(row.source_instance, ""),
      timestamp: stringOrFallback(row.source_timestamp, ""),
    },
    constraints: {
      mode: stringOrFallback(row.constraints_mode, "read_only") as CeelineEnvelope["constraints"]["mode"],
      audience: stringOrFallback(row.constraints_audience, "machine") as CeelineEnvelope["constraints"]["audience"],
      max_render_tokens: numberOrFallback(row.constraints_max_render_tokens, 0),
      no_user_visible_output: booleanOrFallback(row.constraints_no_user_visible_output, false),
      fallback: stringOrFallback(row.constraints_fallback, "reject") as CeelineEnvelope["constraints"]["fallback"],
    },
    preserve: {
      tokens: parseJsonBlob<string[]>(row.preserve_tokens_json, []),
      classes: parseJsonBlob<CeelineEnvelope["preserve"]["classes"]>(row.preserve_classes_json, []),
    },
    payload,
    render: {
      style: stringOrFallback(row.render_style, "none") as CeelineEnvelope["render"]["style"],
      locale: stringOrFallback(row.render_locale, "en"),
      sanitizer: stringOrFallback(row.render_sanitizer, "strict") as CeelineEnvelope["render"]["sanitizer"],
    },
    ...(row.diagnostics_json == null
      ? {}
      : { diagnostics: parseJsonBlob<Record<string, unknown>>(row.diagnostics_json, {}) }),
  };
}

function buildTonlPayload(surface: CeelineSurface, row: Record<string, unknown>): CeelineEnvelope["payload"] {
  const commonPayload = {
    summary: stringOrFallback(row.payload_summary, ""),
    facts: parseJsonBlob<string[]>(row.payload_facts_json, []),
    ask: stringOrFallback(row.payload_ask, ""),
    artifacts: parseJsonBlob<unknown[]>(row.payload_artifacts_json, []),
    metadata: parseJsonBlob<Record<string, unknown>>(row.payload_metadata_json, {}),
  };
  const extras = parseJsonBlob<Record<string, unknown>>(row.payload_extra_json, {});

  return {
    ...commonPayload,
    ...extras,
  } as CeelineEnvelope["payload"];
}

function parseJsonBlob<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) return fallback;
  return JSON.parse(value) as T;
}

function stringOrFallback(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function numberOrFallback(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanOrFallback(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;
  return fallback;
}

function normalizeJsonSchema(value: unknown): JsonSchema {
  if (!isRecord(value)) return {};

  const schema: JsonSchema = {};
  const type = value.type;
  if (typeof type === "string" || Array.isArray(type)) {
    schema.type = type as JsonSchema["type"];
  }

  if (Array.isArray(value.enum)) schema.enum = value.enum;
  if (Object.prototype.hasOwnProperty.call(value, "const")) schema.enum = [value.const];
  if (Array.isArray(value.required)) schema.required = value.required.filter((entry): entry is string => typeof entry === "string");

  if (typeof value.additionalProperties === "boolean") {
    schema.additionalProperties = value.additionalProperties;
  } else if (isRecord(value.additionalProperties)) {
    schema.additionalProperties = true;
  }

  if (isRecord(value.properties)) {
    schema.properties = Object.fromEntries(
      Object.entries(value.properties).map(([key, child]) => [key, normalizeJsonSchema(child)]),
    );
  }

  if (Array.isArray(value.items)) {
    schema.items = value.items.map((item) => normalizeJsonSchema(item));
  } else if (isRecord(value.items)) {
    schema.items = normalizeJsonSchema(value.items);
  }

  if (Array.isArray(value.anyOf)) schema.anyOf = value.anyOf.map((item) => normalizeJsonSchema(item));
  if (Array.isArray(value.oneOf)) schema.oneOf = value.oneOf.map((item) => normalizeJsonSchema(item));
  if (Array.isArray(value.allOf)) schema.allOf = value.allOf.map((item) => normalizeJsonSchema(item));

  if (typeof value.minLength === "number") schema.minLength = value.minLength;
  if (typeof value.maxLength === "number") schema.maxLength = value.maxLength;
  if (typeof value.minItems === "number") schema.minItems = value.minItems;
  if (typeof value.maxItems === "number") schema.maxItems = value.maxItems;
  if (typeof value.minProperties === "number") schema.minProperties = value.minProperties;
  if (typeof value.maxProperties === "number") schema.maxProperties = value.maxProperties;
  if (typeof value.minimum === "number") schema.minimum = value.minimum;
  if (typeof value.maximum === "number") schema.maximum = value.maximum;
  if (typeof value.pattern === "string") schema.pattern = value.pattern;
  if (typeof value.format === "string") schema.format = value.format;
  if (typeof value.uniqueItems === "boolean") schema.uniqueItems = value.uniqueItems;

  return schema;
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return isDeepStrictEqual(normalizeJsonValue(left), normalizeJsonValue(right));
}

function normalizeJsonValue(value: unknown): unknown {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as unknown;
}

function ceelineRoundTripMatches(parsed: Record<string, unknown>, envelope: CeelineEnvelope): boolean {
  return parsed.surface === envelope.surface
    && parsed.intent === envelope.intent
    && parsed.channel === envelope.channel
    && parsed.mode === envelope.constraints.mode
    && parsed.audience === envelope.constraints.audience
    && parsed.summary === envelope.payload.summary;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
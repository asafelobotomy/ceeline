import {
  COMPACT_AUDIENCE_CODES,
  COMPACT_CHANNEL_CODES,
  COMPACT_DEFAULTS,
  COMPACT_DENSITIES,
  COMPACT_FALLBACK_CODES,
  COMPACT_LINE_KEYS,
  COMPACT_MODE_CODES,
  COMPACT_PRESERVE_CLASS_CODES,
  COMPACT_RENDER_STYLE_CODES,
  COMPACT_SANITIZER_CODES,
  COMPACT_SURFACE_CODES,
  DIGEST_STATUS_CODES,
  DIGEST_WINDOW_CODES,
  EXTENSION_PREFIX,
  HANDOFF_ROLE_CODES,
  HANDOFF_TARGET_CODES,
  HISTORY_SPAN_CODES,
  MEMORY_DURABILITY_CODES,
  MEMORY_KIND_CODES,
  PROMPT_CONTEXT_PHASE_CODES,
  REFLECTION_TYPE_CODES,
  REVERSE_AUDIENCE_CODES,
  REVERSE_CHANNEL_CODES,
  REVERSE_DIGEST_STATUS_CODES,
  REVERSE_DIGEST_WINDOW_CODES,
  REVERSE_FALLBACK_CODES,
  REVERSE_HANDOFF_ROLE_CODES,
  REVERSE_HANDOFF_TARGET_CODES,
  REVERSE_HISTORY_SPAN_CODES,
  REVERSE_MEMORY_DURABILITY_CODES,
  REVERSE_MEMORY_KIND_CODES,
  REVERSE_MODE_CODES,
  REVERSE_PRESERVE_CLASS_CODES,
  REVERSE_PROMPT_CONTEXT_PHASE_CODES,
  REVERSE_REFLECTION_TYPE_CODES,
  REVERSE_RENDER_STYLE_CODES,
  REVERSE_ROUTING_STRATEGY_CODES,
  REVERSE_SANITIZER_CODES,
  REVERSE_SURFACE_CODES,
  REVERSE_TOOL_OUTCOME_CODES,
  ROUTING_STRATEGY_CODES,
  TOOL_OUTCOME_CODES,
  type CeelineEnvelope,
  type CommonPayload,
  type CompactDensity,
  type CeelineMorphology,
  type DigestPayload,
  type HandoffPayload,
  type MemoryPayload,
  resolveAffix,
  activateDomains,
  DOMAIN_TABLES,
  registerSessionStem,
  resolveSymbolExpr,
  isSymbol,
  type SymbolExpr,
  type DialectStore,
  type DialectStemDef,
  parseDialectStem,
  parseDialectFromClauses,
  defineDialect,
  type PersonalLexicon,
  type PersonalStemDef,
  definePersonalLexicon,
  parsePersonalStem,
  parsePersonalLexiconFromClauses,
} from "@ceeline/schema";
import { fail, ok, type CeelineResult, type ValidationIssue } from "./result.js";

// =========================================================================
// Encoding helpers
// =========================================================================

const BARE_ATOM_RE = /^[A-Za-z0-9._:/@\u0080-\uFFFF-]+$/;

function encodeAtom(value: string): string {
  return BARE_ATOM_RE.test(value) ? value : JSON.stringify(value);
}

function encodeList(values: readonly string[]): string {
  return values.map((v) => encodeAtom(v)).join(",");
}

function encodeMetrics(metrics: Record<string, number>): string {
  return Object.entries(metrics)
    .map(([k, v]) => `${k}:${Number.isInteger(v) ? v.toString() : v}`)
    .join(",");
}

// =========================================================================
// Density helpers
// =========================================================================

function shouldIncludeDefaults(density: CompactDensity): boolean {
  return density === "lite";
}

function shouldEmitPreserveClasses(density: CompactDensity): boolean {
  return density !== "dense";
}

function shouldEmitTokens(density: CompactDensity): boolean {
  return density !== "lite";
}

// =========================================================================
// Renderer
// =========================================================================

function renderHeader(envelope: CeelineEnvelope, density: CompactDensity, domains?: readonly string[], dialects?: readonly string[], lexicons?: readonly string[]): string {
  const parts = [
    "@cl1",
    `s=${COMPACT_SURFACE_CODES[envelope.surface]}`,
    `i=${encodeAtom(envelope.intent)}`
  ];

  if (envelope.parent_envelope_id) {
    parts.push(`pid=${encodeAtom(envelope.parent_envelope_id)}`);
  }

  if (domains && domains.length > 0) {
    const safe = domains.filter(id => /^[a-z0-9]+$/.test(id));
    if (safe.length > 0) {
      parts.push(`dom=${safe.join("+")}`);
    }
  }

  if (dialects && dialects.length > 0) {
    const safe = dialects.filter(id => /^[a-z][a-z0-9._-]*$/.test(id));
    if (safe.length > 0) {
      parts.push(`dialect=${safe.join("+")}`);
    }
  }

  if (lexicons && lexicons.length > 0) {
    const safe = lexicons.filter(id => /^[a-z][a-z0-9._-]*$/.test(id));
    if (safe.length > 0) {
      parts.push(`lexicon=${safe.join("+")}`);
    }
  }

  if (shouldIncludeDefaults(density) || envelope.channel !== COMPACT_DEFAULTS.channel) {
    parts.push(`ch=${COMPACT_CHANNEL_CODES[envelope.channel]}`);
  }
  if (shouldIncludeDefaults(density) || envelope.constraints.mode !== COMPACT_DEFAULTS.mode) {
    parts.push(`md=${COMPACT_MODE_CODES[envelope.constraints.mode]}`);
  }
  if (shouldIncludeDefaults(density) || envelope.constraints.audience !== COMPACT_DEFAULTS.audience) {
    parts.push(`au=${COMPACT_AUDIENCE_CODES[envelope.constraints.audience]}`);
  }
  if (shouldIncludeDefaults(density) || envelope.constraints.fallback !== COMPACT_DEFAULTS.fallback) {
    parts.push(`fb=${COMPACT_FALLBACK_CODES[envelope.constraints.fallback]}`);
  }
  if (shouldIncludeDefaults(density) || envelope.render.style !== COMPACT_DEFAULTS.renderStyle) {
    parts.push(`rs=${COMPACT_RENDER_STYLE_CODES[envelope.render.style]}`);
  }
  if (shouldIncludeDefaults(density) || envelope.render.sanitizer !== COMPACT_DEFAULTS.sanitizer) {
    parts.push(`sz=${COMPACT_SANITIZER_CODES[envelope.render.sanitizer]}`);
  }
  if (density !== "dense" && envelope.constraints.max_render_tokens > 0) {
    parts.push(`mx=${envelope.constraints.max_render_tokens}`);
  }

  return parts.join(" ");
}

function renderCommonPayload(payload: CommonPayload, density: CompactDensity): string[] {
  const lines = [`${COMPACT_LINE_KEYS.summary}=${encodeAtom(payload.summary)}`];

  for (const fact of payload.facts) {
    lines.push(`${COMPACT_LINE_KEYS.fact}=${encodeAtom(fact)}`);
  }
  if (payload.ask) {
    lines.push(`${COMPACT_LINE_KEYS.ask}=${encodeAtom(payload.ask)}`);
  }
  if (density === "lite" && payload.artifacts.length > 0) {
    for (const artifact of payload.artifacts) {
      lines.push(`${COMPACT_LINE_KEYS.artifact}=${encodeAtom(JSON.stringify(artifact))}`);
    }
  }

  return lines;
}

function renderSurfacePayload(envelope: CeelineEnvelope): string[] {
  const payload = envelope.payload;
  const K = COMPACT_LINE_KEYS;

  switch (envelope.surface) {
    case "handoff": {
      const p = payload as HandoffPayload;
      return [
        `${K.role}=${HANDOFF_ROLE_CODES[p.role]}`,
        `${K.target}=${HANDOFF_TARGET_CODES[p.target]}`,
        `${K.scope}=${encodeList(p.scope)}`
      ];
    }
    case "digest": {
      const p = payload as DigestPayload;
      return [
        `${K.window}=${DIGEST_WINDOW_CODES[p.window]}`,
        `${K.status}=${DIGEST_STATUS_CODES[p.status]}`,
        `${K.metrics}=${encodeMetrics(p.metrics)}`
      ];
    }
    case "memory": {
      const p = payload as MemoryPayload;
      return [
        `${K.memoryKind}=${MEMORY_KIND_CODES[p.memory_kind]}`,
        `${K.durability}=${MEMORY_DURABILITY_CODES[p.durability]}`,
        `${K.citations}=${encodeList(p.citations)}`
      ];
    }
    case "reflection": {
      const lines: string[] = [];
      const rty = (payload as Record<string, unknown>).reflection_type as string | undefined;
      if (rty && rty in REFLECTION_TYPE_CODES) {
        lines.push(`${K.reflectionType}=${REFLECTION_TYPE_CODES[rty as keyof typeof REFLECTION_TYPE_CODES]}`);
      }
      const cnf = (payload as Record<string, unknown>).confidence as number | undefined;
      if (cnf !== undefined) lines.push(`${K.confidence}=${cnf}`);
      const rev = (payload as Record<string, unknown>).revision as string | undefined;
      if (rev) lines.push(`${K.revision}=${encodeAtom(rev)}`);
      return lines;
    }
    case "tool_summary": {
      const lines: string[] = [];
      const tn = (payload as Record<string, unknown>).tool_name as string | undefined;
      if (tn) lines.push(`${K.toolName}=${encodeAtom(tn)}`);
      const out = (payload as Record<string, unknown>).outcome as string | undefined;
      if (out && out in TOOL_OUTCOME_CODES) {
        lines.push(`${K.outcome}=${TOOL_OUTCOME_CODES[out as keyof typeof TOOL_OUTCOME_CODES]}`);
      }
      const ela = (payload as Record<string, unknown>).elapsed_ms as number | undefined;
      if (ela !== undefined) lines.push(`${K.elapsed}=${ela}`);
      return lines;
    }
    case "routing": {
      const lines: string[] = [];
      const str = (payload as Record<string, unknown>).strategy as string | undefined;
      if (str && str in ROUTING_STRATEGY_CODES) {
        lines.push(`${K.strategy}=${ROUTING_STRATEGY_CODES[str as keyof typeof ROUTING_STRATEGY_CODES]}`);
      }
      const cand = (payload as Record<string, unknown>).candidates as string[] | undefined;
      if (cand?.length) lines.push(`${K.candidates}=${encodeList(cand)}`);
      const sel = (payload as Record<string, unknown>).selected as string | undefined;
      if (sel) lines.push(`${K.selected}=${encodeAtom(sel)}`);
      return lines;
    }
    case "prompt_context": {
      const lines: string[] = [];
      const ph = (payload as Record<string, unknown>).phase as string | undefined;
      if (ph && ph in PROMPT_CONTEXT_PHASE_CODES) {
        lines.push(`${K.phase}=${PROMPT_CONTEXT_PHASE_CODES[ph as keyof typeof PROMPT_CONTEXT_PHASE_CODES]}`);
      }
      const pri = (payload as Record<string, unknown>).priority as number | undefined;
      if (pri !== undefined) lines.push(`${K.priority}=${pri}`);
      const src = (payload as Record<string, unknown>).source_ref as string | undefined;
      if (src) lines.push(`${K.sourceRef}=${encodeAtom(src)}`);
      return lines;
    }
    case "history": {
      const lines: string[] = [];
      const spn = (payload as Record<string, unknown>).span as string | undefined;
      if (spn && spn in HISTORY_SPAN_CODES) {
        lines.push(`${K.span}=${HISTORY_SPAN_CODES[spn as keyof typeof HISTORY_SPAN_CODES]}`);
      }
      const tc = (payload as Record<string, unknown>).turn_count as number | undefined;
      if (tc !== undefined) lines.push(`${K.turnCount}=${tc}`);
      const anc = (payload as Record<string, unknown>).anchor as string | undefined;
      if (anc) lines.push(`${K.anchor}=${encodeAtom(anc)}`);
      return lines;
    }
    /* v8 ignore next 2 — all 8 surfaces handled above */
    default:
      return [];
  }
}

function renderPreserve(envelope: CeelineEnvelope, density: CompactDensity): string[] {
  const lines: string[] = [];

  if (shouldEmitPreserveClasses(density)) {
    for (const preserveClass of envelope.preserve.classes) {
      lines.push(`${COMPACT_LINE_KEYS.preserveClass}=${COMPACT_PRESERVE_CLASS_CODES[preserveClass]}`);
    }
  }
  if (shouldEmitTokens(density)) {
    for (const token of envelope.preserve.tokens) {
      lines.push(`${COMPACT_LINE_KEYS.token}=${encodeAtom(token)}`);
    }
  }

  return lines;
}

function renderExtensions(envelope: CeelineEnvelope): string[] {
  const lines: string[] = [];
  const record = envelope as unknown as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key.startsWith("x_")) {
      const compactKey = `${EXTENSION_PREFIX}${key.slice(2)}`;
      const val = record[key];
      lines.push(`${compactKey}=${encodeAtom(typeof val === "string" ? val : JSON.stringify(val))}`);
    }
  }
  return lines;
}

function renderDiagnostics(envelope: CeelineEnvelope): string[] {
  const diag = envelope.diagnostics;
  if (!diag) return [];
  const lines: string[] = [];
  if (diag.trace === true) {
    lines.push("diag.trace=1");
  }
  if (diag.labels && diag.labels.length > 0) {
    lines.push(`diag.labels=${diag.labels.map(l => encodeAtom(l)).join(",")}`);
  }
  return lines;
}

/** Options for compact rendering. */
export interface CompactRenderOptions {
  /** Domain IDs to activate in the header (e.g. ["sec", "perf"]). */
  domains?: readonly string[];
  /** Dialect IDs to reference in the header (e.g. ["audit.sec-review"]). */
  dialects?: readonly string[];
  /** Personal lexicon IDs to reference in the header (e.g. ["my.sec-terms"]). */
  lexicons?: readonly string[];
}

export function renderCeelineCompact(
  envelope: CeelineEnvelope,
  density: CompactDensity = COMPACT_DENSITIES[1],
  options?: CompactRenderOptions
): CeelineResult<string> {
  const surfaceCode = COMPACT_SURFACE_CODES[envelope.surface];
  if (!surfaceCode) {
    return fail({ code: "unknown_surface", message: `Unknown surface: ${envelope.surface}`, path: "surface" });
  }

  const segments = [
    renderHeader(envelope, density, options?.domains, options?.dialects, options?.lexicons),
    ...renderCommonPayload(envelope.payload, density),
    ...renderSurfacePayload(envelope),
    ...renderPreserve(envelope, density),
    ...renderDiagnostics(envelope),
    ...renderExtensions(envelope)
  ];

  const rendered = density === "lite"
    ? segments.join("\n")
    : segments.join(" ; ");

  // Append byte-length integrity trailer
  const contentBytes = new TextEncoder().encode(rendered).byteLength;
  const sep = density === "lite" ? "\n" : " ; ";
  const withTrailer = `${rendered}${sep}#n=${contentBytes}`;

  // Enforce max_render_tokens (byte-based estimate: 4 bytes ≈ 1 token)
  const budget = envelope.constraints.max_render_tokens;
  if (budget > 0) {
    const estimatedTokens = Math.ceil(new TextEncoder().encode(withTrailer).byteLength / 4);
    if (estimatedTokens > budget) {
      return fail({
        code: "token_budget_exceeded",
        message: `Rendered ~${estimatedTokens} tokens exceeds max_render_tokens=${budget} (density=${density}).`,
        path: "constraints.max_render_tokens"
      });
    }
  }

  return ok(withTrailer);
}

/**
 * Auto-select the best density that fits within the envelope's token budget.
 *
 * For `operator` audience: tries lite → full → dense (prefer readability).
 * For `machine` audience: tries full → dense (prefer compactness).
 *
 * Returns the rendered compact text at the chosen density.
 * If no density fits, returns the densest result with a token_budget_exceeded failure.
 */
export function renderCeelineCompactAuto(
  envelope: CeelineEnvelope,
  options?: CompactRenderOptions
): CeelineResult<string> {
  const budget = envelope.constraints.max_render_tokens;

  // No budget constraint — use full as default
  if (budget <= 0) {
    return renderCeelineCompact(envelope, "full", options);
  }

  const order: CompactDensity[] =
    envelope.constraints.audience === "operator"
      ? ["lite", "full", "dense"]
      : ["full", "dense"];

  for (const density of order) {
    const result = renderCeelineCompact(envelope, density, options);
    if (result.ok) return result;
    // If failure is not token-related, bail immediately
    if (!result.ok && result.issues.some(i => i.code !== "token_budget_exceeded")) {
      return result;
    }
  }

  // All densities exceeded budget — return the densest attempt (which carries the error)
  return renderCeelineCompact(envelope, "dense", options);
}

// =========================================================================
// Parser – round-trip from compact text back to structured data
// =========================================================================

/**
 * Parsed result of a Ceeline Compact Text string.
 *
 * Contains all information recoverable from the compact form.
 * Fields absent in the compact text are filled from COMPACT_DEFAULTS.
 * Source info (kind, name, instance, timestamp) and envelope_id are not
 * present in compact text and must be supplied by the caller.
 */
export interface CompactParseResult {
  dialectVersion: number;
  surface: string;
  intent: string;
  parentEnvelopeId?: string;
  channel: string;
  mode: string;
  audience: string;
  fallback: string;
  renderStyle: string;
  sanitizer: string;
  maxRenderTokens: number;
  summary: string;
  facts: string[];
  ask: string;
  artifacts: unknown[];
  preserveTokens: string[];
  preserveClasses: string[];
  /** Surface-specific payload fields (canonical names, decoded values). */
  surfaceFields: Record<string, string | number | string[]>;
  /** Extension clauses keyed without the `x.` prefix. */
  extensions: Record<string, string>;
  /** Diagnostics trace flag, if present. */
  diagnosticsTrace?: boolean;
  /** Diagnostics labels, if present. */
  diagnosticsLabels?: string[];
  /** Session vocabulary defined via vocab= clauses: stem → definition. */
  sessionVocab: Record<string, string>;
  /** Active domain IDs from dom= header. */
  domains: string[];
  /** Active dialect IDs from dialect= header. */
  dialects: string[];
  /** Inline dialect stem definitions from stem= clauses. */
  dialectStems: DialectStemDef[];
  /** Dialect metadata fields (did, dver, dname, dbase) if present. */
  dialectMeta: Record<string, string>;
  /** Active personal lexicon IDs from lexicon= header. */
  lexicons: string[];
  /** Personal lexicon owner from lowner= body clause. */
  lexiconOwner?: string;
  /** Inline personal stem definitions (stem= clauses with @relation). */
  lexiconStems: PersonalStemDef[];
  /** Resolved symbol expressions found in clause values, keyed by clause key. */
  symbolExprs: Record<string, SymbolExpr>;
  /** Any clause keys the parser did not recognize (preserved, not dropped). */
  unknown: Record<string, string>;
}

// -- Tokenizer helpers --

/** Decode a single compact value (bare atom or JSON-quoted string). */
function decodeAtom(raw: string): string {
  if (raw.startsWith('"')) {
    try { return JSON.parse(raw); } catch { return raw; }
  }
  return raw;
}

/** Decode a comma-separated list of atoms. */
function decodeList(raw: string): string[] {
  if (raw === "") return [];
  const items: string[] = [];
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === '"') {
      // find end of JSON string
      let depth = 1;
      let j = i + 1;
      while (j < raw.length && depth > 0) {
        if (raw[j] === '\\') { j += 2; continue; }
        if (raw[j] === '"') depth--;
        j++;
      }
      items.push(decodeAtom(raw.slice(i, j)));
      i = j;
      if (i < raw.length && raw[i] === ',') i++;
    } else {
      const next = raw.indexOf(',', i);
      if (next === -1) {
        items.push(raw.slice(i));
        break;
      }
      items.push(raw.slice(i, next));
      i = next + 1;
    }
  }
  return items;
}

/** Decode metrics string `key:value,key:value` → Record. */
function decodeMetrics(raw: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const pair of raw.split(",")) {
    const colon = pair.indexOf(":");
    if (colon > 0) {
      out[pair.slice(0, colon)] = Number(pair.slice(colon + 1));
    }
  }
  return out;
}

/** Split a `key=value` string on the first `=`. */
function splitKV(clause: string): [string, string] {
  const eq = clause.indexOf("=");
  if (eq === -1) return [clause, ""];
  return [clause.slice(0, eq), clause.slice(eq + 1)];
}

/**
 * Quote-aware split on ` ; ` — skips occurrences inside "..." strings.
 * Handles escaped quotes inside JSON strings.
 */
function splitSemicolon(text: string): string[] {
  const segments: string[] = [];
  let start = 0;
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\\" && inQuote) {
      i++; // skip escaped char
      continue;
    }
    if (text[i] === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (!inQuote && i + 3 <= text.length && text.slice(i, i + 3) === " ; ") {
      segments.push(text.slice(start, i));
      start = i + 3;
      i += 2; // skip past ` ; `
    }
  }
  segments.push(text.slice(start));
  return segments;
}

/** Split compact text into clauses, auto-detecting lite vs single-line format. */
function splitClauses(text: string): { headerParts: string[]; bodyClauses: string[] } {
  const trimmed = text.trim();
  // Detect multiline (lite) vs single-line (full/dense)
  const firstNewline = trimmed.indexOf("\n");
  const firstSemicolon = trimmed.indexOf(" ; ");

  let headerLine: string;
  let bodyClauses: string[];

  if (firstNewline > 0 && (firstSemicolon === -1 || firstNewline < firstSemicolon)) {
    // Multiline: first line is header, rest are individual clauses
    const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
    headerLine = lines[0];
    bodyClauses = lines.slice(1);
  } else if (firstSemicolon > 0) {
    // Single-line: quote-aware split on ` ; `
    const segments = splitSemicolon(trimmed);
    headerLine = segments[0];
    bodyClauses = segments.slice(1);
  } else {
    // Header only, no body
    headerLine = trimmed;
    bodyClauses = [];
  }

  return { headerParts: headerLine.split(" "), bodyClauses };
}

// -- Surface-scoped reverse-lookup decoders --

type FieldDecoder = (raw: string, out: CompactParseResult) => void;

const SURFACE_FIELD_DECODERS: Record<string, Record<string, FieldDecoder>> = {
  handoff: {
    role: (raw, out) => { out.surfaceFields.role = REVERSE_HANDOFF_ROLE_CODES[raw] ?? raw; },
    tgt: (raw, out) => { out.surfaceFields.target = REVERSE_HANDOFF_TARGET_CODES[raw] ?? raw; },
    sc: (raw, out) => { out.surfaceFields.scope = decodeList(raw); },
  },
  digest: {
    win: (raw, out) => { out.surfaceFields.window = REVERSE_DIGEST_WINDOW_CODES[raw] ?? raw; },
    st: (raw, out) => { out.surfaceFields.status = REVERSE_DIGEST_STATUS_CODES[raw] ?? raw; },
    met: (raw, out) => { out.surfaceFields.metrics = decodeMetrics(raw) as unknown as string[]; },
  },
  memory: {
    mk: (raw, out) => { out.surfaceFields.memory_kind = REVERSE_MEMORY_KIND_CODES[raw] ?? raw; },
    dur: (raw, out) => { out.surfaceFields.durability = REVERSE_MEMORY_DURABILITY_CODES[raw] ?? raw; },
    cit: (raw, out) => { out.surfaceFields.citations = decodeList(raw); },
  },
  reflection: {
    rty: (raw, out) => { out.surfaceFields.reflection_type = REVERSE_REFLECTION_TYPE_CODES[raw] ?? raw; },
    cnf: (raw, out) => { out.surfaceFields.confidence = Number(raw); },
    rev: (raw, out) => { out.surfaceFields.revision = decodeAtom(raw); },
  },
  tool_summary: {
    tn: (raw, out) => { out.surfaceFields.tool_name = decodeAtom(raw); },
    out: (raw, out) => { out.surfaceFields.outcome = REVERSE_TOOL_OUTCOME_CODES[raw] ?? raw; },
    ela: (raw, out) => { out.surfaceFields.elapsed_ms = Number(raw); },
  },
  routing: {
    str: (raw, out) => { out.surfaceFields.strategy = REVERSE_ROUTING_STRATEGY_CODES[raw] ?? raw; },
    cand: (raw, out) => { out.surfaceFields.candidates = decodeList(raw); },
    sel: (raw, out) => { out.surfaceFields.selected = decodeAtom(raw); },
  },
  prompt_context: {
    ph: (raw, out) => { out.surfaceFields.phase = REVERSE_PROMPT_CONTEXT_PHASE_CODES[raw] ?? raw; },
    pri: (raw, out) => { out.surfaceFields.priority = Number(raw); },
    src: (raw, out) => { out.surfaceFields.source_ref = decodeAtom(raw); },
  },
  history: {
    spn: (raw, out) => { out.surfaceFields.span = REVERSE_HISTORY_SPAN_CODES[raw] ?? raw; },
    tc: (raw, out) => { out.surfaceFields.turn_count = Number(raw); },
    anc: (raw, out) => { out.surfaceFields.anchor = decodeAtom(raw); },
  },
};

/**
 * Parse a Ceeline Compact Text string into structured data.
 *
 * Tolerates unknown header keys and body clause keys — they are preserved
 * in the `unknown` field rather than causing a parse failure.  This is the
 * core forward-compatibility rule: preserve what you don't understand.
 */
export function parseCeelineCompact(
  text: string,
  morphology?: CeelineMorphology
): CeelineResult<CompactParseResult> {
  // Snapshot caller's domainStems so dom= activation doesn't leak across parses
  const priorDomainStems = morphology
    ? new Map([...morphology.domainStems].map(([k, v]) => [k, new Set(v)]))
    : undefined;

  try {
    return parseCeelineCompactInner(text, morphology);
  } finally {
    if (morphology && priorDomainStems) {
      morphology.domainStems = priorDomainStems;
    }
  }
}

function parseCeelineCompactInner(
  text: string,
  morphology?: CeelineMorphology
): CeelineResult<CompactParseResult> {
  const issues: ValidationIssue[] = [];
  const { headerParts, bodyClauses } = splitClauses(text);

  // -- Validate header marker --
  if (headerParts.length === 0 || !headerParts[0].startsWith("@cl")) {
    return fail([{ path: "header", code: "missing_header", message: "Compact text must start with @cl<version>" }]);
  }
  const versionStr = headerParts[0].slice(3);
  const dialectVersion = parseInt(versionStr, 10);
  if (isNaN(dialectVersion) || dialectVersion < 1) {
    return fail([{ path: "header", code: "invalid_version", message: `Invalid dialect version: ${headerParts[0]}` }]);
  }

  // -- Parse header key=value pairs --
  const result: CompactParseResult = {
    dialectVersion,
    surface: "",
    intent: "",
    channel: COMPACT_DEFAULTS.channel,
    mode: COMPACT_DEFAULTS.mode,
    audience: COMPACT_DEFAULTS.audience,
    fallback: COMPACT_DEFAULTS.fallback,
    renderStyle: COMPACT_DEFAULTS.renderStyle,
    sanitizer: COMPACT_DEFAULTS.sanitizer,
    maxRenderTokens: 0,
    summary: "",
    facts: [],
    ask: "",
    artifacts: [],
    preserveTokens: [],
    preserveClasses: [],
    surfaceFields: {},
    extensions: {},
    sessionVocab: {},
    domains: [],
    dialects: [],
    dialectStems: [],
    dialectMeta: {},
    lexicons: [],
    lexiconStems: [],
    symbolExprs: {},
    unknown: {}
  };

  for (let h = 1; h < headerParts.length; h++) {
    const [hk, hv] = splitKV(headerParts[h]);
    switch (hk) {
      case "s": result.surface = REVERSE_SURFACE_CODES[hv] ?? hv; break;
      case "i": result.intent = decodeAtom(hv); break;
      case "pid": result.parentEnvelopeId = decodeAtom(hv); break;
      case "ch": result.channel = REVERSE_CHANNEL_CODES[hv] ?? hv; break;
      case "md": result.mode = REVERSE_MODE_CODES[hv] ?? hv; break;
      case "au": result.audience = REVERSE_AUDIENCE_CODES[hv] ?? hv; break;
      case "fb": result.fallback = REVERSE_FALLBACK_CODES[hv] ?? hv; break;
      case "rs": result.renderStyle = REVERSE_RENDER_STYLE_CODES[hv] ?? hv; break;
      case "sz": result.sanitizer = REVERSE_SANITIZER_CODES[hv] ?? hv; break;
      case "mx": result.maxRenderTokens = parseInt(hv, 10) || 0; break;
      case "dom": {
        const ids = hv.split("+").filter(id => /^[a-z0-9]+$/.test(id));
        result.domains = ids;
        for (const id of ids) {
          if (!DOMAIN_TABLES.has(id)) {
            issues.push({ path: "header.dom", code: "unknown_domain", message: `Unknown domain: ${id}` });
          }
        }
        if (morphology) {
          activateDomains(ids, morphology);
        }
        break;
      }
      case "dialect": {
        const dialectIds = hv.split("+").filter(id => /^[a-z][a-z0-9._-]*$/.test(id));
        result.dialects = dialectIds;
        // Dialect activation is handled by the caller via DialectStore.
        // The parser records the IDs; it does not store or resolve dialect contents.
        break;
      }
      case "lexicon": {
        const lexiconIds = hv.split("+").filter(id => /^[a-z][a-z0-9._-]*$/.test(id));
        result.lexicons = lexiconIds;
        // Lexicon activation is handled by the caller via DialectStore.activateWithLexicon().
        break;
      }
      default:
        // Unknown header key — preserve for forward compatibility
        result.unknown[hk] = hv;
        issues.push({ path: `header.${hk}`, code: "unknown_header_key", message: `Unknown header key: ${hk}` });
        break;
    }
  }

  if (!result.surface) {
    return fail([{ path: "header.s", code: "missing_surface", message: "Surface (s=) is required in header" }]);
  }
  if (!result.intent) {
    return fail([{ path: "header.i", code: "missing_intent", message: "Intent (i=) is required in header" }]);
  }

  // -- Parse body clauses --
  for (const clause of bodyClauses) {
    const [ck, cv] = splitKV(clause.trim());

    // Session vocabulary: vocab=stem:definition
    if (ck === "vocab") {
      const colonIdx = cv.indexOf(":");
      if (colonIdx > 0) {
        const stem = cv.slice(0, colonIdx);
        const def = decodeAtom(cv.slice(colonIdx + 1));
        result.sessionVocab[stem] = def;
        // Register into live morphology so subsequent affixed codes resolve
        if (morphology) {
          registerSessionStem(stem, "NRPTDQOXAMVC", morphology);
        }
      } else {
        issues.push({ path: "body.vocab", code: "invalid_vocab", message: `vocab clause must be stem:definition, got: ${cv}` });
      }
      continue;
    }

    // Dialect stem definition: stem=code:meaning/FLAGS or stem=code:meaning/FLAGS@relation
    if (ck === "stem") {
      const personalStem = parsePersonalStem(cv);
      if (personalStem) {
        if (personalStem.relation) {
          // Has @relation suffix — route to lexicon stems
          result.lexiconStems.push(personalStem);
        } else {
          // Plain dialect stem
          result.dialectStems.push(personalStem);
        }
        // Register into live morphology so subsequent affixed codes resolve
        if (morphology) {
          const flags = personalStem.flags ?? "NRPTDQOXAMVC";
          morphology.domainStems.set(personalStem.code, new Set(flags.split("")));
        }
      } else {
        issues.push({ path: "body.stem", code: "invalid_stem", message: `stem clause must be code:meaning/FLAGS, got: ${cv}` });
      }
      continue;
    }

    // Personal lexicon owner: lowner=<identity>
    if (ck === "lowner") {
      result.lexiconOwner = decodeAtom(cv);
      result.dialectMeta[ck] = decodeAtom(cv);
      continue;
    }

    // Dialect metadata: did, dver, dname, dbase
    if (ck === "did" || ck === "dver" || ck === "dname" || ck === "dbase") {
      result.dialectMeta[ck] = decodeAtom(cv);
      continue;
    }

    // Extension namespace
    if (ck.startsWith(EXTENSION_PREFIX)) {
      result.extensions[ck.slice(EXTENSION_PREFIX.length)] = decodeAtom(cv);
      continue;
    }

    // Diagnostics clauses
    if (ck === "diag.trace") {
      result.diagnosticsTrace = cv === "1";
      continue;
    }
    if (ck === "diag.labels") {
      result.diagnosticsLabels = decodeList(cv);
      continue;
    }

    // Common payload keys
    switch (ck) {
      case "sum": result.summary = decodeAtom(cv); continue;
      case "f": result.facts.push(decodeAtom(cv)); continue;
      case "ask": result.ask = decodeAtom(cv); continue;
      case "art": {
        try { result.artifacts.push(JSON.parse(decodeAtom(cv))); } catch { result.artifacts.push(cv); }
        continue;
      }
      case "tok": result.preserveTokens.push(decodeAtom(cv)); continue;
      case "cls": {
        const name = REVERSE_PRESERVE_CLASS_CODES[cv] ?? cv;
        result.preserveClasses.push(name);
        continue;
      }
      default: break;
    }

    // Surface-specific field decoders (scoped by surface)
    const surfaceDecoders = SURFACE_FIELD_DECODERS[result.surface];
    const decoder = surfaceDecoders?.[ck];
    if (decoder) {
      decoder(cv, result);
      continue;
    }

    // Byte-length integrity trailer (#n=<bytes>)
    if (ck === "#n") {
      const declaredBytes = parseInt(cv, 10);
      if (!isNaN(declaredBytes)) {
        // Strip the final trailer clause from the original text to get the content
        const trailerRe = /(?:\n| ; )#n=\d+\s*$/;
        const contentText = text.replace(trailerRe, "");
        const actualBytes = new TextEncoder().encode(contentText).byteLength;
        if (actualBytes !== declaredBytes) {
          issues.push({
            path: "trailer.#n",
            code: "integrity_mismatch",
            message: `Byte-length trailer: declared=${declaredBytes}, actual=${actualBytes}. Content may be truncated.`
          });
        }
      }
      continue;
    }

    // Morphology-aware resolution: if a clause key looks affixed, resolve it
    if (morphology) {
      const resolved = resolveAffix(ck, morphology);
      if (resolved && resolved.valid) {
        // Store the affixed code as a surface field with its resolved parts
        result.surfaceFields[ck] = cv;
        continue;
      }
    }

    // Symbol expression resolution: key or value starts with a symbol char
    // Key-as-symbol: the clause key itself is a symbol expression (e.g. ○→●=1)
    if (isSymbol(/* v8 ignore next */ [...ck][0] ?? "")) {
      const expr = resolveSymbolExpr(ck, result.surface);
      if (expr) {
        result.symbolExprs[ck] = expr;
        result.surfaceFields[ck] = cv;
        continue;
      }
    }
    // Value-as-symbol: the value is a symbol expression (e.g. st=○→●)
    if (cv.length > 0 && isSymbol(/* v8 ignore next */ [...cv][0] ?? "")) {
      const expr = resolveSymbolExpr(cv, result.surface);
      if (expr) {
        result.symbolExprs[ck] = expr;
        result.surfaceFields[ck] = cv;
        continue;
      }
    }

    // Unknown clause — preserve for forward compatibility
    result.unknown[ck] = cv;
    issues.push({ path: `body.${ck}`, code: "unknown_clause_key", message: `Unknown clause key: ${ck}` });
  }

  // Post-processing: scan surfaceFields values for symbol expressions.
  // This catches symbols in values even when the key was consumed by
  // surface-specific decoders or morphology-aware resolution.
  for (const [key, val] of Object.entries(result.surfaceFields)) {
    if (result.symbolExprs[key]) continue; // already resolved
    const sv = typeof val === "string" ? val : "";
    if (sv.length > 0 && isSymbol(/* v8 ignore next */ [...sv][0] ?? "")) {
      const expr = resolveSymbolExpr(sv, result.surface);
      if (expr) result.symbolExprs[key] = expr;
    }
  }

  // Issues are informational (warnings), not failures.  The parse succeeds
  // even with unknown keys — that's the forward-compatibility contract.
  return ok(result);
}

// =========================================================================
// Dialect extraction — pull a dialect definition from a parsed result
// =========================================================================

/**
 * Extract a dialect definition from a parsed compact text result.
 *
 * When an LLM emits a dialect.define or dialect.evolve message, the parser
 * captures `did`, `dver`, `dname`, `dbase` metadata and `stem=` definitions.
 * This function assembles them into a `DialectDefinition` and optionally
 * stores it in a `DialectStore`.
 *
 * Returns null if the parse result doesn't contain dialect metadata.
 *
 * Usage:
 * ```typescript
 * const parsed = parseCeelineCompact(text, morphology);
 * if (parsed.ok) {
 *   const dialect = extractDialect(parsed.value, store);
 *   //=> CeelineDialect | null
 * }
 * ```
 */
export function extractDialect(
  result: CompactParseResult,
  store?: DialectStore
): ReturnType<typeof defineDialect> | null {
  if (!result.dialectMeta["did"] || !result.dialectMeta["dname"]) {
    return null;
  }
  const def = parseDialectFromClauses(
    { ...result.dialectMeta, sum: result.summary || result.dialectMeta["sum"] || "" },
    result.dialectStems
  );
  /* v8 ignore next 2 -- structurally unreachable: extractDialect guards the same condition */
  if (!def) return null;

  const dialect = defineDialect(def);
  if (store) {
    store.define(dialect);
  }
  return dialect;
}

// =========================================================================
// Personal lexicon extraction — pull a lexicon from a parsed result
// =========================================================================

/**
 * Extract a personal lexicon definition from a parsed compact text result.
 *
 * When an LLM emits a lexicon.define or lexicon.evolve message with
 * `lowner=` metadata and `stem=` clauses with `@relation` suffixes,
 * this function assembles them into a `PersonalLexicon` and optionally
 * stores it in a `DialectStore`.
 *
 * Falls back to dialect stems if no lexicon-specific stems are present
 * (for lexicons defined with plain stems).
 *
 * Returns null if the parse result doesn't contain lexicon metadata.
 */
export function extractPersonalLexicon(
  result: CompactParseResult,
  store?: DialectStore
): PersonalLexicon | null {
  if (!result.lexiconOwner || !result.dialectMeta["did"] || !result.dialectMeta["dname"]) {
    return null;
  }

  // Use lexiconStems if present, otherwise fall back to dialectStems
  const stems: PersonalStemDef[] =
    result.lexiconStems.length > 0 ? result.lexiconStems : result.dialectStems;

  const def = parsePersonalLexiconFromClauses(
    { ...result.dialectMeta, lowner: result.lexiconOwner, sum: result.summary || result.dialectMeta["sum"] || "" },
    stems
  );
  /* v8 ignore next 2 -- structurally unreachable: extractPersonalLexicon guards the same condition */
  if (!def) return null;

  const lexicon = definePersonalLexicon(def);
  if (store) {
    store.defineLexicon(lexicon);
  }
  return lexicon;
}
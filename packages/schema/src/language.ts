import type { CeelineChannel, CeelineSurface, ConstraintMode, Audience, FallbackMode, PreserveClass, RenderStyle, SanitizerMode } from "./index";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Build a reverse lookup from a forward code map. Returns Record<string, string> for flexible indexing. */
function reverseRecord<K extends string, V extends string>(
  record: Readonly<Record<K, V>>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(record)) {
    out[v as string] = k;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Density
// ---------------------------------------------------------------------------

export const COMPACT_DENSITIES = ["lite", "full", "dense"] as const;
export type CompactDensity = (typeof COMPACT_DENSITIES)[number];

// ---------------------------------------------------------------------------
// Core code maps (forward: canonical name → compact code)
// ---------------------------------------------------------------------------

export const COMPACT_SURFACE_CODES: Record<CeelineSurface, string> = {
  handoff: "ho",
  digest: "dg",
  memory: "me",
  reflection: "rf",
  tool_summary: "ts",
  routing: "rt",
  prompt_context: "pc",
  history: "hs"
};

export const COMPACT_CHANNEL_CODES: Record<CeelineChannel, string> = {
  internal: "i",
  controlled_ui: "cu"
};

export const COMPACT_MODE_CODES: Record<ConstraintMode, string> = {
  read_only: "ro",
  advisory: "ad",
  mutating: "mu"
};

export const COMPACT_AUDIENCE_CODES: Record<Audience, string> = {
  machine: "m",
  operator: "o",
  user: "u"
};

export const COMPACT_FALLBACK_CODES: Record<FallbackMode, string> = {
  reject: "rj",
  verbose: "vb",
  pass_through: "pt"
};

export const COMPACT_RENDER_STYLE_CODES: Record<RenderStyle, string> = {
  none: "n",
  terse: "te",
  normal: "nr",
  user_facing: "uf"
};

export const COMPACT_SANITIZER_CODES: Record<SanitizerMode, string> = {
  strict: "st",
  standard: "sd"
};

export const COMPACT_PRESERVE_CLASS_CODES: Record<PreserveClass, string> = {
  file_path: "fp",
  tool_identifier: "ti",
  agent_name: "ag",
  model_name: "mo",
  command: "cmd",
  env_var: "env",
  version: "ver",
  schema_key: "key",
  placeholder: "ph",
  section_label: "sec",
  url: "url",
  code_span: "cs",
  code_fence: "cf"
};

// ---------------------------------------------------------------------------
// Reverse code maps (compact code → canonical name)
// ---------------------------------------------------------------------------

export const REVERSE_SURFACE_CODES = reverseRecord(COMPACT_SURFACE_CODES);
export const REVERSE_CHANNEL_CODES = reverseRecord(COMPACT_CHANNEL_CODES);
export const REVERSE_MODE_CODES = reverseRecord(COMPACT_MODE_CODES);
export const REVERSE_AUDIENCE_CODES = reverseRecord(COMPACT_AUDIENCE_CODES);
export const REVERSE_FALLBACK_CODES = reverseRecord(COMPACT_FALLBACK_CODES);
export const REVERSE_RENDER_STYLE_CODES = reverseRecord(COMPACT_RENDER_STYLE_CODES);
export const REVERSE_SANITIZER_CODES = reverseRecord(COMPACT_SANITIZER_CODES);
export const REVERSE_PRESERVE_CLASS_CODES = reverseRecord(COMPACT_PRESERVE_CLASS_CODES);

// ---------------------------------------------------------------------------
// Defaults (fields at these values may be omitted in full/dense)
// ---------------------------------------------------------------------------

export const COMPACT_DEFAULTS = {
  channel: "internal",
  mode: "read_only",
  audience: "machine",
  fallback: "reject",
  renderStyle: "none",
  sanitizer: "strict"
} as const;

// ---------------------------------------------------------------------------
// Line keys (payload & preserve clause keys)
// ---------------------------------------------------------------------------

export const COMPACT_LINE_KEYS = {
  // common
  summary: "sum",
  fact: "f",
  ask: "ask",
  artifact: "art",
  token: "tok",
  preserveClass: "cls",
  // handoff
  role: "role",
  target: "tgt",
  scope: "sc",
  // digest
  window: "win",
  status: "st",
  metrics: "met",
  // memory
  memoryKind: "mk",
  durability: "dur",
  citations: "cit",
  // reflection
  reflectionType: "rty",
  confidence: "cnf",
  revision: "rev",
  // tool_summary
  toolName: "tn",
  outcome: "out",
  elapsed: "ela",
  // routing
  strategy: "str",
  candidates: "cand",
  selected: "sel",
  // prompt_context
  phase: "ph",
  priority: "pri",
  sourceRef: "src",
  // history
  span: "spn",
  turnCount: "tc",
  anchor: "anc"
} as const;

export const REVERSE_LINE_KEYS = reverseRecord(COMPACT_LINE_KEYS);

// ---------------------------------------------------------------------------
// Surface-specific enum code maps (forward + reverse)
// ---------------------------------------------------------------------------

// -- Handoff --

export const HANDOFF_ROLE_CODES = {
  planner: "pl",
  reviewer: "rv",
  coordinator: "co",
  parent_agent: "pa"
} as const;

export const HANDOFF_TARGET_CODES = {
  implementer: "im",
  fixer: "fx",
  subagent: "sa",
  reviewer: "rv"
} as const;

export const REVERSE_HANDOFF_ROLE_CODES = reverseRecord(HANDOFF_ROLE_CODES);
export const REVERSE_HANDOFF_TARGET_CODES = reverseRecord(HANDOFF_TARGET_CODES);

// -- Digest --

export const DIGEST_WINDOW_CODES = {
  turn: "tr",
  session: "ss",
  run: "rn"
} as const;

export const DIGEST_STATUS_CODES = {
  ok: "ok",
  warn: "wr",
  error: "er"
} as const;

export const REVERSE_DIGEST_WINDOW_CODES = reverseRecord(DIGEST_WINDOW_CODES);
export const REVERSE_DIGEST_STATUS_CODES = reverseRecord(DIGEST_STATUS_CODES);

// -- Memory --

export const MEMORY_KIND_CODES = {
  fact: "fa",
  decision: "de",
  research: "rs"
} as const;

export const MEMORY_DURABILITY_CODES = {
  session: "sn",
  project: "pj",
  persistent: "ps"
} as const;

export const REVERSE_MEMORY_KIND_CODES = reverseRecord(MEMORY_KIND_CODES);
export const REVERSE_MEMORY_DURABILITY_CODES = reverseRecord(MEMORY_DURABILITY_CODES);

// -- Reflection --

export const REFLECTION_TYPE_CODES = {
  self_critique: "sc",
  hypothesis: "hy",
  plan_revision: "pr",
  confidence_check: "cc"
} as const;

export const REVERSE_REFLECTION_TYPE_CODES = reverseRecord(REFLECTION_TYPE_CODES);

// -- Tool Summary --

export const TOOL_OUTCOME_CODES = {
  success: "ok",
  failure: "fl",
  partial: "pt",
  skipped: "sk"
} as const;

export const REVERSE_TOOL_OUTCOME_CODES = reverseRecord(TOOL_OUTCOME_CODES);

// -- Routing --

export const ROUTING_STRATEGY_CODES = {
  direct: "dr",
  broadcast: "bc",
  conditional: "cn",
  fallback: "fb"
} as const;

export const REVERSE_ROUTING_STRATEGY_CODES = reverseRecord(ROUTING_STRATEGY_CODES);

// -- Prompt Context --

export const PROMPT_CONTEXT_PHASE_CODES = {
  system: "sy",
  injection: "ij",
  retrieval: "rt",
  grounding: "gr"
} as const;

export const REVERSE_PROMPT_CONTEXT_PHASE_CODES = reverseRecord(PROMPT_CONTEXT_PHASE_CODES);

// -- History --

export const HISTORY_SPAN_CODES = {
  turn: "tr",
  exchange: "ex",
  session: "ss",
  project: "pj"
} as const;

export const REVERSE_HISTORY_SPAN_CODES = reverseRecord(HISTORY_SPAN_CODES);

// ---------------------------------------------------------------------------
// Extension namespace prefix
// ---------------------------------------------------------------------------

/** Compact clause prefix for extension keys: `x.vendor.key=value` */
export const EXTENSION_PREFIX = "x." as const;

// ---------------------------------------------------------------------------
// Registry – extensible code-map container
// ---------------------------------------------------------------------------

/** A bidirectional code pair: forward (name → code) and reverse (code → name). */
export interface CodePair {
  readonly forward: Readonly<Record<string, string>>;
  readonly reverse: Readonly<Record<string, string>>;
}

function codePair(forward: Readonly<Record<string, string>>): CodePair {
  return { forward, reverse: reverseRecord(forward) };
}

/**
 * Extensible container for all code maps used by the compact dialect.
 *
 * Hosts and adapters can extend this at runtime to register new surfaces,
 * enum codes, payload keys, or extensions without modifying the core source.
 */
export interface CompactCodeRegistry {
  /** Dialect version number (1 for @cl1). */
  readonly dialectVersion: number;

  // Core enum maps
  surfaces: CodePair;
  channels: CodePair;
  modes: CodePair;
  audiences: CodePair;
  fallbacks: CodePair;
  renderStyles: CodePair;
  sanitizers: CodePair;
  preserveClasses: CodePair;

  // Clause key map
  lineKeys: CodePair;

  /**
   * Per-surface enum code maps keyed by `"surface_field"` e.g.
   * `"handoff_role"`, `"digest_window"`, `"routing_strategy"`.
   */
  surfacePayloadCodes: Record<string, CodePair>;
}

/** Create a registry pre-loaded with all built-in v1 codes. */
export function createDefaultRegistry(): CompactCodeRegistry {
  return {
    dialectVersion: 1,
    surfaces: codePair(COMPACT_SURFACE_CODES),
    channels: codePair(COMPACT_CHANNEL_CODES),
    modes: codePair(COMPACT_MODE_CODES),
    audiences: codePair(COMPACT_AUDIENCE_CODES),
    fallbacks: codePair(COMPACT_FALLBACK_CODES),
    renderStyles: codePair(COMPACT_RENDER_STYLE_CODES),
    sanitizers: codePair(COMPACT_SANITIZER_CODES),
    preserveClasses: codePair(COMPACT_PRESERVE_CLASS_CODES),
    lineKeys: codePair(COMPACT_LINE_KEYS),
    surfacePayloadCodes: {
      handoff_role: codePair(HANDOFF_ROLE_CODES),
      handoff_target: codePair(HANDOFF_TARGET_CODES),
      digest_window: codePair(DIGEST_WINDOW_CODES),
      digest_status: codePair(DIGEST_STATUS_CODES),
      memory_kind: codePair(MEMORY_KIND_CODES),
      memory_durability: codePair(MEMORY_DURABILITY_CODES),
      reflection_type: codePair(REFLECTION_TYPE_CODES),
      tool_outcome: codePair(TOOL_OUTCOME_CODES),
      routing_strategy: codePair(ROUTING_STRATEGY_CODES),
      prompt_context_phase: codePair(PROMPT_CONTEXT_PHASE_CODES),
      history_span: codePair(HISTORY_SPAN_CODES)
    }
  };
}

/**
 * Produce a new registry that merges additional codes into a base registry.
 * Does not mutate the base.
 */
export function extendRegistry(
  base: CompactCodeRegistry,
  patch: {
    surfaces?: Record<string, string>;
    channels?: Record<string, string>;
    modes?: Record<string, string>;
    audiences?: Record<string, string>;
    fallbacks?: Record<string, string>;
    renderStyles?: Record<string, string>;
    sanitizers?: Record<string, string>;
    preserveClasses?: Record<string, string>;
    lineKeys?: Record<string, string>;
    surfacePayloadCodes?: Record<string, Record<string, string>>;
  }
): CompactCodeRegistry {
  const mergeField = (existing: CodePair, extra: Record<string, string>): CodePair =>
    codePair({ ...existing.forward, ...extra });

  const result: CompactCodeRegistry = {
    dialectVersion: base.dialectVersion,
    surfaces: patch.surfaces ? mergeField(base.surfaces, patch.surfaces) : base.surfaces,
    channels: patch.channels ? mergeField(base.channels, patch.channels) : base.channels,
    modes: patch.modes ? mergeField(base.modes, patch.modes) : base.modes,
    audiences: patch.audiences ? mergeField(base.audiences, patch.audiences) : base.audiences,
    fallbacks: patch.fallbacks ? mergeField(base.fallbacks, patch.fallbacks) : base.fallbacks,
    renderStyles: patch.renderStyles ? mergeField(base.renderStyles, patch.renderStyles) : base.renderStyles,
    sanitizers: patch.sanitizers ? mergeField(base.sanitizers, patch.sanitizers) : base.sanitizers,
    preserveClasses: patch.preserveClasses ? mergeField(base.preserveClasses, patch.preserveClasses) : base.preserveClasses,
    lineKeys: patch.lineKeys ? mergeField(base.lineKeys, patch.lineKeys) : base.lineKeys,
    surfacePayloadCodes: { ...base.surfacePayloadCodes }
  };

  if (patch.surfacePayloadCodes) {
    for (const [key, codes] of Object.entries(patch.surfacePayloadCodes)) {
      const existing = result.surfacePayloadCodes[key];
      result.surfacePayloadCodes[key] = existing
        ? mergeField(existing, codes)
        : codePair(codes);
    }
  }

  return result;
}
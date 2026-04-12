import type { CeelineChannel, CeelineSurface, ConstraintMode, Audience, FallbackMode, PreserveClass, RenderStyle, SanitizerMode } from "./index.js";

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

// ---------------------------------------------------------------------------
// Morphological Affix System
// ---------------------------------------------------------------------------

/**
 * A prefix rule that can be applied to root stems.
 *
 * Example: `{ name: "neg", marker: "neg.", meaning: "negation/absence" }`
 * turns stem `ok` into `neg.ok` → "not success".
 */
export interface AffixRule {
  /** Short name (used in .aff flag documentation). */
  readonly name: string;
  /** The literal string prepended (prefix) or appended (suffix). */
  readonly marker: string;
  /** Human-readable meaning of the transformation. */
  readonly meaning: string;
}

/**
 * A domain-specific stem table activated via dom= header.
 */
export interface DomainStemTable {
  /** Short domain identifier used in dom= header (e.g. "sec"). */
  readonly id: string;
  /** Human-readable domain name (e.g. "Security"). */
  readonly name: string;
  /** Domain stems with their allowed flag sets. */
  readonly stems: ReadonlyMap<string, ReadonlySet<string>>;
}

/**
 * Complete morphology definition for the Ceeline compact dialect.
 * Loaded from .aff/.dic or constructed programmatically.
 */
export interface CeelineMorphology {
  /** Prefix rules, keyed by flag letter (N, R, P, T, D). */
  readonly prefixes: ReadonlyMap<string, AffixRule>;
  /** Suffix rules, keyed by flag letter (Q, O, X, A, M, V). */
  readonly suffixes: ReadonlyMap<string, AffixRule>;
  /** Root stems with their allowed flag sets. */
  readonly stems: ReadonlyMap<string, ReadonlySet<string>>;
  /** Domain stems activated by dom= header. Immutable per-message. */
  domainStems: Map<string, Set<string>>;
  /** Session-scoped stems added at runtime via vocab= clauses. */
  sessionStems: Map<string, Set<string>>;
}

// -- Built-in prefix rules ------------------------------------------------

const BUILTIN_PREFIXES: ReadonlyArray<[string, AffixRule]> = [
  ["N", { name: "neg",  marker: "neg.",  meaning: "negation / absence" }],
  ["R", { name: "re",   marker: "re.",   meaning: "repeat / retry" }],
  ["P", { name: "prev", marker: "prev.", meaning: "prior / previous" }],
  ["T", { name: "tent", marker: "tent.", meaning: "tentative / proposed" }],
  ["D", { name: "del",  marker: "del.",  meaning: "delegated / inherited" }],
];

// -- Built-in suffix rules ------------------------------------------------

const BUILTIN_SUFFIXES: ReadonlyArray<[string, AffixRule]> = [
  ["Q", { name: "seq",   marker: ".seq",   meaning: "sequence / list-of" }],
  ["O", { name: "opt",   marker: ".opt",   meaning: "optional / nullable" }],
  ["X", { name: "ref",   marker: ".ref",   meaning: "reference / pointer-to" }],
  ["A", { name: "as",    marker: ".as",    meaning: "alias binding" }],
  ["M", { name: "multi", marker: ".multi", meaning: "multiple / compound" }],
  ["V", { name: "v",     marker: ".v",     meaning: "version snapshot" }],
];

/** Create the default morphology with all built-in stems and affix rules. */
export function createDefaultMorphology(): CeelineMorphology {
  return {
    prefixes: new Map(BUILTIN_PREFIXES),
    suffixes: new Map(BUILTIN_SUFFIXES),
    stems: new Map(BUILTIN_STEMS),
    domainStems: new Map(),
    sessionStems: new Map(),
  };
}

// -- Built-in stem → flag mapping (mirrors ceeline.dic) -------------------

const BUILTIN_STEMS: ReadonlyArray<[string, ReadonlySet<string>]> = (function () {
  // Helper: parse "NRPQXMVC" into Set<string>
  const f = (flags: string): ReadonlySet<string> => new Set(flags.split(""));
  return [
    // Surfaces
    ["ho", f("NRPDQXMVC")], ["dg", f("NRPQXVC")], ["me", f("NRPDQXVC")],
    ["rf", f("NRPQXVC")],   ["ts", f("NRPQXVC")], ["rt", f("NRPDQXMVC")],
    ["pc", f("NRPDQXVC")],  ["hs", f("NRPQXVC")],
    // Channels
    ["i", f("NTC")], ["cu", f("NTC")],
    // Modes
    ["ro", f("NTDC")], ["ad", f("NTDC")], ["mu", f("NTDC")],
    // Audiences
    ["m", f("C")], ["o", f("C")], ["u", f("C")],
    // Fallbacks
    ["rj", f("NC")], ["vb", f("NC")], ["pt", f("NC")],
    // Render styles
    ["n", f("C")], ["te", f("C")], ["nr", f("C")], ["uf", f("C")],
    // Sanitizers
    ["st", f("C")], ["sd", f("C")],
    // Preserve classes
    ["fp", f("QC")], ["ti", f("QC")], ["ag", f("QC")], ["mo", f("QC")],
    ["cmd", f("QC")], ["env", f("QC")], ["ver", f("QC")], ["key", f("QC")],
    ["ph", f("QC")], ["sec", f("QC")], ["url", f("QC")], ["cs", f("QC")],
    ["cf", f("QC")],
    // Common payload keys
    ["sum", f("ROQC")], ["f", f("QC")], ["ask", f("ROQC")],
    ["art", f("QOXC")], ["tok", f("QC")], ["cls", f("QC")],
    // Handoff
    ["role", f("OC")], ["tgt", f("OXC")], ["sc", f("NRQOC")],
    ["pl", f("NRC")],  ["rv", f("NRC")],  ["co", f("NRC")],
    ["pa", f("NRC")],  ["im", f("NRC")],  ["fx", f("NRC")],  ["sa", f("NRC")],
    // Digest
    ["win", f("PC")], ["met", f("QC")], ["ok", f("NC")],
    ["wr", f("NC")],  ["er", f("NC")],  ["tr", f("PQC")],
    ["ss", f("PQC")], ["rn", f("PQC")],
    // Memory
    ["mk", f("C")],  ["dur", f("C")],  ["cit", f("QC")],
    ["fa", f("NRC")], ["de", f("NRC")], ["rs", f("NRC")],
    ["sn", f("C")],   ["pj", f("C")],   ["ps", f("C")],
    // Reflection
    ["rty", f("C")],  ["cnf", f("OC")], ["rev", f("ROQC")],
    ["hy", f("NRC")],  ["pr", f("NRC")], ["cc", f("NRC")],
    // Tool summary
    ["tn", f("OXC")],  ["out", f("C")],  ["ela", f("OC")],
    ["fl", f("NRC")],  ["sk", f("NRC")],
    // Routing
    ["str", f("C")],  ["cand", f("QXC")], ["sel", f("OXC")],
    ["dr", f("NTC")], ["bc", f("NTC")],   ["cn", f("NTC")], ["fb", f("NTC")],
    // Prompt context
    ["pri", f("OC")], ["src", f("OXC")],
    ["sy", f("NC")],  ["ij", f("NC")],  ["gr", f("NC")],
    // History
    ["spn", f("C")], ["tc", f("OC")], ["anc", f("OXC")], ["ex", f("PQC")],
    // Diagnostics
    ["diag", f("C")], ["trace", f("C")], ["labels", f("QC")],
    // Structural
    ["pid", f("XC")],
    // Symbol stems (Tier 1 single-token Unicode — flag U for symbol class)
    // Greek semantic operators
    ["α", f("UC")], ["β", f("UC")], ["γ", f("UC")], ["δ", f("UC")],
    ["ε", f("UC")], ["ζ", f("UC")], ["η", f("UC")], ["θ", f("UC")],
    ["λ", f("UC")], ["μ", f("UC")], ["π", f("UC")], ["σ", f("UC")],
    ["φ", f("UC")], ["ψ", f("UC")], ["ω", f("UC")], ["Σ", f("UC")],
    // Arrows
    ["→", f("UC")], ["←", f("UC")], ["↑", f("UC")], ["↓", f("UC")], ["⇒", f("UC")],
    // Geometric shapes (state)
    ["●", f("UC")], ["○", f("UC")], ["■", f("UC")], ["□", f("UC")],
    ["▲", f("UC")], ["▼", f("UC")], ["▶", f("UC")], ["◆", f("UC")], ["◇", f("UC")],
    // Block elements (confidence gradient)
    ["█", f("UC")], ["▓", f("UC")], ["▒", f("UC")], ["░", f("UC")],
    // Math operators
    ["∀", f("UC")], ["≈", f("UC")], ["≤", f("UC")], ["≥", f("UC")],
    ["√", f("UC")], ["∞", f("UC")], ["−", f("UC")],
    // Dingbats
    ["✓", f("UC")], ["✔", f("UC")],
  ];
})();

// -- Domain stem tables ---------------------------------------------------

const domF = (flags: string): ReadonlySet<string> => new Set(flags.split(""));

/** Security domain stems — activated by dom=sec */
const DOMAIN_SECURITY_STEMS: ReadonlyArray<[string, ReadonlySet<string>]> = [
  ["vul", domF("NRQC")],   // vulnerability
  ["ath", domF("NRC")],    // authentication
  ["azn", domF("NRC")],    // authorization
  ["byp", domF("NRC")],    // bypass
  ["ij2", domF("NRQC")],   // injection
  ["xss", domF("QC")],     // cross-site scripting
  ["crf", domF("QC")],     // CSRF
  ["prv", domF("NRQC")],   // privilege
  ["esc", domF("NRC")],    // escalation
  ["acl", domF("NRC")],    // access control
  ["tkv", domF("NRC")],    // token validation
  ["snt", domF("NRC")],    // sanitization
  ["enc", domF("NRC")],    // encryption
  ["tls", domF("NC")],     // TLS/SSL
  ["crt", domF("NQXC")],   // certificate
  ["sqi", domF("QC")],     // SQL injection
  ["bof", domF("QC")],     // buffer overflow
  ["dos", domF("NC")],     // denial of service
  ["rlm", domF("NRC")],    // rate limiting
  ["owp", domF("XC")],     // OWASP
  ["pen", domF("QC")],     // penetration test
  ["exf", domF("NRC")],    // exfiltration
  ["hsh", domF("NRC")],    // hashing
  ["rbac", domF("NC")],    // RBAC
];

/** Performance domain stems — activated by dom=perf */
const DOMAIN_PERF_STEMS: ReadonlyArray<[string, ReadonlySet<string>]> = [
  ["lat", domF("NRQOC")],  // latency
  ["thr", domF("NRQC")],   // throughput
  ["cch", domF("NRQC")],   // cache
  ["gcl", domF("NQC")],    // garbage collection
  ["mmu", domF("NRQC")],   // memory usage
  ["cpu", domF("NQC")],    // CPU
  ["prf", domF("RC")],     // profiling
  ["btl", domF("NRQC")],   // bottleneck
  ["p50", domF("OC")],     // 50th percentile
  ["p95", domF("OC")],     // 95th percentile
  ["p99", domF("OC")],     // 99th percentile
  ["cld", domF("NRC")],    // cold start
  ["wrm", domF("RC")],     // warm-up
  ["pol", domF("NRQC")],   // pooling
  ["bat", domF("NRC")],    // batching
  ["ccr", domF("NQC")],    // concurrency
  ["idx", domF("NRQC")],   // indexing
  ["qop", domF("RQC")],    // query optimization
  ["iop", domF("NQC")],    // I/O
  ["alc", domF("NRQC")],   // allocation
  ["ttl", domF("NOC")],    // time-to-live
  ["rps", domF("QC")],     // requests/second
  ["sat2", domF("NQC")],   // saturation
];

/** Architecture domain stems — activated by dom=arch */
const DOMAIN_ARCH_STEMS: ReadonlyArray<[string, ReadonlySet<string>]> = [
  ["lay", domF("NQC")],    // layer
  ["bnd", domF("NRQC")],   // boundary
  ["cpl", domF("NRQC")],   // coupling
  ["coh", domF("NRC")],    // cohesion
  ["mdl", domF("NRQXC")],  // module
  ["svc", domF("NRQXC")],  // service
  ["gwy", domF("NQXC")],   // gateway
  ["fcd", domF("NXC")],    // facade
  ["adp", domF("NQXC")],   // adapter
  ["pxy", domF("NXC")],    // proxy
  ["obs2", domF("QXC")],   // observer
  ["evt", domF("NRQC")],   // event
  ["msg2", domF("NRQC")],  // message
  ["que", domF("NRQC")],   // queue
  ["pip", domF("NRQC")],   // pipeline
  ["mdw", domF("NQXC")],   // middleware
  ["sch2", domF("NRQVC")], // schema
  ["mig", domF("NRQC")],   // migration
  ["dep2", domF("NRQXC")], // dependency
  ["api", domF("NRQXVC")], // API
  ["ctr2", domF("NRQC")],  // contract
  ["ddd", domF("NQXC")],   // DDD domain
  ["agg", domF("NQXC")],   // aggregate
];

/** Testing domain stems — activated by dom=test */
const DOMAIN_TEST_STEMS: ReadonlyArray<[string, ReadonlySet<string>]> = [
  ["cov", domF("NRQC")],   // coverage
  ["ast2", domF("NRQC")],  // assertion
  ["mck", domF("NRQC")],   // mock
  ["stb", domF("NRQC")],   // stub
  ["fxt", domF("NRQXC")],  // fixture
  ["reg2", domF("NRQC")],  // regression
  ["flk", domF("NRQC")],   // flaky
  ["ste", domF("NRQXC")],  // suite
  ["scn", domF("NRQC")],   // scenario
  ["exp2", domF("NRC")],   // expected
  ["act2", domF("NRC")],   // actual
  ["e2e", domF("NQC")],    // end-to-end
  ["unt", domF("NRQC")],   // unit test
  ["itg", domF("NRQC")],   // integration test
  ["snp2", domF("NRQC")],  // snapshot
  ["pas", domF("NQC")],    // pass
  ["skp", domF("NQC")],    // skip
  ["tmo", domF("NRQC")],   // timeout
  ["rty2", domF("NRQC")],  // retry
  ["hns", domF("NQXC")],   // harness
  ["bln", domF("NRQVC")],  // baseline
];

/** Built-in domain stem tables, keyed by domain ID. */
export const DOMAIN_TABLES: ReadonlyMap<string, DomainStemTable> = new Map([
  ["sec",  { id: "sec",  name: "Security",     stems: new Map(DOMAIN_SECURITY_STEMS) }],
  ["perf", { id: "perf", name: "Performance",  stems: new Map(DOMAIN_PERF_STEMS) }],
  ["arch", { id: "arch", name: "Architecture", stems: new Map(DOMAIN_ARCH_STEMS) }],
  ["test", { id: "test", name: "Testing",      stems: new Map(DOMAIN_TEST_STEMS) }],
]);

/**
 * Activate one or more domain stem tables, populating morphology.domainStems.
 *
 * Unknown domain IDs are silently ignored for forward compatibility.
 *
 * @param domainIds - Domain IDs to activate (e.g. ["sec", "perf"])
 * @param morphology - The morphology to extend (mutated in place)
 */
export function activateDomains(
  domainIds: readonly string[],
  morphology: CeelineMorphology
): void {
  for (const id of domainIds) {
    const table = DOMAIN_TABLES.get(id);
    if (!table) continue;
    for (const [stem, flags] of table.stems) {
      morphology.domainStems.set(stem, new Set(flags));
    }
  }
}

/**
 * Result of resolving an affixed code back to its morphological components.
 */
export interface AffixResolution {
  /** The original affixed code, e.g. `"neg.ok.seq"`. */
  readonly raw: string;
  /** Prefix rule applied, if any. */
  readonly prefix: AffixRule | null;
  /** Root stem after stripping affixes. */
  readonly stem: string;
  /** Suffix rule applied, if any. */
  readonly suffix: AffixRule | null;
  /** Whether the combination is valid per the stem's flag set. */
  readonly valid: boolean;
}

/**
 * Resolve an affixed compact code into its morphological parts.
 *
 * Recognizes patterns like:
 * - `neg.ok`       → prefix=neg, stem=ok, suffix=null
 * - `ho.seq`       → prefix=null, stem=ho, suffix=seq
 * - `re.ho.seq`    → prefix=re, stem=ho, suffix=seq
 * - `ok`           → prefix=null, stem=ok, suffix=null (bare stem)
 *
 * Returns `null` if the code cannot be parsed against the morphology.
 */
export function resolveAffix(
  code: string,
  morphology: CeelineMorphology
): AffixResolution | null {
  let prefix: AffixRule | null = null;
  let prefixFlag: string | null = null;
  let remaining = code;

  // Try to match a prefix
  for (const [flag, rule] of morphology.prefixes) {
    if (remaining.startsWith(rule.marker)) {
      prefix = rule;
      prefixFlag = flag;
      remaining = remaining.slice(rule.marker.length);
      break;
    }
  }

  // Try to match a suffix
  let suffix: AffixRule | null = null;
  let suffixFlag: string | null = null;
  for (const [flag, rule] of morphology.suffixes) {
    if (remaining.endsWith(rule.marker)) {
      suffix = rule;
      suffixFlag = flag;
      remaining = remaining.slice(0, -rule.marker.length);
      break;
    }
  }

  const stem = remaining;

  // Look up stem in built-in, domain, and session stems
  const flags = morphology.stems.get(stem)
    ?? morphology.domainStems.get(stem)
    ?? morphology.sessionStems.get(stem);
  if (!flags) return null;

  // Validate that the stem allows the applied affixes
  const prefixAllowed = prefixFlag === null || flags.has(prefixFlag);
  const suffixAllowed = suffixFlag === null || flags.has(suffixFlag);

  return {
    raw: code,
    prefix,
    stem,
    suffix,
    valid: prefixAllowed && suffixAllowed,
  };
}

/**
 * Check whether a compact code (possibly affixed) is a recognized
 * morphological form. Returns `true` for bare stems, valid affixed
 * forms, and session vocab.
 */
export function isValidMorphologicalCode(
  code: string,
  morphology: CeelineMorphology
): boolean {
  const res = resolveAffix(code, morphology);
  return res !== null && res.valid;
}

/**
 * Register a session-scoped vocabulary stem. Session stems inherit all
 * affix rules and expire with the session.
 *
 * @param stem - The short code (e.g. `"chk"`)
 * @param flags - Affix flags the stem supports (e.g. `"NRPQOXMVC"`)
 * @param morphology - The morphology to extend (mutated in place)
 */
export function registerSessionStem(
  stem: string,
  flags: string,
  morphology: CeelineMorphology
): void {
  morphology.sessionStems.set(stem, new Set(flags.split("")));
}

/**
 * Generate all valid morphological forms for a given stem.
 * Useful for documentation, autocomplete, and testing.
 */
export function expandStem(
  stem: string,
  morphology: CeelineMorphology
): string[] {
  const flags = morphology.stems.get(stem)
    ?? morphology.domainStems.get(stem)
    ?? morphology.sessionStems.get(stem);
  if (!flags) return [];

  const forms: string[] = [stem];

  // Prefixed forms
  for (const [flag, rule] of morphology.prefixes) {
    if (flags.has(flag)) {
      forms.push(`${rule.marker}${stem}`);
    }
  }

  // Suffixed forms
  for (const [flag, rule] of morphology.suffixes) {
    if (flags.has(flag)) {
      forms.push(`${stem}${rule.marker}`);
    }
  }

  // Cross-product: prefix + suffix
  for (const [pFlag, pRule] of morphology.prefixes) {
    if (!flags.has(pFlag)) continue;
    for (const [sFlag, sRule] of morphology.suffixes) {
      if (!flags.has(sFlag)) continue;
      forms.push(`${pRule.marker}${stem}${sRule.marker}`);
    }
  }

  return forms;
}

// ---------------------------------------------------------------------------
// Symbol Expression System (Layers 1-3)
// ---------------------------------------------------------------------------
//
// Layer 1: Single-token Unicode symbols as semantic atoms
// Layer 2: Compound expressions — 2-3 symbols compose into phrases
// Layer 3: Surface-dependent polysemy — same glyph shifts meaning by context
//
// Grammar:
//   symbol-expr  = state-expr | flow-expr | quality-expr | operator-expr
//   state-expr   = shape | shape arrow shape
//   flow-expr    = arrow target | arrow arrow
//   quality-expr = block | block greek | block check
//   operator-expr= greek | greek count | quantifier greek | greek comp greek

// ---------------------------------------------------------------------------
// Symbol code maps (symbol → base meaning)
// ---------------------------------------------------------------------------

/** Greek-letter semantic operators — base meanings. */
export const SYMBOL_GREEK_CODES: Readonly<Record<string, string>> = {
  "α": "primary",
  "β": "secondary",
  "γ": "tertiary",
  "δ": "delta",
  "ε": "epsilon",
  "ζ": "zeta",
  "η": "efficiency",
  "θ": "threshold",
  "λ": "transform",
  "μ": "mean",
  "π": "pipeline",
  "σ": "standard",
  "φ": "phase",
  "ψ": "psi",
  "ω": "final",
  "Σ": "sum",
};

/** Arrow flow symbols — base meanings. */
export const SYMBOL_ARROW_CODES: Readonly<Record<string, string>> = {
  "→": "to",
  "←": "from",
  "↑": "up",
  "↓": "down",
  "⇒": "implies",
};

/** Geometric shape symbols — base meanings (state indicators). */
export const SYMBOL_SHAPE_CODES: Readonly<Record<string, string>> = {
  "●": "active",
  "○": "pending",
  "■": "complete",
  "□": "paused",
  "▲": "high",
  "▼": "low",
  "▶": "process",
  "◆": "key",
  "◇": "optional",
};

/** Block element symbols — confidence gradient. */
export const SYMBOL_BLOCK_CODES: Readonly<Record<string, string>> = {
  "█": "conf_full",
  "▓": "conf_high",
  "▒": "conf_med",
  "░": "conf_low",
};

/** Math operator symbols. */
export const SYMBOL_MATH_CODES: Readonly<Record<string, string>> = {
  "∀": "for_all",
  "≈": "approximately",
  "≤": "at_most",
  "≥": "at_least",
  "√": "verified",
  "∞": "unbounded",
  "−": "minus",
};

/** Dingbat/check symbols. */
export const SYMBOL_CHECK_CODES: Readonly<Record<string, string>> = {
  "✓": "ok",
  "✔": "confirmed",
};

/** Master symbol lookup — all symbol atoms in one map. */
export const SYMBOL_CODES: Readonly<Record<string, string>> = {
  ...SYMBOL_GREEK_CODES,
  ...SYMBOL_ARROW_CODES,
  ...SYMBOL_SHAPE_CODES,
  ...SYMBOL_BLOCK_CODES,
  ...SYMBOL_MATH_CODES,
  ...SYMBOL_CHECK_CODES,
};

/** Reverse lookup: canonical meaning → symbol. */
export const REVERSE_SYMBOL_CODES: Readonly<Record<string, string>> =
  Object.fromEntries(Object.entries(SYMBOL_CODES).map(([k, v]) => [v, k]));

// ---------------------------------------------------------------------------
// Symbol categories (for type checking)
// ---------------------------------------------------------------------------

const GREEKS = new Set(Object.keys(SYMBOL_GREEK_CODES));
const ARROWS = new Set(Object.keys(SYMBOL_ARROW_CODES));
const SHAPES = new Set(Object.keys(SYMBOL_SHAPE_CODES));
const BLOCKS = new Set(Object.keys(SYMBOL_BLOCK_CODES));
const MATHS  = new Set(Object.keys(SYMBOL_MATH_CODES));
const CHECKS = new Set(Object.keys(SYMBOL_CHECK_CODES));
const ALL_SYMBOLS = new Set(Object.keys(SYMBOL_CODES));

/** Check whether a character is a known Ceeline symbol atom. */
export function isSymbol(ch: string): boolean {
  return ALL_SYMBOLS.has(ch);
}

// ---------------------------------------------------------------------------
// Surface-dependent polysemy (Layer 3)
// ---------------------------------------------------------------------------

/**
 * Per-surface meaning overrides for symbols.
 *
 * When a symbol appears inside a given surface, its meaning shifts
 * from the base meaning to the surface-specific meaning listed here.
 * If no override exists, the base meaning from SYMBOL_CODES applies.
 */
export const SYMBOL_SURFACE_MEANINGS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  // ● (active)
  "●": {
    handoff:   "claimed",
    routing:   "live",
    digest:    "confirmed",
    reflection: "certain",
  },
  // ○ (pending)
  "○": {
    handoff:   "unclaimed",
    routing:   "inactive",
    digest:    "unverified",
    reflection: "uncertain",
  },
  // → (to)
  "→": {
    handoff:   "transfers_to",
    routing:   "routes_to",
    memory:    "derived_from",
    reflection: "leads_to",
  },
  // ← (from)
  "←": {
    handoff:   "returned_from",
    routing:   "received_from",
    memory:    "sourced_from",
  },
  // ↑ (up)
  "↑": {
    handoff:   "escalate",
    routing:   "promote",
    reflection: "increased",
  },
  // ↓ (down)
  "↓": {
    handoff:   "delegate",
    routing:   "demote",
    reflection: "decreased",
  },
  // δ (delta)
  "δ": {
    handoff:   "changed",
    digest:    "diff",
    reflection: "self_correction",
    memory:    "updated",
  },
  // ▲ (high)
  "▲": {
    handoff:   "high_severity",
    routing:   "high_priority",
    reflection: "confidence_up",
  },
  // ▼ (low)
  "▼": {
    handoff:   "low_severity",
    routing:   "low_priority",
    reflection: "confidence_down",
  },
};

/**
 * Resolve the meaning of a symbol within a specific surface context.
 * Falls back to the base meaning from SYMBOL_CODES if no surface override exists.
 */
export function resolveSymbolMeaning(
  symbol: string,
  surface?: string
): string | undefined {
  if (surface) {
    const overrides = SYMBOL_SURFACE_MEANINGS[symbol];
    if (overrides?.[surface]) return overrides[surface];
  }
  return SYMBOL_CODES[symbol];
}

// ---------------------------------------------------------------------------
// Symbol Expression Parser
// ---------------------------------------------------------------------------

/** The kind of symbol expression recognized. */
export type SymbolExprKind =
  | "state"        // shape or shape→shape  (○→●)
  | "flow"         // arrow + target        (→● ←↑)
  | "quality"      // block or block+mod    (█✓ ▒γ)
  | "operator"     // greek combos          (δ3 Σδ ε≤θ)
  | "atom";        // single symbol         (●)

/** Parsed symbol expression — the result of resolveSymbolExpr(). */
export interface SymbolExpr {
  /** The original raw text. */
  readonly raw: string;
  /** Expression category. */
  readonly kind: SymbolExprKind;
  /** Individual symbol atoms in order. */
  readonly symbols: readonly string[];
  /** Numeric modifier, if present (e.g. 3 from δ3). */
  readonly count?: number;
  /** Base meaning (surface-independent). */
  readonly baseMeaning: string;
}

/**
 * Attempt to parse a string as a symbol expression.
 *
 * Recognizes the following patterns:
 *
 * **State transitions:** `○→●` `●→■` `□→●`
 * **Flow directives:**   `→●` `←↑` `↑▲` `⇒■`
 * **Quality markers:**   `█` `▒γ` `█✓` `░≈`
 * **Operators:**         `δ` `δ3` `Σδ` `ε≤θ` `∀σ` `λ→μ`
 * **Atoms:**             `●` `δ` `▲` (single symbol, no composition)
 *
 * Returns `null` if the string does not match any symbol expression pattern.
 */
export function resolveSymbolExpr(
  text: string,
  surface?: string
): SymbolExpr | null {
  if (text.length === 0) return null;

  const chars = [...text]; // surrogate-safe split
  if (chars.length === 0) return null;

  // All characters must be either symbols, digits, or ASCII for stem refs
  // Quick check: first char must be a symbol
  if (!ALL_SYMBOLS.has(chars[0])) return null;

  // --- Single atom ---
  if (chars.length === 1) {
    const meaning = resolveSymbolMeaning(chars[0], surface) ?? chars[0];
    const kind = categorize(chars[0]);
    return { raw: text, kind, symbols: chars, baseMeaning: meaning };
  }

  // --- State transition: shape→shape ---
  // Pattern: [shape][arrow][shape]
  if (chars.length === 3 && SHAPES.has(chars[0]) && ARROWS.has(chars[1]) && SHAPES.has(chars[2])) {
    const from = resolveSymbolMeaning(chars[0], surface) ?? chars[0];
    const arrow = resolveSymbolMeaning(chars[1], surface) ?? chars[1];
    const to = resolveSymbolMeaning(chars[2], surface) ?? chars[2];
    return {
      raw: text, kind: "state", symbols: chars,
      baseMeaning: `${from}_${arrow}_${to}`,
    };
  }

  // --- Flow: arrow + target(s) ---
  // Pattern: [arrow][symbol] or [arrow][arrow]
  if (ARROWS.has(chars[0])) {
    const symbols = chars.filter(c => ALL_SYMBOLS.has(c));
    if (symbols.length === chars.length) {
      const parts = symbols.map(s => resolveSymbolMeaning(s, surface) ?? s);
      return {
        raw: text, kind: "flow", symbols,
        baseMeaning: parts.join("_"),
      };
    }
  }

  // --- Quality: block + optional modifier ---
  // Pattern: [block] or [block][greek|check|math]
  if (BLOCKS.has(chars[0])) {
    if (chars.length === 1) {
      return {
        raw: text, kind: "quality", symbols: [chars[0]],
        baseMeaning: resolveSymbolMeaning(chars[0], surface) ?? chars[0],
      };
    }
    if (chars.length === 2 && (GREEKS.has(chars[1]) || CHECKS.has(chars[1]) || MATHS.has(chars[1]))) {
      const block = resolveSymbolMeaning(chars[0], surface) ?? chars[0];
      const mod = resolveSymbolMeaning(chars[1], surface) ?? chars[1];
      return {
        raw: text, kind: "quality", symbols: chars,
        baseMeaning: `${block}_${mod}`,
      };
    }
  }

  // --- Operator: greek + modifier ---
  // Pattern: [greek][digits]  e.g. δ3
  if (GREEKS.has(chars[0])) {
    const rest = text.slice(chars[0].length);
    // Greek + digits → operator with count
    if (/^\d+$/.test(rest)) {
      return {
        raw: text, kind: "operator", symbols: [chars[0]],
        count: parseInt(rest, 10),
        baseMeaning: resolveSymbolMeaning(chars[0], surface) ?? chars[0],
      };
    }
    // Greek + arrow + greek → operator chain (λ→μ)
    if (chars.length === 3 && ARROWS.has(chars[1]) && GREEKS.has(chars[2])) {
      const parts = chars.map(c => resolveSymbolMeaning(c, surface) ?? c);
      return {
        raw: text, kind: "operator", symbols: chars,
        baseMeaning: parts.join("_"),
      };
    }
    // Greek + math + greek → comparison (ε≤θ)
    if (chars.length === 3 && MATHS.has(chars[1]) && GREEKS.has(chars[2])) {
      const parts = chars.map(c => resolveSymbolMeaning(c, surface) ?? c);
      return {
        raw: text, kind: "operator", symbols: chars,
        baseMeaning: parts.join("_"),
      };
    }
    // Quantifier + greek → aggregate (Σδ ∀σ)
    if (chars.length === 2 && (GREEKS.has(chars[1]) || MATHS.has(chars[0]))) {
      const parts = chars.map(c => resolveSymbolMeaning(c, surface) ?? c);
      return {
        raw: text, kind: "operator", symbols: chars,
        baseMeaning: parts.join("_"),
      };
    }
  }

  // --- Quantifier-led operator: Σδ ∀σ ---
  if (MATHS.has(chars[0]) && chars.length === 2 && GREEKS.has(chars[1])) {
    const parts = chars.map(c => resolveSymbolMeaning(c, surface) ?? c);
    return {
      raw: text, kind: "operator", symbols: chars,
      baseMeaning: parts.join("_"),
    };
  }

  return null;
}

function categorize(ch: string): SymbolExprKind {
  if (SHAPES.has(ch)) return "state";
  if (ARROWS.has(ch)) return "flow";
  if (BLOCKS.has(ch)) return "quality";
  if (GREEKS.has(ch) || MATHS.has(ch)) return "operator";
  return "atom";
}
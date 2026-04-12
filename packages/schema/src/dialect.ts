/**
 * LLM-Authored Dialect Evolution System
 *
 * Dialects are named, versioned vocabulary extensions that an LLM can define,
 * activate, share between agents, and evolve across exchanges. They sit
 * between ephemeral session vocab (vocab=) and hardcoded domain tables (dom=)
 * in the persistence hierarchy.
 *
 * Evolution lifecycle:
 *   1. Define  — LLM emits stem= clauses with a dialect ID
 *   2. Store   — DialectStore persists the dialect across exchanges
 *   3. Activate — dialect= header activates stems into morphology
 *   4. Evolve  — LLM increments version, adds/modifies stems
 *   5. Promote — Frequently used dialect stems graduate to domain tables
 *
 * Compact text integration:
 *   - Define:   @cl1 s=me i=dialect.define ; did=<id> ; dver=<n> ; stem=<code>:<meaning>/<FLAGS>
 *   - Activate: @cl1 s=ho i=review.security dialect=<id>
 *   - Evolve:   @cl1 s=me i=dialect.evolve ; did=<id> ; dver=<n> ; dbase=<parent-id>
 */

import type { CeelineMorphology } from "./language.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single stem within a dialect: code, meaning, and allowed affix flags. */
export interface DialectStem {
  /** Short compact code (e.g. "chk"). */
  readonly code: string;
  /** Human-readable meaning (e.g. "checkpoint"). */
  readonly meaning: string;
  /** Affix flags this stem accepts (e.g. Set(["N","R","Q","C"])). */
  readonly flags: ReadonlySet<string>;
}

/**
 * An LLM-authored dialect: a named, versioned vocabulary extension.
 *
 * Dialects are richer than domain tables — they carry meanings for
 * documentation/sharing and support inheritance via `base`.
 */
export interface CeelineDialect {
  /** Unique dialect identifier (e.g. "audit.sec-review"). */
  readonly id: string;
  /** Human-readable name (e.g. "Security Audit Review"). */
  readonly name: string;
  /** Monotonic version number, starts at 1. */
  readonly version: number;
  /** Parent dialect this one extends (by id), if any. */
  readonly base?: string;
  /** Stems defined by this dialect. */
  readonly stems: ReadonlyMap<string, DialectStem>;
  /** Per-surface symbol meaning overrides, if any. */
  readonly symbolOverrides?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** Free-text description of the dialect's purpose. */
  readonly description?: string;
}

/** Input for defining a new dialect (plain objects, no Maps). */
export interface DialectDefinition {
  readonly id: string;
  readonly name: string;
  readonly version?: number;
  readonly base?: string;
  readonly stems: readonly DialectStemDef[];
  readonly symbolOverrides?: Record<string, Record<string, string>>;
  readonly description?: string;
}

/** A stem definition in plain-object form. */
export interface DialectStemDef {
  readonly code: string;
  readonly meaning: string;
  /** Flag string, e.g. "NRQC". Default: "NRPTDQOXAMVC" (all flags). */
  readonly flags?: string;
}

// ---------------------------------------------------------------------------
// Dialect creation
// ---------------------------------------------------------------------------

/** Default flags granted to dialect stems when none are specified. */
const DEFAULT_DIALECT_FLAGS = "NRPTDQOXAMVC";

/** Validate a dialect ID: lowercase alphanumeric + dots + hyphens. */
const DIALECT_ID_RE = /^[a-z][a-z0-9._-]*$/;

/**
 * Create a dialect from a plain-object definition.
 *
 * Validates the ID format and stem codes. Throws on invalid input rather
 * than returning a result — dialect definitions are authored, not parsed
 * from untrusted wire input.
 */
export function defineDialect(def: DialectDefinition): CeelineDialect {
  if (!DIALECT_ID_RE.test(def.id)) {
    throw new Error(`Invalid dialect ID "${def.id}": must match ${DIALECT_ID_RE}`);
  }

  const stems = new Map<string, DialectStem>();
  for (const s of def.stems) {
    if (stems.has(s.code)) {
      throw new Error(`Duplicate stem code "${s.code}" in dialect "${def.id}"`);
    }
    stems.set(s.code, {
      code: s.code,
      meaning: s.meaning,
      flags: new Set((s.flags ?? DEFAULT_DIALECT_FLAGS).split("")),
    });
  }

  return {
    id: def.id,
    name: def.name,
    version: def.version ?? 1,
    base: def.base,
    stems,
    symbolOverrides: def.symbolOverrides,
    description: def.description,
  };
}

// ---------------------------------------------------------------------------
// Dialect application (morphology integration)
// ---------------------------------------------------------------------------

/**
 * Activate a dialect's stems into the morphology's domainStems map.
 *
 * This follows the same pattern as `activateDomains()` — stems are merged
 * into `morphology.domainStems` so they participate in affix resolution.
 * The parser snapshots and restores domainStems to prevent leaking.
 */
export function applyDialect(
  dialect: CeelineDialect,
  morphology: CeelineMorphology
): void {
  for (const [code, stem] of dialect.stems) {
    morphology.domainStems.set(code, new Set(stem.flags));
  }
}

// ---------------------------------------------------------------------------
// Dialect Store — in-memory registry for LLM-authored dialects
// ---------------------------------------------------------------------------

/**
 * In-memory store for LLM-authored dialects.
 *
 * Supports define, retrieve, activate, list, and evolution (version bumps).
 * The store is scoped to a runtime session — persistence across process
 * restarts is the host's responsibility.
 */
export class DialectStore {
  /** dialects keyed by id. Latest version wins. */
  private readonly dialects = new Map<string, CeelineDialect>();

  /** Usage counters: stem code → activation count. */
  private readonly usage = new Map<string, number>();

  /** Define or update a dialect. Newer versions replace older ones. */
  define(dialect: CeelineDialect): void {
    const existing = this.dialects.get(dialect.id);
    if (existing && dialect.version <= existing.version) {
      throw new Error(
        `Dialect "${dialect.id}" v${dialect.version} cannot replace v${existing.version}: version must increase`
      );
    }
    this.dialects.set(dialect.id, dialect);
  }

  /** Retrieve a dialect by ID, or undefined if not found. */
  get(id: string): CeelineDialect | undefined {
    return this.dialects.get(id);
  }

  /** List all stored dialects. */
  list(): CeelineDialect[] {
    return [...this.dialects.values()];
  }

  /**
   * Activate one or more dialects into a morphology.
   *
   * Resolves dialect inheritance (base → child) and merges all stems.
   * Tracks usage counts for promotion decisions.
   *
   * @returns Array of dialect IDs that were successfully activated.
   */
  activate(ids: readonly string[], morphology: CeelineMorphology): string[] {
    const activated: string[] = [];
    for (const id of ids) {
      const chain = this.resolveChain(id);
      if (chain.length === 0) continue;
      for (const dialect of chain) {
        applyDialect(dialect, morphology);
        // Track usage
        for (const code of dialect.stems.keys()) {
          this.usage.set(code, (this.usage.get(code) ?? 0) + 1);
        }
      }
      activated.push(id);
    }
    return activated;
  }

  /** Get usage count for a stem code. */
  getUsage(code: string): number {
    return this.usage.get(code) ?? 0;
  }

  /** Get all usage counts, sorted descending. */
  getUsageReport(): Array<{ code: string; count: number }> {
    return [...this.usage.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Resolve the inheritance chain for a dialect: [base, ..., child].
   * Returns empty array if the dialect is not found.
   * Guards against circular inheritance.
   */
  private resolveChain(id: string): CeelineDialect[] {
    const chain: CeelineDialect[] = [];
    const visited = new Set<string>();
    let current: string | undefined = id;

    while (current && !visited.has(current)) {
      visited.add(current);
      const dialect = this.dialects.get(current);
      if (!dialect) break;
      chain.unshift(dialect); // base first
      current = dialect.base;
    }

    return chain;
  }
}

// ---------------------------------------------------------------------------
// Compact text serialization
// ---------------------------------------------------------------------------

/**
 * Serialize a dialect stem to compact stem= clause format.
 *
 * Format: `stem=code:meaning/FLAGS`
 *
 * Examples:
 *   stem=chk:checkpoint/NRQC
 *   stem=swp:sweep/NRQC
 */
export function serializeDialectStem(stem: DialectStem): string {
  const flags = [...stem.flags].sort().join("");
  const meaning = /^[A-Za-z0-9._:/@\u0080-\uFFFF-]+$/.test(stem.meaning)
    ? stem.meaning
    : JSON.stringify(stem.meaning);
  return `stem=${stem.code}:${meaning}/${flags}`;
}

/**
 * Parse a stem= clause value into a DialectStemDef.
 *
 * Expected format: `code:meaning/FLAGS` or `code:meaning` (default flags).
 *
 * Returns null if the format is invalid.
 */
export function parseDialectStem(value: string): DialectStemDef | null {
  // Split on last / to get flags
  const slashIdx = value.lastIndexOf("/");
  let codeAndMeaning: string;
  let flags: string | undefined;

  if (slashIdx > 0) {
    codeAndMeaning = value.slice(0, slashIdx);
    flags = value.slice(slashIdx + 1);
    // Validate flags are uppercase letters
    if (!/^[A-Z]+$/.test(flags)) {
      // The /... part isn't valid flags — treat as part of meaning
      codeAndMeaning = value;
      flags = undefined;
    }
  } else {
    codeAndMeaning = value;
  }

  const colonIdx = codeAndMeaning.indexOf(":");
  if (colonIdx <= 0) return null;

  const code = codeAndMeaning.slice(0, colonIdx);
  let meaning = codeAndMeaning.slice(colonIdx + 1);

  // Decode JSON-quoted meanings
  if (meaning.startsWith('"')) {
    try { meaning = JSON.parse(meaning); } catch { /* keep raw */ }
  }

  if (!code || !meaning) return null;

  return { code, meaning, flags };
}

/**
 * Serialize a full dialect to compact text clauses (for embedding in
 * a memory surface envelope or for agent-to-agent sharing).
 *
 * Returns an array of compact clause strings (without header).
 * The caller wraps these in an appropriate envelope.
 *
 * Example output:
 *   ["did=audit.sec-review", "dver=1", "dname=\"Security Audit Review\"",
 *    "stem=chk:checkpoint/NRQC", "stem=swp:sweep/NRQC",
 *    "sum=\"Dialect for systematic audit patterns\""]
 */
export function serializeDialect(dialect: CeelineDialect): string[] {
  const clauses: string[] = [];

  clauses.push(`did=${dialect.id}`);
  clauses.push(`dver=${dialect.version}`);

  const name = /^[A-Za-z0-9._:/@\u0080-\uFFFF-]+$/.test(dialect.name)
    ? dialect.name
    : JSON.stringify(dialect.name);
  clauses.push(`dname=${name}`);

  if (dialect.base) {
    clauses.push(`dbase=${dialect.base}`);
  }

  for (const stem of dialect.stems.values()) {
    clauses.push(serializeDialectStem(stem));
  }

  if (dialect.description) {
    const desc = /^[A-Za-z0-9._:/@\u0080-\uFFFF-]+$/.test(dialect.description)
      ? dialect.description
      : JSON.stringify(dialect.description);
    clauses.push(`sum=${desc}`);
  }

  return clauses;
}

/**
 * Reconstruct a DialectDefinition from parsed compact clauses.
 *
 * Expects a Record of clause key → value as produced by the parser's
 * surfaceFields, extensions, and dedicated dialect fields.
 *
 * This is the inverse of serializeDialect() — used when the parser
 * encounters a dialect.define or dialect.evolve intent.
 */
export function parseDialectFromClauses(
  fields: Record<string, string>,
  stems: DialectStemDef[]
): DialectDefinition | null {
  const id = fields["did"];
  const name = fields["dname"];
  if (!id || !name) return null;

  const version = fields["dver"] ? parseInt(fields["dver"], 10) : 1;

  return {
    id,
    name,
    version: isNaN(version) ? 1 : version,
    base: fields["dbase"],
    stems,
    description: fields["sum"],
  };
}

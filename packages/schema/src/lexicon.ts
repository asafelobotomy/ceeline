/**
 * Personal Lexicon Plugin System
 *
 * A personal lexicon is a per-LLM-identity vocabulary layer that sits
 * between shared dialects and ephemeral session vocab in the resolution
 * hierarchy:
 *
 *   Layer 4: Session vocab    (ephemeral)       ← vocab=
 *   Layer 3: Personal lexicon (persistent)      ← lexicon=
 *   Layer 2: Shared dialects  (persistent)      ← dialect=
 *   Layer 1: Domain tables    (permanent)       ← dom=
 *   Layer 0: Core stems       (immutable)       ← built-in
 *
 * Each personal lexicon wraps a CeelineDialect (reusing defineDialect
 * validation) and adds:
 *   - owner identity (which LLM authored it)
 *   - stem relations (how personal stems map to core/dialect stems)
 *
 * Compact text integration:
 *   - Define:   lowner=<owner> ; did=<id> ; dver=<n> ; stem=<code>:<meaning>/<FLAGS>@<relation>
 *   - Activate: lexicon=<id> (header key)
 *   - Evolve:   lowner=<owner> ; did=<id> ; dver=<n> ; dbase=<parent>
 */

import {
  defineDialect,
  serializeDialect,
  parseDialectStem,
  parseDialectFromClauses,
  type CeelineDialect,
  type DialectStemDef,
} from "./dialect.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** How a personal stem relates to an existing core/dialect stem. */
export type StemRelation = "extends" | "narrows" | "aliases" | "supersedes";

/** Valid stem relations for validation. */
export const STEM_RELATIONS: readonly StemRelation[] = [
  "extends",
  "narrows",
  "aliases",
  "supersedes",
] as const;

/** A stem definition in a personal lexicon, with relation metadata. */
export interface PersonalStemDef extends DialectStemDef {
  /** Relation to an existing stem. Default: "extends". */
  readonly relation?: StemRelation;
  /** The core/dialect stem code this relates to, if any. */
  readonly coreRef?: string;
}

/** Input for defining a personal lexicon (plain objects, no Maps). */
export interface PersonalLexiconDefinition {
  readonly owner: string;
  readonly id: string;
  readonly name: string;
  readonly version?: number;
  readonly base?: string;
  readonly stems: readonly PersonalStemDef[];
  readonly description?: string;
}

/**
 * A personal lexicon: an owner-scoped vocabulary extension.
 *
 * Wraps a CeelineDialect by composition and adds owner identity
 * and stem relation metadata.
 */
export interface PersonalLexicon {
  /** LLM identity that authored this lexicon (e.g. "claude-3", "gpt-4"). */
  readonly owner: string;
  /** The underlying dialect (reuses all dialect validation/features). */
  readonly dialect: CeelineDialect;
  /** Stem code → relation type. */
  readonly relations: ReadonlyMap<string, StemRelation>;
  /** Stem code → core/dialect stem code it maps to. */
  readonly coreRefs: ReadonlyMap<string, string>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a personal lexicon from a plain-object definition.
 *
 * Validates owner, delegates dialect creation to defineDialect(),
 * and builds relation/coreRef maps. Throws on invalid input.
 */
export function definePersonalLexicon(
  def: PersonalLexiconDefinition
): PersonalLexicon {
  if (!def.owner || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(def.owner)) {
    throw new Error(
      `Invalid lexicon owner "${def.owner}": must be alphanumeric with dots/hyphens/underscores`
    );
  }

  // Delegate dialect creation (validates ID, stem codes, etc.)
  const dialect = defineDialect({
    id: def.id,
    name: def.name,
    version: def.version,
    base: def.base,
    stems: def.stems,
    description: def.description,
  });

  const relations = new Map<string, StemRelation>();
  const coreRefs = new Map<string, string>();

  for (const s of def.stems) {
    const rel = s.relation ?? "extends";
    /* v8 ignore next 4 -- structurally unreachable: TypeScript constrains StemRelation */
    if (!STEM_RELATIONS.includes(rel)) {
      throw new Error(
        `Invalid relation "${rel}" on stem "${s.code}": must be one of ${STEM_RELATIONS.join(", ")}`
      );
    }
    relations.set(s.code, rel);
    if (s.coreRef) {
      coreRefs.set(s.code, s.coreRef);
    }
  }

  return { owner: def.owner, dialect, relations, coreRefs };
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Serialize a personal lexicon to compact text clauses.
 *
 * Delegates to `serializeDialect()` for the base structure and prepends
 * `lowner=`, then appends `@relation[:coreRef]` suffixes to stem clauses.
 *
 * Example output:
 *   ["lowner=claude-3", "did=my.sec-terms", "dver=1",
 *    "dname=\"My Security Terms\"",
 *    "stem=vuln:vulnerability/NRQC@extends",
 *    "stem=breach:security-breach/NRC@narrows:sc"]
 */
export function serializePersonalLexicon(lex: PersonalLexicon): string[] {
  const baseClauses = serializeDialect(lex.dialect);

  // Append @relation[:coreRef] suffixes to stem= clauses
  const clauses = baseClauses.map(clause => {
    if (!clause.startsWith("stem=")) return clause;
    const code = clause.slice(5, clause.indexOf(":"));
    const rel = lex.relations.get(code);
    /* v8 ignore next -- definePersonalLexicon always sets a relation for every stem */
    if (!rel) return clause;
    const ref = lex.coreRefs.get(code);
    return ref ? `${clause}@${rel}:${ref}` : `${clause}@${rel}`;
  });

  // Prepend owner
  clauses.unshift(`lowner=${lex.owner}`);
  return clauses;
}

/**
 * Parse the `@relation` and optional `:coreRef` suffix from a stem=
 * clause value.
 *
 * Input: "code:meaning/FLAGS@extends:coreStem"
 * Returns: { stemValue: "code:meaning/FLAGS", relation: "extends", coreRef: "coreStem" }
 *
 * Returns null relation/coreRef if no @ suffix is present.
 */
export function parseStemRelation(
  value: string
): { stemValue: string; relation: StemRelation | undefined; coreRef: string | undefined } {
  const atIdx = value.lastIndexOf("@");
  if (atIdx <= 0) {
    return { stemValue: value, relation: undefined, coreRef: undefined };
  }

  const stemValue = value.slice(0, atIdx);
  const relPart = value.slice(atIdx + 1);

  const colonIdx = relPart.indexOf(":");
  let relStr: string;
  let coreRef: string | undefined;

  if (colonIdx > 0) {
    relStr = relPart.slice(0, colonIdx);
    coreRef = relPart.slice(colonIdx + 1);
  } else {
    relStr = relPart;
  }

  if (!STEM_RELATIONS.includes(relStr as StemRelation)) {
    // Not a valid relation — treat the whole thing as the stem value
    return { stemValue: value, relation: undefined, coreRef: undefined };
  }

  return { stemValue, relation: relStr as StemRelation, coreRef };
}

/**
 * Parse a personal stem definition from a stem= clause value that may
 * include an `@relation` suffix.
 *
 * Returns null if the base stem format is invalid.
 */
export function parsePersonalStem(value: string): PersonalStemDef | null {
  const { stemValue, relation, coreRef } = parseStemRelation(value);
  const base = parseDialectStem(stemValue);
  if (!base) return null;

  return { ...base, relation, coreRef };
}

/**
 * Reconstruct a PersonalLexiconDefinition from parsed compact clauses.
 *
 * Expects `lowner` in the meta fields. Returns null if owner or required
 * dialect fields are missing.
 */
export function parsePersonalLexiconFromClauses(
  fields: Record<string, string>,
  stems: PersonalStemDef[]
): PersonalLexiconDefinition | null {
  const owner = fields["lowner"];
  if (!owner) return null;

  const dialectDef = parseDialectFromClauses(fields, stems);
  if (!dialectDef) return null;

  return {
    owner,
    id: dialectDef.id,
    name: dialectDef.name,
    version: dialectDef.version,
    base: dialectDef.base,
    stems,
    description: dialectDef.description,
  };
}

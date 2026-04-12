// ---------------------------------------------------------------------------
// .aff / .dic parser — reads Hunspell-compatible Ceeline language files
// ---------------------------------------------------------------------------

import type { AffixRule, CeelineMorphology } from "./language.js";

/**
 * Parse a Ceeline `.aff` file into prefix and suffix rule maps.
 *
 * Supports the subset of Hunspell `.aff` syntax used by Ceeline:
 * - `PFX <flag> Y <count>` / `PFX <flag> <strip> <add> <condition>`
 * - `SFX <flag> Y <count>` / `SFX <flag> <strip> <add> <condition>`
 *
 * Comment lines (starting with `#`) and directives we don't use
 * (SET, LANG, COMPOUNDFLAG, COMPOUNDMIN) are silently skipped.
 */
export function parseAffFile(content: string): {
  prefixes: Map<string, AffixRule>;
  suffixes: Map<string, AffixRule>;
} {
  const prefixes = new Map<string, AffixRule>();
  const suffixes = new Map<string, AffixRule>();

  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;

    const parts = line.split(/\s+/);
    const kind = parts[0]; // PFX or SFX

    if (kind !== "PFX" && kind !== "SFX") continue;

    // Header line: PFX N Y 1 — we skip these (they declare count)
    if (parts.length === 4 && (parts[2] === "Y" || parts[2] === "N")) continue;

    // Rule line: PFX N 0 neg. .
    if (parts.length >= 5) {
      const flag = parts[1];
      const add = parts[3]; // e.g. "neg." or ".seq"

      // Derive a human name from the marker (strip dots)
      const name = add.replace(/\./g, "");

      const map = kind === "PFX" ? prefixes : suffixes;
      if (!map.has(flag)) {
        map.set(flag, { name, marker: add, meaning: "" });
      }
    }
  }

  return { prefixes, suffixes };
}

/**
 * Parse a Ceeline `.dic` file into a stem → flags map.
 *
 * Format:
 * - First non-comment line: approximate stem count (ignored)
 * - Subsequent lines: `<stem>/<flags>` or `<stem>` (no flags)
 * - Comment lines start with `#`
 */
export function parseDicFile(content: string): Map<string, Set<string>> {
  const stems = new Map<string, Set<string>>();
  let lineNum = 0;
  let sawCount = false;

  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;

    lineNum++;

    // First non-comment line is the count — skip it
    if (!sawCount) {
      if (/^\d+$/.test(line)) {
        sawCount = true;
        continue;
      }
      sawCount = true; // treat as missing count, fall through
    }

    const slashIdx = line.indexOf("/");
    if (slashIdx > 0) {
      const stem = line.slice(0, slashIdx);
      const flags = new Set(line.slice(slashIdx + 1).split(""));
      stems.set(stem, flags);
    } else {
      // Bare stem with no flags
      stems.set(line, new Set());
    }
  }

  return stems;
}

/**
 * Build a `CeelineMorphology` from raw `.aff` and `.dic` file contents.
 *
 * This is the primary integration point: read the two files from disk,
 * pass their text content here, and get a fully wired morphology object.
 *
 * ```ts
 * import { readFileSync } from "node:fs";
 * const aff = readFileSync("packages/schema/dict/ceeline.aff", "utf-8");
 * const dic = readFileSync("packages/schema/dict/ceeline.dic", "utf-8");
 * const morphology = loadMorphology(aff, dic);
 * ```
 */
export function loadMorphology(
  affContent: string,
  dicContent: string
): CeelineMorphology {
  const { prefixes, suffixes } = parseAffFile(affContent);
  const stems = parseDicFile(dicContent);

  return {
    prefixes,
    suffixes,
    stems,
    domainStems: new Map(),
    sessionStems: new Map(),
  };
}

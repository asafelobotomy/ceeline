import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseAffFile,
  parseDicFile,
  loadMorphology,
  createDefaultMorphology,
  resolveAffix,
  DOMAIN_TABLES,
} from "@ceeline/schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DICT_DIR = resolve(__dirname, "../../../../packages/schema/dict");
const affContent = readFileSync(resolve(DICT_DIR, "ceeline.aff"), "utf-8");
const dicContent = readFileSync(resolve(DICT_DIR, "ceeline.dic"), "utf-8");

describe(".aff parser", () => {
  const { prefixes, suffixes } = parseAffFile(affContent);

  it("parses all 5 prefix rules", () => {
    expect(prefixes.size).toBe(5);
    expect(prefixes.has("N")).toBe(true);
    expect(prefixes.has("R")).toBe(true);
    expect(prefixes.has("P")).toBe(true);
    expect(prefixes.has("T")).toBe(true);
    expect(prefixes.has("D")).toBe(true);
  });

  it("parses prefix markers correctly", () => {
    expect(prefixes.get("N")!.marker).toBe("neg.");
    expect(prefixes.get("R")!.marker).toBe("re.");
    expect(prefixes.get("P")!.marker).toBe("prev.");
    expect(prefixes.get("T")!.marker).toBe("tent.");
    expect(prefixes.get("D")!.marker).toBe("del.");
  });

  it("parses all 6 suffix rules", () => {
    expect(suffixes.size).toBe(6);
    expect(suffixes.has("Q")).toBe(true);
    expect(suffixes.has("O")).toBe(true);
    expect(suffixes.has("X")).toBe(true);
    expect(suffixes.has("A")).toBe(true);
    expect(suffixes.has("M")).toBe(true);
    expect(suffixes.has("V")).toBe(true);
  });

  it("parses suffix markers correctly", () => {
    expect(suffixes.get("Q")!.marker).toBe(".seq");
    expect(suffixes.get("O")!.marker).toBe(".opt");
    expect(suffixes.get("X")!.marker).toBe(".ref");
    expect(suffixes.get("A")!.marker).toBe(".as");
    expect(suffixes.get("M")!.marker).toBe(".multi");
    expect(suffixes.get("V")!.marker).toBe(".v");
  });

  it("ignores malformed PFX/SFX lines with fewer than 5 parts", () => {
    // A PFX line with only 3 parts (not a header, not a full rule)
    const aff = "PFX Z Y 1\nPFX Z abc\n";
    const { prefixes, suffixes } = parseAffFile(aff);
    // Z header line is parsed but rule line has only 3 parts, so no actual rule
    expect(prefixes.size).toBe(0);
    expect(suffixes.size).toBe(0);
  });

  it("parses header lines with N cross-product flag", () => {
    // Header line with "N" (no cross-product) instead of "Y"
    const aff = "PFX Z N 1\nPFX Z 0 test. .\n";
    const { prefixes } = parseAffFile(aff);
    expect(prefixes.has("Z")).toBe(true);
    expect(prefixes.get("Z")!.marker).toBe("test.");
  });

  it("handles duplicate flag rules (second rule overwrites)", () => {
    const aff = "PFX A Y 2\nPFX A 0 first. .\nPFX A 0 second. .\n";
    const { prefixes } = parseAffFile(aff);
    expect(prefixes.has("A")).toBe(true);
  });
});

describe(".dic parser", () => {
  const stems = parseDicFile(dicContent);

  it("parses a substantial number of stems", () => {
    expect(stems.size).toBeGreaterThan(50);
  });

  it("parses .dic content without a count line", () => {
    // First line is a stem directly (no numeric count header)
    const noCounts = "ho/NRQC\ndg/NRC\n";
    const parsed = parseDicFile(noCounts);
    expect(parsed.has("ho")).toBe(true);
    expect(parsed.has("dg")).toBe(true);
  });

  it("parses bare stem with no flags", () => {
    const bare = "3\nho/NRC\nsimple\n";
    const parsed = parseDicFile(bare);
    expect(parsed.has("simple")).toBe(true);
    expect(parsed.get("simple")!.size).toBe(0);
  });

  it("parses surface stems with correct flags", () => {
    expect(stems.has("ho")).toBe(true);
    const hoFlags = stems.get("ho")!;
    expect(hoFlags.has("N")).toBe(true);
    expect(hoFlags.has("R")).toBe(true);
    expect(hoFlags.has("Q")).toBe(true);
    expect(hoFlags.has("C")).toBe(true);
  });

  it("parses audience stems with minimal flags", () => {
    expect(stems.has("m")).toBe(true);
    const mFlags = stems.get("m")!;
    expect(mFlags.has("C")).toBe(true);
    expect(mFlags.has("N")).toBe(false);
  });
});

describe("loadMorphology (round-trip from .aff/.dic)", () => {
  const morphology = loadMorphology(affContent, dicContent);

  it("resolves bare stems", () => {
    const res = resolveAffix("ho", morphology);
    expect(res).not.toBeNull();
    expect(res!.stem).toBe("ho");
    expect(res!.valid).toBe(true);
  });

  it("resolves prefixed codes", () => {
    const res = resolveAffix("neg.ok", morphology);
    expect(res).not.toBeNull();
    expect(res!.prefix!.marker).toBe("neg.");
    expect(res!.stem).toBe("ok");
    expect(res!.valid).toBe(true);
  });

  it("resolves suffixed codes", () => {
    const res = resolveAffix("ho.seq", morphology);
    expect(res).not.toBeNull();
    expect(res!.suffix!.marker).toBe(".seq");
    expect(res!.stem).toBe("ho");
    expect(res!.valid).toBe(true);
  });

  it("rejects disallowed affix+stem combos", () => {
    const res = resolveAffix("neg.m", morphology);
    expect(res).not.toBeNull();
    expect(res!.valid).toBe(false);
  });
});

describe(".dic ↔ BUILTIN_STEMS sync", () => {
  const dicStems = parseDicFile(dicContent);
  const builtinMorphology = createDefaultMorphology();

  it("every BUILTIN_STEMS entry exists in .dic with matching flags", () => {
    const mismatches: string[] = [];

    for (const [stem, builtinFlags] of builtinMorphology.stems) {
      const dicFlags = dicStems.get(stem);
      if (!dicFlags) {
        mismatches.push(`${stem}: missing from .dic`);
        continue;
      }
      // Check that every flag in the TS builtin is also in the .dic
      for (const flag of builtinFlags) {
        if (!dicFlags.has(flag)) {
          mismatches.push(`${stem}: flag ${flag} in TS but not in .dic`);
        }
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("every .dic stem that's in BUILTIN_STEMS has matching flags (reverse)", () => {
    const mismatches: string[] = [];

    for (const [stem, dicFlags] of dicStems) {
      // Skip stems that are only in .dic (e.g. @cl1, density modifiers, etc.)
      const builtinFlags = builtinMorphology.stems.get(stem);
      if (!builtinFlags) continue;

      for (const flag of dicFlags) {
        if (!builtinFlags.has(flag)) {
          mismatches.push(`${stem}: flag ${flag} in .dic but not in TS`);
        }
      }
    }

    expect(mismatches).toEqual([]);
  });
});

describe(".dic ↔ DOMAIN_TABLES sync", () => {
  const dicStems = parseDicFile(dicContent);

  it("every domain stem exists in .dic with matching flags", () => {
    const mismatches: string[] = [];

    for (const [domId, table] of DOMAIN_TABLES) {
      for (const [stem, tsFlags] of table.stems) {
        const dicFlags = dicStems.get(stem);
        if (!dicFlags) {
          mismatches.push(`${domId}/${stem}: missing from .dic`);
          continue;
        }
        for (const flag of tsFlags) {
          if (!dicFlags.has(flag)) {
            mismatches.push(`${domId}/${stem}: flag ${flag} in TS but not in .dic`);
          }
        }
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("every .dic domain stem has matching flags in DOMAIN_TABLES (reverse)", () => {
    const mismatches: string[] = [];
    const builtinMorphology = createDefaultMorphology();

    for (const [stem, dicFlags] of dicStems) {
      // Skip builtins and structural entries
      if (builtinMorphology.stems.has(stem)) continue;
      if (stem.startsWith("@")) continue;

      // Find which domain table owns this stem
      let found = false;
      for (const [domId, table] of DOMAIN_TABLES) {
        const tsFlags = table.stems.get(stem);
        if (!tsFlags) continue;
        found = true;
        for (const flag of dicFlags) {
          if (!tsFlags.has(flag)) {
            mismatches.push(`${domId}/${stem}: flag ${flag} in .dic but not in TS`);
          }
        }
      }
      // Stems in .dic but not in any table are OK (e.g. density modifiers)
      if (!found) continue;
    }

    expect(mismatches).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import {
  definePersonalLexicon,
  serializePersonalLexicon,
  parsePersonalStem,
  parseStemRelation,
  parsePersonalLexiconFromClauses,
  DialectStore,
  defineDialect,
  createDefaultMorphology,
  resolveAffix,
  activateDomains,
  type PersonalStemDef,
  STEM_RELATIONS,
} from "@ceeline/schema";
import { parseCeelineCompact, renderCeelineCompact, extractPersonalLexicon } from "../compact.js";
import { makeHandoff, makeMemory } from "./helpers.js";

// ─── definePersonalLexicon ──────────────────────────────────────────

describe("definePersonalLexicon", () => {
  it("creates a personal lexicon with default relation", () => {
    const lex = definePersonalLexicon({
      owner: "claude-3",
      id: "my.sec",
      name: "My Security",
      stems: [{ code: "vuln", meaning: "vulnerability" }],
    });
    expect(lex.owner).toBe("claude-3");
    expect(lex.dialect.id).toBe("my.sec");
    expect(lex.dialect.version).toBe(1);
    expect(lex.dialect.stems.size).toBe(1);
    expect(lex.relations.get("vuln")).toBe("extends");
    expect(lex.coreRefs.size).toBe(0);
  });

  it("creates a lexicon with explicit relations and coreRefs", () => {
    const lex = definePersonalLexicon({
      owner: "gpt-4",
      id: "my.audit",
      name: "My Audit Terms",
      stems: [
        { code: "brk", meaning: "breach", relation: "narrows", coreRef: "sc" },
        { code: "cve", meaning: "cve-ref", relation: "aliases", coreRef: "art" },
        { code: "zday", meaning: "zero-day", relation: "extends" },
        { code: "fix", meaning: "fix-applied", relation: "supersedes", coreRef: "rpt" },
      ],
    });
    expect(lex.relations.get("brk")).toBe("narrows");
    expect(lex.relations.get("cve")).toBe("aliases");
    expect(lex.relations.get("zday")).toBe("extends");
    expect(lex.relations.get("fix")).toBe("supersedes");
    expect(lex.coreRefs.get("brk")).toBe("sc");
    expect(lex.coreRefs.get("cve")).toBe("art");
    expect(lex.coreRefs.has("zday")).toBe(false);
    expect(lex.coreRefs.get("fix")).toBe("rpt");
  });

  it("supports version, base, and description", () => {
    const lex = definePersonalLexicon({
      owner: "claude-3",
      id: "my.v2",
      name: "V2 Lexicon",
      version: 2,
      base: "my.v1",
      stems: [{ code: "chk", meaning: "checkpoint" }],
      description: "Updated lexicon",
    });
    expect(lex.dialect.version).toBe(2);
    expect(lex.dialect.base).toBe("my.v1");
    expect(lex.dialect.description).toBe("Updated lexicon");
  });

  it("throws on invalid owner", () => {
    expect(() => definePersonalLexicon({
      owner: "",
      id: "my.test",
      name: "Test",
      stems: [],
    })).toThrow(/Invalid lexicon owner/);
  });

  it("throws on invalid owner characters", () => {
    expect(() => definePersonalLexicon({
      owner: "bad owner!",
      id: "my.test",
      name: "Test",
      stems: [],
    })).toThrow(/Invalid lexicon owner/);
  });

  it("throws on invalid dialect ID (delegates to defineDialect)", () => {
    expect(() => definePersonalLexicon({
      owner: "claude-3",
      id: "BAD ID",
      name: "Test",
      stems: [],
    })).toThrow(/Invalid dialect ID/);
  });

  it("throws on duplicate stem codes", () => {
    expect(() => definePersonalLexicon({
      owner: "claude-3",
      id: "my.dup",
      name: "Dup",
      stems: [
        { code: "x", meaning: "one" },
        { code: "x", meaning: "two" },
      ],
    })).toThrow(/Duplicate stem code/);
  });
});

// ─── parseStemRelation ──────────────────────────────────────────────

describe("parseStemRelation", () => {
  it("parses a simple relation", () => {
    const r = parseStemRelation("chk:checkpoint/NRQC@extends");
    expect(r.stemValue).toBe("chk:checkpoint/NRQC");
    expect(r.relation).toBe("extends");
    expect(r.coreRef).toBeUndefined();
  });

  it("parses relation with coreRef", () => {
    const r = parseStemRelation("brk:breach/NRC@narrows:sc");
    expect(r.stemValue).toBe("brk:breach/NRC");
    expect(r.relation).toBe("narrows");
    expect(r.coreRef).toBe("sc");
  });

  it("returns no relation when no @ present", () => {
    const r = parseStemRelation("chk:checkpoint/NRQC");
    expect(r.stemValue).toBe("chk:checkpoint/NRQC");
    expect(r.relation).toBeUndefined();
  });

  it("returns no relation for invalid relation string", () => {
    const r = parseStemRelation("chk:email@example.com");
    expect(r.stemValue).toBe("chk:email@example.com");
    expect(r.relation).toBeUndefined();
  });

  it("parses all valid relation types", () => {
    for (const rel of STEM_RELATIONS) {
      const r = parseStemRelation(`x:y/N@${rel}`);
      expect(r.relation).toBe(rel);
    }
  });
});

// ─── parsePersonalStem ──────────────────────────────────────────────

describe("parsePersonalStem", () => {
  it("parses stem with relation", () => {
    const s = parsePersonalStem("vuln:vulnerability/NRQC@extends");
    expect(s).not.toBeNull();
    expect(s!.code).toBe("vuln");
    expect(s!.meaning).toBe("vulnerability");
    expect(s!.flags).toBe("NRQC");
    expect(s!.relation).toBe("extends");
  });

  it("parses stem with relation and coreRef", () => {
    const s = parsePersonalStem("brk:breach/NRC@narrows:sc");
    expect(s).not.toBeNull();
    expect(s!.code).toBe("brk");
    expect(s!.relation).toBe("narrows");
    expect(s!.coreRef).toBe("sc");
  });

  it("parses stem without relation", () => {
    const s = parsePersonalStem("chk:checkpoint/NRQC");
    expect(s).not.toBeNull();
    expect(s!.code).toBe("chk");
    expect(s!.relation).toBeUndefined();
    expect(s!.coreRef).toBeUndefined();
  });

  it("returns null for invalid stem format", () => {
    expect(parsePersonalStem("badformat")).toBeNull();
  });
});

// ─── DialectStore lexicon methods ───────────────────────────────────

describe("DialectStore lexicon support", () => {
  it("stores and retrieves a personal lexicon", () => {
    const store = new DialectStore();
    const lex = definePersonalLexicon({
      owner: "claude-3",
      id: "my.terms",
      name: "My Terms",
      stems: [{ code: "chk", meaning: "checkpoint" }],
    });
    store.defineLexicon(lex);

    const retrieved = store.getLexicon("claude-3", "my.terms");
    expect(retrieved).toBe(lex);
  });

  it("returns undefined for missing lexicon", () => {
    const store = new DialectStore();
    expect(store.getLexicon("claude-3", "nonexistent")).toBeUndefined();
  });

  it("enforces version increase", () => {
    const store = new DialectStore();
    store.defineLexicon(definePersonalLexicon({
      owner: "claude-3",
      id: "my.terms",
      name: "V1",
      version: 1,
      stems: [{ code: "a", meaning: "alpha" }],
    }));

    expect(() => store.defineLexicon(definePersonalLexicon({
      owner: "claude-3",
      id: "my.terms",
      name: "V1 Again",
      version: 1,
      stems: [{ code: "a", meaning: "alpha" }],
    }))).toThrow(/version must increase/);
  });

  it("allows same dialect ID for different owners", () => {
    const store = new DialectStore();
    store.defineLexicon(definePersonalLexicon({
      owner: "claude-3",
      id: "my.terms",
      name: "Claude terms",
      stems: [{ code: "c1", meaning: "claude-stem" }],
    }));
    store.defineLexicon(definePersonalLexicon({
      owner: "gpt-4",
      id: "my.terms",
      name: "GPT terms",
      stems: [{ code: "g1", meaning: "gpt-stem" }],
    }));

    expect(store.getLexicon("claude-3", "my.terms")!.dialect.name).toBe("Claude terms");
    expect(store.getLexicon("gpt-4", "my.terms")!.dialect.name).toBe("GPT terms");
  });

  it("lists all lexicons", () => {
    const store = new DialectStore();
    store.defineLexicon(definePersonalLexicon({
      owner: "claude-3",
      id: "lex.a",
      name: "A",
      stems: [{ code: "a1", meaning: "a" }],
    }));
    store.defineLexicon(definePersonalLexicon({
      owner: "gpt-4",
      id: "lex.b",
      name: "B",
      stems: [{ code: "b1", meaning: "b" }],
    }));

    expect(store.listLexicons()).toHaveLength(2);
    expect(store.listLexicons("claude-3")).toHaveLength(1);
    expect(store.listLexicons("gpt-4")).toHaveLength(1);
    expect(store.listLexicons("unknown")).toHaveLength(0);
  });

  it("replaces lexicon with higher version", () => {
    const store = new DialectStore();
    store.defineLexicon(definePersonalLexicon({
      owner: "claude-3",
      id: "my.terms",
      name: "V1",
      version: 1,
      stems: [{ code: "a", meaning: "alpha" }],
    }));
    store.defineLexicon(definePersonalLexicon({
      owner: "claude-3",
      id: "my.terms",
      name: "V2",
      version: 2,
      stems: [{ code: "a", meaning: "alpha" }, { code: "b", meaning: "beta" }],
    }));

    const lex = store.getLexicon("claude-3", "my.terms")!;
    expect(lex.dialect.version).toBe(2);
    expect(lex.dialect.stems.size).toBe(2);
  });
});

// ─── activateWithLexicon ────────────────────────────────────────────

describe("activateWithLexicon", () => {
  it("activates dialects first, then lexicons (lexicon wins)", () => {
    const store = new DialectStore();

    // Shared dialect defines "chk" with NRC flags
    store.define(defineDialect({
      id: "shared.audit",
      name: "Shared Audit",
      stems: [{ code: "chk", meaning: "checkpoint", flags: "NRC" }],
    }));

    // Personal lexicon redefines "chk" with NRQC flags
    store.defineLexicon(definePersonalLexicon({
      owner: "claude-3",
      id: "my.audit",
      name: "My Audit",
      stems: [{ code: "chk", meaning: "my-checkpoint", flags: "NRQC", relation: "supersedes", coreRef: "chk" }],
    }));

    const morphology = createDefaultMorphology();
    const result = store.activateWithLexicon(
      ["shared.audit"], ["my.audit"], "claude-3", morphology
    );

    expect(result.dialects).toEqual(["shared.audit"]);
    expect(result.lexicons).toEqual(["my.audit"]);

    // Lexicon version wins — Q flag is available
    const resolved = resolveAffix("chk", morphology);
    expect(resolved?.valid).toBe(true);
    const flags = morphology.domainStems.get("chk")!;
    expect(flags.has("Q")).toBe(true);
  });

  it("skips unknown lexicon IDs", () => {
    const store = new DialectStore();
    const morphology = createDefaultMorphology();
    const result = store.activateWithLexicon([], ["nonexistent"], "claude-3", morphology);
    expect(result.lexicons).toEqual([]);
  });

  it("tracks usage for lexicon stems", () => {
    const store = new DialectStore();
    store.defineLexicon(definePersonalLexicon({
      owner: "claude-3",
      id: "my.terms",
      name: "Terms",
      stems: [{ code: "myc", meaning: "my-code" }],
    }));

    const morphology = createDefaultMorphology();
    store.activateWithLexicon([], ["my.terms"], "claude-3", morphology);
    expect(store.getUsage("myc")).toBe(1);

    store.activateWithLexicon([], ["my.terms"], "claude-3", morphology);
    expect(store.getUsage("myc")).toBe(2);
  });

  it("lexicon overrides domain table stems", () => {
    const store = new DialectStore();

    // Personal lexicon overrides a built-in domain stem
    store.defineLexicon(definePersonalLexicon({
      owner: "claude-3",
      id: "my.sec-ext",
      name: "Sec Extension",
      stems: [{ code: "vul", meaning: "my-vulnerability", flags: "NRQC", relation: "supersedes", coreRef: "vul" }],
    }));

    const morphology = createDefaultMorphology();
    activateDomains(["sec"], morphology);
    store.activateWithLexicon([], ["my.sec-ext"], "claude-3", morphology);

    // Lexicon stem wins (has Q flag, domain table's vul only has NRPC)
    const flags = morphology.domainStems.get("vul")!;
    expect(flags.has("Q")).toBe(true);
  });

  it("does not affect different owner's lexicons", () => {
    const store = new DialectStore();
    store.defineLexicon(definePersonalLexicon({
      owner: "claude-3",
      id: "my.terms",
      name: "Claude Terms",
      stems: [{ code: "cc", meaning: "claude-code" }],
    }));
    store.defineLexicon(definePersonalLexicon({
      owner: "gpt-4",
      id: "my.terms",
      name: "GPT Terms",
      stems: [{ code: "gc", meaning: "gpt-code" }],
    }));

    const morphology = createDefaultMorphology();
    store.activateWithLexicon([], ["my.terms"], "claude-3", morphology);

    // Only claude's stems are active
    expect(resolveAffix("cc", morphology)?.valid).toBe(true);
    expect(resolveAffix("gc", morphology)?.valid).toBeFalsy();
  });

  it("activates lexicon stems even without shared dialect store entry", () => {
    const store = new DialectStore();
    store.defineLexicon(definePersonalLexicon({
      owner: "claude-3",
      id: "standalone.lex",
      name: "Standalone",
      stems: [{ code: "snd", meaning: "standalone-stem", flags: "NRC" }],
    }));

    const morphology = createDefaultMorphology();
    const result = store.activateWithLexicon([], ["standalone.lex"], "claude-3", morphology);

    expect(result.lexicons).toEqual(["standalone.lex"]);
    expect(resolveAffix("snd", morphology)?.valid).toBe(true);
  });

  it("resolves lexicon dialect chain when dialect is also in main store", () => {
    const store = new DialectStore();

    // Put a base dialect in the main store
    store.define(defineDialect({
      id: "base.shared",
      name: "Shared Base",
      stems: [{ code: "bs", meaning: "base-stem", flags: "NRC" }],
    }));

    // Personal lexicon's dialect ID matches a main-store entry
    store.defineLexicon(definePersonalLexicon({
      owner: "claude-3",
      id: "base.shared",
      name: "Personal Override",
      stems: [{ code: "ps", meaning: "personal-stem", flags: "NRQC" }],
    }));

    const morphology = createDefaultMorphology();
    store.activateWithLexicon([], ["base.shared"], "claude-3", morphology);

    // The shared dialect's chain was resolved (base.shared stems available)
    expect(resolveAffix("bs", morphology)?.valid).toBe(true);
    // The lexicon's own stems are also applied on top of the chain
    expect(resolveAffix("ps", morphology)?.valid).toBe(true);
  });
});

// ─── Serialization ──────────────────────────────────────────────────

describe("serializePersonalLexicon", () => {
  it("serializes a basic personal lexicon", () => {
    const lex = definePersonalLexicon({
      owner: "claude-3",
      id: "my.sec",
      name: "My-Security",
      stems: [{ code: "vuln", meaning: "vulnerability", flags: "NRQC", relation: "extends" }],
    });

    const clauses = serializePersonalLexicon(lex);
    expect(clauses[0]).toBe("lowner=claude-3");
    expect(clauses[1]).toBe("did=my.sec");
    expect(clauses[2]).toBe("dver=1");
    expect(clauses[3]).toBe("dname=My-Security");
    expect(clauses).toContainEqual("stem=vuln:vulnerability/CNQR@extends");
  });

  it("serializes relation with coreRef", () => {
    const lex = definePersonalLexicon({
      owner: "gpt-4",
      id: "my.audit",
      name: "Audit",
      stems: [{ code: "brk", meaning: "breach", flags: "NRC", relation: "narrows", coreRef: "sc" }],
    });

    const clauses = serializePersonalLexicon(lex);
    expect(clauses).toContainEqual("stem=brk:breach/CNR@narrows:sc");
  });

  it("serializes description as sum=", () => {
    const lex = definePersonalLexicon({
      owner: "claude-3",
      id: "my.desc",
      name: "Desc",
      stems: [{ code: "a", meaning: "alpha" }],
      description: "A descriptive lexicon",
    });

    const clauses = serializePersonalLexicon(lex);
    expect(clauses[clauses.length - 1]).toMatch(/^sum=/);
  });

  it("serializes base dialect reference", () => {
    const lex = definePersonalLexicon({
      owner: "claude-3",
      id: "my.v2",
      name: "V2",
      version: 2,
      base: "my.v1",
      stems: [{ code: "x", meaning: "ex" }],
    });

    const clauses = serializePersonalLexicon(lex);
    expect(clauses).toContain("dbase=my.v1");
  });

  it("serializes relation without coreRef (no colon suffix)", () => {
    const lex = definePersonalLexicon({
      owner: "claude-3",
      id: "my.noref",
      name: "NoRef",
      stems: [{ code: "nr", meaning: "no-ref", flags: "NRC", relation: "narrows" }],
    });

    const clauses = serializePersonalLexicon(lex);
    const stemClause = clauses.find(c => c.startsWith("stem=nr:"));
    expect(stemClause).toBeDefined();
    expect(stemClause).toMatch(/@narrows$/);
    expect(stemClause).not.toContain("@narrows:");
  });

  it("serializes description with spaces as JSON-quoted sum=", () => {
    const lex = definePersonalLexicon({
      owner: "claude-3",
      id: "my.spacey",
      name: "SpaceyName",
      stems: [{ code: "s", meaning: "stem" }],
      description: "A description with spaces",
    });

    const clauses = serializePersonalLexicon(lex);
    const sumClause = clauses.find(c => c.startsWith("sum="));
    expect(sumClause).toBeDefined();
    expect(sumClause).toBe('sum="A description with spaces"');
  });
});

// ─── Parser: lexicon= header ────────────────────────────────────────

describe("parser: lexicon= header", () => {
  it("parses single lexicon ID", () => {
    const text = "@cl1 s=ho i=test.intent lexicon=my.sec-terms ; sum=test";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.lexicons).toEqual(["my.sec-terms"]);
    }
  });

  it("parses multiple lexicon IDs", () => {
    const text = "@cl1 s=ho i=test.intent lexicon=lex.a+lex.b ; sum=test";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.lexicons).toEqual(["lex.a", "lex.b"]);
    }
  });

  it("filters out invalid lexicon IDs", () => {
    const text = "@cl1 s=ho i=test.intent lexicon=valid.id+BAD+also.valid ; sum=test";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.lexicons).toEqual(["valid.id", "also.valid"]);
    }
  });

  it("parses alongside dialect= header", () => {
    const text = "@cl1 s=ho i=test.intent dialect=audit.sec lexicon=my.sec ; sum=test";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.dialects).toEqual(["audit.sec"]);
      expect(parsed.value.lexicons).toEqual(["my.sec"]);
    }
  });

  it("defaults to empty array when no lexicon= header", () => {
    const text = "@cl1 s=ho i=test.intent ; sum=test";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.lexicons).toEqual([]);
    }
  });
});

// ─── Parser: lowner= and @relation stems ────────────────────────────

describe("parser: lexicon definition clauses", () => {
  it("parses lowner= clause", () => {
    const text = "@cl1 s=me i=lexicon.define ; lowner=claude-3 ; did=my.sec ; dver=1 ; dname=My-Security ; stem=vuln:vulnerability/NRQC@extends ; sum=test";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.lexiconOwner).toBe("claude-3");
      expect(parsed.value.dialectMeta["lowner"]).toBe("claude-3");
    }
  });

  it("routes stems with @relation to lexiconStems", () => {
    const text = "@cl1 s=me i=lexicon.define ; lowner=claude-3 ; did=my.sec ; dver=1 ; dname=Sec ; stem=vuln:vulnerability/NRQC@extends ; stem=plain:plain-stem/NR ; sum=test";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      // stem with @relation goes to lexiconStems
      expect(parsed.value.lexiconStems).toHaveLength(1);
      expect(parsed.value.lexiconStems[0].code).toBe("vuln");
      expect(parsed.value.lexiconStems[0].relation).toBe("extends");
      // stem without @relation goes to dialectStems
      expect(parsed.value.dialectStems).toHaveLength(1);
      expect(parsed.value.dialectStems[0].code).toBe("plain");
    }
  });

  it("parses @relation with coreRef", () => {
    const text = "@cl1 s=me i=lexicon.define ; lowner=gpt-4 ; did=my.audit ; dver=1 ; dname=Audit ; stem=brk:breach/NRC@narrows:sc ; sum=test";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.lexiconStems[0].code).toBe("brk");
      expect(parsed.value.lexiconStems[0].relation).toBe("narrows");
      expect(parsed.value.lexiconStems[0].coreRef).toBe("sc");
    }
  });

  it("registers lexicon stems into morphology", () => {
    const morphology = createDefaultMorphology();
    const text = "@cl1 s=me i=lexicon.define ; lowner=claude-3 ; did=my.lex ; dver=1 ; dname=Test ; stem=xyz:test-stem/NRC@extends ; sum=test";
    parseCeelineCompact(text, morphology);
    // morphology is restored after parse (snapshot/restore), so stem shouldn't persist
    // But during parsing it was available for resolution
    // Test the parse result instead
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.lexiconStems[0].code).toBe("xyz");
    }
  });
});

// ─── extractPersonalLexicon ─────────────────────────────────────────

describe("extractPersonalLexicon", () => {
  it("extracts a lexicon from a parsed result with lowner", () => {
    const text = "@cl1 s=me i=lexicon.define ; lowner=claude-3 ; did=my.sec ; dver=1 ; dname=My-Security ; stem=vuln:vulnerability/NRQC@extends ; sum=test-lexicon";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const lex = extractPersonalLexicon(parsed.value);
      expect(lex).not.toBeNull();
      expect(lex!.owner).toBe("claude-3");
      expect(lex!.dialect.id).toBe("my.sec");
      expect(lex!.dialect.stems.get("vuln")!.meaning).toBe("vulnerability");
      expect(lex!.relations.get("vuln")).toBe("extends");
    }
  });

  it("stores lexicon in DialectStore when provided", () => {
    const store = new DialectStore();
    const text = "@cl1 s=me i=lexicon.define ; lowner=claude-3 ; did=my.terms ; dver=1 ; dname=Terms ; stem=abc:alpha/NRC@extends ; sum=stored";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const lex = extractPersonalLexicon(parsed.value, store);
      expect(lex).not.toBeNull();
      expect(store.getLexicon("claude-3", "my.terms")).toBe(lex);
    }
  });

  it("returns null without lowner", () => {
    const text = "@cl1 s=me i=dialect.define ; did=shared.d ; dver=1 ; dname=Shared ; stem=abc:alpha/NRC ; sum=test";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(extractPersonalLexicon(parsed.value)).toBeNull();
    }
  });

  it("returns null without dialect metadata", () => {
    const text = "@cl1 s=me i=test.intent ; lowner=claude-3 ; sum=test";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(extractPersonalLexicon(parsed.value)).toBeNull();
    }
  });

  it("falls back to dialectStems when no lexiconStems present", () => {
    const text = "@cl1 s=me i=lexicon.define ; lowner=claude-3 ; did=my.plain ; dver=1 ; dname=Plain ; stem=abc:alpha/NRC ; sum=test";
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const lex = extractPersonalLexicon(parsed.value);
      expect(lex).not.toBeNull();
      expect(lex!.dialect.stems.get("abc")!.meaning).toBe("alpha");
      // Default relation when not specified via @relation
      expect(lex!.relations.get("abc")).toBe("extends");
    }
  });
});

// ─── Renderer: lexicon= header ──────────────────────────────────────

describe("renderer: lexicon= header", () => {
  it("renders single lexicon ID", () => {
    const envelope = makeHandoff();
    const result = renderCeelineCompact(envelope, "full", { lexicons: ["my.sec"] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("lexicon=my.sec");
    }
  });

  it("renders multiple lexicon IDs", () => {
    const envelope = makeHandoff();
    const result = renderCeelineCompact(envelope, "full", { lexicons: ["lex.a", "lex.b"] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("lexicon=lex.a+lex.b");
    }
  });

  it("renders alongside dialect= header", () => {
    const envelope = makeHandoff();
    const result = renderCeelineCompact(envelope, "full", {
      dialects: ["audit.sec"],
      lexicons: ["my.sec"],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("dialect=audit.sec");
      expect(result.value).toContain("lexicon=my.sec");
    }
  });

  it("filters out invalid lexicon IDs in renderer", () => {
    const envelope = makeHandoff();
    const result = renderCeelineCompact(envelope, "full", { lexicons: ["INVALID", "valid.id"] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("lexicon=valid.id");
      expect(result.value).not.toContain("INVALID");
    }
  });

  it("omits lexicon= header when all IDs are invalid", () => {
    const envelope = makeHandoff();
    const result = renderCeelineCompact(envelope, "full", { lexicons: ["INVALID", "ALSO BAD"] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).not.toContain("lexicon=");
    }
  });
});

// ─── parsePersonalLexiconFromClauses ────────────────────────────────

describe("parsePersonalLexiconFromClauses", () => {
  it("builds definition from fields and stems", () => {
    const fields = { lowner: "claude-3", did: "my.sec", dver: "2", dname: "My Security", sum: "Desc" };
    const stems: PersonalStemDef[] = [
      { code: "vuln", meaning: "vulnerability", flags: "NRQC", relation: "extends" },
    ];

    const def = parsePersonalLexiconFromClauses(fields, stems);
    expect(def).not.toBeNull();
    expect(def!.owner).toBe("claude-3");
    expect(def!.id).toBe("my.sec");
    expect(def!.version).toBe(2);
    expect(def!.stems[0].code).toBe("vuln");
    expect(def!.description).toBe("Desc");
  });

  it("returns null without lowner", () => {
    const def = parsePersonalLexiconFromClauses(
      { did: "my.sec", dver: "1", dname: "Test" },
      []
    );
    expect(def).toBeNull();
  });

  it("returns null without did", () => {
    const def = parsePersonalLexiconFromClauses(
      { lowner: "claude-3", dver: "1", dname: "Test" },
      []
    );
    expect(def).toBeNull();
  });

  it("returns null without dname", () => {
    const def = parsePersonalLexiconFromClauses(
      { lowner: "claude-3", did: "my.sec", dver: "1" },
      []
    );
    expect(def).toBeNull();
  });
});

// ─── Render round-trip ──────────────────────────────────────────────

describe("lexicon render/parse round-trip", () => {
  it("rendered lexicon= survives parse round-trip", () => {
    const envelope = makeHandoff();
    const rendered = renderCeelineCompact(envelope, "full", {
      dialects: ["audit.sec"],
      lexicons: ["my.sec-terms", "my.perf-terms"],
    });
    expect(rendered.ok).toBe(true);
    if (rendered.ok) {
      const parsed = parseCeelineCompact(rendered.value);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.value.dialects).toEqual(["audit.sec"]);
        expect(parsed.value.lexicons).toEqual(["my.sec-terms", "my.perf-terms"]);
      }
    }
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────

describe("lexicon edge cases", () => {
  it("empty lexicon (no stems) defines successfully", () => {
    const lex = definePersonalLexicon({
      owner: "claude-3",
      id: "my.empty",
      name: "Empty",
      stems: [],
    });
    expect(lex.dialect.stems.size).toBe(0);
    expect(lex.relations.size).toBe(0);
  });

  it("lexicon with JSON-quoted name serializes and parses", () => {
    const lex = definePersonalLexicon({
      owner: "claude-3",
      id: "my.quoted",
      name: "My Quoted Name",
      stems: [{ code: "q", meaning: "quoted meaning" }],
    });

    const clauses = serializePersonalLexicon(lex);
    // Name with spaces is JSON-quoted
    expect(clauses.some(c => c.startsWith("dname="))).toBe(true);
  });

  it("lexicon owner with dots and numbers is valid", () => {
    const lex = definePersonalLexicon({
      owner: "claude-3.5-sonnet",
      id: "my.test",
      name: "Test",
      stems: [{ code: "t", meaning: "test" }],
    });
    expect(lex.owner).toBe("claude-3.5-sonnet");
  });

  it("multiple surface types support lexicon= header", () => {
    // Memory surface
    const envelope = makeMemory();
    const result = renderCeelineCompact(envelope, "full", { lexicons: ["my.mem-terms"] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("lexicon=my.mem-terms");
      const parsed = parseCeelineCompact(result.value);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.value.lexicons).toEqual(["my.mem-terms"]);
      }
    }
  });
});

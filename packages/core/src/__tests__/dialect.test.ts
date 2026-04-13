import { describe, it, expect } from "vitest";
import {
  defineDialect,
  DialectStore,
  applyDialect,
  serializeDialect,
  serializeDialectStem,
  parseDialectStem,
  parseDialectFromClauses,
  createDefaultMorphology,
  resolveAffix,
  activateDomains,
  type DialectStemDef,
} from "@asafelobotomy/ceeline-schema";
import { parseCeelineCompact, renderCeelineCompact, extractDialect } from "../compact.js";
import { makeHandoff } from "./helpers.js";

// ─── defineDialect ──────────────────────────────────────────────────

describe("defineDialect", () => {
  it("creates a dialect with default flags when none specified", () => {
    const d = defineDialect({
      id: "test.basic",
      name: "Basic Test Dialect",
      stems: [{ code: "chk", meaning: "checkpoint" }],
    });
    expect(d.id).toBe("test.basic");
    expect(d.version).toBe(1);
    expect(d.stems.size).toBe(1);
    const stem = d.stems.get("chk")!;
    expect(stem.meaning).toBe("checkpoint");
    // Default flags = all
    expect(stem.flags.has("N")).toBe(true);
    expect(stem.flags.has("Q")).toBe(true);
  });

  it("creates a dialect with explicit flags", () => {
    const d = defineDialect({
      id: "test.explicit",
      name: "Explicit Flags",
      stems: [{ code: "swp", meaning: "sweep", flags: "NRQC" }],
    });
    const stem = d.stems.get("swp")!;
    expect(stem.flags.has("N")).toBe(true);
    expect(stem.flags.has("R")).toBe(true);
    expect(stem.flags.has("Q")).toBe(true);
    expect(stem.flags.has("C")).toBe(true);
    expect(stem.flags.has("T")).toBe(false);
  });

  it("supports version, base, and description", () => {
    const d = defineDialect({
      id: "test.v2",
      name: "V2 Dialect",
      version: 2,
      base: "test.v1",
      stems: [{ code: "fix", meaning: "fix_applied", flags: "NRQC" }],
      description: "Extended with fix tracking",
    });
    expect(d.version).toBe(2);
    expect(d.base).toBe("test.v1");
    expect(d.description).toBe("Extended with fix tracking");
  });

  it("rejects invalid dialect ID", () => {
    expect(() => defineDialect({
      id: "UPPER",
      name: "Bad",
      stems: [],
    })).toThrow("Invalid dialect ID");
  });

  it("rejects ID starting with number", () => {
    expect(() => defineDialect({
      id: "1bad",
      name: "Bad",
      stems: [],
    })).toThrow("Invalid dialect ID");
  });

  it("rejects duplicate stem codes", () => {
    expect(() => defineDialect({
      id: "test.dup",
      name: "Dup",
      stems: [
        { code: "chk", meaning: "checkpoint" },
        { code: "chk", meaning: "check" },
      ],
    })).toThrow('Duplicate stem code "chk"');
  });
});

// ─── applyDialect ───────────────────────────────────────────────────

describe("applyDialect", () => {
  it("merges dialect stems into morphology.domainStems", () => {
    const morphology = createDefaultMorphology();
    const d = defineDialect({
      id: "test.apply",
      name: "Apply Test",
      stems: [{ code: "chk", meaning: "checkpoint", flags: "NRQC" }],
    });
    applyDialect(d, morphology);
    expect(morphology.domainStems.has("chk")).toBe(true);
    expect(morphology.domainStems.get("chk")!.has("N")).toBe(true);
  });

  it("dialect stems participate in affix resolution", () => {
    const morphology = createDefaultMorphology();
    const d = defineDialect({
      id: "test.affix",
      name: "Affix Test",
      stems: [{ code: "chk", meaning: "checkpoint", flags: "NRQC" }],
    });
    applyDialect(d, morphology);

    // Bare stem
    const bare = resolveAffix("chk", morphology);
    expect(bare).not.toBeNull();
    expect(bare!.valid).toBe(true);
    expect(bare!.stem).toBe("chk");

    // Prefixed
    const neg = resolveAffix("neg.chk", morphology);
    expect(neg).not.toBeNull();
    expect(neg!.valid).toBe(true);
    expect(neg!.prefix!.name).toBe("neg");

    // Suffixed
    const seq = resolveAffix("chk.seq", morphology);
    expect(seq).not.toBeNull();
    expect(seq!.valid).toBe(true);
    expect(seq!.suffix!.name).toBe("seq");

    // Cross-product
    const both = resolveAffix("re.chk.seq", morphology);
    expect(both).not.toBeNull();
    expect(both!.valid).toBe(true);
    expect(both!.prefix!.name).toBe("re");
    expect(both!.suffix!.name).toBe("seq");
  });

  it("rejects unsupported affix on dialect stem", () => {
    const morphology = createDefaultMorphology();
    const d = defineDialect({
      id: "test.limited",
      name: "Limited Flags",
      stems: [{ code: "chk", meaning: "checkpoint", flags: "QC" }],
    });
    applyDialect(d, morphology);

    // N flag not granted — neg.chk should be invalid
    const neg = resolveAffix("neg.chk", morphology);
    expect(neg).not.toBeNull();
    expect(neg!.valid).toBe(false);
  });
});

// ─── DialectStore ───────────────────────────────────────────────────

describe("DialectStore", () => {
  it("stores and retrieves a dialect", () => {
    const store = new DialectStore();
    const d = defineDialect({ id: "store.test", name: "Test", stems: [] });
    store.define(d);
    expect(store.get("store.test")).toBe(d);
  });

  it("lists all dialects", () => {
    const store = new DialectStore();
    store.define(defineDialect({ id: "a", name: "A", stems: [] }));
    store.define(defineDialect({ id: "b", name: "B", stems: [] }));
    expect(store.list()).toHaveLength(2);
  });

  it("rejects downgrade of version", () => {
    const store = new DialectStore();
    store.define(defineDialect({ id: "v", name: "V", version: 2, stems: [] }));
    expect(() =>
      store.define(defineDialect({ id: "v", name: "V", version: 1, stems: [] }))
    ).toThrow("version must increase");
  });

  it("rejects same version", () => {
    const store = new DialectStore();
    store.define(defineDialect({ id: "v", name: "V", version: 1, stems: [] }));
    expect(() =>
      store.define(defineDialect({ id: "v", name: "V", version: 1, stems: [] }))
    ).toThrow("version must increase");
  });

  it("allows version upgrade", () => {
    const store = new DialectStore();
    const v1 = defineDialect({ id: "v", name: "V", version: 1, stems: [] });
    const v2 = defineDialect({ id: "v", name: "V", version: 2, stems: [] });
    store.define(v1);
    store.define(v2);
    expect(store.get("v")).toBe(v2);
  });

  it("activates dialect stems into morphology", () => {
    const store = new DialectStore();
    const d = defineDialect({
      id: "store.activate",
      name: "Activate",
      stems: [{ code: "tst", meaning: "test_stem", flags: "NRC" }],
    });
    store.define(d);

    const morphology = createDefaultMorphology();
    const activated = store.activate(["store.activate"], morphology);
    expect(activated).toEqual(["store.activate"]);
    expect(morphology.domainStems.has("tst")).toBe(true);
  });

  it("skips unknown dialect IDs during activation", () => {
    const store = new DialectStore();
    const morphology = createDefaultMorphology();
    const activated = store.activate(["nonexistent"], morphology);
    expect(activated).toEqual([]);
  });

  it("tracks usage counts", () => {
    const store = new DialectStore();
    const d = defineDialect({
      id: "usage.test",
      name: "Usage",
      stems: [
        { code: "a1", meaning: "stem_a", flags: "C" },
        { code: "b1", meaning: "stem_b", flags: "C" },
      ],
    });
    store.define(d);

    const m = createDefaultMorphology();
    store.activate(["usage.test"], m);
    store.activate(["usage.test"], m);

    expect(store.getUsage("a1")).toBe(2);
    expect(store.getUsage("b1")).toBe(2);
    expect(store.getUsage("nonexistent")).toBe(0);
  });

  it("returns sorted usage report", () => {
    const store = new DialectStore();
    store.define(defineDialect({
      id: "r1", name: "R1",
      stems: [{ code: "lo", meaning: "low", flags: "C" }],
    }));
    store.define(defineDialect({
      id: "r2", name: "R2",
      stems: [{ code: "hi", meaning: "high", flags: "C" }],
    }));

    const m = createDefaultMorphology();
    store.activate(["r1"], m);
    store.activate(["r2"], m);
    store.activate(["r2"], m);

    const report = store.getUsageReport();
    expect(report[0].code).toBe("hi");
    expect(report[0].count).toBe(2);
    expect(report[1].code).toBe("lo");
    expect(report[1].count).toBe(1);
  });

  it("resolves dialect inheritance chain", () => {
    const store = new DialectStore();
    store.define(defineDialect({
      id: "base",
      name: "Base",
      stems: [{ code: "b1", meaning: "base_stem", flags: "NRC" }],
    }));
    store.define(defineDialect({
      id: "child",
      name: "Child",
      base: "base",
      stems: [{ code: "c1", meaning: "child_stem", flags: "NRC" }],
    }));

    const morphology = createDefaultMorphology();
    store.activate(["child"], morphology);

    // Both base and child stems should be present
    expect(morphology.domainStems.has("b1")).toBe(true);
    expect(morphology.domainStems.has("c1")).toBe(true);
  });

  it("handles circular inheritance gracefully", () => {
    const store = new DialectStore();
    // Create two dialects that reference each other (impossible through
    // normal define flow, but test the guard)
    store.define(defineDialect({
      id: "loop-a",
      name: "Loop A",
      base: "loop-b",
      stems: [{ code: "la", meaning: "loop_a", flags: "C" }],
    }));
    store.define(defineDialect({
      id: "loop-b",
      name: "Loop B",
      base: "loop-a",
      stems: [{ code: "lb", meaning: "loop_b", flags: "C" }],
    }));

    const morphology = createDefaultMorphology();
    const activated = store.activate(["loop-a"], morphology);
    expect(activated).toEqual(["loop-a"]);
    // Should have activated the portion of chain it could resolve
    expect(morphology.domainStems.has("la")).toBe(true);
  });
});

// ─── Serialization ──────────────────────────────────────────────────

describe("dialect serialization", () => {
  it("serializeDialectStem produces correct format", () => {
    const stem = { code: "chk", meaning: "checkpoint", flags: new Set(["N", "R", "Q", "C"]) };
    const s = serializeDialectStem(stem);
    expect(s).toBe("stem=chk:checkpoint/CNQR");
  });

  it("serializeDialectStem quotes meanings with special chars", () => {
    const stem = { code: "msg", meaning: "hello world", flags: new Set(["C"]) };
    const s = serializeDialectStem(stem);
    expect(s).toBe('stem=msg:"hello world"/C');
  });

  it("parseDialectStem parses code:meaning/FLAGS", () => {
    const parsed = parseDialectStem("chk:checkpoint/NRQC");
    expect(parsed).not.toBeNull();
    expect(parsed!.code).toBe("chk");
    expect(parsed!.meaning).toBe("checkpoint");
    expect(parsed!.flags).toBe("NRQC");
  });

  it("parseDialectStem defaults flags when missing", () => {
    const parsed = parseDialectStem("chk:checkpoint");
    expect(parsed).not.toBeNull();
    expect(parsed!.code).toBe("chk");
    expect(parsed!.meaning).toBe("checkpoint");
    expect(parsed!.flags).toBeUndefined();
  });

  it("parseDialectStem handles JSON-quoted meaning", () => {
    const parsed = parseDialectStem('msg:"hello world"/C');
    expect(parsed).not.toBeNull();
    expect(parsed!.meaning).toBe("hello world");
    expect(parsed!.flags).toBe("C");
  });

  it("parseDialectStem returns null for invalid format", () => {
    expect(parseDialectStem("invalid")).toBeNull();
    expect(parseDialectStem(":nope")).toBeNull();
    expect(parseDialectStem("")).toBeNull();
    // Empty meaning after colon
    expect(parseDialectStem("code:")).toBeNull();
  });

  it("parseDialectStem treats non-uppercase /part as part of meaning", () => {
    const parsed = parseDialectStem("url:http://example.com/path");
    expect(parsed).not.toBeNull();
    expect(parsed!.code).toBe("url");
    expect(parsed!.meaning).toBe("http://example.com/path");
    expect(parsed!.flags).toBeUndefined();
  });

  it("serializeDialect produces full clause set", () => {
    const d = defineDialect({
      id: "ser.test",
      name: "Serialization Test",
      version: 2,
      base: "ser.base",
      stems: [
        { code: "a1", meaning: "alpha", flags: "NRC" },
        { code: "b1", meaning: "beta", flags: "QC" },
      ],
      description: "Test dialect serialization",
    });
    const clauses = serializeDialect(d);
    expect(clauses).toContain("did=ser.test");
    expect(clauses).toContain("dver=2");
    expect(clauses).toContain("dbase=ser.base");
    expect(clauses.some(c => c.startsWith("stem=a1:"))).toBe(true);
    expect(clauses.some(c => c.startsWith("stem=b1:"))).toBe(true);
  });

  it("parseDialectFromClauses reconstructs definition", () => {
    const def = parseDialectFromClauses(
      { did: "from.clauses", dname: "From Clauses", dver: "3", dbase: "parent" },
      [
        { code: "x1", meaning: "stem_x", flags: "NRC" },
        { code: "y1", meaning: "stem_y" },
      ],
    );
    expect(def).not.toBeNull();
    expect(def!.id).toBe("from.clauses");
    expect(def!.name).toBe("From Clauses");
    expect(def!.version).toBe(3);
    expect(def!.base).toBe("parent");
    expect(def!.stems).toHaveLength(2);
  });

  it("parseDialectFromClauses returns null when ID missing", () => {
    expect(parseDialectFromClauses({ dname: "X" }, [])).toBeNull();
  });

  it("parseDialectFromClauses returns null when name missing", () => {
    expect(parseDialectFromClauses({ did: "x" }, [])).toBeNull();
  });

  it("serializeDialect uses bare atom for simple name (no quotes)", () => {
    const d = defineDialect({
      id: "bare.name",
      name: "BareSimpleName",
      stems: [],
      description: "BareDesc",
    });
    const clauses = serializeDialect(d);
    // Name with only BARE_ATOM chars should not be quoted
    expect(clauses).toContain("dname=BareSimpleName");
    expect(clauses).toContain("sum=BareDesc");
  });

  it("serializeDialect omits sum when no description", () => {
    const d = defineDialect({
      id: "no.desc",
      name: "NoDesc",
      stems: [],
    });
    const clauses = serializeDialect(d);
    expect(clauses).not.toContainEqual(expect.stringContaining("sum="));
  });

  it("serializeDialect quotes name with spaces", () => {
    const d = defineDialect({
      id: "quoted.name",
      name: "Has Spaces",
      stems: [],
      description: "Also Has Spaces",
    });
    const clauses = serializeDialect(d);
    expect(clauses).toContain('dname="Has Spaces"');
    expect(clauses).toContain('sum="Also Has Spaces"');
  });

  it("parseDialectFromClauses defaults version to 1 when invalid", () => {
    const def = parseDialectFromClauses(
      { did: "v", dname: "V", dver: "abc" }, []
    );
    expect(def!.version).toBe(1);
  });

  it("parseDialectFromClauses defaults version to 1 when absent", () => {
    const def = parseDialectFromClauses(
      { did: "v", dname: "V" }, []
    );
    expect(def!.version).toBe(1);
  });
});

// ─── Parser integration ─────────────────────────────────────────────

describe("compact parser: dialect support", () => {
  it("parses dialect= header key", () => {
    const text = '@cl1 s=ho i=test dialect=audit.sec-review ; sum="test" ; role=rv ; tgt=fx ; sc=a ; #n=0';
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.dialects).toEqual(["audit.sec-review"]);
  });

  it("parses multiple dialect= IDs with + separator", () => {
    const text = '@cl1 s=ho i=test dialect=one+two.sub ; sum="test" ; role=rv ; tgt=fx ; sc=a ; #n=0';
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.dialects).toEqual(["one", "two.sub"]);
  });

  it("filters invalid dialect IDs", () => {
    const text = '@cl1 s=ho i=test dialect=good+BAD+123bad ; sum="test" ; role=rv ; tgt=fx ; sc=a ; #n=0';
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.dialects).toEqual(["good"]);
  });

  it("parses stem= body clauses", () => {
    const text = '@cl1 s=me i=dialect.define ; did=test ; dver=1 ; dname="Test" ; stem=chk:checkpoint/NRQC ; stem=swp:sweep/QC ; sum="test" ; mk=fa ; dur=sn ; cit=none ; #n=0';
    const morphology = createDefaultMorphology();
    const parsed = parseCeelineCompact(text, morphology);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.dialectStems).toHaveLength(2);
    expect(parsed.value.dialectStems[0].code).toBe("chk");
    expect(parsed.value.dialectStems[0].meaning).toBe("checkpoint");
    expect(parsed.value.dialectStems[0].flags).toBe("NRQC");
  });

  it("parses stem= without morphology context", () => {
    const text = '@cl1 s=me i=dialect.define ; did=test ; dver=1 ; dname="Test" ; stem=chk:checkpoint/NRQC ; sum="test" ; mk=fa ; dur=sn ; cit=none ; #n=0';
    const parsed = parseCeelineCompact(text); // no morphology
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.dialectStems).toHaveLength(1);
    expect(parsed.value.dialectStems[0].code).toBe("chk");
  });

  it("parses stem= with default flags (no /FLAGS)", () => {
    const text = '@cl1 s=me i=dialect.define ; did=test ; dver=1 ; dname="Test" ; stem=chk:checkpoint ; sum="test" ; mk=fa ; dur=sn ; cit=none ; #n=0';
    const morphology = createDefaultMorphology();
    const parsed = parseCeelineCompact(text, morphology);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.dialectStems).toHaveLength(1);
    expect(parsed.value.dialectStems[0].code).toBe("chk");
    expect(parsed.value.dialectStems[0].meaning).toBe("checkpoint");
    expect(parsed.value.dialectStems[0].flags).toBeUndefined();
  });

  it("stem= stems register into live morphology", () => {
    const text = '@cl1 s=me i=dialect.define ; stem=chk:checkpoint/NRQC ; neg.chk=found ; sum="test" ; mk=fa ; dur=sn ; cit=none ; did=t ; dver=1 ; dname="T" ; #n=0';
    const morphology = createDefaultMorphology();
    const parsed = parseCeelineCompact(text, morphology);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    // neg.chk should have been resolved as a morphological code
    expect(parsed.value.surfaceFields["neg.chk"]).toBe("found");
  });

  it("reports invalid stem= format", () => {
    const text = '@cl1 s=ho i=test ; stem=bad_no_colon ; sum="test" ; role=rv ; tgt=fx ; sc=a ; #n=0';
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.dialectStems).toHaveLength(0);
  });

  it("parses did/dver/dname/dbase metadata", () => {
    const text = '@cl1 s=me i=dialect.define ; did=my.dialect ; dver=2 ; dname="My Dialect" ; dbase=parent.d ; sum="test" ; mk=fa ; dur=sn ; cit=none ; #n=0';
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.dialectMeta).toEqual({
      did: "my.dialect",
      dver: "2",
      dname: "My Dialect",
      dbase: "parent.d",
    });
  });
});

// ─── extractDialect ─────────────────────────────────────────────────

describe("extractDialect", () => {
  it("extracts dialect from parsed result with metadata and stems", () => {
    const text = '@cl1 s=me i=dialect.define ; did=extract.test ; dver=1 ; dname="Extract Test" ; stem=chk:checkpoint/NRQC ; stem=swp:sweep/QC ; sum="test" ; mk=fa ; dur=sn ; cit=none ; #n=0';
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const dialect = extractDialect(parsed.value);
    expect(dialect).not.toBeNull();
    expect(dialect!.id).toBe("extract.test");
    expect(dialect!.stems.size).toBe(2);
    expect(dialect!.stems.get("chk")!.meaning).toBe("checkpoint");
  });

  it("stores extracted dialect in DialectStore when provided", () => {
    const text = '@cl1 s=me i=dialect.define ; did=stored.test ; dver=1 ; dname="Stored" ; stem=a1:alpha/C ; sum="test" ; mk=fa ; dur=sn ; cit=none ; #n=0';
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const store = new DialectStore();
    const dialect = extractDialect(parsed.value, store);
    expect(dialect).not.toBeNull();
    expect(store.get("stored.test")).toBe(dialect);
  });

  it("returns null when no dialect metadata present", () => {
    const text = '@cl1 s=ho i=test ; sum="test" ; role=rv ; tgt=fx ; sc=a ; #n=0';
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const dialect = extractDialect(parsed.value);
    expect(dialect).toBeNull();
  });

  it("returns null when only did is present (no dname)", () => {
    const text = '@cl1 s=ho i=test ; did=partial ; sum="test" ; role=rv ; tgt=fx ; sc=a ; #n=0';
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const dialect = extractDialect(parsed.value);
    expect(dialect).toBeNull();
  });

  it("falls back through summary || dialectMeta.sum || empty string", () => {
    // Parse a valid dialect message
    const text = '@cl1 s=me i=dialect.define ; did=fb.test ; dver=2 ; dname="FallbackTest" ; stem=a1:alpha/C ; sum="from-sum" ; mk=fa ; dur=sn ; cit=none ; #n=0';
    const parsed = parseCeelineCompact(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    // Case 1: summary is truthy — uses it (default path)
    const d1 = extractDialect(parsed.value);
    expect(d1).not.toBeNull();
    expect(d1!.description).toBe("from-sum");

    // Case 2: clear summary, set dialectMeta.sum
    parsed.value.summary = "";
    parsed.value.dialectMeta["sum"] = "from-meta";
    const d2 = extractDialect({ ...parsed.value, summary: "" });
    expect(d2).not.toBeNull();
    expect(d2!.description).toBe("from-meta");

    // Case 3: both empty — falls to ""
    const d3 = extractDialect({
      ...parsed.value,
      summary: "",
      dialectMeta: { ...parsed.value.dialectMeta, sum: "" },
    });
    expect(d3).not.toBeNull();
    expect(d3!.description).toBe("");
  });
});

// ─── Renderer integration ───────────────────────────────────────────

describe("compact renderer: dialect support", () => {
  it("emits dialect= in header when dialects option provided", () => {
    const envelope = makeHandoff();
    const result = renderCeelineCompact(envelope, "full", { dialects: ["audit.sec-review"] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain("dialect=audit.sec-review");
  });

  it("emits multiple dialects with + separator", () => {
    const envelope = makeHandoff();
    const result = renderCeelineCompact(envelope, "full", { dialects: ["a.one", "b.two"] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain("dialect=a.one+b.two");
  });

  it("filters invalid dialect IDs in render options", () => {
    const envelope = makeHandoff();
    const result = renderCeelineCompact(envelope, "full", { dialects: ["good", "BAD"] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain("dialect=good");
    expect(result.value).not.toContain("BAD");
  });

  it("does not emit dialect= when dialects array is empty", () => {
    const envelope = makeHandoff();
    const result = renderCeelineCompact(envelope, "full", { dialects: [] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toContain("dialect=");
  });
  it("does not emit dialect= when all IDs are invalid", () => {
    const envelope = makeHandoff();
    const result = renderCeelineCompact(envelope, "full", { dialects: ["BAD", "123"] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toContain("dialect=");
  });
});

// ─── End-to-end: define → store → activate → use ────────────────────

describe("dialect evolution: end-to-end", () => {
  it("full lifecycle: define, store, activate, use with affixes", () => {
    const store = new DialectStore();

    // Step 1: LLM defines a dialect
    const defineText = [
      '@cl1 s=me i=dialect.define',
      'did=audit.code-review',
      'dver=1',
      'dname="Code Review Patterns"',
      'stem=chk:checkpoint/NRQC',
      'stem=swp:sweep/NRQC',
      'stem=grd:guard_clause/NRC',
      'sum="Vocabulary for systematic code review"',
      'mk=fa',
      'dur=pj',
      'cit=spec',
      '#n=0',
    ].join("\n");

    const parsed = parseCeelineCompact(defineText);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    // Step 2: Extract and store the dialect
    const dialect = extractDialect(parsed.value, store);
    expect(dialect).not.toBeNull();
    expect(store.get("audit.code-review")).toBeDefined();

    // Step 3: Use the dialect in a subsequent message
    const morphology = createDefaultMorphology();
    store.activate(["audit.code-review"], morphology);

    // Step 4: Verify stems resolve with affixes
    expect(resolveAffix("chk", morphology)?.valid).toBe(true);
    expect(resolveAffix("neg.chk", morphology)?.valid).toBe(true);
    expect(resolveAffix("chk.seq", morphology)?.valid).toBe(true);
    expect(resolveAffix("re.swp.seq", morphology)?.valid).toBe(true);
    expect(resolveAffix("neg.grd", morphology)?.valid).toBe(true);
    // grd doesn't have Q flag, so .seq should be invalid
    expect(resolveAffix("grd.seq", morphology)?.valid).toBe(false);
  });

  it("dialect evolution: v1 → v2 with new stems", () => {
    const store = new DialectStore();

    // v1
    store.define(defineDialect({
      id: "evolving",
      name: "Evolving Dialect",
      version: 1,
      stems: [{ code: "a1", meaning: "alpha", flags: "NRC" }],
    }));

    // v2 — adds new stem, references v1 as base
    store.define(defineDialect({
      id: "evolving",
      name: "Evolving Dialect v2",
      version: 2,
      stems: [
        { code: "a1", meaning: "alpha", flags: "NRC" },
        { code: "b1", meaning: "beta", flags: "NRQC" },
      ],
    }));

    const morphology = createDefaultMorphology();
    store.activate(["evolving"], morphology);
    expect(morphology.domainStems.has("a1")).toBe(true);
    expect(morphology.domainStems.has("b1")).toBe(true);
  });

  it("dialect inheritance: child inherits base stems", () => {
    const store = new DialectStore();

    store.define(defineDialect({
      id: "base.lang",
      name: "Base Language",
      stems: [
        { code: "bw1", meaning: "base_word_1", flags: "NRC" },
        { code: "bw2", meaning: "base_word_2", flags: "QC" },
      ],
    }));

    store.define(defineDialect({
      id: "child.lang",
      name: "Child Language",
      base: "base.lang",
      stems: [
        { code: "cw1", meaning: "child_word_1", flags: "NRQC" },
      ],
    }));

    const morphology = createDefaultMorphology();
    store.activate(["child.lang"], morphology);

    // Base stems
    expect(resolveAffix("bw1", morphology)?.valid).toBe(true);
    expect(resolveAffix("bw2", morphology)?.valid).toBe(true);
    // Child stems
    expect(resolveAffix("cw1", morphology)?.valid).toBe(true);
    expect(resolveAffix("neg.cw1", morphology)?.valid).toBe(true);
  });

  it("dialect + domain can be used together", () => {
    const store = new DialectStore();
    store.define(defineDialect({
      id: "custom",
      name: "Custom",
      stems: [{ code: "cst", meaning: "custom_stem", flags: "NRC" }],
    }));

    const morphology = createDefaultMorphology();

    // Activate both a built-in domain and a custom dialect
    activateDomains(["sec"], morphology);
    store.activate(["custom"], morphology);

    // Domain stem
    expect(resolveAffix("vul", morphology)?.valid).toBe(true);
    // Dialect stem
    expect(resolveAffix("cst", morphology)?.valid).toBe(true);
  });
});

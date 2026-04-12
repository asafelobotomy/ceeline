import { describe, it, expect } from "vitest";
import {
  createDefaultMorphology,
  resolveAffix,
  isValidMorphologicalCode,
  registerSessionStem,
  expandStem,
  activateDomains,
  DOMAIN_TABLES,
} from "@ceeline/schema";

describe("Morphological affix system", () => {
  const morphology = createDefaultMorphology();

  describe("resolveAffix", () => {
    it("resolves a bare stem", () => {
      const res = resolveAffix("ho", morphology);
      expect(res).not.toBeNull();
      expect(res!.stem).toBe("ho");
      expect(res!.prefix).toBeNull();
      expect(res!.suffix).toBeNull();
      expect(res!.valid).toBe(true);
    });

    it("resolves a prefixed code", () => {
      const res = resolveAffix("neg.ok", morphology);
      expect(res).not.toBeNull();
      expect(res!.prefix!.name).toBe("neg");
      expect(res!.stem).toBe("ok");
      expect(res!.suffix).toBeNull();
      expect(res!.valid).toBe(true);
    });

    it("resolves a suffixed code", () => {
      const res = resolveAffix("ho.seq", morphology);
      expect(res).not.toBeNull();
      expect(res!.prefix).toBeNull();
      expect(res!.stem).toBe("ho");
      expect(res!.suffix!.name).toBe("seq");
      expect(res!.valid).toBe(true);
    });

    it("resolves a cross-product (prefix + suffix)", () => {
      const res = resolveAffix("re.ho.seq", morphology);
      expect(res).not.toBeNull();
      expect(res!.prefix!.name).toBe("re");
      expect(res!.stem).toBe("ho");
      expect(res!.suffix!.name).toBe("seq");
      expect(res!.valid).toBe(true);
    });

    it("returns null for an unknown stem", () => {
      const res = resolveAffix("zzz", morphology);
      expect(res).toBeNull();
    });

    it("marks invalid when stem lacks the required prefix flag", () => {
      // "m" (audience=machine) has flags "C" only — no N flag
      const res = resolveAffix("neg.m", morphology);
      expect(res).not.toBeNull();
      expect(res!.valid).toBe(false);
    });

    it("marks invalid when stem lacks the required suffix flag", () => {
      // "mk" (memory_kind) has flags "C" only — no Q flag
      const res = resolveAffix("mk.seq", morphology);
      expect(res).not.toBeNull();
      expect(res!.valid).toBe(false);
    });

    it("resolves prev. prefix", () => {
      const res = resolveAffix("prev.ss", morphology);
      expect(res).not.toBeNull();
      expect(res!.prefix!.name).toBe("prev");
      expect(res!.stem).toBe("ss");
      expect(res!.valid).toBe(true);
    });

    it("resolves tent. prefix", () => {
      const res = resolveAffix("tent.dr", morphology);
      expect(res).not.toBeNull();
      expect(res!.prefix!.name).toBe("tent");
      expect(res!.stem).toBe("dr");
      expect(res!.valid).toBe(true);
    });

    it("resolves del. prefix", () => {
      const res = resolveAffix("del.ho", morphology);
      expect(res).not.toBeNull();
      expect(res!.prefix!.name).toBe("del");
      expect(res!.stem).toBe("ho");
      expect(res!.valid).toBe(true);
    });

    it("resolves .opt suffix", () => {
      const res = resolveAffix("tgt.opt", morphology);
      expect(res).not.toBeNull();
      expect(res!.suffix!.name).toBe("opt");
      expect(res!.stem).toBe("tgt");
      expect(res!.valid).toBe(true);
    });

    it("resolves .ref suffix", () => {
      const res = resolveAffix("me.ref", morphology);
      expect(res).not.toBeNull();
      expect(res!.suffix!.name).toBe("ref");
      expect(res!.stem).toBe("me");
      expect(res!.valid).toBe(true);
    });

    it("resolves .multi suffix", () => {
      const res = resolveAffix("rt.multi", morphology);
      expect(res).not.toBeNull();
      expect(res!.suffix!.name).toBe("multi");
      expect(res!.stem).toBe("rt");
      expect(res!.valid).toBe(true);
    });
  });

  describe("isValidMorphologicalCode", () => {
    it("returns true for valid bare stems", () => {
      expect(isValidMorphologicalCode("ho", morphology)).toBe(true);
      expect(isValidMorphologicalCode("dg", morphology)).toBe(true);
      expect(isValidMorphologicalCode("sum", morphology)).toBe(true);
    });

    it("returns true for valid affixed codes", () => {
      expect(isValidMorphologicalCode("neg.ok", morphology)).toBe(true);
      expect(isValidMorphologicalCode("ho.seq", morphology)).toBe(true);
      expect(isValidMorphologicalCode("re.ho.seq", morphology)).toBe(true);
    });

    it("returns false for unknown stems", () => {
      expect(isValidMorphologicalCode("zzz", morphology)).toBe(false);
      expect(isValidMorphologicalCode("neg.zzz", morphology)).toBe(false);
    });

    it("returns false for disallowed affix combinations", () => {
      expect(isValidMorphologicalCode("neg.m", morphology)).toBe(false);
    });
  });

  describe("registerSessionStem", () => {
    it("registers a session stem that resolves correctly", () => {
      const m = createDefaultMorphology();
      registerSessionStem("chk", "NRPQOXMVC", m);

      expect(isValidMorphologicalCode("chk", m)).toBe(true);
      expect(isValidMorphologicalCode("neg.chk", m)).toBe(true);
      expect(isValidMorphologicalCode("chk.seq", m)).toBe(true);
      expect(isValidMorphologicalCode("re.chk.ref", m)).toBe(true);
    });

    it("does not leak session stems to other morphology instances", () => {
      const m1 = createDefaultMorphology();
      const m2 = createDefaultMorphology();
      registerSessionStem("xyz", "NQ", m1);

      expect(isValidMorphologicalCode("xyz", m1)).toBe(true);
      expect(isValidMorphologicalCode("xyz", m2)).toBe(false);
    });
  });

  describe("expandStem", () => {
    it("produces the bare stem plus all valid affixed forms", () => {
      const forms = expandStem("ok", morphology);
      expect(forms).toContain("ok");
      expect(forms).toContain("neg.ok");
      // "ok" has flags NC — no suffix flags except C
      // So only bare + neg. prefix
      expect(forms.length).toBe(2);
    });

    it("expands a richly-flagged stem with cross-products", () => {
      const forms = expandStem("ho", morphology);
      expect(forms).toContain("ho");
      expect(forms).toContain("neg.ho");
      expect(forms).toContain("re.ho");
      expect(forms).toContain("ho.seq");
      expect(forms).toContain("ho.ref");
      expect(forms).toContain("ho.multi");
      expect(forms).toContain("ho.v");
      expect(forms).toContain("re.ho.seq");
      expect(forms).toContain("neg.ho.multi");
      expect(forms.length).toBeGreaterThan(20);
    });

    it("returns empty array for unknown stems", () => {
      expect(expandStem("zzz", morphology)).toEqual([]);
    });

    it("expands session stems", () => {
      const m = createDefaultMorphology();
      registerSessionStem("bkg", "NRQ", m);
      const forms = expandStem("bkg", m);
      expect(forms).toContain("bkg");
      expect(forms).toContain("neg.bkg");
      expect(forms).toContain("re.bkg");
      expect(forms).toContain("bkg.seq");
      expect(forms).toContain("neg.bkg.seq");
      expect(forms).toContain("re.bkg.seq");
    });
  });
});

// =========================================================================
// Domain stem tables
// =========================================================================

describe("Domain stem tables", () => {
  describe("DOMAIN_TABLES", () => {
    it("contains all four domains", () => {
      expect(DOMAIN_TABLES.has("sec")).toBe(true);
      expect(DOMAIN_TABLES.has("perf")).toBe(true);
      expect(DOMAIN_TABLES.has("arch")).toBe(true);
      expect(DOMAIN_TABLES.has("test")).toBe(true);
      expect(DOMAIN_TABLES.size).toBe(4);
    });

    it("each domain has a non-empty stem set", () => {
      for (const [id, table] of DOMAIN_TABLES) {
        expect(table.id).toBe(id);
        expect(table.name.length).toBeGreaterThan(0);
        expect(table.stems.size).toBeGreaterThan(0);
      }
    });
  });

  describe("activateDomains", () => {
    it("copies domain stems into morphology.domainStems", () => {
      const m = createDefaultMorphology();
      activateDomains(["sec"], m);
      expect(m.domainStems.has("vul")).toBe(true);
      expect(m.domainStems.has("xss")).toBe(true);
      expect(m.domainStems.has("rbac")).toBe(true);
    });

    it("activates multiple domains at once", () => {
      const m = createDefaultMorphology();
      activateDomains(["sec", "perf"], m);
      // sec stem
      expect(m.domainStems.has("vul")).toBe(true);
      // perf stem
      expect(m.domainStems.has("lat")).toBe(true);
    });

    it("silently ignores unknown domain IDs", () => {
      const m = createDefaultMorphology();
      activateDomains(["sec", "nope", "also_unknown"], m);
      expect(m.domainStems.has("vul")).toBe(true);
      // Stems from unknown domain don't appear
      expect(m.domainStems.size).toBe(DOMAIN_TABLES.get("sec")!.stems.size);
    });

    it("does not modify built-in stems", () => {
      const m = createDefaultMorphology();
      const builtinSize = m.stems.size;
      activateDomains(["sec", "perf", "arch", "test"], m);
      expect(m.stems.size).toBe(builtinSize);
    });

    it("does not leak between morphology instances", () => {
      const m1 = createDefaultMorphology();
      const m2 = createDefaultMorphology();
      activateDomains(["sec"], m1);
      expect(m1.domainStems.has("vul")).toBe(true);
      expect(m2.domainStems.has("vul")).toBe(false);
    });
  });

  describe("domain stem resolution via resolveAffix", () => {
    it("resolves a bare domain stem after activation", () => {
      const m = createDefaultMorphology();
      activateDomains(["sec"], m);
      const res = resolveAffix("vul", m);
      expect(res).not.toBeNull();
      expect(res!.stem).toBe("vul");
      expect(res!.valid).toBe(true);
    });

    it("resolves prefixed domain stem", () => {
      const m = createDefaultMorphology();
      activateDomains(["sec"], m);
      const res = resolveAffix("neg.vul", m);
      expect(res).not.toBeNull();
      expect(res!.prefix!.name).toBe("neg");
      expect(res!.stem).toBe("vul");
      expect(res!.valid).toBe(true);
    });

    it("resolves suffixed domain stem", () => {
      const m = createDefaultMorphology();
      activateDomains(["sec"], m);
      const res = resolveAffix("vul.seq", m);
      expect(res).not.toBeNull();
      expect(res!.suffix!.name).toBe("seq");
      expect(res!.stem).toBe("vul");
      expect(res!.valid).toBe(true);
    });

    it("resolves cross-product on domain stem", () => {
      const m = createDefaultMorphology();
      activateDomains(["sec"], m);
      const res = resolveAffix("re.vul.seq", m);
      expect(res).not.toBeNull();
      expect(res!.prefix!.name).toBe("re");
      expect(res!.stem).toBe("vul");
      expect(res!.suffix!.name).toBe("seq");
      expect(res!.valid).toBe(true);
    });

    it("returns null for domain stem when domain is not activated", () => {
      const m = createDefaultMorphology();
      // no activateDomains call
      expect(resolveAffix("vul", m)).toBeNull();
    });

    it("marks invalid for disallowed affix combination on domain stem", () => {
      const m = createDefaultMorphology();
      activateDomains(["sec"], m);
      // "tls" has flags "NC" — no Q flag, so .seq is invalid
      const res = resolveAffix("tls.seq", m);
      expect(res).not.toBeNull();
      expect(res!.valid).toBe(false);
    });
  });

  describe("domain stem expansion via expandStem", () => {
    it("expands domain stems with correct affix forms", () => {
      const m = createDefaultMorphology();
      activateDomains(["perf"], m);
      const forms = expandStem("lat", m);
      expect(forms).toContain("lat");
      expect(forms).toContain("neg.lat");
      expect(forms).toContain("re.lat");
      expect(forms).toContain("lat.seq");
      expect(forms).toContain("lat.opt");
      expect(forms.length).toBeGreaterThan(5);
    });

    it("returns empty for unactivated domain stem", () => {
      const m = createDefaultMorphology();
      expect(expandStem("lat", m)).toEqual([]);
    });
  });

  describe("collision safety", () => {
    it("no domain stem collides with a built-in stem", () => {
      const m = createDefaultMorphology();
      for (const [, table] of DOMAIN_TABLES) {
        for (const stem of table.stems.keys()) {
          expect(m.stems.has(stem)).toBe(false);
        }
      }
    });

    it("no domain stem collides across domains", () => {
      const allStems = new Map<string, string>();
      for (const [domId, table] of DOMAIN_TABLES) {
        for (const stem of table.stems.keys()) {
          expect(allStems.has(stem)).toBe(false);
          allStems.set(stem, domId);
        }
      }
    });

    it("domain IDs do not collide with compact header keywords", () => {
      const headerKeywords = ["s", "i", "pid", "ch", "md", "au", "fb", "rs", "sz", "mx", "dom"];
      for (const id of DOMAIN_TABLES.keys()) {
        expect(headerKeywords).not.toContain(id);
      }
    });
  });
});

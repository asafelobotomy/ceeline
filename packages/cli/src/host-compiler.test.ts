import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { describe, expect, it, afterEach } from "vitest";
import { compileHostContext, learnSignalBoosts, writeHostContextToDisk } from "./host-compiler.js";

const fixtureRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../plugin");
const emptyRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../core/src");

describe("host context compiler", () => {
  it("compiles plugin assets into validated prompt_context, routing, digest, and history envelopes", () => {
    const result = compileHostContext(fixtureRoot, {
      task: "Review a Ceeline handoff for security validation issues and return findings."
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(`compileHostContext failed: ${JSON.stringify(result.issues)}`);
    }

    const primaryDocuments = result.value.documents.filter((d) => d.kind !== "reference");
    const referenceDocuments = result.value.documents.filter((d) => d.kind === "reference");

    expect(primaryDocuments).toHaveLength(4);
    expect(primaryDocuments.map((document) => document.kind)).toEqual(["agent", "agent", "hooks", "skill"]);
    expect(primaryDocuments.every((document) => document.routeSignals.length > 0)).toBe(true);

    expect(referenceDocuments.length).toBeGreaterThanOrEqual(1);
    expect(referenceDocuments.some((d) => d.sourceRef.includes("compact-grammar"))).toBe(true);

    const reviewDocument = result.value.documents.find((document) => document.name === "ceeline-review");
    expect(reviewDocument).toBeDefined();
    expect(reviewDocument?.routeSignals).toContain("tool:translate_from_ceeline");
    expect(reviewDocument?.routeSignals).toContain("task:review");
    expect(reviewDocument?.routeSignals).toContain("task:security");

    expect(result.value.promptContext.length).toBeGreaterThanOrEqual(10);
    expect(result.value.promptContext.every((envelope) => envelope.surface === "prompt_context")).toBe(true);
    expect(result.value.promptContext.some((envelope) => envelope.payload.source_ref.includes("hooks.json"))).toBe(true);

    expect(result.value.routing).toHaveLength(3);
    expect(result.value.routing.every((envelope) => envelope.surface === "routing")).toBe(true);
    expect(result.value.routing.every((envelope) => envelope.payload.candidates.length === 3)).toBe(true);
    expect(result.value.routing.map((envelope) => envelope.payload.selected).sort()).toEqual([
      "ceeline",
      "ceeline-handoff",
      "ceeline-review"
    ]);
    expect(result.value.routing.some((envelope) => envelope.payload.facts.some((fact) => fact.startsWith("Task-match signals:")))).toBe(true);

    expect(result.value.digest.surface).toBe("digest");
    expect(result.value.digest.payload.metrics.documents).toBe(result.value.documents.length);
    expect(result.value.digest.payload.metrics.references).toBeGreaterThanOrEqual(1);
    expect(result.value.history.surface).toBe("history");
    expect(result.value.history.payload.turn_count).toBe(result.value.documents.length);

    expect(result.value.routingMatches).toBeDefined();
    expect(result.value.routingMatches?.taskSignals).toContain("task:review");
    expect(result.value.routingMatches?.taskSignals).toContain("task:security");
    expect(result.value.routingMatches?.matches[0]?.name).toBe("ceeline-review");
    expect(result.value.routingMatches?.matches[0]?.selected).toBe(true);
    expect(result.value.routingMatches?.matches[0]?.score).toBeGreaterThan(result.value.routingMatches?.matches[1]?.score ?? 0);
    expect(result.value.routingMatches?.matches[0]?.matchedSignals).toContain("task:review");
    expect(result.value.routingMatches?.matches[0]?.matchedSignals).toContain("task:security");

    expect(result.value.compactBundles.promptContext.surface).toBe("prompt_context");
    expect(result.value.compactBundles.promptContext.density).toBe("dense");
    expect(result.value.compactBundles.promptContext.itemCount).toBe(result.value.promptContext.length);
    expect(result.value.compactBundles.promptContext.text).toContain("@cl1 s=pc");

    expect(result.value.compactBundles.routing.surface).toBe("routing");
    expect(result.value.compactBundles.routing.density).toBe("dense");
    expect(result.value.compactBundles.routing.itemCount).toBe(result.value.routing.length);
    expect(result.value.compactBundles.routing.text).toContain("@cl1 s=rt");

    expect(result.value.compactBundles.digest.surface).toBe("digest");
    expect(result.value.compactBundles.digest.density).toBe("full");
    expect(result.value.compactBundles.digest.itemCount).toBe(1);

    expect(result.value.compactBundles.history.surface).toBe("history");
    expect(result.value.compactBundles.history.density).toBe("full");
    expect(result.value.compactBundles.history.itemCount).toBe(1);
  });

  it("reports when no host compiler sources are present", () => {
    const result = compileHostContext(emptyRoot);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((entry) => entry.code === "no_host_context_sources")).toBe(true);
    }
  });

  describe("reference document discovery", () => {
    it("discovers markdown references linked from SKILL.md", () => {
      const result = compileHostContext(fixtureRoot);
      expect(result.ok).toBe(true);
      if (!result.ok) { return; }

      const refs = result.value.documents.filter((d) => d.kind === "reference");
      expect(refs.length).toBeGreaterThanOrEqual(1);

      const grammarRef = refs.find((d) => d.sourceRef.includes("compact-grammar"));
      expect(grammarRef).toBeDefined();
      expect(grammarRef?.sections.length).toBeGreaterThan(0);
      expect(grammarRef?.sections.every((s) => s.phase === "grounding")).toBe(true);
      expect(grammarRef?.sections.every((s) => s.priority === 60)).toBe(true);
    });

    it("discovers script documents adjacent to skills", () => {
      const result = compileHostContext(fixtureRoot);
      expect(result.ok).toBe(true);
      if (!result.ok) { return; }

      const scriptDoc = result.value.documents.find((d) => d.kind === "reference" && d.name.includes("scripts"));
      expect(scriptDoc).toBeDefined();
      expect(scriptDoc?.sections.length).toBe(1);
      expect(scriptDoc?.sections[0]?.facts.some((f) => f.includes("Available script:"))).toBe(true);
      expect(scriptDoc?.tools.length).toBeGreaterThan(0);
    });

    it("excludes reference documents from routing candidates", () => {
      const result = compileHostContext(fixtureRoot, { task: "Review security" });
      expect(result.ok).toBe(true);
      if (!result.ok) { return; }

      const routingCandidates = result.value.routing.flatMap((e) => e.payload.candidates);
      const referenceNames = result.value.documents.filter((d) => d.kind === "reference").map((d) => d.name);

      for (const refName of referenceNames) {
        expect(routingCandidates).not.toContain(refName);
      }

      expect(result.value.routingMatches?.matches.every((m) => m.kind !== "reference")).toBe(true);
    });

    it("includes reference document facts in prompt_context envelopes", () => {
      const result = compileHostContext(fixtureRoot);
      expect(result.ok).toBe(true);
      if (!result.ok) { return; }

      const refSourceRefs = result.value.documents
        .filter((d) => d.kind === "reference")
        .map((d) => d.sourceRef);

      const refEnvelopes = result.value.promptContext.filter((e) =>
        refSourceRefs.some((ref) => e.payload.source_ref.startsWith(ref))
      );

      expect(refEnvelopes.length).toBeGreaterThan(0);
      expect(refEnvelopes.every((e) => e.surface === "prompt_context")).toBe(true);
    });
  });

  describe("compiler diagnostics", () => {
    it("returns a diagnostics array on successful compilation", () => {
      const result = compileHostContext(fixtureRoot);
      expect(result.ok).toBe(true);
      if (!result.ok) { return; }

      expect(Array.isArray(result.value.diagnostics)).toBe(true);
      for (const diag of result.value.diagnostics) {
        expect(["error", "warning", "info"]).toContain(diag.level);
        expect(typeof diag.code).toBe("string");
        expect(typeof diag.message).toBe("string");
        expect(typeof diag.sourceRef).toBe("string");
      }
    });

    it("does not produce duplicate_document_name for unique names", () => {
      const result = compileHostContext(fixtureRoot);
      expect(result.ok).toBe(true);
      if (!result.ok) { return; }

      const dupes = result.value.diagnostics.filter((d) => d.code === "duplicate_document_name");
      expect(dupes).toHaveLength(0);
    });

    it("produces fix suggestions for all diagnostics", () => {
      const result = compileHostContext(fixtureRoot);
      expect(result.ok).toBe(true);
      if (!result.ok) { return; }

      for (const diag of result.value.diagnostics) {
        expect(typeof diag.fix).toBe("string");
        expect(diag.fix!.length).toBeGreaterThan(0);
      }
    });

    it("--strict promotes warnings to errors", () => {
      const normal = compileHostContext(fixtureRoot, { strict: false });
      expect(normal.ok).toBe(true);
      if (!normal.ok) { return; }

      const warnings = normal.value.diagnostics.filter((d) => d.level === "warning");
      if (warnings.length === 0) {
        // No warnings to promote; strict should also succeed
        const strict = compileHostContext(fixtureRoot, { strict: true });
        expect(strict.ok).toBe(true);
      } else {
        const strict = compileHostContext(fixtureRoot, { strict: true });
        expect(strict.ok).toBe(false);
        if (!strict.ok) {
          expect(strict.issues.length).toBeGreaterThan(0);
          expect(strict.issues.some((i) => warnings.some((w) => w.code === i.code))).toBe(true);
        }
      }
    });
  });

  describe("routing confidence bands", () => {
    it("assigns confidence bands to routing matches", () => {
      const result = compileHostContext(fixtureRoot, {
        task: "Review a Ceeline handoff for security validation issues."
      });
      expect(result.ok).toBe(true);
      if (!result.ok) { return; }

      expect(result.value.routingMatches).toBeDefined();
      for (const match of result.value.routingMatches!.matches) {
        expect(["high", "medium", "low", "none"]).toContain(match.confidence);
      }
    });

    it("marks top match with correct confidence when scores are close", () => {
      const result = compileHostContext(fixtureRoot, {
        task: "Review a Ceeline handoff for security validation issues."
      });
      expect(result.ok).toBe(true);
      if (!result.ok) { return; }

      const matches = result.value.routingMatches!.matches;
      // ceeline-handoff and ceeline-review share many signals and tie
      expect(matches[0].selected).toBe(true);
      expect(["high", "medium"]).toContain(matches[0].confidence);

      // When top two are tied/close, ambiguous should be true
      if (matches[0].score === matches[1]?.score) {
        expect(result.value.routingMatches!.ambiguous).toBe(true);
      }
    });

    it("reports ambiguity when top matches have close scores", () => {
      const result = compileHostContext(fixtureRoot, {
        task: "Review security validation"
      });
      expect(result.ok).toBe(true);
      if (!result.ok) { return; }

      const matches = result.value.routingMatches!.matches;
      // ceeline-handoff and ceeline-review both match "review" + "security" equally
      if (matches.length >= 2 && matches[0].score === matches[1].score) {
        expect(result.value.routingMatches!.ambiguous).toBe(true);
      } else if (matches.length >= 2 && matches[0].score >= 2 * matches[1].score) {
        expect(result.value.routingMatches!.ambiguous).toBe(false);
      }
    });

    it("assigns none confidence when score is zero", () => {
      const result = compileHostContext(fixtureRoot, {
        task: "completely unrelated topic with no matching signals xyz123"
      });
      expect(result.ok).toBe(true);
      if (!result.ok) { return; }

      const matches = result.value.routingMatches!.matches;
      const zeroMatches = matches.filter((m) => m.score === 0);
      for (const match of zeroMatches) {
        expect(match.confidence).toBe("none");
      }
    });
  });

  describe("reflection envelope", () => {
    it("emits a reflection envelope with confidence_check type", () => {
      const result = compileHostContext(fixtureRoot);
      expect(result.ok).toBe(true);
      if (!result.ok) { return; }

      expect(result.value.reflection.surface).toBe("reflection");
      expect(result.value.reflection.payload.reflection_type).toBe("confidence_check");
      expect(typeof result.value.reflection.payload.confidence).toBe("number");
      expect(result.value.reflection.payload.confidence).toBeGreaterThanOrEqual(0);
      expect(result.value.reflection.payload.confidence).toBeLessThanOrEqual(1);
    });

    it("decreases confidence when diagnostics are present", () => {
      const clean = compileHostContext(fixtureRoot);
      expect(clean.ok).toBe(true);
      if (!clean.ok) { return; }

      // Strict mode would fail if warnings exist, confirming diagnostics affect confidence
      const confidence = clean.value.reflection.payload.confidence;
      const diagCount = clean.value.diagnostics.length;
      if (diagCount > 0) {
        expect(confidence).toBeLessThan(1);
      } else {
        expect(confidence).toBe(1);
      }
    });

    it("includes routing info in reflection facts when task is provided", () => {
      const result = compileHostContext(fixtureRoot, { task: "Review security" });
      expect(result.ok).toBe(true);
      if (!result.ok) { return; }

      const facts = result.value.reflection.payload.facts;
      expect(facts.some((f) => f.includes("Top routing match:"))).toBe(true);
    });

    it("has a compact bundle for reflection", () => {
      const result = compileHostContext(fixtureRoot);
      expect(result.ok).toBe(true);
      if (!result.ok) { return; }

      expect(result.value.compactBundles.reflection.surface).toBe("reflection");
      expect(result.value.compactBundles.reflection.density).toBe("full");
      expect(result.value.compactBundles.reflection.itemCount).toBe(1);
    });
  });

  describe("tool summary envelope", () => {
    it("emits a tool_summary envelope listing all unique tools", () => {
      const result = compileHostContext(fixtureRoot);
      expect(result.ok).toBe(true);
      if (!result.ok) { return; }

      expect(result.value.toolSummary.surface).toBe("tool_summary");
      expect(result.value.toolSummary.payload.outcome).toBe("success");

      const uniqueTools = result.value.toolSummary.payload.metadata.unique_tools as string[];
      expect(Array.isArray(uniqueTools)).toBe(true);
      expect(uniqueTools.length).toBeGreaterThan(0);

      // Every tool declared in documents should appear in the summary
      const allDocTools = result.value.documents.flatMap((d) => d.tools);
      const toolSet = new Set(uniqueTools);
      for (const tool of allDocTools) {
        expect(toolSet.has(tool)).toBe(true);
      }
    });

    it("maps tools to their declaring documents", () => {
      const result = compileHostContext(fixtureRoot);
      expect(result.ok).toBe(true);
      if (!result.ok) { return; }

      const toolMap = result.value.toolSummary.payload.metadata.tool_document_map as Record<string, string[]>;
      expect(typeof toolMap).toBe("object");

      for (const [tool, owners] of Object.entries(toolMap)) {
        expect(typeof tool).toBe("string");
        expect(Array.isArray(owners)).toBe(true);
        expect(owners.length).toBeGreaterThan(0);
      }
    });

    it("has facts describing each tool", () => {
      const result = compileHostContext(fixtureRoot);
      expect(result.ok).toBe(true);
      if (!result.ok) { return; }

      const facts = result.value.toolSummary.payload.facts;
      expect(facts.some((f) => f.startsWith("Total unique tools:"))).toBe(true);
      expect(facts.some((f) => f.includes("declared in:"))).toBe(true);
    });

    it("has a compact bundle for tool_summary", () => {
      const result = compileHostContext(fixtureRoot);
      expect(result.ok).toBe(true);
      if (!result.ok) { return; }

      expect(result.value.compactBundles.toolSummary.surface).toBe("tool_summary");
      expect(result.value.compactBundles.toolSummary.density).toBe("full");
      expect(result.value.compactBundles.toolSummary.itemCount).toBe(1);
    });
  });

  describe("disk output", () => {
    const tempDirs: string[] = [];

    afterEach(() => {
      for (const dir of tempDirs) {
        rmSync(dir, { recursive: true, force: true });
      }
      tempDirs.length = 0;
    });

    function makeTempDir(): string {
      const dir = mkdtempSync(join(tmpdir(), "ceeline-test-"));
      tempDirs.push(dir);
      return dir;
    }

    it("writes envelopes, compact bundles, and manifest to disk", () => {
      const result = compileHostContext(fixtureRoot);
      expect(result.ok).toBe(true);
      if (!result.ok) { return; }

      const outDir = makeTempDir();
      const diskResult = writeHostContextToDisk(result.value, outDir);
      expect(diskResult.ok).toBe(true);
      if (!diskResult.ok) { return; }

      // Manifest exists
      expect(existsSync(join(outDir, "manifest.json"))).toBe(true);
      const manifest = JSON.parse(readFileSync(join(outDir, "manifest.json"), "utf8"));
      expect(manifest.version).toBe("1.0");
      expect(manifest.entries.length).toBeGreaterThan(0);

      // Envelope files exist
      const envelopeEntries = manifest.entries.filter((e: { file: string }) => e.file.startsWith("envelopes/"));
      for (const entry of envelopeEntries) {
        expect(existsSync(join(outDir, entry.file))).toBe(true);
      }

      // Compact files exist
      const compactEntries = manifest.entries.filter((e: { file: string }) => e.file.startsWith("compact/"));
      expect(compactEntries.length).toBe(6); // 6 surfaces
      for (const entry of compactEntries) {
        const filePath = join(outDir, entry.file);
        expect(existsSync(filePath)).toBe(true);
        expect(entry.file.endsWith(".cl1")).toBe(true);
      }
    });

    it("produces deterministic SHA-256 hashes", () => {
      const result = compileHostContext(fixtureRoot);
      expect(result.ok).toBe(true);
      if (!result.ok) { return; }

      const dir1 = makeTempDir();
      const dir2 = makeTempDir();
      const r1 = writeHostContextToDisk(result.value, dir1);
      const r2 = writeHostContextToDisk(result.value, dir2);
      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(true);
      if (!r1.ok || !r2.ok) { return; }

      // Same content should produce same hashes (generatedAt differs, but entry hashes are content-based)
      const hashes1 = r1.value.entries.map((e) => e.sha256);
      const hashes2 = r2.value.entries.map((e) => e.sha256);
      expect(hashes1).toEqual(hashes2);
    });
  });

  describe("learned signal boosts", () => {
    it("produces boosts that reinforce correct routing", () => {
      const tasks = [
        { task: "Review security of a handoff", expectedWinner: "ceeline-review" },
        { task: "Review security of a handoff", expectedWinner: "ceeline-review" }
      ];

      const result = learnSignalBoosts(fixtureRoot, tasks);
      expect(result.ok).toBe(true);
      if (!result.ok) { return; }

      expect(result.value.version).toBe("1.0");
      expect(Array.isArray(result.value.boosts)).toBe(true);
    });

    it("adjusts signals when expected winner does not match top result", () => {
      // Force a mismatch by asking for a winner that wouldn't normally win
      const tasks = [
        { task: "Review security of a handoff", expectedWinner: "ceeline-handoff" }
      ];

      const result = learnSignalBoosts(fixtureRoot, tasks);
      expect(result.ok).toBe(true);
      if (!result.ok) { return; }

      // Should have some boosts (positive for expected winner's signals, negative for wrong winner's)
      expect(result.value.boosts.length).toBeGreaterThan(0);
      const positiveBoosts = result.value.boosts.filter((b) => b.adjustment > 0);
      const negativeBoosts = result.value.boosts.filter((b) => b.adjustment < 0);
      expect(positiveBoosts.length + negativeBoosts.length).toBeGreaterThan(0);
    });

    it("loads and applies signal boosts to routing", () => {
      // Learn boosts first
      const tasks = [
        { task: "Review security of a handoff", expectedWinner: "ceeline-handoff" }
      ];
      const learnResult = learnSignalBoosts(fixtureRoot, tasks);
      expect(learnResult.ok).toBe(true);
      if (!learnResult.ok) { return; }

      // Write boosts to temp file
      const dir = mkdtempSync(join(tmpdir(), "ceeline-boosts-"));
      const boostsPath = join(dir, "signal-boosts.json");
      writeFileSync(boostsPath, JSON.stringify(learnResult.value), "utf8");

      // Compile with boosts
      const result = compileHostContext(fixtureRoot, {
        task: "Review security of a handoff",
        signalBoostsPath: boostsPath
      });
      expect(result.ok).toBe(true);

      rmSync(dir, { recursive: true, force: true });
    });
  });
});
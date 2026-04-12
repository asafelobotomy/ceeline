/**
 * Ceeline Compact Dialect Benchmark
 * ==================================
 *
 * Metrics:
 *   1. Byte compression ratio   — JSON bytes ÷ compact bytes
 *   2. Byte space saving         — (1 − compact/JSON) × 100
 *   3. Token compression ratio   — JSON tokens ÷ compact tokens (cl100k + o200k)
 *   4. Token space saving        — (1 − compact/JSON) × 100
 *   5. Round-trip fidelity       — parse(render(envelope)) recovers key fields
 *   6. Render throughput         — envelopes/ms across 1000 iterations
 *   7. Per-surface breakdown     — all above per surface type
 *   8. Per-density breakdown     — lite vs full vs dense
 *
 * Token encodings:
 *   - cl100k_base  (GPT-4, GPT-3.5-turbo)
 *   - o200k_base   (GPT-4o, GPT-5, O1/O3)
 */

import { getEncoding } from "js-tiktoken";
import { renderCeelineCompact, renderCeelineCompactAuto, parseCeelineCompact } from "@ceeline/core";
import type { CompactDensity, CeelineEnvelope } from "@ceeline/schema";
import { CORPUS } from "./corpus.js";

// ── Tokenizers ──────────────────────────────────────────────────────────

const cl100k = getEncoding("cl100k_base");
const o200k  = getEncoding("o200k_base");

function countTokens(text: string, encoding: "cl100k" | "o200k"): number {
  return (encoding === "cl100k" ? cl100k : o200k).encode(text).length;
}

// ── Types ───────────────────────────────────────────────────────────────

interface EnvelopeMetrics {
  surface: string;
  density: CompactDensity;
  jsonBytes: number;
  compactBytes: number;
  byteRatio: number;
  byteSaving: number;
  jsonTokensCl100k: number;
  compactTokensCl100k: number;
  tokenRatioCl100k: number;
  tokenSavingCl100k: number;
  jsonTokensO200k: number;
  compactTokensO200k: number;
  tokenRatioO200k: number;
  tokenSavingO200k: number;
  roundTripOk: boolean;
  roundTripIssues: string[];
  compactText: string;
}

interface AggregateMetrics {
  label: string;
  count: number;
  avgByteRatio: number;
  avgByteSaving: number;
  avgTokenRatioCl100k: number;
  avgTokenSavingCl100k: number;
  avgTokenRatioO200k: number;
  avgTokenSavingO200k: number;
  roundTripPassRate: number;
  totalJsonBytes: number;
  totalCompactBytes: number;
  totalJsonTokensCl100k: number;
  totalCompactTokensCl100k: number;
  totalJsonTokensO200k: number;
  totalCompactTokensO200k: number;
}

interface ThroughputMetrics {
  iterations: number;
  totalMs: number;
  envelopesPerMs: number;
  avgMsPerEnvelope: number;
}

interface BenchmarkReport {
  generated: string;
  envelopes: EnvelopeMetrics[];
  bySurface: AggregateMetrics[];
  byDensity: AggregateMetrics[];
  overall: AggregateMetrics;
  throughput: {
    render: Record<string, ThroughputMetrics>;
    parse: Record<string, ThroughputMetrics>;
  };
  trailerOverhead: TrailerOverhead[];
  autoDensity: AutoDensityResult[];
  budgetFailures: BudgetFailure[];
}

interface TrailerOverhead {
  surface: string;
  density: CompactDensity;
  trailerBytes: number;
  trailerTokensCl100k: number;
  trailerTokensO200k: number;
  contentBytes: number;
  overheadPercent: number;
}

interface AutoDensityResult {
  surface: string;
  selectedDensity: string;
  autoBytes: number;
  autoTokensCl100k: number;
  autoTokensO200k: number;
  manualFullBytes: number;
  manualDenseBytes: number;
}

interface BudgetFailure {
  surface: string;
  density: CompactDensity;
  budget: number;
  estimatedTokens: number;
}

// ── Measurement ─────────────────────────────────────────────────────────

const DENSITIES: CompactDensity[] = ["lite", "full", "dense"];

function measureEnvelope(envelope: CeelineEnvelope, density: CompactDensity): EnvelopeMetrics {
  const json = JSON.stringify(envelope);
  const renderResult = renderCeelineCompact(envelope, density);
  if (!renderResult.ok) {
    return {
      surface: envelope.surface, density,
      jsonBytes: 0, compactBytes: 0, byteRatio: 0, byteSaving: 0,
      jsonTokensCl100k: 0, compactTokensCl100k: 0, tokenRatioCl100k: 0, tokenSavingCl100k: 0,
      jsonTokensO200k: 0, compactTokensO200k: 0, tokenRatioO200k: 0, tokenSavingO200k: 0,
      roundTripOk: false,
      roundTripIssues: [`Render failed: ${renderResult.issues.map(i => i.message).join("; ")}`],
      compactText: ""
    };
  }
  const compact = renderResult.value;

  const jsonBytes = Buffer.byteLength(json, "utf-8");
  const compactBytes = Buffer.byteLength(compact, "utf-8");

  const jsonCl = countTokens(json, "cl100k");
  const compactCl = countTokens(compact, "cl100k");
  const jsonO2 = countTokens(json, "o200k");
  const compactO2 = countTokens(compact, "o200k");

  // Round-trip fidelity check
  const parsed = parseCeelineCompact(compact);
  const issues: string[] = [];
  if (!parsed.ok) {
    issues.push(`Parse failed: ${parsed.issues.map(i => i.message).join("; ")}`);
  } else {
    const p = parsed.value;
    if (p.surface !== envelope.surface) issues.push(`surface: ${p.surface} !== ${envelope.surface}`);
    if (p.intent !== envelope.intent) issues.push(`intent: ${p.intent} !== ${envelope.intent}`);
    if (p.channel !== envelope.channel) issues.push(`channel: ${p.channel} !== ${envelope.channel}`);
    if (p.mode !== envelope.constraints.mode) issues.push(`mode: ${p.mode} !== ${envelope.constraints.mode}`);
    if (p.audience !== envelope.constraints.audience) issues.push(`audience: ${p.audience} !== ${envelope.constraints.audience}`);
    if (p.summary !== (envelope.payload as Record<string, unknown>).summary) issues.push(`summary mismatch`);
  }

  return {
    surface: envelope.surface,
    density,
    jsonBytes,
    compactBytes,
    byteRatio: round(jsonBytes / compactBytes),
    byteSaving: round((1 - compactBytes / jsonBytes) * 100),
    jsonTokensCl100k: jsonCl,
    compactTokensCl100k: compactCl,
    tokenRatioCl100k: round(jsonCl / compactCl),
    tokenSavingCl100k: round((1 - compactCl / jsonCl) * 100),
    jsonTokensO200k: jsonO2,
    compactTokensO200k: compactO2,
    tokenRatioO200k: round(jsonO2 / compactO2),
    tokenSavingO200k: round((1 - compactO2 / jsonO2) * 100),
    roundTripOk: issues.length === 0,
    roundTripIssues: issues,
    compactText: compact
  };
}

function aggregate(label: string, items: EnvelopeMetrics[]): AggregateMetrics {
  const n = items.length;
  if (n === 0) throw new Error(`Cannot aggregate empty set: ${label}`);
  const sum = (fn: (m: EnvelopeMetrics) => number) => items.reduce((s, m) => s + fn(m), 0);

  return {
    label,
    count: n,
    avgByteRatio: round(sum(m => m.byteRatio) / n),
    avgByteSaving: round(sum(m => m.byteSaving) / n),
    avgTokenRatioCl100k: round(sum(m => m.tokenRatioCl100k) / n),
    avgTokenSavingCl100k: round(sum(m => m.tokenSavingCl100k) / n),
    avgTokenRatioO200k: round(sum(m => m.tokenRatioO200k) / n),
    avgTokenSavingO200k: round(sum(m => m.tokenSavingO200k) / n),
    roundTripPassRate: round(sum(m => m.roundTripOk ? 1 : 0) / n * 100),
    totalJsonBytes: sum(m => m.jsonBytes),
    totalCompactBytes: sum(m => m.compactBytes),
    totalJsonTokensCl100k: sum(m => m.jsonTokensCl100k),
    totalCompactTokensCl100k: sum(m => m.compactTokensCl100k),
    totalJsonTokensO200k: sum(m => m.jsonTokensO200k),
    totalCompactTokensO200k: sum(m => m.compactTokensO200k)
  };
}

function measureThroughput(
  fn: () => void,
  iterations: number
): ThroughputMetrics {
  // Warm up
  for (let i = 0; i < 50; i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;

  return {
    iterations,
    totalMs: round(elapsed),
    envelopesPerMs: round(iterations / elapsed),
    avgMsPerEnvelope: round(elapsed / iterations, 4)
  };
}

function round(n: number, decimals = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

// ── Trailer overhead measurement ────────────────────────────────────────

function measureTrailerOverhead(envelope: CeelineEnvelope, density: CompactDensity): TrailerOverhead | null {
  const result = renderCeelineCompact(envelope, density);
  if (!result.ok) return null;

  const compact = result.value;
  const sep = density === "lite" ? "\n" : " ; ";
  const trailerIdx = compact.lastIndexOf(`${sep}#n=`);
  if (trailerIdx === -1) return null;

  const content = compact.slice(0, trailerIdx);
  const trailer = compact.slice(trailerIdx);
  const contentBytes = Buffer.byteLength(content, "utf-8");
  const trailerBytes = Buffer.byteLength(trailer, "utf-8");
  const trailerTokensCl100k = countTokens(trailer, "cl100k");
  const trailerTokensO200k = countTokens(trailer, "o200k");

  return {
    surface: envelope.surface,
    density,
    trailerBytes,
    trailerTokensCl100k,
    trailerTokensO200k,
    contentBytes,
    overheadPercent: round(trailerBytes / (contentBytes + trailerBytes) * 100)
  };
}

// ── Auto-density measurement ────────────────────────────────────────────

function measureAutoDensity(envelope: CeelineEnvelope): AutoDensityResult | null {
  const autoResult = renderCeelineCompactAuto(envelope);
  const fullResult = renderCeelineCompact(envelope, "full");
  const denseResult = renderCeelineCompact(envelope, "dense");

  if (!autoResult.ok) return null;

  // Detect which density was selected by checking format
  const isMultiline = autoResult.value.includes("\n");
  const selectedDensity = isMultiline ? "lite" : (
    fullResult.ok && autoResult.value === fullResult.value ? "full" :
    denseResult.ok && autoResult.value === denseResult.value ? "dense" : "unknown"
  );

  return {
    surface: envelope.surface,
    selectedDensity,
    autoBytes: Buffer.byteLength(autoResult.value, "utf-8"),
    autoTokensCl100k: countTokens(autoResult.value, "cl100k"),
    autoTokensO200k: countTokens(autoResult.value, "o200k"),
    manualFullBytes: fullResult.ok ? Buffer.byteLength(fullResult.value, "utf-8") : 0,
    manualDenseBytes: denseResult.ok ? Buffer.byteLength(denseResult.value, "utf-8") : 0
  };
}

// ── Budget failure detection ────────────────────────────────────────────

function detectBudgetFailures(envelope: CeelineEnvelope): BudgetFailure[] {
  const budget = envelope.constraints.max_render_tokens;
  if (budget <= 0) return [];

  const failures: BudgetFailure[] = [];
  for (const density of DENSITIES) {
    const result = renderCeelineCompact(envelope, density);
    if (!result.ok && result.issues.some(i => i.code === "token_budget_exceeded")) {
      const match = result.issues[0].message.match(/~(\d+) tokens/);
      failures.push({
        surface: envelope.surface,
        density,
        budget,
        estimatedTokens: match ? parseInt(match[1], 10) : 0
      });
    }
  }
  return failures;
}

// ── Main ────────────────────────────────────────────────────────────────

function run(): BenchmarkReport {
  // 1. Measure every (envelope, density) combination
  const all: EnvelopeMetrics[] = [];
  for (const envelope of CORPUS) {
    for (const density of DENSITIES) {
      all.push(measureEnvelope(envelope, density));
    }
  }

  // 2. Group by surface
  const surfaces = [...new Set(all.map(m => m.surface))];
  const bySurface = surfaces.map(s => aggregate(s, all.filter(m => m.surface === s)));

  // 3. Group by density
  const byDensity = DENSITIES.map(d => aggregate(d, all.filter(m => m.density === d)));

  // 4. Overall
  const overall = aggregate("overall", all);

  // 5. Throughput
  const ITERATIONS = 1000;
  const throughputRender: Record<string, ThroughputMetrics> = {};
  const throughputParse: Record<string, ThroughputMetrics> = {};

  for (const density of DENSITIES) {
    throughputRender[density] = measureThroughput(() => {
      for (const envelope of CORPUS) {
        renderCeelineCompact(envelope, density);
        // Result unwrap not needed in throughput hot loop
      }
    }, ITERATIONS);

    // Pre-render for parse benchmark
    const compactTexts = CORPUS.map(e => {
      const r = renderCeelineCompact(e, density);
      return r.ok ? r.value : "";
    });

    throughputParse[density] = measureThroughput(() => {
      for (const text of compactTexts) {
        parseCeelineCompact(text);
      }
    }, ITERATIONS);
  }

  // 6. Trailer overhead
  const trailerOverhead: TrailerOverhead[] = [];
  for (const envelope of CORPUS) {
    for (const density of DENSITIES) {
      const overhead = measureTrailerOverhead(envelope, density);
      if (overhead) trailerOverhead.push(overhead);
    }
  }

  // 7. Auto-density comparison
  const autoDensity: AutoDensityResult[] = [];
  for (const envelope of CORPUS) {
    const ad = measureAutoDensity(envelope);
    if (ad) autoDensity.push(ad);
  }

  // 8. Budget failure detection
  const budgetFailures: BudgetFailure[] = [];
  for (const envelope of CORPUS) {
    budgetFailures.push(...detectBudgetFailures(envelope));
  }

  return {
    generated: new Date().toISOString(),
    envelopes: all,
    bySurface,
    byDensity,
    overall,
    throughput: { render: throughputRender, parse: throughputParse },
    trailerOverhead,
    autoDensity,
    budgetFailures
  };
}

// ── Formatting ──────────────────────────────────────────────────────────

function formatTable(
  title: string,
  headers: string[],
  rows: string[][],
  alignRight: boolean[] = []
): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => (r[i] ?? "").length)));
  const sep = widths.map(w => "─".repeat(w + 2)).join("┼");
  const pad = (s: string, i: number) => {
    const w = widths[i];
    return alignRight[i] ? s.padStart(w) : s.padEnd(w);
  };

  const lines = [
    "",
    `  ${title}`,
    `  ${"─".repeat(sep.length + 2)}`,
    `  │ ${headers.map((h, i) => pad(h, i)).join(" │ ")} │`,
    `  ├─${sep}─┤`,
    ...rows.map(r => `  │ ${r.map((c, i) => pad(c, i)).join(" │ ")} │`),
    `  ${"─".repeat(sep.length + 2)}`,
    ""
  ];
  return lines.join("\n");
}

function formatReport(report: BenchmarkReport): string {
  const lines: string[] = [
    "╔══════════════════════════════════════════════════════════════════╗",
    "║            CEELINE COMPACT DIALECT BENCHMARK REPORT            ║",
    `║            Generated: ${report.generated.slice(0, 19).padEnd(40)} ║`,
    "╚══════════════════════════════════════════════════════════════════╝",
    ""
  ];

  // Overall summary
  const o = report.overall;
  lines.push("  OVERALL SUMMARY");
  lines.push("  ───────────────");
  lines.push(`  Envelopes measured:      ${o.count} (${CORPUS.length} surfaces × ${DENSITIES.length} densities)`);
  lines.push(`  Round-trip fidelity:     ${o.roundTripPassRate}%`);
  lines.push("");
  lines.push(`  Byte compression:        ${o.avgByteRatio}:1 ratio  (${o.avgByteSaving}% saving)`);
  lines.push(`  Token compression (cl100k GPT-4):    ${o.avgTokenRatioCl100k}:1 ratio  (${o.avgTokenSavingCl100k}% saving)`);
  lines.push(`  Token compression (o200k GPT-4o/5):  ${o.avgTokenRatioO200k}:1 ratio  (${o.avgTokenSavingO200k}% saving)`);
  lines.push("");
  lines.push(`  Total JSON bytes:        ${o.totalJsonBytes.toLocaleString()}`);
  lines.push(`  Total Compact bytes:     ${o.totalCompactBytes.toLocaleString()}`);
  lines.push(`  Total JSON tokens (cl100k):   ${o.totalJsonTokensCl100k.toLocaleString()}`);
  lines.push(`  Total Compact tokens (cl100k): ${o.totalCompactTokensCl100k.toLocaleString()}`);
  lines.push(`  Total JSON tokens (o200k):    ${o.totalJsonTokensO200k.toLocaleString()}`);
  lines.push(`  Total Compact tokens (o200k):  ${o.totalCompactTokensO200k.toLocaleString()}`);

  // By-density table
  lines.push(formatTable(
    "COMPRESSION BY DENSITY",
    ["Density", "Byte Ratio", "Byte Save%", "cl100k Ratio", "cl100k Save%", "o200k Ratio", "o200k Save%", "RT Pass%"],
    report.byDensity.map(d => [
      d.label, `${d.avgByteRatio}:1`, `${d.avgByteSaving}%`,
      `${d.avgTokenRatioCl100k}:1`, `${d.avgTokenSavingCl100k}%`,
      `${d.avgTokenRatioO200k}:1`, `${d.avgTokenSavingO200k}%`,
      `${d.roundTripPassRate}%`
    ]),
    [false, true, true, true, true, true, true, true]
  ));

  // By-surface table
  lines.push(formatTable(
    "COMPRESSION BY SURFACE (averaged across densities)",
    ["Surface", "Byte Ratio", "Byte Save%", "cl100k Ratio", "cl100k Save%", "o200k Ratio", "o200k Save%"],
    report.bySurface.map(s => [
      s.label, `${s.avgByteRatio}:1`, `${s.avgByteSaving}%`,
      `${s.avgTokenRatioCl100k}:1`, `${s.avgTokenSavingCl100k}%`,
      `${s.avgTokenRatioO200k}:1`, `${s.avgTokenSavingO200k}%`
    ]),
    [false, true, true, true, true, true, true]
  ));

  // Throughput table
  lines.push(formatTable(
    "THROUGHPUT (1000 iterations × 8 envelopes per iteration)",
    ["Operation", "Density", "Total ms", "Envelopes/ms", "ms/Envelope"],
    [
      ...DENSITIES.map(d => {
        const r = report.throughput.render[d];
        return [`render`, d, `${r.totalMs}`, `${r.envelopesPerMs}`, `${r.avgMsPerEnvelope}`];
      }),
      ...DENSITIES.map(d => {
        const p = report.throughput.parse[d];
        return [`parse`, d, `${p.totalMs}`, `${p.envelopesPerMs}`, `${p.avgMsPerEnvelope}`];
      })
    ],
    [false, false, true, true, true]
  ));

  // Per-envelope detail (full density only as representative)
  const fullOnly = report.envelopes.filter(e => e.density === "full");
  lines.push(formatTable(
    "PER-ENVELOPE DETAIL (full density)",
    ["Surface", "JSON B", "Compact B", "Byte Ratio", "cl100k J→C", "o200k J→C", "RT"],
    fullOnly.map(e => [
      e.surface,
      `${e.jsonBytes}`,
      `${e.compactBytes}`,
      `${e.byteRatio}:1`,
      `${e.jsonTokensCl100k}→${e.compactTokensCl100k}`,
      `${e.jsonTokensO200k}→${e.compactTokensO200k}`,
      e.roundTripOk ? "✓" : "✗"
    ]),
    [false, true, true, true, true, true, false]
  ));

  // Sample compact output (one per density for the first surface)
  lines.push("  SAMPLE COMPACT OUTPUT (handoff surface)");
  lines.push("  ────────────────────────────────────────");
  for (const density of DENSITIES) {
    const sample = report.envelopes.find(e => e.surface === "handoff" && e.density === density);
    if (sample) {
      lines.push(`  [${density}]`);
      lines.push(`  ${sample.compactText.replace(/\n/g, "\n  ")}`);
      lines.push("");
    }
  }

  // Round-trip failures
  const failures = report.envelopes.filter(e => !e.roundTripOk);
  if (failures.length > 0) {
    lines.push("  ⚠ ROUND-TRIP FAILURES");
    lines.push("  ─────────────────────");
    for (const f of failures) {
      lines.push(`  ${f.surface}/${f.density}: ${f.roundTripIssues.join("; ")}`);
    }
  } else {
    lines.push("  ✓ ALL ROUND-TRIP CHECKS PASSED");
  }

  // Trailer overhead table
  if (report.trailerOverhead.length > 0) {
    lines.push(formatTable(
      "INTEGRITY TRAILER OVERHEAD (#n=<bytecount>)",
      ["Surface", "Density", "Trailer B", "Trailer cl100k", "Trailer o200k", "Content B", "Overhead%"],
      report.trailerOverhead.map(t => [
        t.surface, t.density, `${t.trailerBytes}`, `${t.trailerTokensCl100k}`,
        `${t.trailerTokensO200k}`, `${t.contentBytes}`, `${t.overheadPercent}%`
      ]),
      [false, false, true, true, true, true, true]
    ));
  }

  // Auto-density table
  if (report.autoDensity.length > 0) {
    lines.push(formatTable(
      "AUTO-DENSITY SELECTION (renderCeelineCompactAuto, no budget)",
      ["Surface", "Selected", "Auto B", "Auto cl100k", "Auto o200k", "Full B", "Dense B"],
      report.autoDensity.map(a => [
        a.surface, a.selectedDensity, `${a.autoBytes}`, `${a.autoTokensCl100k}`,
        `${a.autoTokensO200k}`, `${a.manualFullBytes}`, `${a.manualDenseBytes}`
      ]),
      [false, false, true, true, true, true, true]
    ));
  }

  // Budget failures
  if (report.budgetFailures.length > 0) {
    lines.push("  ⚠ BUDGET EXCEEDED FAILURES");
    lines.push("  ──────────────────────────");
    for (const bf of report.budgetFailures) {
      lines.push(`  ${bf.surface}/${bf.density}: budget=${bf.budget}, estimated=${bf.estimatedTokens}`);
    }
    lines.push("");
  }

  lines.push("");

  return lines.join("\n");
}

// ── Execute ─────────────────────────────────────────────────────────────

const report = run();
const text = formatReport(report);

// Write both human-readable and JSON reports
import fs from "node:fs";
import path from "node:path";

const outDir = path.resolve(path.dirname(new URL(import.meta.url).pathname));
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(outDir, "report.txt"), text);

console.log(text);
console.log(`\n  Reports written to benchmarks/report.json and benchmarks/report.txt`);

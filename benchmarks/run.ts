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
import { renderCeelineCompact, renderCeelineCompactAuto, parseCeelineCompact } from "@asafelobotomy/ceeline-core";
import type { CompactDensity, CeelineEnvelope } from "@asafelobotomy/ceeline-schema";
import { CORPUS } from "./corpus.js";
import { measureBatchComparisons, measureExternalComparables, measureMixedBatchComparisons, type BatchComparison, type ComparableFormatMetrics } from "./comparables.js";
import { stringify as yamlStringify } from "yaml";
import { encode as msgpackEncode } from "@msgpack/msgpack";
import { encode as cborEncode } from "cbor-x";

// ── Tokenizers ──────────────────────────────────────────────────────────

const cl100k = getEncoding("cl100k_base");
const o200k  = getEncoding("o200k_base");

function countTokens(text: string, encoding: "cl100k" | "o200k"): number {
  return (encoding === "cl100k" ? cl100k : o200k).encode(text).length;
}

function benchmarkCaseLabel(envelope: CeelineEnvelope): string {
  const match = envelope.envelope_id.match(/^cel:bench-(.+?)(?:-\d+)?$/);
  return match?.[1] ?? envelope.surface;
}

// ── Types ───────────────────────────────────────────────────────────────

interface EnvelopeMetrics {
  surface: string;
  label: string;
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
  formatComparison: FormatComparison[];
  batchComparison: BatchComparison[];
  mixedBatchComparison: BatchComparison[];
  reflectionVariants: ReflectionVariant[];
  percentileLatencies: PercentileLatency[];
  scaling: ScalingResult[];
  informationDensity: InformationDensity[];
}

interface TrailerOverhead {
  surface: string;
  label: string;
  density: CompactDensity;
  trailerBytes: number;
  trailerTokensCl100k: number;
  trailerTokensO200k: number;
  contentBytes: number;
  overheadPercent: number;
}

interface AutoDensityResult {
  surface: string;
  label: string;
  selectedDensity: string;
  autoBytes: number;
  autoTokensCl100k: number;
  autoTokensO200k: number;
  manualFullBytes: number;
  manualDenseBytes: number;
}

interface BudgetFailure {
  surface: string;
  label: string;
  density: CompactDensity;
  budget: number;
  estimatedTokens: number;
}

interface FormatComparison {
  surface: string;
  label: string;
  jsonBytes: number;
  jsonTokensCl100k: number;
  jsonTokensO200k: number;
  yamlBytes: number;
  yamlTokensCl100k: number;
  yamlTokensO200k: number;
  msgpackBytes: number;
  cborBytes: number;
  compactFullBytes: number;
  compactFullTokensCl100k: number;
  compactFullTokensO200k: number;
  compactDenseBytes: number;
  compactDenseTokensCl100k: number;
  compactDenseTokensO200k: number;
  comparables: ComparableFormatMetrics[];
}

interface ReflectionVariant {
  label: string;
  focus: "bytes" | "tokens";
  compactFullBytes: number;
  compactDenseBytes: number;
  byteDelta: number;
  compactFullTokensCl100k: number;
  compactDenseTokensCl100k: number;
  compactFullTokensO200k: number;
  compactDenseTokensO200k: number;
}

interface PercentileLatency {
  operation: string;
  density: CompactDensity;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
  meanMs: number;
  stdevMs: number;
}

interface ScalingResult {
  scale: string;
  factCount: number;
  jsonBytes: number;
  compactBytes: number;
  byteRatio: number;
  tokenRatioCl100k: number;
  tokenRatioO200k: number;
  renderMs: number;
  parseMs: number;
}

interface InformationDensity {
  surface: string;
  label: string;
  density: CompactDensity;
  factCount: number;
  bytesPerFact: number;
  tokensCl100kPerFact: number;
  tokensO200kPerFact: number;
  clauseCount: number;
  bytesPerClause: number;
}

// ── Measurement ─────────────────────────────────────────────────────────

const DENSITIES: CompactDensity[] = ["lite", "full", "dense"];

function measureEnvelope(envelope: CeelineEnvelope, density: CompactDensity): EnvelopeMetrics {
  const json = JSON.stringify(envelope);
  const renderResult = renderCeelineCompact(envelope, density);
  if (!renderResult.ok) {
    return {
      surface: envelope.surface, label: benchmarkCaseLabel(envelope), density,
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
    label: benchmarkCaseLabel(envelope),
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
    label: benchmarkCaseLabel(envelope),
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
    label: benchmarkCaseLabel(envelope),
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
        label: benchmarkCaseLabel(envelope),
        density,
        budget,
        estimatedTokens: match ? parseInt(match[1], 10) : 0
      });
    }
  }
  return failures;
}

// ── Format comparison measurement ───────────────────────────────────────

function measureFormatComparison(envelope: CeelineEnvelope): FormatComparison {
  const json = JSON.stringify(envelope);
  const yamlText = yamlStringify(envelope);
  const msgpack = msgpackEncode(envelope);
  const cbor = cborEncode(envelope);
  const fullResult = renderCeelineCompact(envelope, "full");
  const denseResult = renderCeelineCompact(envelope, "dense");
  const compactFull = fullResult.ok ? fullResult.value : "";
  const compactDense = denseResult.ok ? denseResult.value : "";
  const comparables = measureExternalComparables(envelope, countTokens);

  return {
    surface: envelope.surface,
    label: benchmarkCaseLabel(envelope),
    jsonBytes: Buffer.byteLength(json, "utf-8"),
    jsonTokensCl100k: countTokens(json, "cl100k"),
    jsonTokensO200k: countTokens(json, "o200k"),
    yamlBytes: Buffer.byteLength(yamlText, "utf-8"),
    yamlTokensCl100k: countTokens(yamlText, "cl100k"),
    yamlTokensO200k: countTokens(yamlText, "o200k"),
    msgpackBytes: msgpack.byteLength,
    cborBytes: cbor.byteLength,
    compactFullBytes: Buffer.byteLength(compactFull, "utf-8"),
    compactFullTokensCl100k: countTokens(compactFull, "cl100k"),
    compactFullTokensO200k: countTokens(compactFull, "o200k"),
    compactDenseBytes: Buffer.byteLength(compactDense, "utf-8"),
    compactDenseTokensCl100k: countTokens(compactDense, "cl100k"),
    compactDenseTokensO200k: countTokens(compactDense, "o200k"),
    comparables,
  };
}

function measureReflectionVariants(formatComparison: readonly FormatComparison[]): ReflectionVariant[] {
  return formatComparison
    .filter((entry) => entry.label.startsWith("reflection"))
    .map((entry) => ({
      label: entry.label,
      focus: entry.label === "reflection-token" ? "tokens" : "bytes",
      compactFullBytes: entry.compactFullBytes,
      compactDenseBytes: entry.compactDenseBytes,
      byteDelta: entry.compactDenseBytes - entry.compactFullBytes,
      compactFullTokensCl100k: entry.compactFullTokensCl100k,
      compactDenseTokensCl100k: entry.compactDenseTokensCl100k,
      compactFullTokensO200k: entry.compactFullTokensO200k,
      compactDenseTokensO200k: entry.compactDenseTokensO200k,
    }));
}

// ── Percentile latency measurement ─────────────────────────────────────

function measurePercentileLatencies(density: CompactDensity, iterations: number): PercentileLatency[] {
  // Warm up
  for (let i = 0; i < 50; i++) {
    for (const envelope of CORPUS) renderCeelineCompact(envelope, density);
  }

  // Measure render latencies
  const renderTimes: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    for (const envelope of CORPUS) renderCeelineCompact(envelope, density);
    renderTimes.push(performance.now() - start);
  }

  // Pre-render for parse benchmark
  const compactTexts = CORPUS.map(e => {
    const r = renderCeelineCompact(e, density);
    return r.ok ? r.value : "";
  });

  // Warm up parse
  for (let i = 0; i < 50; i++) {
    for (const text of compactTexts) parseCeelineCompact(text);
  }

  // Measure parse latencies
  const parseTimes: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    for (const text of compactTexts) parseCeelineCompact(text);
    parseTimes.push(performance.now() - start);
  }

  return [
    computePercentiles("render", density, renderTimes),
    computePercentiles("parse", density, parseTimes)
  ];
}

function computePercentiles(operation: string, density: CompactDensity, times: number[]): PercentileLatency {
  times.sort((a, b) => a - b);
  const n = times.length;
  const mean = times.reduce((s, t) => s + t, 0) / n;
  const variance = times.reduce((s, t) => s + (t - mean) ** 2, 0) / n;

  return {
    operation,
    density,
    p50Ms: round(times[Math.floor(n * 0.50)], 4),
    p95Ms: round(times[Math.floor(n * 0.95)], 4),
    p99Ms: round(times[Math.floor(n * 0.99)], 4),
    minMs: round(times[0], 4),
    maxMs: round(times[n - 1], 4),
    meanMs: round(mean, 4),
    stdevMs: round(Math.sqrt(variance), 4)
  };
}

// ── Payload scaling measurement ────────────────────────────────────────

function measureScaling(): ScalingResult[] {
  // Use the handoff envelope as the reference
  const base = CORPUS[0];
  const baseFacts = (base.payload as Record<string, unknown>).facts as string[];
  const scales = [1, 2, 5, 10, 20];
  const results: ScalingResult[] = [];

  for (const scale of scales) {
    // Create a scaled envelope by multiplying facts
    const scaledFacts: string[] = [];
    for (let i = 0; i < scale; i++) {
      for (const fact of baseFacts) {
        scaledFacts.push(i === 0 ? fact : `${fact} (iteration ${i + 1})`);
      }
    }

    const scaled = {
      ...base,
      constraints: { ...base.constraints, max_render_tokens: 10000 },
      payload: { ...(base.payload as Record<string, unknown>), facts: scaledFacts }
    } as CeelineEnvelope;

    const json = JSON.stringify(scaled);
    const jsonBytes = Buffer.byteLength(json, "utf-8");
    const renderResult = renderCeelineCompact(scaled, "dense");
    if (!renderResult.ok) continue;

    const compact = renderResult.value;
    const compactBytes = Buffer.byteLength(compact, "utf-8");

    const jsonCl = countTokens(json, "cl100k");
    const compactCl = countTokens(compact, "cl100k");
    const jsonO2 = countTokens(json, "o200k");
    const compactO2 = countTokens(compact, "o200k");

    // Throughput at this scale
    const SCALE_ITERATIONS = 200;
    // Warm up
    for (let i = 0; i < 20; i++) renderCeelineCompact(scaled, "dense");
    const rStart = performance.now();
    for (let i = 0; i < SCALE_ITERATIONS; i++) renderCeelineCompact(scaled, "dense");
    const renderMs = round((performance.now() - rStart) / SCALE_ITERATIONS, 4);

    // Warm up parse
    for (let i = 0; i < 20; i++) parseCeelineCompact(compact);
    const pStart = performance.now();
    for (let i = 0; i < SCALE_ITERATIONS; i++) parseCeelineCompact(compact);
    const parseMs = round((performance.now() - pStart) / SCALE_ITERATIONS, 4);

    results.push({
      scale: `${scale}x`,
      factCount: scaledFacts.length,
      jsonBytes,
      compactBytes,
      byteRatio: round(jsonBytes / compactBytes),
      tokenRatioCl100k: round(jsonCl / compactCl),
      tokenRatioO200k: round(jsonO2 / compactO2),
      renderMs,
      parseMs
    });
  }

  return results;
}

// ── Information density measurement ────────────────────────────────────

function measureInformationDensity(envelope: CeelineEnvelope, density: CompactDensity): InformationDensity | null {
  const renderResult = renderCeelineCompact(envelope, density);
  if (!renderResult.ok) return null;

  const compact = renderResult.value;
  const compactBytes = Buffer.byteLength(compact, "utf-8");
  const cl100kTokens = countTokens(compact, "cl100k");
  const o200kTokens = countTokens(compact, "o200k");

  const facts = (envelope.payload as Record<string, unknown>).facts as string[] | undefined;
  const factCount = facts?.length ?? 0;

  // Count clauses in compact text
  const sep = density === "lite" ? "\n" : " ; ";
  const clauseCount = compact.split(sep).length;

  return {
    surface: envelope.surface,
    label: benchmarkCaseLabel(envelope),
    density,
    factCount,
    bytesPerFact: factCount > 0 ? round(compactBytes / factCount) : 0,
    tokensCl100kPerFact: factCount > 0 ? round(cl100kTokens / factCount) : 0,
    tokensO200kPerFact: factCount > 0 ? round(o200kTokens / factCount) : 0,
    clauseCount,
    bytesPerClause: round(compactBytes / clauseCount)
  };
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

  // 9. Format comparison (JSON vs YAML vs MsgPack vs CBOR vs Ceeline)
  const formatComparison: FormatComparison[] = [];
  for (const envelope of CORPUS) {
    formatComparison.push(measureFormatComparison(envelope));
  }

  const reflectionVariants = measureReflectionVariants(formatComparison);

  const batchComparison = measureBatchComparisons(CORPUS, countTokens);
  const mixedBatchComparison = measureMixedBatchComparisons(CORPUS, countTokens);

  // 10. Percentile latencies
  const LATENCY_ITERATIONS = 1000;
  const percentileLatencies: PercentileLatency[] = [];
  for (const density of DENSITIES) {
    percentileLatencies.push(...measurePercentileLatencies(density, LATENCY_ITERATIONS));
  }

  // 11. Payload scaling
  const scaling = measureScaling();

  // 12. Information density
  const informationDensity: InformationDensity[] = [];
  for (const envelope of CORPUS) {
    for (const density of DENSITIES) {
      const id = measureInformationDensity(envelope, density);
      if (id) informationDensity.push(id);
    }
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
    budgetFailures,
    formatComparison,
    batchComparison,
    mixedBatchComparison,
    reflectionVariants,
    percentileLatencies,
    scaling,
    informationDensity
  };
}

function findComparable(
  comparables: readonly ComparableFormatMetrics[],
  format: string,
): ComparableFormatMetrics | undefined {
  return comparables.find((entry) => entry.format === format);
}

function formatComparableCell(
  comparables: readonly ComparableFormatMetrics[],
  format: string,
  field: "bytes" | "tokensCl100k" | "tokensO200k",
): string {
  const entry = findComparable(comparables, format);
  if (!entry) return "n/a";
  if (entry.error) return "ERR";
  if (!entry.roundTripOk) return "RT!";
  return `${entry[field]}`;
}

function formatComparablePercent(
  comparables: readonly ComparableFormatMetrics[],
  format: string,
  baseline: number,
  field: "bytes" | "tokensCl100k" | "tokensO200k",
): string {
  const entry = findComparable(comparables, format);
  if (!entry || entry.error || baseline === 0) return "n/a";
  return `${round((entry[field] / baseline) * 100)}%`;
}

function totalComparableMetric(
  rows: readonly FormatComparison[],
  format: string,
  field: "bytes" | "tokensCl100k" | "tokensO200k",
): number | null {
  const matches = rows
    .map((row) => findComparable(row.comparables, format))
    .filter((entry): entry is ComparableFormatMetrics => Boolean(entry && !entry.error && entry.roundTripOk));
  if (matches.length === 0) return null;
  return matches.reduce((sum, entry) => sum + entry[field], 0);
}

function batchMetricCell(
  comparison: BatchComparison,
  format: string,
  field: "bytes" | "tokensCl100k" | "tokensO200k",
): string {
  const entry = findComparable(comparison.formats, format);
  if (!entry) return "n/a";
  if (entry.error) return "ERR";
  if (!entry.roundTripOk) return "RT!";
  return `${round(entry[field] / comparison.recordCount)}`;
}

function losslessComparableEntries(
  comparables: readonly ComparableFormatMetrics[],
  format: string,
): ComparableFormatMetrics | undefined {
  const entry = findComparable(comparables, format);
  return entry && !entry.error && entry.roundTripOk ? entry : undefined;
}

function summarizeLosslessOneShot(
  rows: readonly FormatComparison[],
): Array<{ format: string; cases: number; bytes: number; tokensCl100k: number; tokensO200k: number; }> {
  const formats = ["pakt", "jtml", "zipson", "jsonschema-key-compression"] as const;

  return formats.flatMap((format) => {
    const entries = rows
      .map((row) => losslessComparableEntries(row.comparables, format))
      .filter((entry): entry is ComparableFormatMetrics => Boolean(entry));

    if (entries.length !== rows.length) return [];

    return [{
      format,
      cases: entries.length,
      bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
      tokensCl100k: entries.reduce((sum, entry) => sum + entry.tokensCl100k, 0),
      tokensO200k: entries.reduce((sum, entry) => sum + entry.tokensO200k, 0),
    }];
  });
}

function summarizeLosslessBatch(
  rows: readonly BatchComparison[],
): Array<{ format: string; groups: number; bytesPerRecord: number; tokensCl100kPerRecord: number; tokensO200kPerRecord: number; }> {
  const formats = [
    "json",
    "ceeline-full",
    "ceeline-dense",
    "pakt",
    "jtml",
    "jtml-ref",
    "zipson",
    "jsonschema-key-compression",
    "tonl",
  ] as const;

  return formats.flatMap((format) => {
    const entries = rows
      .map((row) => {
        const entry = findComparable(row.formats, format);
        return entry && !entry.error && entry.roundTripOk
          ? { entry, row }
          : undefined;
      })
      .filter((entry): entry is { entry: ComparableFormatMetrics; row: BatchComparison } => Boolean(entry));

    if (entries.length !== rows.length) return [];

    const bytesPerRecord = entries.reduce((sum, { entry, row }) => sum + entry.bytes / row.recordCount, 0) / entries.length;
    const tokensCl100kPerRecord = entries.reduce((sum, { entry, row }) => sum + entry.tokensCl100k / row.recordCount, 0) / entries.length;
    const tokensO200kPerRecord = entries.reduce((sum, { entry, row }) => sum + entry.tokensO200k / row.recordCount, 0) / entries.length;

    return [{
      format,
      groups: entries.length,
      bytesPerRecord: round(bytesPerRecord),
      tokensCl100kPerRecord: round(tokensCl100kPerRecord),
      tokensO200kPerRecord: round(tokensO200kPerRecord),
    }];
  });
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
  lines.push(`  Envelopes measured:      ${o.count} (${CORPUS.length} corpus envelopes × ${DENSITIES.length} densities)`);
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
    `THROUGHPUT (1000 iterations × ${CORPUS.length} envelopes per iteration)`,
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
    ["Case", "JSON B", "Compact B", "Byte Ratio", "cl100k J→C", "o200k J→C", "RT"],
    fullOnly.map(e => [
      e.label,
      `${e.jsonBytes}`,
      `${e.compactBytes}`,
      `${e.byteRatio}:1`,
      `${e.jsonTokensCl100k}→${e.compactTokensCl100k}`,
      `${e.jsonTokensO200k}→${e.compactTokensO200k}`,
      e.roundTripOk ? "✓" : "✗"
    ]),
    [false, true, true, true, true, true, false]
  ));

  if (report.reflectionVariants.length > 0) {
    lines.push(formatTable(
      "REFLECTION VARIANTS (byte-oriented vs token-oriented)",
      ["Case", "Focus", "Full B", "Dense B", "dB", "Full cl100k", "Dense cl100k", "Full o200k", "Dense o200k"],
      report.reflectionVariants.map((entry) => [
        entry.label,
        entry.focus,
        `${entry.compactFullBytes}`,
        `${entry.compactDenseBytes}`,
        `${entry.byteDelta}`,
        `${entry.compactFullTokensCl100k}`,
        `${entry.compactDenseTokensCl100k}`,
        `${entry.compactFullTokensO200k}`,
        `${entry.compactDenseTokensO200k}`,
      ]),
      [false, false, true, true, true, true, true, true, true]
    ));
  }

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
      lines.push(`  ${f.label}/${f.density}: ${f.roundTripIssues.join("; ")}`);
    }
  } else {
    lines.push("  ✓ ALL ROUND-TRIP CHECKS PASSED");
  }

  // Trailer overhead table
  if (report.trailerOverhead.length > 0) {
    lines.push(formatTable(
      "INTEGRITY TRAILER OVERHEAD (#n=<bytecount>)",
      ["Case", "Density", "Trailer B", "Trailer cl100k", "Trailer o200k", "Content B", "Overhead%"],
      report.trailerOverhead.map(t => [
        t.label, t.density, `${t.trailerBytes}`, `${t.trailerTokensCl100k}`,
        `${t.trailerTokensO200k}`, `${t.contentBytes}`, `${t.overheadPercent}%`
      ]),
      [false, false, true, true, true, true, true]
    ));
  }

  // Auto-density table
  if (report.autoDensity.length > 0) {
    lines.push(formatTable(
      "AUTO-DENSITY SELECTION (renderCeelineCompactAuto, no budget)",
      ["Case", "Selected", "Auto B", "Auto cl100k", "Auto o200k", "Full B", "Dense B"],
      report.autoDensity.map(a => [
        a.label, a.selectedDensity, `${a.autoBytes}`, `${a.autoTokensCl100k}`,
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
      lines.push(`  ${bf.label}/${bf.density}: budget=${bf.budget}, estimated=${bf.estimatedTokens}`);
    }
    lines.push("");
  }

  // Format comparison table
  if (report.formatComparison.length > 0) {
    lines.push(formatTable(
      "FORMAT COMPARISON (JSON vs YAML vs MsgPack vs CBOR vs Ceeline)",
      ["Case", "JSON B", "YAML B", "MsgPack B", "CBOR B", "Cee Full B", "Cee Dense B"],
      report.formatComparison.map(f => [
        f.label, `${f.jsonBytes}`, `${f.yamlBytes}`, `${f.msgpackBytes}`,
        `${f.cborBytes}`, `${f.compactFullBytes}`, `${f.compactDenseBytes}`
      ]),
      [false, true, true, true, true, true, true]
    ));

    lines.push(formatTable(
      "TOKEN COMPARISON — TEXT FORMATS ONLY (LLM-readable, cl100k)",
      ["Case", "JSON tok", "YAML tok", "Cee Full tok", "Cee Dense tok", "Cee/JSON %", "Cee/YAML %"],
      report.formatComparison.map(f => [
        f.label, `${f.jsonTokensCl100k}`, `${f.yamlTokensCl100k}`,
        `${f.compactFullTokensCl100k}`, `${f.compactDenseTokensCl100k}`,
        `${round((f.compactDenseTokensCl100k / f.jsonTokensCl100k) * 100)}%`,
        `${round((f.compactDenseTokensCl100k / f.yamlTokensCl100k) * 100)}%`
      ]),
      [false, true, true, true, true, true, true]
    ));

    lines.push(formatTable(
      "TOKEN COMPARISON — TEXT FORMATS ONLY (LLM-readable, o200k)",
      ["Case", "JSON tok", "YAML tok", "Cee Full tok", "Cee Dense tok", "Cee/JSON %", "Cee/YAML %"],
      report.formatComparison.map(f => [
        f.label, `${f.jsonTokensO200k}`, `${f.yamlTokensO200k}`,
        `${f.compactFullTokensO200k}`, `${f.compactDenseTokensO200k}`,
        `${round((f.compactDenseTokensO200k / f.jsonTokensO200k) * 100)}%`,
        `${round((f.compactDenseTokensO200k / f.yamlTokensO200k) * 100)}%`
      ]),
      [false, true, true, true, true, true, true]
    ));

    // Summary row
    const totals = report.formatComparison.reduce((acc, f) => ({
      json: acc.json + f.jsonBytes,
      yaml: acc.yaml + f.yamlBytes,
      msgpack: acc.msgpack + f.msgpackBytes,
      cbor: acc.cbor + f.cborBytes,
      ceeFull: acc.ceeFull + f.compactFullBytes,
      ceeDense: acc.ceeDense + f.compactDenseBytes
    }), { json: 0, yaml: 0, msgpack: 0, cbor: 0, ceeFull: 0, ceeDense: 0 });

    lines.push("  FORMAT BYTE TOTALS (all surfaces)");
    lines.push("  ─────────────────────────────────");
    lines.push(`  JSON:                ${totals.json.toLocaleString()} bytes`);
    lines.push(`  YAML:                ${totals.yaml.toLocaleString()} bytes  (${round(totals.yaml / totals.json * 100)}% of JSON)`);
    lines.push(`  MsgPack (binary):    ${totals.msgpack.toLocaleString()} bytes  (${round(totals.msgpack / totals.json * 100)}% of JSON)`);
    lines.push(`  CBOR (binary):       ${totals.cbor.toLocaleString()} bytes  (${round(totals.cbor / totals.json * 100)}% of JSON)`);
    lines.push(`  Ceeline full:        ${totals.ceeFull.toLocaleString()} bytes  (${round(totals.ceeFull / totals.json * 100)}% of JSON)`);
    lines.push(`  Ceeline dense:       ${totals.ceeDense.toLocaleString()} bytes  (${round(totals.ceeDense / totals.json * 100)}% of JSON)`);
    lines.push("");

    lines.push(formatTable(
      "EXTERNAL BASELINES — ONE SHOT BYTES",
      ["Case", "PAKT B", "JTML B", "Zipson B", "JSKC B"],
      report.formatComparison.map(f => [
        f.label,
        formatComparableCell(f.comparables, "pakt", "bytes"),
        formatComparableCell(f.comparables, "jtml", "bytes"),
        formatComparableCell(f.comparables, "zipson", "bytes"),
        formatComparableCell(f.comparables, "jsonschema-key-compression", "bytes"),
      ]),
      [false, true, true, true, true]
    ));

    lines.push(formatTable(
      "EXTERNAL BASELINES — ONE SHOT TOKENS (cl100k)",
      ["Case", "JSON", "Cee Dense", "PAKT", "JTML", "Zipson", "JSKC"],
      report.formatComparison.map(f => [
        f.label,
        `${f.jsonTokensCl100k}`,
        `${f.compactDenseTokensCl100k}`,
        formatComparableCell(f.comparables, "pakt", "tokensCl100k"),
        formatComparableCell(f.comparables, "jtml", "tokensCl100k"),
        formatComparableCell(f.comparables, "zipson", "tokensCl100k"),
        formatComparableCell(f.comparables, "jsonschema-key-compression", "tokensCl100k"),
      ]),
      [false, true, true, true, true, true, true]
    ));

    const losslessOneShot = summarizeLosslessOneShot(report.formatComparison);
    if (losslessOneShot.length > 0) {
      lines.push(formatTable(
        "LOSSLESS-ONLY SUMMARY — ONE SHOT",
        ["Format", "Cases", "Bytes", "% JSON", "cl100k", "% JSON tok", "o200k"],
        losslessOneShot.map((entry) => [
          entry.format,
          `${entry.cases}`,
          `${entry.bytes}`,
          `${round((entry.bytes / totals.json) * 100)}%`,
          `${entry.tokensCl100k}`,
          `${round((entry.tokensCl100k / report.formatComparison.reduce((sum, row) => sum + row.jsonTokensCl100k, 0)) * 100)}%`,
          `${entry.tokensO200k}`,
        ]),
        [false, true, true, true, true, true, true]
      ));
    }

    if (losslessOneShot.length > 0) {
      lines.push("  EXTERNAL BASELINE TOTALS (one-shot, fully lossless formats only)");
      lines.push("  ─────────────────────────────────────────────────────────────");
      for (const entry of losslessOneShot) {
        lines.push(
          `  ${entry.format}: ${entry.bytes.toLocaleString()} bytes (${round(entry.bytes / totals.json * 100)}% of JSON), ${entry.tokensCl100k.toLocaleString()} cl100k tokens`,
        );
      }
      lines.push("");
    }
  }

  if (report.batchComparison.length > 0) {
    lines.push(formatTable(
      "BATCH TRACK — BYTES PER RECORD (per surface)",
      ["Surface", "N", "JSON", "Cee Dense", "PAKT", "JTML", "JTML Ref", "Zipson", "JSKC", "TONL"],
      report.batchComparison.map(batch => [
        batch.surface,
        `${batch.recordCount}`,
        batchMetricCell(batch, "json", "bytes"),
        batchMetricCell(batch, "ceeline-dense", "bytes"),
        batchMetricCell(batch, "pakt", "bytes"),
        batchMetricCell(batch, "jtml", "bytes"),
        batchMetricCell(batch, "jtml-ref", "bytes"),
        batchMetricCell(batch, "zipson", "bytes"),
        batchMetricCell(batch, "jsonschema-key-compression", "bytes"),
        batchMetricCell(batch, "tonl", "bytes"),
      ]),
      [false, true, true, true, true, true, true, true, true, true]
    ));

    lines.push(formatTable(
      "BATCH TRACK — TOKENS PER RECORD (cl100k)",
      ["Surface", "N", "JSON", "Cee Dense", "PAKT", "JTML", "JTML Ref", "Zipson", "JSKC", "TONL"],
      report.batchComparison.map(batch => [
        batch.surface,
        `${batch.recordCount}`,
        batchMetricCell(batch, "json", "tokensCl100k"),
        batchMetricCell(batch, "ceeline-dense", "tokensCl100k"),
        batchMetricCell(batch, "pakt", "tokensCl100k"),
        batchMetricCell(batch, "jtml", "tokensCl100k"),
        batchMetricCell(batch, "jtml-ref", "tokensCl100k"),
        batchMetricCell(batch, "zipson", "tokensCl100k"),
        batchMetricCell(batch, "jsonschema-key-compression", "tokensCl100k"),
        batchMetricCell(batch, "tonl", "tokensCl100k"),
      ]),
      [false, true, true, true, true, true, true, true, true, true]
    ));

    const losslessBatch = summarizeLosslessBatch(report.batchComparison);
    if (losslessBatch.length > 0) {
      lines.push(formatTable(
        "LOSSLESS-ONLY SUMMARY — PER-SURFACE BATCH",
        ["Format", "Groups", "B/Record", "cl100k/Record", "o200k/Record"],
        losslessBatch.map((entry) => [
          entry.format,
          `${entry.groups}`,
          `${entry.bytesPerRecord}`,
          `${entry.tokensCl100kPerRecord}`,
          `${entry.tokensO200kPerRecord}`,
        ]),
        [false, true, true, true, true]
      ));
    }

    const batchFailures = report.batchComparison.flatMap((batch) =>
      batch.formats
        .filter((entry) => entry.error || !entry.roundTripOk)
        .map((entry) => `${batch.surface}/n=${batch.recordCount}/${entry.format}: ${entry.error ?? "round-trip mismatch"}`),
    );

    if (batchFailures.length > 0) {
      lines.push("  ⚠ BATCH TRACK FAILURES");
      lines.push("  ─────────────────────");
      for (const failure of batchFailures) lines.push(`  ${failure}`);
      lines.push("");
    } else {
      lines.push("  ✓ ALL BATCH TRACK ROUND-TRIP CHECKS PASSED");
      lines.push("");
    }
  }

  if (report.mixedBatchComparison.length > 0) {
    lines.push(formatTable(
      "MIXED-CORPUS BATCH — BYTES PER RECORD",
      ["Group", "N", "JSON", "Cee Dense", "PAKT", "JTML", "JTML Ref", "Zipson", "JSKC", "TONL"],
      report.mixedBatchComparison.map(batch => [
        batch.surface,
        `${batch.recordCount}`,
        batchMetricCell(batch, "json", "bytes"),
        batchMetricCell(batch, "ceeline-dense", "bytes"),
        batchMetricCell(batch, "pakt", "bytes"),
        batchMetricCell(batch, "jtml", "bytes"),
        batchMetricCell(batch, "jtml-ref", "bytes"),
        batchMetricCell(batch, "zipson", "bytes"),
        batchMetricCell(batch, "jsonschema-key-compression", "bytes"),
        batchMetricCell(batch, "tonl", "bytes"),
      ]),
      [false, true, true, true, true, true, true, true, true, true]
    ));

    lines.push(formatTable(
      "MIXED-CORPUS BATCH — TOKENS PER RECORD (cl100k)",
      ["Group", "N", "JSON", "Cee Dense", "PAKT", "JTML", "JTML Ref", "Zipson", "JSKC", "TONL"],
      report.mixedBatchComparison.map(batch => [
        batch.surface,
        `${batch.recordCount}`,
        batchMetricCell(batch, "json", "tokensCl100k"),
        batchMetricCell(batch, "ceeline-dense", "tokensCl100k"),
        batchMetricCell(batch, "pakt", "tokensCl100k"),
        batchMetricCell(batch, "jtml", "tokensCl100k"),
        batchMetricCell(batch, "jtml-ref", "tokensCl100k"),
        batchMetricCell(batch, "zipson", "tokensCl100k"),
        batchMetricCell(batch, "jsonschema-key-compression", "tokensCl100k"),
        batchMetricCell(batch, "tonl", "tokensCl100k"),
      ]),
      [false, true, true, true, true, true, true, true, true, true]
    ));

    const mixedLossless = summarizeLosslessBatch(report.mixedBatchComparison);
    if (mixedLossless.length > 0) {
      lines.push(formatTable(
        "LOSSLESS-ONLY SUMMARY — MIXED BATCH",
        ["Format", "Groups", "B/Record", "cl100k/Record", "o200k/Record"],
        mixedLossless.map((entry) => [
          entry.format,
          `${entry.groups}`,
          `${entry.bytesPerRecord}`,
          `${entry.tokensCl100kPerRecord}`,
          `${entry.tokensO200kPerRecord}`,
        ]),
        [false, true, true, true, true]
      ));
    }

    const mixedFailures = report.mixedBatchComparison.flatMap((batch) =>
      batch.formats
        .filter((entry) => entry.error || !entry.roundTripOk)
        .map((entry) => `${batch.surface}/n=${batch.recordCount}/${entry.format}: ${entry.error ?? "round-trip mismatch"}`),
    );

    if (mixedFailures.length > 0) {
      lines.push("  ⚠ MIXED-CORPUS BATCH FAILURES");
      lines.push("  ─────────────────────────────");
      for (const failure of mixedFailures) lines.push(`  ${failure}`);
      lines.push("");
    } else {
      lines.push("  ✓ ALL MIXED-CORPUS BATCH ROUND-TRIP CHECKS PASSED");
      lines.push("");
    }
  }

  // Percentile latencies table
  if (report.percentileLatencies.length > 0) {
    lines.push(formatTable(
      `PERCENTILE LATENCIES (ms per iteration of ${CORPUS.length} envelopes, N=1000)`,
      ["Operation", "Density", "p50", "p95", "p99", "min", "max", "mean", "stdev"],
      report.percentileLatencies.map(p => [
        p.operation, p.density, `${p.p50Ms}`, `${p.p95Ms}`, `${p.p99Ms}`,
        `${p.minMs}`, `${p.maxMs}`, `${p.meanMs}`, `${p.stdevMs}`
      ]),
      [false, false, true, true, true, true, true, true, true]
    ));
  }

  // Payload scaling table
  if (report.scaling.length > 0) {
    lines.push(formatTable(
      "PAYLOAD SCALING (handoff surface, dense density, varied fact count)",
      ["Scale", "Facts", "JSON B", "Compact B", "Byte Ratio", "cl100k Ratio", "o200k Ratio", "Render ms", "Parse ms"],
      report.scaling.map(s => [
        s.scale, `${s.factCount}`, `${s.jsonBytes}`, `${s.compactBytes}`,
        `${s.byteRatio}:1`, `${s.tokenRatioCl100k}:1`, `${s.tokenRatioO200k}:1`,
        `${s.renderMs}`, `${s.parseMs}`
      ]),
      [false, true, true, true, true, true, true, true, true]
    ));
  }

  // Information density table (dense density only, as representative)
  const denseInfo = report.informationDensity.filter(i => i.density === "dense");
  if (denseInfo.length > 0) {
    lines.push(formatTable(
      "INFORMATION DENSITY (dense density)",
      ["Case", "Facts", "Clauses", "B/Fact", "cl100k/Fact", "o200k/Fact", "B/Clause"],
      denseInfo.map(i => [
        i.label, `${i.factCount}`, `${i.clauseCount}`,
        `${i.bytesPerFact}`, `${i.tokensCl100kPerFact}`, `${i.tokensO200kPerFact}`,
        `${i.bytesPerClause}`
      ]),
      [false, true, true, true, true, true, true]
    ));
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

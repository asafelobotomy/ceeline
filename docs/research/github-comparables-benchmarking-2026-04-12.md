# GitHub Comparables And Benchmarking Strategy

Date: 2026-04-12

## Summary

Ceeline sits in a narrow lane: TypeScript-based, lossless-first, schema-aware or structure-aware compression for model-visible internal data. The closest public GitHub comparisons are not the most-starred generic serializers. The best benchmark targets are the repos that can be driven from Node/TypeScript, round-trip structured JSON, and expose a compact text or compact transport representation that can be measured with the same byte and tokenizer metrics Ceeline already uses.

The strongest benchmark set is:

1. `sriinnu/clipforge-PAKT`
2. `thushanthbengre22-dev/jtml`
3. `pubkey/jsonschema-key-compression`
4. `jgranstrom/zipson`
5. `kryptomrx/tonl-mcp-bridge`

This is a benchmark-priority ranking, not a stars ranking. It weights semantic similarity and benchmark fit above popularity.

## Selection Criteria

- TypeScript or Node-first build surface
- Public repo with a usable library or CLI surface
- Structured-data compression or structured serialization, not generic archive compression
- Lossless path available, or a clearly configurable lossless mode
- Practical benchmark fit against Ceeline's existing JSON-envelope corpus
- Evidence of active build and test surfaces, or explicit benchmark scripts

## Top 5

| Priority | Repo | Stars | Build Shape | Why It Matches Ceeline | Benchmark Fit | Main Caveat |
|---|---|---:|---|---|---|---|
| 1 | `sriinnu/clipforge-PAKT` | 20 | TypeScript monorepo, `pnpm` + `turbo`, `build`, `test`, `bench`, library + CLI + MCP | Lossless-first prompt compression for JSON/YAML/CSV/Markdown, explicit token focus, direct Node integration | Excellent direct comparator for bytes, tokens, round-trip, and CLI/library UX | Must keep comparison on lossless `L1-L3`; do not enable lossy `L4` |
| 2 | `thushanthbengre22-dev/jtml` | 1 | TypeScript package, `tsup`, `vitest`, explicit `benchmark` script, library + CLI | Schema-first token-minimized language for LLM prompts, very close to Ceeline's structured-text positioning | Excellent direct comparator, especially for schema/header amortization | Young project with light ecosystem maturity |
| 3 | `pubkey/jsonschema-key-compression` | 99 | TypeScript package, `build`, `test`, `test:performance`, `test:efficiency` | Schema-first JSON key compression while preserving valid JSON | Strong structural baseline using Ceeline schemas | Requires usable JSON Schema per benchmark input |
| 4 | `jgranstrom/zipson` | 515 | TypeScript package, `tsc`, Mocha tests, stringify/parse API | Mature direct JSON stringify/parse compressor, easy to slot into current harness | Very strong generic JSON-compression baseline | Not token-aware and default float behavior must be forced lossless |
| 5 | `kryptomrx/tonl-mcp-bridge` | 3 | TypeScript package, `build`, `test`, `benchmark`, library + CLI + MCP | Token-optimized structured text for JSON/YAML, very relevant to LLM cost reduction | Valuable for batch and tabular tracks | Unfair on Ceeline's current one-envelope track because TONL is designed for repeated-record datasets |

## Why These 5

### 1. ClipForge PAKT

Repo: <https://github.com/sriinnu/clipforge-PAKT>

Relevant signals:

- TypeScript monorepo with `pnpm build`, `pnpm test`, and `pnpm bench`
- Library, CLI, and MCP surfaces, which mirrors Ceeline's multi-surface build shape more closely than most alternatives
- README explicitly describes lossless layers `L1-L3` and a separate lossy `L4`
- README publishes token savings snapshots and release-facing benchmark notes

Why it matters:

- This is the best direct public benchmark target for Ceeline's core claim: compact, structured, model-visible text with a lossless path.

How to benchmark it:

- Feed Ceeline's canonical JSON envelope text into PAKT's `compress()`
- Keep `semanticBudget` off so the run stays lossless
- Decompress back to JSON and compare exact equality
- Measure bytes, `cl100k`, `o200k`, encode time, decode time

### 2. JTML

Repo: <https://github.com/thushanthbengre22-dev/jtml>

Relevant signals:

- TypeScript package with `build`, `test`, and `benchmark` scripts
- Library and CLI surface
- README exposes `encode`, `decode`, `compareTokens`, and schema reuse options
- README positions JTML as schema-first encoding for token-efficient LLM prompts

Why it matters:

- JTML is the closest public conceptual analogue to Ceeline's clause language among the repos reviewed.

How to benchmark it:

- Encode each Ceeline envelope object with schema included for one-shot comparisons
- Also run a schema-reuse track with `schemaRef` and `includeSchema: false`
- Decode and compare to the original envelope object
- Measure bytes and external token counts, not JTML's internal estimates only

### 3. jsonschema-key-compression

Repo: <https://github.com/pubkey/jsonschema-key-compression>

Relevant signals:

- TypeScript package with explicit `test:performance` and `test:efficiency`
- README shows exact API: `createCompressionTable`, `compressObject`, `decompressObject`
- Maintains valid JSON rather than switching to a new text syntax
- Strong schema-first fit with Ceeline's existing schema package

Why it matters:

- This is the cleanest schema-first baseline for answering whether Ceeline beats simple key compression on the same envelope shapes.

How to benchmark it:

- Generate or adapt JSON Schema for each Ceeline surface or a common envelope schema
- Build a compression table once per schema
- Compress the envelope object and serialize the result as JSON
- Decompress and compare exact equality

### 4. Zipson

Repo: <https://github.com/jgranstrom/zipson>

Relevant signals:

- Mature TypeScript package with direct `stringify()` and `parse()` API
- Zero-config JSON replacement positioning
- No special schema or corpus requirements
- Large stars lead among the actually relevant TypeScript candidates

Why it matters:

- Zipson is the easiest generic text-compression baseline to integrate into Ceeline's existing benchmark harness.

How to benchmark it:

- Use `stringify(envelope, { fullPrecisionFloats: true })`
- Parse back with `parse()` and compare exact equality
- Measure bytes and token counts on the Zipson string output

Notes:

- The default float precision reduction is not acceptable for a strict lossless comparison. Force full precision.

### 5. TONL-MCP Bridge

Repo: <https://github.com/kryptomrx/tonl-mcp-bridge>

Relevant signals:

- TypeScript library + CLI + MCP server
- Explicit `benchmark` scripts and published token-savings tables
- README is very clear that TONL excels on repeated structured datasets and is weaker on small single objects

Why it matters:

- TONL is highly relevant to Ceeline's broader value proposition around LLM token reduction, but only on the right workload shape.

How to benchmark it:

- Do not use TONL as a headline result on Ceeline's current one-envelope-per-surface benchmark
- Benchmark it on batched arrays of envelopes, NDJSON-style records, or repeated per-surface corpora
- Use `jsonToTonl()` and `tonlToJson()` for the round-trip path

## Useful Reference But Not A Top-5 Competitor

### file-format-token-accuracy-benchmark

Repo: <https://github.com/thoeltig/file-format-token-accuracy-benchmark>

Why it matters:

- It is a benchmark methodology repo, not a compression library competitor
- It compares file formats for LLM consumption and includes TOON in the mix
- It is useful for shaping benchmark presentation and task-quality validation, but it is not a direct Ceeline-vs-library target

## Recommended Benchmark Tracks

Ceeline should not use a single scoreboard for all five repos. A fair comparison needs multiple tracks.

### Track A: One-Shot Envelope

Use the current Ceeline corpus as-is, one envelope at a time.

Measure:

- output bytes
- `cl100k` tokens
- `o200k` tokens
- exact round-trip fidelity
- encode time
- decode time

Use this track for:

- Ceeline
- PAKT
- JTML
- jsonschema-key-compression
- Zipson

Do not use this track as the primary TONL score.

### Track B: Batched Envelope Arrays

Batch envelopes by surface and also as a mixed corpus array at sizes like 10, 100, and 1000 items.

Measure:

- bytes and tokens per record
- total bytes and tokens
- round-trip fidelity
- encode and decode throughput

Use this track for:

- Ceeline dense and full
- JTML with schema reuse
- TONL
- PAKT
- jsonschema-key-compression
- Zipson

This is the fairest place to compare Ceeline against TONL.

### Track C: Schema/Header Amortization

Explicitly separate first-message cost from repeated-message cost.

Measure:

- first item with schema/header included
- subsequent items with schema/header reused or omitted

Use this track for:

- Ceeline
- JTML
- TONL
- jsonschema-key-compression

This track matters because Ceeline and JTML both pay a structural declaration cost that amortizes over repeated shapes.

### Track D: Text-Readable Only

Compare only formats that remain directly text-readable by an LLM or operator.

Use this track for:

- Ceeline
- PAKT
- JTML
- TONL
- JSON
- YAML

Exclude binary codecs and valid-but-opaque encodings from the headline chart.

### Track E: Generic Compression Baseline

Use this track to answer whether Ceeline beats general-purpose JSON alternatives.

Use this track for:

- Ceeline
- Zipson
- jsonschema-key-compression
- JSON
- YAML
- existing MsgPack and CBOR baselines

## Normalization Rules

- Use Ceeline's canonical JSON envelope as the source of truth
- Count tokens externally with the same `js-tiktoken` tokenizers Ceeline already uses
- Require exact round-trip equality for every lossless comparison
- Disable any lossy mode by default
- Report both per-message and amortized batch numbers
- Keep binary and text-readable results on separate tables

## Recommended Implementation Order

1. Integrate PAKT first. It is the strongest head-to-head text-format comparison.
2. Integrate JTML second. It is the closest schema-first prompt-format analogue.
3. Integrate Zipson third. It is the fastest generic baseline to wire in.
4. Integrate jsonschema-key-compression fourth. It needs schema plumbing but answers an important structural question.
5. Integrate TONL last, but only after a batch track exists.

## Concrete Integration Notes

### PAKT

- Benchmark mode should stay lossless
- Use Ceeline JSON strings directly
- Compare against Ceeline in both one-shot and batched tracks

### JTML

- Run both schema-included and schema-reuse modes
- Use external tokenizers for fairness
- Treat schema reuse as a separate reported number, not a hidden optimization

### Zipson

- Force `fullPrecisionFloats: true`
- Compare its output as a text baseline, not as an LLM-oriented format

### jsonschema-key-compression

- Generate compression tables once per schema outside the hot loop
- Use Ceeline's schema package as the source for envelope schema definitions where possible

### TONL

- Use repeated rows or arrays of envelope-shaped objects
- Do not headline a single-object result because TONL's own README says overhead dominates there

## Bottom Line

If the goal is a credible public benchmark story, Ceeline should benchmark itself first against PAKT and JTML as direct structured-text competitors, then against Zipson and jsonschema-key-compression as generic and schema-first baselines, and only compare against TONL on batched structured data where TONL is designed to win.
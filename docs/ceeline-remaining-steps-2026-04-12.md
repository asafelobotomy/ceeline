# Ceeline Remaining Steps

> Date: 2026-04-12
> Scope: active follow-up work after the robustness and evolution changes
> Last updated: 2026-04-12

## Current State

The following are implemented:

- `agent` added to allowed `source.kind` values
- validation added for all 8 active surfaces
- `renderCeelineCompact()` now returns `CeelineResult<string>`
- `max_render_tokens` is enforced during render
- `renderCeelineCompactAuto()` selects density from token budget
- parser uses surface-scoped field decoders
- compact output includes `#n=<bytecount>` integrity trailer
- language spec documents trailer, CeelineResult, auto-density, and mx= key
- 164 regression tests covering validation, render, parse, round-trip, and
  golden snapshot stability
- 24 golden compact fixtures (8 surfaces × 3 densities) in
  `packages/fixtures/compact/`
- benchmarks report trailer overhead, auto-density comparison, and budget
  failure detection
- token strategy decided: 4-byte heuristic in core, optional tokenizer in
  CLI/benchmarks only

## Completed Work

### 1. Update docs to match the current API ✓

- Language spec updated with `CeelineResult<string>` return type
- `renderCeelineCompactAuto()` documented as preferred budget-aware renderer
- Round-trip snippets use `CeelineResult` unwrapping
- Header keys list includes `rs=`, `sz=`, `mx=`
- Implemented Scaffold section lists all public API functions

### 2. Document the integrity trailer ✓

- `#n=<bytecount>` grammar added to compact dialect spec
- Byte count semantics documented (content before trailer)
- Parser behaviour on mismatch documented (`integrity_mismatch` warning, content
  treated as potentially truncated)
- Compact examples include trailer

### 3. Add regression tests ✓

164 tests across 7 files:

- `validate.test.ts`: all 5 source.kind values, all 8 surfaces valid, surface-
  specific field rejection
- `compact-render.test.ts`: all 8×3 density combinations, token_budget_exceeded,
  trailer presence, density format correctness
- `compact-auto.test.ts`: operator prefers lite, machine prefers full, budget
  exceeded when no density fits, no budget defaults to full
- `compact-parse.test.ts`: trailer acceptance, integrity_mismatch on tampered
  content, unknown clause/header preservation, cross-surface key rejection,
  extension parsing, required field failures
- `round-trip.test.ts`: render→parse for all 8×3 combinations, preserve tokens,
  extension clauses

### 4. Add golden compact fixtures ✓

- 24 `.txt` fixtures in `packages/fixtures/compact/` for all 8 surfaces × 3
  densities
- `golden-generate.test.ts` regenerates fixtures from current renderer
- `golden-snapshot.test.ts` verifies byte-for-byte stability and parse
  round-trip

### 5. Extend the benchmark harness ✓

- Trailer overhead table: bytes and token cost of `#n=` per surface/density
- Auto-density comparison: selected density, bytes, and tokens vs manual
  full/dense
- Budget failure detection across corpus
- Reports regenerated in `benchmarks/report.json` and `benchmarks/report.txt`

### 6. Decide the long-term token counting strategy ✓

Decision: keep the portable 4-byte heuristic (`ceil(bytes / 4)`) in core
permanently. The core library remains dependency-free and portable.

Accurate tokenizer-backed counting (js-tiktoken) is used only in:

- `benchmarks/run.ts` for reporting cl100k and o200k token counts
- the CLI or adapter layer if precise budget enforcement is needed

Rationale: the heuristic is conservative (overestimates tokens), which means
budget enforcement errs on the side of safety. Real tokenizer cost is a runtime
dependency inappropriate for a lightweight core library. The benchmark reports
confirm the heuristic produces comparable compression ratios to tokenizer-backed
counts.

### 7. Update external-facing examples and notes ✓

- Design brief reviewed; remains accurate as high-level product spec
- Benchmarks re-run with current code; `report.json` and `report.txt`
  regenerated with trailer, auto-density, and budget failure sections
- Remaining-steps doc updated to reflect all completed work

## Not Yet Started

These were discussed but intentionally deferred:

- checksum / stronger integrity beyond byte-length trailer
- richer surface evolution policy beyond current scoped decoders
- any user-facing or chat-window surface work

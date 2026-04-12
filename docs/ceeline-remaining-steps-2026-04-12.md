# Ceeline Remaining Steps

> Date: 2026-04-12
> Scope: active follow-up work after the robustness and evolution changes

## Current State

The following are already implemented:

- `agent` added to allowed `source.kind` values
- validation added for all 8 active surfaces
- `renderCeelineCompact()` now returns `CeelineResult<string>`
- `max_render_tokens` is enforced during render
- `renderCeelineCompactAuto()` selects density from token budget
- parser uses surface-scoped field decoders
- compact output includes `#n=<bytecount>` integrity trailer

## Remaining Work

### 1. Update docs to match the current API

- Update [docs/ceeline-language-spec-v1.md](/mnt/SteamLibrary/git/ceeline/docs/ceeline-language-spec-v1.md)
- Replace examples that assume `renderCeelineCompact()` returns a raw string
- Document `renderCeelineCompactAuto()` as the preferred budget-aware renderer
- Update any round-trip snippets to unwrap `CeelineResult`

### 2. Document the integrity trailer

- Add `#n=<bytecount>` to the compact dialect grammar in [docs/ceeline-language-spec-v1.md](/mnt/SteamLibrary/git/ceeline/docs/ceeline-language-spec-v1.md)
- Explain that the byte count covers the content before the trailer
- Document parser behavior on mismatch:
  - parse succeeds
  - warning is emitted via `integrity_mismatch`
  - content is treated as potentially truncated
- Update compact examples to include the trailer

### 3. Add regression tests

Create tests covering:

- `source.kind = "agent"` validates successfully
- each surface validator rejects invalid surface-specific fields
- `renderCeelineCompact()` returns `token_budget_exceeded` when over budget
- `renderCeelineCompactAuto()` chooses:
  - `lite` first for `audience = operator`
  - `full` first for `audience = machine`
  - `dense` when needed to fit budget
- parser accepts valid `#n=` trailer
- parser emits `integrity_mismatch` when trailer is wrong
- parser preserves unknown clauses for forward compatibility
- cross-surface clause keys are not decoded onto the wrong surface

### 4. Add golden compact fixtures

Add compact text fixtures for all 8 surfaces and all 3 densities:

- include the new `#n=` trailer
- verify byte-for-byte stable rendering
- verify parse round-trip against expected compact parse results

This is important now that the renderer includes:

- budget enforcement
- auto-density behavior
- integrity metadata

### 5. Extend the benchmark harness

Benchmark harness is working, but follow-up improvements are still useful:

- add a second report mode using `renderCeelineCompactAuto()`
- report trailer overhead explicitly:
  - bytes added by `#n=`
  - token cost added by `#n=`
- compare:
  - `full` vs `dense`
  - manual density vs auto-density
- include failure reporting when a corpus envelope exceeds budget

### 6. Decide the long-term token counting strategy

Current budget enforcement uses a portable heuristic:

- `4 bytes ≈ 1 token`

That is acceptable for core robustness, but there is still an open product decision:

- keep the heuristic in core permanently
- or add optional tokenizer-backed enforcement in CLI / benchmarking only

If tokenizer-backed enforcement is adopted later, keep core portable and dependency-light.

### 7. Update external-facing examples and notes

Review and refresh:

- [docs/ceeline-design-brief-2026-04-11.md](/mnt/SteamLibrary/git/ceeline/docs/ceeline-design-brief-2026-04-11.md)
- [benchmarks/report.txt](/mnt/SteamLibrary/git/ceeline/benchmarks/report.txt)
- [benchmarks/report.json](/mnt/SteamLibrary/git/ceeline/benchmarks/report.json)

Specific follow-up:

- ensure examples reflect the result-returning renderer
- ensure examples show the trailer where appropriate
- ensure benchmark commentary mentions trailer overhead

## Recommended Execution Order

1. Update the language spec and example snippets.
2. Add regression tests for validation, trailer handling, and auto-density.
3. Add golden compact fixtures.
4. Extend benchmarks with trailer-overhead and auto-density comparisons.
5. Revisit tokenizer-backed budget enforcement as a product decision.

## Not Yet Started

These were discussed but intentionally deferred:

- checksum / stronger integrity beyond byte-length trailer
- richer surface evolution policy beyond current scoped decoders
- any user-facing or chat-window surface work

# Ceeline Remaining Steps

> Date: 2026-04-12
> Scope: active follow-up work after the robustness and evolution changes
> Last updated: 2026-04-14

## Current State

The following are implemented:

- `agent` added to allowed `source.kind` values
- validation added for all 8 active surfaces
- `renderCeelineCompact()` now returns `CeelineResult<string>`
- `max_render_tokens` is enforced during render
- `renderCeelineCompactAuto()` selects density from token budget
- parser uses surface-scoped field decoders
- compact output includes `#n=<bytecount>` integrity trailer
- morphological affix system with prefix/suffix derivation rules
- symbol expression system (3-layer Unicode: atoms, compounds, polysemy)
- 4 domain stem tables: security (24), performance (23), architecture (23),
  testing (21) — activated via `dom=` header
- 3-tier stem lookup: builtin → domain → session
- `CompactRenderOptions` with `domains?: readonly string[]`
- parser snapshot/restore for morphology isolation across parses
- domain ID injection safety (regex validation, `unknown_domain` warning)
- `ceeline.dic` expanded to 323 stems with domain sections
- language spec documents trailer, CeelineResult, auto-density, mx=, dom=,
  domain stem tables, morphology, and symbol expressions
- 341 regression tests across 11 files covering validation, render, parse,
  round-trip, golden snapshot, morphology, domain stems, symbol expressions,
  dict↔TS sync, and robustness probes
- 24 golden compact fixtures (8 surfaces × 3 densities) in
  `fixtures/compact/`
- 6 canonical + 8 envelope fixture files in `packages/fixtures/`
- benchmarks report trailer overhead, auto-density comparison, and budget
  failure detection
- token strategy decided: 4-byte heuristic in core, optional tokenizer in
  CLI/benchmarks only
- CLI and MCP adapter updated with expanded surface support
- plugin scaffolding with agents, hooks, and skill references

## Completed Work

### 1. Update docs to match the current API ✓

- Language spec updated with `CeelineResult<string>` return type
- `renderCeelineCompactAuto()` documented as preferred budget-aware renderer
- Round-trip snippets use `CeelineResult` unwrapping
- Header keys list includes `rs=`, `sz=`, `mx=`, `dom=`
- Implemented Scaffold section lists all public API functions
- Domain stem tables documented with resolution precedence and affix
  compatibility

### 2. Document the integrity trailer ✓

- `#n=<bytecount>` grammar added to compact dialect spec
- Byte count semantics documented (content before trailer)
- Parser behaviour on mismatch documented (`integrity_mismatch` warning, content
  treated as potentially truncated)
- Compact examples include trailer

### 3. Add regression tests ✓

341 tests across 11 files:

- `validate.test.ts`: all 5 source.kind values, all 8 surfaces valid, surface-
  specific field rejection
- `compact-render.test.ts`: all 8×3 density combinations, token_budget_exceeded,
  trailer presence, density format correctness
- `compact-auto.test.ts`: operator prefers lite, machine prefers full, budget
  exceeded when no density fits, no budget defaults to full
- `compact-parse.test.ts`: trailer acceptance, integrity_mismatch on tampered
  content, unknown clause/header preservation, cross-surface key rejection,
  extension parsing, required field failures, dom= parsing (single/multi/absent),
  injection safety, unknown_domain warning, morphology isolation
- `round-trip.test.ts`: render→parse for all 8×3 combinations, preserve tokens,
  extension clauses, dom= single/multi round-trip, omission when empty
- `morphology.test.ts`: DOMAIN_TABLES existence, activation, isolation,
  resolve/expand with domain stems, collision guards (builtin + cross-domain),
  domain ID vs header keyword guard
- `symbol-expr.test.ts`: Tier 1 Unicode symbol parsing and expression
  recognition
- `dict-sync.test.ts`: .dic ↔ TS bidirectional flag verification including
  domain table sync
- `robustness-probe.test.ts`: edge cases and forward compatibility probes

### 4. Add golden compact fixtures ✓

- 24 `.txt` fixtures in `fixtures/compact/` for all 8 surfaces × 3
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

### 8. Implement domain stem tables ✓

- Designed 4 domain stem tables: security (24 stems), performance (23),
  architecture (23), testing (21) — 91 total domain stems
- Added `DomainStemTable` interface and `DOMAIN_TABLES` map to
  `@ceeline/schema`
- Implemented `activateDomains()` for runtime domain activation
- Extended `resolveAffix()` and `expandStem()` with 3-tier lookup chain
  (builtin → domain → session)
- Added `dom=` header key to compact renderer and parser
- `CompactRenderOptions` interface with `domains?: readonly string[]`
- Parser snapshot/restore of `domainStems` in try/finally for isolation
- Domain ID validation with `/^[a-z0-9]+$/` regex (injection safety)
- Parser emits `unknown_domain` informational warning for unrecognized IDs
- `ceeline.dic` expanded from 232 to 323 stems with domain section markers
- Dict↔TS sync test for bidirectional verification
- Collision guards: domain stems cannot shadow built-in stems; cross-domain
  uniqueness enforced; domain IDs checked against header keywords

### 9. Code review and hardening ✓

8 issues identified and resolved:

- **H1**: Header injection via `dom=` — fixed with regex filter on render + parse
- **H2**: Missing `CompactRenderOptions` export — added to core index.ts
- **M1**: Morphology mutation leak — snapshot/restore in try/finally
- **M2**: Silent unknown domains — emits `unknown_domain` informational issue
- **C1**: Domain ID / header keyword collision — test guard added
- **L2**: `.dic` not updated — 91 domain stems with section markers added
- Dict-sync coverage extended with bidirectional domain table verification
- All 341 tests passing, typecheck clean

## Not Yet Started

These were discussed but intentionally deferred:

- checksum / stronger integrity beyond byte-length trailer
- richer surface evolution policy beyond current scoped decoders
- any user-facing or chat-window surface work
- domain-specific golden fixtures (compact text with `dom=` header)
- runtime domain table registration (custom user-defined domains)
- benchmark comparison with domain stems active vs inactive

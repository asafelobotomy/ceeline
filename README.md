# Ceeline

Schema-first compact transport layer for internal AI communication.

Ceeline reduces token usage on machine-controlled surfaces without changing the
default language of user-facing chat, editors, or documentation. It is a
deterministic translation and validation system for surfaces that a host
application owns end-to-end.

## What it does

- **Compresses** internal-only AI communication (handoffs, summaries, memory
  notes, routing metadata) into a compact wire format
- **Preserves** exact technical tokens — file paths, commands, env vars,
  placeholders, versions, URLs — across every transform
- **Validates** envelopes against typed schemas with deterministic error
  reporting
- **Detects leaks** before compact artifacts reach user-visible output
- **Round-trips** losslessly between JSON envelope and compact text

### Benchmark highlights

| Metric | Value |
|---|---|
| Byte compression | 2.32:1 (56.6% saving) |
| Token compression (cl100k) | 1.95:1 (48.5% saving) |
| Token compression (o200k) | 2.01:1 (49.9% saving) |
| Round-trip fidelity | 100% |
| Integrity trailer overhead | 1.6–3.0% |

Measured across 8 surfaces × 3 densities. Full report in
[benchmarks/report.txt](benchmarks/report.txt).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Canonical source (human-readable)                          │
├────────────────────────┬────────────────────────────────────┤
│  @ceeline/schema       │  Envelope + payload JSON schemas   │
│  @ceeline/core         │  Encode, validate, render, parse   │
│  @ceeline/cli          │  CLI: encode, decode, validate     │
├────────────────────────┼────────────────────────────────────┤
│  adapters/mcp-server   │  MCP tool surface                  │
├────────────────────────┴────────────────────────────────────┤
│  Compact transport (#n= integrity trailer)                  │
└─────────────────────────────────────────────────────────────┘
```

## Packages

| Package | Description |
|---|---|
| `@ceeline/schema` | TypeScript types, enums, code maps, JSON schemas |
| `@ceeline/core` | Validation, compact render/parse, preserve, encode/decode, leak detection |
| `@ceeline/cli` | CLI for `encode`, `decode`, `render`, `validate`, `detect-leak` |
| `@ceeline/fixtures` | Golden fixtures for all 8 surfaces × 3 compact densities |
| `adapters/mcp-server` | MCP JSON-RPC tool adapter |

## Surfaces

Ceeline v1 supports 8 surfaces for AI-to-AI communication:

| Surface | Code | Use case |
|---|---|---|
| `handoff` | `ho` | Planner-to-implementer, reviewer-to-fixer payloads |
| `digest` | `dg` | Session summaries, heartbeat state, telemetry |
| `memory` | `me` | Internal memory notes, research condensation |
| `reflection` | `rf` | Self-check summaries, post-run audits |
| `tool_summary` | `ts` | Compact tool input/output summaries |
| `routing` | `rt` | Intent classification, scope hints, constraints |
| `prompt_context` | `pc` | Host-owned prompt fragments (machine-private) |
| `history` | `hs` | Participant-local conversation state |

## Compact format

The compact dialect has three density levels:

- **lite** — one key=value per line, human-scannable, omits `tok=` lines
- **full** — semicolon-separated single line, includes `tok=` preserve tokens
- **dense** — like full but drops redundant fields (`cls=`, `ch=`, `md=`, etc.)

Every compact output ends with a `#n=<bytecount>` integrity trailer that the
parser verifies on read.

Example (lite density, handoff surface):

```
@cl1 s=ho i=review.security ch=i md=ro au=m fb=rj rs=n sz=st mx=500
sum="Review src/core/codec.ts for transport safety before release."
f="Preserve {{PROJECT_ID}} exactly."
ask="Return severity-ordered findings only."
role=rv
tgt=fx
sc=transport,validation
cls=fp
#n=287
```

Full language grammar in [docs/ceeline-language-spec-v1.md](docs/ceeline-language-spec-v1.md).

## Quick start

```bash
npm install
npm run build
npm run test
```

### CLI usage

```bash
# Validate an envelope
echo '{"ceeline_version":"1.0",...}' | npx ceeline validate

# Encode canonical input
echo '{"surface":"handoff","intent":"review.security",...}' | npx ceeline encode

# Detect leaks in text
echo "some output text" | npx ceeline detect-leak
```

### Programmatic usage

```typescript
import { encodeCanonical, validateEnvelope, renderCeelineCompact } from "@ceeline/core";

// Encode a handoff envelope
const result = encodeCanonical({
  intent: "review.security",
  source: { kind: "host", name: "myapp", instance: "s1", timestamp: new Date().toISOString() },
  payload: { summary: "Review codec.ts for transport safety" }
}, "handoff");

if (result.ok) {
  // Render to compact format
  const compact = renderCeelineCompact(result.value, "full");
  if (compact.ok) console.log(compact.value);
}
```

Budget-aware rendering:

```typescript
import { renderCeelineCompactAuto } from "@ceeline/core";

// Auto-selects density to fit within token budget
const compact = renderCeelineCompactAuto(envelope);
if (compact.ok) console.log(compact.value);
// Returns token_budget_exceeded if no density fits
```

## Core API

| Function | Returns | Purpose |
|---|---|---|
| `encodeCanonical(input, surface)` | `CeelineResult<CeelineEnvelope>` | Build a validated envelope from canonical input |
| `validateEnvelope(obj)` | `CeelineResult<CeelineEnvelope>` | Schema-validate an envelope object |
| `parseEnvelope(json)` | `CeelineResult<CeelineEnvelope>` | Parse and validate JSON text |
| `decodeEnvelope(envelope)` | `DecodedEnvelope` | Decode envelope to structured canonical meaning |
| `renderCeelineCompact(envelope, density)` | `CeelineResult<string>` | Render to compact format at specified density |
| `renderCeelineCompactAuto(envelope)` | `CeelineResult<string>` | Auto-select density from token budget |
| `parseCeelineCompact(text)` | `CompactParseResult` | Parse compact text back to structured data |
| `detectLeaks(text)` | `LeakFinding[]` | Scan text for leaked Ceeline artifacts |
| `renderUserFacing(decoded)` | `string` | Clean user-facing rendering after leak checks |
| `extractPreserveTokens(text, classes)` | `string[]` | Extract tokens that must survive transforms |
| `validatePreservation(before, after, set)` | `CeelineResult<true>` | Verify all preserve tokens survived |

All mutating operations return `CeelineResult<T>`, a discriminated union:

```typescript
type CeelineResult<T> = { ok: true; value: T } | { ok: false; issues: ValidationIssue[] };
```

## Testing

```bash
npm run test          # 164 tests via vitest
npm run test:watch    # watch mode
npm run typecheck     # tsc project references
```

Test coverage includes validation (all surfaces and source kinds), compact
render/parse for all 8×3 combinations, auto-density selection, round-trip
fidelity, and byte-for-byte golden snapshot stability against 24 fixture files.

## Benchmarks

```bash
npx tsx benchmarks/run.ts
```

Generates `benchmarks/report.json` and `benchmarks/report.txt` with:

- Byte and token compression ratios per surface and density
- Render/parse throughput (envelopes/ms)
- Integrity trailer overhead
- Auto-density selection comparison
- Budget failure detection

## Project structure

```
packages/
  schema/       TypeScript types, enums, JSON schemas
  core/         Encode, validate, render, compact, preserve, leak detection
  cli/          CLI tool
  fixtures/     Golden envelope + compact fixtures
adapters/
  mcp-server/   MCP JSON-RPC adapter
benchmarks/     Compression and throughput benchmarks
docs/           Design brief, language spec, ADRs
```

## Documentation

- [Design brief](docs/ceeline-design-brief-2026-04-11.md) — product spec, surface classes, trust boundaries
- [Compact language spec](docs/ceeline-language-spec-v1.md) — grammar, field codes, trailer, density rules
- [Trust model ADR](docs/adr/0001-trust-model.md)
- [Render policy ADR](docs/adr/0002-render-policy.md)
- [Remaining steps](docs/ceeline-remaining-steps-2026-04-12.md) — implementation status

## License

Private — not yet published.

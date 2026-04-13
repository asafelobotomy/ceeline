# Version History

## 0.1.0 — 2026-04-13

First public release. Published to npm under the `@asafelobotomy` scope.

### Packages

| Package | Version |
|---|---|
| `@asafelobotomy/ceeline-schema` | 0.1.0 |
| `@asafelobotomy/ceeline-core` | 0.1.0 |
| `@asafelobotomy/ceeline-cli` | 0.1.0 |
| `@asafelobotomy/ceeline-mcp-server` | 0.1.0 |

### What's included

**Language and encoding**
- Compact dialect with three density levels: `lite`, `full`, `dense`
- `#n=<bytecount>` integrity trailer on every compact output
- `renderCeelineCompact(envelope, density)` and `renderCeelineCompactAuto(envelope)` with token-budget enforcement
- `parseCeelineCompact(text)` with trailer verification, morphology isolation, and extension clause preservation
- 100% round-trip fidelity across all 8 surfaces × 3 densities

**Schema and surfaces**
- 8 surfaces: `handoff`, `digest`, `memory`, `reflection`, `tool_summary`, `routing`, `prompt_context`, `history`
- Full JSON schema validation for all surfaces and source kinds
- `encodeCanonical(input, surface, options?)` with `internal` and `final_response` policy modes
- `createPolicyDefaults(surface, policy)` mapping policies to channel, constraints, and render defaults

**Morphology and domain stems**
- Morphological affix system: prefix + suffix derivation rules with flag-gated stem compatibility
- 4 built-in domain stem tables: security (24 stems), performance (23), architecture (23), testing (21)
- 3-tier stem resolution: builtin → domain → session
- `activateDomains(ids, morphology)` for runtime domain activation
- Domain ID injection safety (regex validation, `unknown_domain` informational warning)

**Preserve and leak detection**
- `extractPreserveTokens(text, classes)` — file paths, URLs, env vars, commands, placeholders, versions
- `validatePreservation(before, after, set)` — byte-for-byte token survival verification
- `detectLeaks(text)` — scans output for escaped compact artifacts before user delivery

**CLI (`ceeline` binary)**
- `encode`, `decode`, `render`, `validate`, `detect-leak` subcommands
- Policy flag: `--policy internal|final_response`
- Reads from stdin, writes to stdout

**MCP server (`ceeline-mcp-server` binary)**
- 7 MCP tools over stdio JSON-RPC: `translate_to_ceeline`, `translate_from_ceeline`, `validate_ceeline_payload`, `render_verbose_summary`, `detect_ceeline_leak`, `render_compact`, `parse_compact`
- Optional `policy` argument on `translate_to_ceeline`

**Personal lexicon**
- Runtime session-scoped stem registration
- Serialisation to/from JSON for persistence across invocations

**Testing and benchmarks**
- 631 tests across 16 files (vitest)
- 24 golden compact fixtures: all 8 surfaces × 3 densities, byte-for-byte stability
- Benchmark harness: byte/token compression, render/parse throughput, trailer overhead, auto-density comparison
- Compression: 2.4:1 bytes, 1.97:1 tokens (cl100k), 2.02:1 tokens (o200k)

**Distribution**
- npm workspaces monorepo; published workspace packages use `"type": "module"`; Node ≥ 18
- Agent plugin drop-in in `plugin/`: agents, skill, hooks, MCP config

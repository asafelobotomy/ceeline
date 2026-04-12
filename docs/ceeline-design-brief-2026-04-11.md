# Product Spec: Ceeline v1

> Date: 2026-04-11 | Author: Copilot | Status: draft

## Summary

Ceeline is a standalone product for compact internal AI communication.

Its purpose is to reduce token usage on machine-controlled surfaces without
changing the default user-facing language of chat systems, editors, agents, or
documentation.

Ceeline is not a universal prompt-rewrite layer. It is a deterministic
translation and validation system for surfaces that a host application owns
end-to-end.

Ceeline v1 standardizes on one canonical transport format: a versioned JSON
envelope. Human-readable shorthand formats may exist, but they are derived
views, not primary transport.

The recommended product shape is:

1. a core translation library
2. a schema package for the v1 envelope
3. validators and golden fixtures
4. a CLI for local use and CI
5. optional adapters for MCP, hooks, agents, and editors
6. an optional extension-owned chat surface when Ceeline must mediate complete
   user-visible flows

---

## Define the Product

Ceeline is a compact internal communication layer for AI systems.

It operates between canonical source content and machine-consumed transport
payloads.

Ceeline is suitable for:

- agent handoff payloads
- planner summaries
- reflection and heartbeat digests
- internal memory notes
- tool-call summaries
- routing metadata
- extension-owned prompt assembly

Ceeline is not suitable for:

- default end-user chat text
- human-authored instruction source files
- public documentation
- contract-sensitive templates that require exact prose structure
- arbitrary interception of built-in chat systems that Ceeline does not control

---

## Define the Problem

AI-enabled systems repeatedly exchange internal text that is:

- verbose
- machine-consumed
- structurally repetitive
- expensive in prompt budgets
- vulnerable to accidental leakage into user-visible output

Most of this text does not need polished prose. It needs to be compact,
deterministic, safe, and testable.

At the same time, many systems also contain surfaces that must remain readable,
stable, and contract-safe for humans, tooling, or CI.

The product problem is selective, not universal:

1. compress internal-only communication that the host owns end-to-end
2. preserve normal human-readable source content where contracts depend on it
3. prevent compact internal artifacts from appearing in user-visible output
4. preserve exact technical tokens across every transform
5. make the transforms deterministic enough to validate in tests and CI

---

## Set Goals

Ceeline v1 should:

- reduce tokens on internal-only transport surfaces
- preserve exact technical tokens such as file paths, commands, env vars,
  placeholders, URLs, versions, identifiers, and schema keys
- provide deterministic encode, decode, validate, and render behavior for
  high-risk flows
- define a single canonical wire format
- support adapters for multiple hosts without embedding host-specific policy in
  the core
- provide leak detection before user-facing output is emitted
- support golden fixtures, contract tests, and schema validation

---

## Set Non-Goals

Ceeline v1 should not:

- transparently rewrite every inbound or outbound turn of chat systems it does
  not control
- replace normal English in source instruction files by default
- rely on lossy LLM rewriting for contract-sensitive surfaces
- require a database
- require model fine-tuning
- attempt universal middleware behavior where the platform does not expose that
  control point

---

## Define Product Principles

Ceeline follows these principles:

1. Source stays readable
   Authors write canonical source in normal language unless a surface is
   explicitly machine-oriented.

2. Transport is canonical
   Ceeline v1 uses one canonical JSON envelope as the transport contract.

3. Deterministic first
   High-risk transforms use rules, schemas, and validators before any optional
   heuristic compression.

4. Compile, do not hand-author
   People author source content. Tooling derives Ceeline envelopes and rendered
   variants.

5. No visible leaks
   Raw Ceeline artifacts must never appear in user-visible output.

6. Typed where possible
   Machine-consumed payloads should prefer explicit schemas over ad hoc prose.

7. Preserve exact tokens
   Technical tokens are treated as immutable units during transform.

8. Fail closed on ambiguity
   If Ceeline cannot validate or safely render a payload, it must reject or
   fall back rather than guess.

---

## Define Surface Classes

Ceeline is repo-agnostic. Hosts map their own concrete files and subsystems onto
these product-level surface classes.

### Safe v1 surfaces

- `handoff`: planner-to-implementer, reviewer-to-fixer, or parent-to-subagent
  payloads
- `digest`: compact session summaries, heartbeat state, routing digests,
  telemetry summaries
- `memory`: internal memory notes, research condensation, fact stores
- `reflection`: self-check summaries, stop-hook reflections, post-run audits
- `tool_summary`: compact summaries of tool inputs, outputs, or tool plans
- `routing`: intent classification, scope hints, constraint bundles
- `prompt_context`: extension-owned or host-owned prompt fragments that remain
  machine-private
- `history`: participant-local conversation state stored in compact form

### Future controlled surfaces (deferred)

- `ui_request`: extension-owned user input after capture but before model prompt
  composition
- `ui_response`: extension-owned internal representation before final rendering

> **Note:** ui_request and ui_response are shelved to focus on AI-to-AI
> communication. Their codes (`ur`, `us`) and line keys are reserved.

### Unsafe v1 surfaces

- public documentation
- source instruction files intended for direct human editing
- contract-sensitive templates with fixed prose shape
- user-visible final responses unless they have been rendered and sanitized
- external systems where Ceeline does not control the full encode/decode path

---

## Define the Architecture

Ceeline has four layers:

1. Canonical source layer
   Human-authored or host-authored readable source content.

2. Canonical transport layer
   The Ceeline v1 envelope.

3. Validation layer
   Schema checks, preserve checks, trust checks, roundtrip checks, and leak
   detection.

4. Render layer
   Human-readable internal renderings or clean user-facing renderings derived
   from canonical content.

### Core components

#### 1. Schema package

Defines:

- envelope schema
- per-surface payload schemas
- allowed enums
- validation error codes

#### 2. Core library

Implements:

- parse
- encode
- decode
- render
- sanitize
- preserve token extraction
- roundtrip validation
- leak detection

#### 3. CLI

Exposes:

- `ceeline encode`
- `ceeline decode`
- `ceeline render`
- `ceeline validate`
- `ceeline detect-leak`

#### 4. Adapter layer

Optional adapters may expose Ceeline through:

- MCP tools
- hook scripts
- custom agents
- editor extensions
- service APIs

Adapters must not redefine the core format.

---

## Formalize the Ceeline v1 Envelope

Ceeline v1 uses one canonical envelope for transport.

The normative schema file lives at
[../packages/schema/schema/envelope-1.0.schema.json](../packages/schema/schema/envelope-1.0.schema.json).

The non-canonical compact language spec lives at
[ceeline-language-spec-v1.md](ceeline-language-spec-v1.md).

Surface-specific payload schemas currently live at:

- [../packages/schema/schema/handoff-payload-1.0.schema.json](../packages/schema/schema/handoff-payload-1.0.schema.json)
- [../packages/schema/schema/digest-payload-1.0.schema.json](../packages/schema/schema/digest-payload-1.0.schema.json)
- [../packages/schema/schema/memory-payload-1.0.schema.json](../packages/schema/schema/memory-payload-1.0.schema.json)
- [../packages/schema/schema/reflection-payload-1.0.schema.json](../packages/schema/schema/reflection-payload-1.0.schema.json)
- [../packages/schema/schema/tool-summary-payload-1.0.schema.json](../packages/schema/schema/tool-summary-payload-1.0.schema.json)
- [../packages/schema/schema/routing-payload-1.0.schema.json](../packages/schema/schema/routing-payload-1.0.schema.json)
- [../packages/schema/schema/prompt-context-payload-1.0.schema.json](../packages/schema/schema/prompt-context-payload-1.0.schema.json)
- [../packages/schema/schema/history-payload-1.0.schema.json](../packages/schema/schema/history-payload-1.0.schema.json)

### Design rules

- format: JSON object
- versioned: yes
- canonical: yes
- deterministic field meanings: yes
- extensible: yes, through namespaced optional fields
- binary-safe: no, text-oriented only

### Top-level schema

```json
{
  "ceeline_version": "1.0",
  "envelope_id": "cel:01ARZ3NDEKTSV4RRFFQ69G5FAV",
  "surface": "handoff",
  "channel": "internal",
  "intent": "review.security",
  "source": {
    "kind": "host",
    "name": "ceeline.vscode",
    "instance": "session-7f3d",
    "timestamp": "2026-04-11T18:03:12Z"
  },
  "constraints": {
    "mode": "read_only",
    "audience": "machine",
    "max_render_tokens": 240,
    "no_user_visible_output": true,
    "fallback": "reject"
  },
  "preserve": {
    "tokens": [
      "src/core/codec.ts",
      "GPT-5.4",
      "{{PROJECT_ID}}",
      "npm test"
    ],
    "classes": [
      "file_path",
      "model_name",
      "placeholder",
      "command"
    ]
  },
  "payload": {
    "summary": "check transport safety and return findings only",
    "facts": [
      "surface is host-owned",
      "user-visible output is forbidden"
    ],
    "ask": "return severity-ordered findings",
    "artifacts": [],
    "metadata": {}
  },
  "render": {
    "style": "none",
    "locale": "en",
    "sanitizer": "strict"
  },
  "diagnostics": {
    "trace": false,
    "labels": ["pilot", "safety-critical"]
  }
}
```

### Required fields

- `ceeline_version`
- `envelope_id`
- `surface`
- `channel`
- `intent`
- `source`
- `constraints`
- `preserve`
- `payload`
- `render`

### Optional fields

- `diagnostics`
- future namespaced fields such as `x_host` or `x_experiment`

### Field definitions

#### `ceeline_version`

- type: string
- required value for v1: `1.0`
- semantic meaning: schema and behavior contract version

#### `envelope_id`

- type: string
- must be unique per envelope
- recommended form: prefix plus ULID or UUID
- semantic meaning: traceability, deduplication, and fixture identity

#### `surface`

- type: enum string
- allowed v1 values:
  - `handoff`
  - `digest`
  - `memory`
  - `reflection`
  - `tool_summary`
  - `routing`
  - `prompt_context`
  - `history`

#### `channel`

- type: enum string
- allowed v1 values:
  - `internal`
  - `controlled_ui`

`internal` means the payload must remain machine-private.

`controlled_ui` means the host owns the full encode, decode, and sanitize path.

#### `intent`

- type: string
- format: dotted identifier
- examples:
  - `review.security`
  - `summarize.digest`
  - `handoff.implement`
  - `memory.capture`

#### `source`

- type: object
- required fields:
  - `kind`: enum `host | adapter | test | fixture | agent`
  - `name`: string
  - `instance`: string
  - `timestamp`: RFC 3339 timestamp string

#### `constraints`

- type: object
- required fields:
  - `mode`: enum `read_only | advisory | mutating`
  - `audience`: enum `machine | operator | user`
  - `max_render_tokens`: integer >= 0
  - `no_user_visible_output`: boolean
  - `fallback`: enum `reject | verbose | pass_through`

Semantics:

- `reject`: fail if validation or rendering cannot be completed safely
- `verbose`: fall back to safe verbose rendering from canonical content
- `pass_through`: allowed only for trusted internal machine channels

#### `preserve`

- type: object
- required fields:
  - `tokens`: array of strings
  - `classes`: array of enum strings

Allowed v1 classes:

- `file_path`
- `tool_identifier`
- `agent_name`
- `model_name`
- `command`
- `env_var`
- `version`
- `schema_key`
- `placeholder`
- `section_label`
- `url`
- `code_span`
- `code_fence`

Semantics:

- every token listed in `tokens` must survive encode, decode, and render exactly
- class-based extraction may add tokens before validation begins

#### `payload`

- type: object
- required common fields:
  - `summary`: string
  - `facts`: array of strings
  - `ask`: string
  - `artifacts`: array
  - `metadata`: object

Surface-specific schemas may further constrain `payload`.

#### `render`

- type: object
- required fields:
  - `style`: enum `none | terse | normal | user_facing`
  - `locale`: string
  - `sanitizer`: enum `strict | standard`

Semantics:

- `none`: no human-facing rendering should be produced
- `terse`: compact operator-facing rendering
- `normal`: readable internal rendering
- `user_facing`: clean end-user rendering after leak checks

#### `diagnostics`

- type: object
- optional
- intended for tracing, labels, and non-semantic debugging context
- must not affect decode or render meaning

### Canonicalization rules

Ceeline v1 canonicalization rules are part of the format.

1. JSON object keys must be emitted in the documented top-level order.
2. Arrays preserve insertion order.
3. Strings are UTF-8 JSON strings.
4. No comments are allowed.
5. Unknown top-level fields are allowed only if prefixed with `x_`.
6. Unknown required semantics are a validation error.
7. Empty string values are allowed only where semantically valid.
8. `payload.metadata` may contain host-specific keys, but those keys must not
   redefine standard field meanings.

---

## Define the Transform Lifecycle

Ceeline v1 defines a strict lifecycle.

### 1. Extract preserve tokens

The encoder must identify exact tokens from:

- explicit host input
- class-based detectors
- schema-sensitive fields

### 2. Encode canonical content

Canonical readable content is transformed into a v1 envelope.

This step may compress phrasing, but it must not alter preserved tokens.

### 3. Validate envelope

Validation checks:

- schema validity
- allowed surface
- allowed channel
- preserve token completeness
- canonicalization compliance

### 4. Process internally

Agents, tools, hooks, or services may consume the envelope.

If they mutate content, the result must be revalidated before further use.

### 5. Decode to canonical meaning

Decoding reconstructs structured canonical meaning, not final user prose.

The decode result is an internal representation suitable for validation,
inspection, and rendering.

### 6. Render if needed

Rendering produces one of:

- no output
- terse operator output
- readable internal output
- clean user-facing output

The normative render policy lives at
[adr/0002-render-policy.md](adr/0002-render-policy.md).

### 7. Sanitize and leak-check

Before any user-visible output is accepted, Ceeline must run leak detection and
output sanitization.

---

## Define the Core API

Ceeline v1 should expose a deterministic API surface.

Required core functions:

- `parseEnvelope(text)`
- `encodeCanonical(input, surface, options)`
- `decodeCanonical(envelope)`
- `renderInternal(decoded, style)`
- `renderUserFacing(decoded)`
- `extractPreserveTokens(input, classes)`
- `validateEnvelope(envelope)`
- `validatePreservation(before, after, preserveSet)`
- `detectLeaks(text)`
- `sanitizeUserFacing(text)`

Recommended result style:

- return typed success or typed error
- do not silently coerce invalid payloads
- keep validation diagnostics machine-readable

---

## Define Trust Boundaries

Trust boundaries are part of the product spec.

The normative trust model lives at
[adr/0001-trust-model.md](adr/0001-trust-model.md).

### Trusted inputs

- host-generated canonical content
- schema-validated fixtures
- adapter output that has already passed Ceeline validation

### Untrusted inputs

- arbitrary model output
- external service responses
- human-edited envelope JSON unless revalidated
- host metadata fields that bypass schema guarantees

### Required policy

1. untrusted text must never be interpreted as a valid Ceeline envelope without
   schema validation
2. any mutation after validation requires revalidation
3. user-facing rendering must reject raw envelope objects and recognized
   shorthand markers
4. `pass_through` fallback is forbidden for `channel = controlled_ui`

---

## Define Preserve Rules

Ceeline must preserve these token classes exactly:

- file paths
- tool identifiers
- agent names
- model names
- commands
- environment variables
- version numbers
- schema keys when semantically fixed
- placeholder tokens such as `{{PLACEHOLDER}}`
- section labels such as `S1` or `D2`
- URLs
- inline code spans
- code fences

If any preserved token changes byte-for-byte, validation fails.

Preservation is checked at three points:

1. after encode
2. after decode
3. after any user-facing render

---

## Define Leak Prevention

Ceeline must never leak compact internal artifacts into user-visible output.

### Leak classes

- raw Ceeline envelopes
- shorthand field sigils not intended for users
- internal routing metadata
- adapter-only policy markers
- unresolved placeholders intended only for transport

### Leak policy

1. detect leaks before final output acceptance
2. reject output on strict mode leak detection
3. optionally fall back to safe verbose rendering when configured
4. emit machine-readable diagnostics for every leak finding

---

## Define Validation

Validation is deterministic and mandatory.

### Schema validation

- top-level fields
- field types
- enum values
- required field presence
- canonicalization compliance

### Semantic validation

- allowed surface for current host policy
- allowed fallback for current channel
- preserve token completeness
- render mode compatibility

### Contract validation

- roundtrip meaning is stable
- user-facing outputs contain no raw Ceeline artifacts
- unknown fields do not alter standard behavior

---

## Define Testing

### Unit tests

- schema acceptance and rejection
- preserve extraction
- canonicalization rules
- leak detection
- sanitizer behavior

### Fixture tests

Use golden fixtures for:

- handoff envelopes
- digest envelopes
- memory envelopes
- reflection envelopes
- tool summary envelopes

### Contract tests

- encode then decode preserves canonical meaning
- encode then render preserves exact tokens
- invalid envelopes fail with typed errors
- controlled UI output contains no raw Ceeline artifacts

### Metrics

Track:

- token reduction percentage
- validation failure rate
- leak detection count
- fallback rate
- encode and render latency

---

## Define the Standalone Implementation Plan

The initial scaffold now exists in:

- [../packages/schema](../packages/schema)
- [../packages/core](../packages/core)
- [../packages/cli](../packages/cli)
- [../packages/fixtures](../packages/fixtures)
- [../adapters/mcp-server](../adapters/mcp-server)
- [../adapters/vscode-extension](../adapters/vscode-extension)

### Phase 0: Product spec ✓

- finalize the v1 envelope
- finalize surface enums
- finalize preserve classes
- finalize trust and fallback policy

### Phase 1: Core packages ✓

- create schema package
- create core library
- create CLI
- add typed validation errors

### Phase 2: Corpus and fixtures ✓

- collect representative internal payload examples from target hosts
- classify them by surface
- build golden fixtures with preserve expectations

### Phase 3: Validation first ✓

- implement preserve extraction
- implement leak detection
- implement roundtrip validation
- implement strict sanitizer

### Phase 4: Host adapters ✓

- add MCP wrapper as an explicit tool surface
- add hook helper scripts for host-controlled lifecycle points
- add agent and subagent adapters for handoff envelopes

### Phase 5: Controlled UI prototype (deferred)

> Shelved to focus on AI-to-AI communication. VS Code extension adapter
> preserved in `_shelved/vscode-extension/`.

- build a VS Code chat participant or equivalent host-owned front door
- encode user input into internal Ceeline structures only when the host owns the
  full decode and sanitize path
- render clean user-facing responses from decoded canonical meaning

### Phase 6: Expansion

- add more surface-specific schemas
- add host-specific policy packs
- evaluate whether shorthand renderings need a formal secondary spec

---

## Recommend the Product Direction

Build Ceeline as a standalone schema-first core.

Do not start with an MCP-only design.

Do not start with a database.

Do not treat shorthand text as the canonical wire format.

The correct order is:

1. formal v1 envelope
2. deterministic schema and validators
3. core encode, decode, render, and leak detection
4. CLI and fixture corpus
5. optional adapters for MCP, hooks, and agents
6. optional extension-owned controlled UI surface

This order keeps the product portable across hosts, testable in CI, and aligned
with the main safety requirement: compact internal wire, clean external output.

---

## List Open Questions

1. ~~Which surface should be the first production pilot: `handoff`, `memory`, or
   `digest`?~~ **Resolved:** all 8 surfaces are implemented and validated.
2. ~~Should `payload` remain minimally common across all surfaces, or should each
   surface move immediately to a stricter schema?~~ **Resolved:** all 8 surfaces
   have dedicated payload schemas.
3. ~~Should the first implementation use JSON Schema, Zod, or both?~~
   **Resolved:** JSON Schema files + TypeScript runtime validation.
4. Should shorthand internal renderings receive their own versioned spec in v2,
   or remain non-canonical views?
5. ~~Which hosts need the first adapters: VS Code extension, MCP server, or a
   standalone service?~~ **Resolved:** MCP server adapter implemented;
   VS Code extension preserved in `_shelved/`.

---

## Appendix: Normative Files

- Envelope schema:
  [../packages/schema/schema/envelope-1.0.schema.json](../packages/schema/schema/envelope-1.0.schema.json)
- Handoff payload schema:
  [../packages/schema/schema/handoff-payload-1.0.schema.json](../packages/schema/schema/handoff-payload-1.0.schema.json)
- Digest payload schema:
  [../packages/schema/schema/digest-payload-1.0.schema.json](../packages/schema/schema/digest-payload-1.0.schema.json)
- Memory payload schema:
  [../packages/schema/schema/memory-payload-1.0.schema.json](../packages/schema/schema/memory-payload-1.0.schema.json)
- Reflection payload schema:
  [../packages/schema/schema/reflection-payload-1.0.schema.json](../packages/schema/schema/reflection-payload-1.0.schema.json)
- Tool summary payload schema:
  [../packages/schema/schema/tool-summary-payload-1.0.schema.json](../packages/schema/schema/tool-summary-payload-1.0.schema.json)
- Routing payload schema:
  [../packages/schema/schema/routing-payload-1.0.schema.json](../packages/schema/schema/routing-payload-1.0.schema.json)
- Prompt context payload schema:
  [../packages/schema/schema/prompt-context-payload-1.0.schema.json](../packages/schema/schema/prompt-context-payload-1.0.schema.json)
- History payload schema:
  [../packages/schema/schema/history-payload-1.0.schema.json](../packages/schema/schema/history-payload-1.0.schema.json)
- Trust model ADR:
  [adr/0001-trust-model.md](adr/0001-trust-model.md)
- Render policy ADR:
  [adr/0002-render-policy.md](adr/0002-render-policy.md)
- Compact language spec:
  [ceeline-language-spec-v1.md](ceeline-language-spec-v1.md)

---

## Sources

| Source | Relevance |
|---|---|
| <https://modelcontextprotocol.io/docs/learn/architecture> | MCP capability model and control boundaries |
| <https://modelcontextprotocol.io/specification> | MCP trust and protocol semantics |
| <https://code.visualstudio.com/docs/copilot/customization/mcp-servers> | MCP behavior in VS Code |
| <https://code.visualstudio.com/docs/copilot/customization/hooks> | Hook lifecycle and control boundaries |
| <https://code.visualstudio.com/api/extension-guides/chat> | Chat participant model for extension-owned prompt and response flow |
| <https://code.visualstudio.com/api/extension-guides/language-model> | Language Model API for extension-controlled model requests |
| <https://code.visualstudio.com/api/extension-guides/webview> | Optional dedicated UI surface |
| <https://github.com/JuliusBrussee/caveman> | Prose compression reference pattern |
| <https://github.com/asafelobotomy/ClosedClaw> | Internal transport and sanitization reference pattern |

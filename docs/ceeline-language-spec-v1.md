# Ceeline Language Spec v1

> Status: draft | Scope: non-canonical compact text dialect derived from the
> canonical envelope

## Purpose

Ceeline v1 has one canonical wire format: JSON envelope.

This document defines the first compact text dialect derived from that envelope.

The dialect exists for machine-private and operator-private surfaces where a
shorter textual representation is useful, especially when model-visible context
must be compressed.

It is inspired by two external ideas:

- ClosedClaw / ClawTalk: keep transport compression separate from user-visible
  output and treat translation as an explicit device rather than invisible magic
- caveman: remove filler aggressively, preserve technical atoms exactly, and
  benchmark compression against a real terse baseline instead of verbose prose

Ceeline deliberately does not copy caveman's persona or speech style. Ceeline
is a clause language, not a character voice.

---

## Design Goals

The language should optimize for:

1. lower token count on internal text surfaces
2. deterministic encode and render
3. exact preservation of technical atoms
4. easy machine parsing and round-tripping
5. stable abbreviations rather than freeform synonym drift
6. no accidental user-facing leakage
7. incremental evolution without breaking existing consumers

---

## Evolution Principles

The dialect is designed to grow alongside Copilot. These rules govern how it
changes over time.

### Versioning

The dialect version lives in the header marker: `@cl1`, `@cl2`, etc.

**Additive changes** do not bump the version:

- new surface codes
- new enum values within an existing code map
- new line-key codes for payload clauses
- new extension namespace keys

**Breaking changes** require a version bump:

- changing the meaning of an existing code
- removing or renaming an existing code
- changing header syntax or clause separator rules
- changing quoting rules

A consumer that encounters a version it does not support should treat the text
as opaque and fall through to the envelope's `fallback` policy.

### Forward compatibility

When a consumer encounters an unknown code -- whether header key, clause key,
or enum value -- the required behavior is:

1. Preserve the raw key=value pair verbatim in an `unknown` bag.
2. Optionally emit an informational warning.
3. Do NOT reject the parse.

This means new codes can be introduced at any time without coordinated
upgrades. Older consumers carry them through untouched. This is the single
most important rule for long-lived growth.

### Extension namespace

Vendor-specific, host-specific, or experimental clauses use the `x.` prefix:

```text
x.copilot.model=gpt-4o ; x.copilot.tokens_left=4096
```

Extension keys are never promoted directly into core. If an extension proves
broadly useful, a new core code is allocated and the extension is deprecated.

JSON envelope extensions (`x_vendor_field`) map to compact extensions as
`x.vendor.field`.

### Registry pattern

All code maps -- surfaces, channels, modes, audiences, fallbacks, render styles,
sanitizers, preserve classes, line keys, and surface-specific enum values -- are
stored in a `CompactCodeRegistry` data structure.

Hosts and adapters can extend the registry at runtime:

```typescript
import { createDefaultRegistry, extendRegistry } from "@ceeline/schema";

const registry = extendRegistry(createDefaultRegistry(), {
  surfaces: { planning: "pn" },
  surfacePayloadCodes: {
    planning_phase: { scoping: "sc", estimating: "es", committed: "cm" }
  },
  lineKeys: { planPhase: "pph" }
});
```

The renderer and parser accept the default registry unless overridden. This
means the dialect can grow without modifying the core package.

### Surface expansion lifecycle

Surfaces begin with only the common payload keys (`sum`, `f`, `ask`, `art`).
As usage patterns stabilize, surface-specific codes go through three stages:

1. **Extension** -- carried as `x.surface.key` in production traffic.
2. **Stub** -- promoted to a code in the surface payload code map with a
   `COMPACT_LINE_KEYS` entry. May still be optional.
3. **Core** -- required field for that surface, documented in this spec.

The 10 built-in surfaces are at varying stages. Handoff, digest, and memory
are at stage 3. The remaining seven are at stage 2 with stub codes defined.

---

## Efficiency Strategy

Ceeline borrows the right things from caveman and rejects the wrong ones.

### Keep from caveman

- drop filler first
- keep one idea per clause
- preserve code, paths, URLs, commands, versions, and placeholders exactly
- benchmark against terse controls, not only verbose prose
- support density levels

### Keep from ClawTalk

- transport compression is separate from user-facing rendering
- translation is explicit and host-owned
- sanitization is mandatory before user-visible output
- language design must assume leak prevention and trust boundaries

### Reject from both as direct product behavior

- persona-driven output syntax
- lossy abbreviation of technical identifiers
- ad hoc natural-language shorthand that cannot be validated
- hidden middleware assumptions

---

## Language Layers

Ceeline now has three language layers.

1. Canonical source
   Human-readable source content.

2. Canonical wire
   JSON envelope. This remains normative.

3. Ceeline Compact Text
   A deterministic derived clause dialect for compressed internal text.

Only layer 2 is canonical in v1. Layer 3 is derived and disposable.

---

## Ceeline Compact Text

Ceeline Compact Text starts with a header and then emits short clauses.

### Header

The first clause always begins with `@cl<version>`.

Example:

```text
@cl1 s=ho i=review.security ch=i md=ro au=m fb=rj
```

Meaning:

- `@cl1`: Ceeline compact language version 1
- `s`: surface
- `i`: intent
- `ch`: channel
- `md`: mode
- `au`: audience
- `fb`: fallback

### Clauses

Subsequent clauses represent payload, preserve, and extension data.

Example:

```text
sum="Review src/core/codec.ts for transport safety." ; f="Preserve {{PROJECT_ID}} exactly." ; ask="Return severity-ordered findings only." ; role=rv ; tgt=fx ; sc=transport,validation ; tok=src/core/codec.ts ; tok="{{PROJECT_ID}}" ; x.copilot.model=gpt-4o
```

### Quoting rules

- Bare atoms may contain only safe token characters: `A-Z a-z 0-9 . _ : / @ -`
- Any other value must be encoded as a JSON string literal
- Technical atoms must pass through byte-for-byte
- Lists are comma-separated sequences of atoms or quoted atoms

This means Ceeline gets JSON's well-understood escaping rules without embedding
full JSON structure everywhere.

### Extension clauses

Any clause whose key starts with `x.` is an extension clause. Extension keys
use dot-separated namespacing:

```text
x.copilot.model=gpt-4o
x.github.pr_number=12345
x.experiment.flag_a=true
```

Extensions are preserved verbatim during parsing. They are never interpreted
by the core compact renderer or parser -- only by the host or adapter that
registered them.

---

## Density Levels

Ceeline adopts caveman's lesson that one compression level is not enough, but it
uses product-oriented names and behavior.

### `lite`

- multiline
- includes more defaults
- easier for operators to inspect
- best for logs and debugging

### `full`

- one-line semicolon-separated clauses
- omits default fields when safe
- default internal model-facing format

### `dense`

- one-line semicolon-separated clauses
- omits defaults aggressively
- drops preserve-class clauses and keeps preserve tokens only
- best for very tight internal token budgets

Density changes the rendering, not the meaning.

---

## Forward Compatibility Rules

These rules apply to both the renderer and the parser.

1. Unknown header keys are preserved, not dropped.
2. Unknown clause keys are preserved, not dropped.
3. Unknown enum value codes are preserved as raw strings.
4. Extension clauses are always preserved.
5. A parser MUST succeed even when it encounters codes it does not recognize.
6. A renderer SHOULD use the registry for code lookup and fall back to raw
   values when no mapping exists.

These rules mean that a v1 parser can successfully process text generated by
a v2 renderer with new codes -- the new codes simply appear in the `unknown`
bag.

---

## Controlled Lexicon

Ceeline efficiency depends on a stable lexicon. All codes are registered in the
`CompactCodeRegistry` and can be extended at runtime.

### Core codes

#### Surfaces

| Name            | Code |
| --------------- | ---- |
| handoff         | `ho` |
| digest          | `dg` |
| memory          | `me` |
| reflection      | `rf` |
| tool_summary    | `ts` |
| routing         | `rt` |
| prompt_context  | `pc` |
| history         | `hs` |

#### Constraints

| Clause      | Values                      |
| ----------- | --------------------------- |
| `ch=`       | `i` (internal), `cu` (controlled UI) |
| `md=`       | `ro` (read only), `ad` (advisory), `mu` (mutating) |
| `au=`       | `m` (machine), `o` (operator), `u` (user) |
| `fb=`       | `rj` (reject), `vb` (verbose), `pt` (pass through) |

#### Render

| Clause | Values                    |
| ------ | ------------------------- |
| `rs=`  | `n` (none), `te` (terse), `nr` (normal), `uf` (user facing) |
| `sz=`  | `st` (strict), `sd` (standard) |

#### Common payload keys

| Key   | Meaning         |
| ----- | --------------- |
| `sum` | summary         |
| `f`   | fact            |
| `ask` | ask             |
| `art` | artifact        |
| `tok` | preserved token |
| `cls` | preserve class  |

### Surface-specific keys

#### Handoff (stage 3 -- core)

| Key    | Values / Format              |
| ------ | ---------------------------- |
| `role` | `pl` (planner), `rv` (reviewer), `co` (coordinator), `pa` (parent_agent) |
| `tgt`  | `im` (implementer), `fx` (fixer), `sa` (subagent), `rv` (reviewer) |
| `sc`   | comma-separated scope list   |

#### Digest (stage 3 -- core)

| Key   | Values / Format                              |
| ----- | -------------------------------------------- |
| `win` | `tr` (turn), `ss` (session), `rn` (run)     |
| `st`  | `ok`, `wr` (warn), `er` (error)             |
| `met` | comma-separated `key:value` pairs            |

#### Memory (stage 3 -- core)

| Key   | Values / Format                              |
| ----- | -------------------------------------------- |
| `mk`  | `fa` (fact), `de` (decision), `rs` (research) |
| `dur` | `sn` (session), `pj` (project), `ps` (persistent) |
| `cit` | comma-separated citations                    |

#### Reflection (stage 2 -- stub)

| Key   | Values / Format                              |
| ----- | -------------------------------------------- |
| `rty` | `sc` (self_critique), `hy` (hypothesis), `pr` (plan_revision), `cc` (confidence_check) |
| `cnf` | numeric confidence (0-1)                     |
| `rev` | revision text                                |

#### Tool Summary (stage 2 -- stub)

| Key   | Values / Format                              |
| ----- | -------------------------------------------- |
| `tn`  | tool name (bare atom or quoted)              |
| `out` | `ok` (success), `fl` (failure), `pt` (partial), `sk` (skipped) |
| `ela` | elapsed milliseconds                         |

#### Routing (stage 2 -- stub)

| Key    | Values / Format                              |
| ------ | -------------------------------------------- |
| `str`  | `dr` (direct), `bc` (broadcast), `cn` (conditional), `fb` (fallback) |
| `cand` | comma-separated candidate names              |
| `sel`  | selected candidate name                      |

#### Prompt Context (stage 2 -- stub)

| Key   | Values / Format                              |
| ----- | -------------------------------------------- |
| `ph`  | `sy` (system), `ij` (injection), `rt` (retrieval), `gr` (grounding) |
| `pri` | numeric priority                             |
| `src` | source reference                             |

#### History (stage 2 -- stub)

| Key   | Values / Format                              |
| ----- | -------------------------------------------- |
| `spn` | `tr` (turn), `ex` (exchange), `ss` (session), `pj` (project) |
| `tc`  | turn count                                   |
| `anc` | anchor reference                             |

---

## Round-Trip Parsing

The compact text dialect is bidirectional. The parser recovers a
`CompactParseResult` from a compact string, which can be used to reconstruct
a JSON envelope.

### Parser contract

- Input: a Ceeline Compact Text string (any density level).
- Output: a `CeelineResult<CompactParseResult>` containing all decoded fields.
- Unknown codes are preserved, not rejected (forward compatibility).
- Defaults are filled for any header key not present.
- Surface-specific fields are decoded using the appropriate reverse code map.

### Round-trip guarantee

For any envelope `e`:

```
parseCeelineCompact(renderCeelineCompact(e, "lite")).value
```

produces a `CompactParseResult` whose `surface`, `intent`, `channel`, `mode`,
`audience`, `fallback`, `renderStyle`, `sanitizer`, `summary`, and all
surface-specific fields match the original envelope. Fields not present in
compact form (envelope_id, source, timestamps) are not recoverable.

### Fields not in compact form

The following envelope fields have no compact representation and are not
round-trippable:

- `ceeline_version` (implied by `@cl1`)
- `envelope_id`
- `source` (kind, name, instance, timestamp)
- `constraints.no_user_visible_output` (implied by channel/audience)
- `render.locale`
- `diagnostics`

A round-trip through compact form is lossy for these fields. This is by
design: compact text is a compression format, not a full serialization.

---

## Efficiency Rules

Ceeline Compact Text should follow these rules in order.

1. Omit defaults before abbreviating payload text.
2. Use controlled abbreviations for enums and field names.
3. Keep intent exact unless a future host-owned alias table exists.
4. Preserve technical atoms exactly; never abbreviate them.
5. Compress repeated structure before compressing prose.
6. Use one clause per fact.
7. Prefer lists to repeated prose when structure is stable.
8. Prefer stable codes over natural-language synonyms.

---

## What Not to Optimize

Ceeline should not chase token savings by:

- abbreviating file paths
- abbreviating commands
- abbreviating placeholders
- abbreviating URLs
- inventing ambiguous synonym sets
- turning user-visible output into compact dialect text

Those changes would buy smaller token wins at disproportionate safety cost.

---

## Comparison to Caveman and ClawTalk

### caveman contribution

caveman is strongest as a prose minimizer.

Its most useful lessons for Ceeline are:

- compression must be measurable
- terse output should be compared against an already-terse baseline
- technical atoms must remain intact
- density modes matter

Ceeline uses those lessons in a deterministic clause language instead of a
persona voice.

### ClawTalk contribution

ClawTalk is strongest as an architectural pattern.

Its most useful lessons for Ceeline are:

- keep transport compression internal
- treat translation and sanitization as explicit product components
- never assume hidden interception of every user turn

Ceeline uses that architecture and pairs it with a more schema-driven compact
dialect.

---

## Recommendation

For v1:

1. keep JSON envelope canonical
2. use Ceeline Compact Text as a derived internal render only
3. default to `full` density for model-visible internal context
4. benchmark `full` and `dense` against a terse natural-language baseline
5. add host-specific alias tables only after fixture evidence shows they help
6. use the extension namespace for experimental vendor fields
7. evolve surface payload codes through the three-stage lifecycle
8. rely on forward compatibility to avoid coordinated upgrade pressure

---

## Implemented Scaffold

The compact lexicon, registry, renderer, and parser live in:

- [../packages/schema/src/language.ts](../packages/schema/src/language.ts) -- code maps, reverse maps, registry
- [../packages/core/src/compact.ts](../packages/core/src/compact.ts) -- renderer + parser

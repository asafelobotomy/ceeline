# ADR 0004 — Personal Lexicon Plugin System

**Status:** Accepted  
**Date:** 2026-04-12  
**Supersedes:** —  
**Related:** ADR 0001 (Trust Model), ADR 0002 (Render Policy)

## Context

Ceeline's vocabulary system has four tiers:

| Layer | Scope | Persistence |
|-------|-------|-------------|
| Session vocab (`vocab=`) | Single exchange | Ephemeral |
| Dialects (`dialect=`) | Shared across agents | Persistent |
| Domain tables (`dom=`) | Shipped with runtime | Permanent |
| Core stems | Language spec | Immutable |

A gap exists between shared dialects and session vocab: there is no
mechanism for an individual LLM to maintain a persistent, personal
vocabulary that reflects its own interpretive patterns, preferred
shorthands, or domain specializations — without polluting the shared
dialect namespace.

## Decision

Introduce a **Personal Lexicon** layer that sits between shared dialects
and session vocab in the resolution hierarchy. A personal lexicon:

1. Is scoped to an **owner identity** (the LLM that authored it)
2. Wraps a `CeelineDialect` by composition (reusing all dialect machinery)
3. Adds **stem relation metadata** mapping personal stems to core/dialect stems
4. Activates via the `lexicon=` header key (analogous to `dialect=`)

### Precedence (later wins on same stem code)

```
Layer 4: Session vocab     ← vocab=
Layer 3: Personal lexicon  ← lexicon=     (NEW)
Layer 2: Shared dialects   ← dialect=
Layer 1: Domain tables     ← dom=
Layer 0: Core stems        ← built-in
```

### Stem Relations

Each personal stem declares how it relates to existing vocabulary:

| Relation | Meaning |
|----------|---------|
| `extends` | New stem not in core (default) |
| `narrows` | Restricts an existing stem's meaning for this LLM |
| `aliases` | Alternative code for an existing core/domain stem |
| `supersedes` | Replaces a shared dialect stem entirely |

### Compact Text Syntax

**Define a personal lexicon:**
```
@cl1 s=me i=lexicon.define
lowner=claude-3 ; did=my.sec-terms ; dver=1 ; dname="My Security Terms"
stem=vuln:vulnerability/NRQC@extends
stem=breach:security-breach/NRC@narrows:sc
```

**Activate a personal lexicon:**
```
@cl1 s=ho i=review.security dialect=audit.sec-review lexicon=my.sec-terms
```

### Implementation

- `PersonalLexicon` type in `packages/schema/src/lexicon.ts`
- `DialectStore.defineLexicon()` / `getLexicon()` / `activateWithLexicon()`
- Parser handles `lexicon=` header, `lowner=` body clause, `@relation` stem suffix
- `extractPersonalLexicon()` assembles lexicon from parsed result

### Resolution Mechanics

Personal lexicon stems are applied to `morphology.domainStems` **after**
shared dialects, using last-write-wins semantics. This avoids adding a
new tier to `CeelineMorphology` or changing `resolveAffix()`. The
existing `stems → domainStems → sessionStems` chain remains unchanged.

## Consequences

- LLMs can maintain persistent personal vocabularies across exchanges
- Two LLMs can define different meanings for the same stem code, scoped by owner
- Stem collisions between lexicons follow the same last-activated-wins rule as dialects
- Owner identity is informational (per ADR 0001 trust model); no cryptographic verification
- The `@relation` suffix is parsed on all `stem=` clauses; when no `lowner=` is present, stems with `@relation` are routed to `lexiconStems` but `extractPersonalLexicon()` will return null, so they have no effect beyond morphology registration

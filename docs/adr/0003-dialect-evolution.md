# ADR 0003: LLM-Authored Dialect Evolution

**Status:** accepted  
**Date:** 2026-04-12  
**Deciders:** Copilot, operator  

## Context

Ceeline v1 has three vocabulary extension mechanisms:

1. **Session vocab** (`vocab=chk:checkpoint`) — ephemeral per-exchange stems
   with full affix privileges but no persistence.
2. **Domain tables** (`dom=sec`) — hardcoded vocabulary packs for common
   review/audit domains. Persistent but static.
3. **Registry extension** (`extendRegistry()`) — programmatic host-side
   additions. Requires code changes.

This leaves a gap: an LLM cannot create reusable vocabulary that persists
across exchanges without host code changes. When an LLM encounters a
recurring pattern — security audits, migration checklists, refactoring
workflows — it can coin session vocab each time, but these coinages are
lost at the boundary of each exchange.

Natural languages solve this by promoting slang into dialect: regional or
professional vocabulary packages that persist within a community of speakers.
Ceeline should do the same.

## Decision

Introduce **LLM-authored dialects** as a first-class concept. A dialect is a
named, versioned, shareable vocabulary extension that sits between session vocab
and domain tables in the persistence hierarchy.

### Persistence hierarchy

```
Hardcoded stems  (permanent, built-in)
     ↑
Domain tables    (permanent, shipped per-package)
     ↑
Dialects         (persistent across exchanges, LLM-authored)  ← NEW
     ↑
Session vocab    (ephemeral, per-exchange)
```

### Dialect structure

```typescript
interface CeelineDialect {
  id: string;          // e.g. "audit.sec-review"
  name: string;        // "Security Audit Review"
  version: number;     // monotonic, starts at 1
  base?: string;       // parent dialect for inheritance
  stems: Map<string, DialectStem>;  // code → {meaning, flags}
  description?: string;
}
```

Unlike domain table stems (code → flags only), dialect stems also carry a
**meaning** string. This serves documentation, sharing, and LLM reasoning.

### Lifecycle

1. **Define** — LLM emits compact text with `i=dialect.define`, `did=`, `dver=`,
   `dname=`, and `stem=` clauses.
2. **Store** — parser extracts the definition; caller stores it in a
   `DialectStore` instance.
3. **Activate** — subsequent messages use `dialect=id` in the header, which the
   caller resolves and applies to morphology (same pattern as `dom=`).
4. **Evolve** — LLM increments version, adds/modifies stems. `dbase=` chains
   to the predecessor.
5. **Promote** — usage counters identify high-frequency stems for potential
   graduation to domain tables.

### Compact text syntax

**Define a dialect:**
```text
@cl1 s=me i=dialect.define
did=audit.sec-review ; dver=1 ; dname="Security Audit Review"
stem=chk:checkpoint/NRQC
stem=swp:sweep/NRQC
stem=grd:guard_clause/NRC
stem=inv:invariant/NRQC
sum="Vocabulary for systematic security audit flow"
```

**Use a dialect:**
```text
@cl1 s=ho i=review.security dialect=audit.sec-review
sum="Running chk.seq on auth module"
re.chk=pass ; neg.grd=found ; swp.seq=injection,xss
```

**Evolve a dialect:**
```text
@cl1 s=me i=dialect.evolve
did=audit.sec-review ; dver=2 ; dbase=audit.sec-review
stem=fix:fix_applied/NRQC
stem=rgr:regression/NRQC
sum="Added fix tracking and regression stems"
```

### Dialect activation vs domain activation

| Feature | `dom=sec` | `dialect=audit.sec-review` |
|---|---|---|
| Stems defined by | Package source code | LLM at runtime |
| Persistence | Permanent (compiled) | DialectStore (session/host) |
| Meanings stored | No (flags only) | Yes (code + meaning + flags) |
| Inheritance | No | Yes (`dbase=`) |
| Usage tracking | No | Yes (DialectStore counters) |
| Validation | Compile-time | Runtime (defineDialect) |

### Resolution precedence

When resolving an affixed code, the lookup order is:

1. Built-in stems (`morphology.stems`)
2. Domain stems (`morphology.domainStems`) — includes both `dom=` and `dialect=` stems
3. Session stems (`morphology.sessionStems`)

Dialect stems merge into `morphology.domainStems` via the same mechanism as
domain tables. This means they participate identically in affix resolution
without a separate lookup layer.

### Inheritance

Dialects can inherit from a base dialect via `dbase=`. When activating a
dialect with a base, the `DialectStore` resolves the full chain (base → child)
and applies stems from base to child. Child stems shadow base stems.

Circular inheritance is detected and silently broken.

### Usage tracking

The `DialectStore` maintains per-stem activation counters. Each time a dialect
is activated, every stem in that dialect increments its counter. This provides
data for promotion decisions:

```typescript
const report = store.getUsageReport();
// [{ code: "chk", count: 47 }, { code: "swp", count: 31 }, ...]
```

Stems with sustained high usage across exchanges are candidates for promotion
to domain tables.

## Consequences

### Positive

- LLMs can evolve the language without host code changes
- Dialects are structured and validated, not freeform slang
- Morphological affixes apply automatically to dialect stems
- Usage tracking provides a data-driven promotion path
- The protocol is fully backwards-compatible (unknown `dialect=` header keys
  are preserved by old parsers per the forward-compatibility rule)

### Negative

- DialectStore is in-memory only; persistence is the host's responsibility
- No built-in deduplication across independent agents coining similar dialects
- Version monotonicity is enforced per-store, not globally

### Risks

- Dialect proliferation without curation could fragment vocabularies
- Different agents may coin incompatible meanings for the same stem code

### Mitigations

- Meanings are stored with stems, making collision detection possible
- `dbase=` inheritance encourages building on shared foundations
- Usage tracking highlights convergent vocabulary for curation
- The promotion lifecycle (dialect → domain table) provides a curation gate

## Alternatives considered

### A. Extend vocab= with flags and persistence

Would work but conflates ephemeral session slang with persistent vocabulary.
The lifecycle semantics are fundamentally different.

### B. Store dialects in envelope extensions (x.dialect.*)

Possible but loses structured parsing. Extension values are opaque strings;
dialect stems need typed representation.

### C. Require host code changes for all new vocabulary

The current approach for domain tables. Doesn't scale to LLM-driven evolution.

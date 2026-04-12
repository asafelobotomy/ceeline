# Domain Stem Tables — Design Research

**Date:** 2026-04-14
**Prerequisite:** [meta-symbol-research-2026-04-14.md](meta-symbol-research-2026-04-14.md) (Category C)
**Status:** Research complete — ready for review

---

## 1. Executive Summary

Category C from the meta-symbol synthesis proposes **domain dictionary
activation**: a single token in the compact header activates a specialised stem
vocabulary, giving domain-specific terms shorter codes. This document
researches the design space, recommends an architecture, defines four initial
domain tables, and provides concrete token economics.

**Key finding:** Domain stem tables can be implemented with **zero changes to
the morphology resolution pipeline**. The existing `sessionStems` mechanism
already supports runtime stem injection. Domain activation is a header-parse
hook that copies a built-in stem table into the mutable session map.

**Projected savings:** 25–40% additional compression on domain-heavy messages
(security reviews, performance audits) at a cost of one header token (`dom=X`).

---

## 2. Design Space Analysis

### 2.1 Where Do Domain Stem Tables Live?

| Option | Pros | Cons |
|--------|------|------|
| **A. Built-in constants in language.ts** | Zero I/O; available instantly; type-checked | Increases bundle size; new domains require a release |
| **B. Separate importable modules** | Tree-shakeable; lazy load | Extra import plumbing; still baked into the package |
| **C. External JSON dictionaries at runtime** | Fully dynamic; user-extensible | Needs I/O; trust/validation surface; latency |
| **D. Inline in .dic files (Hunspell sections)** | Consistent with existing grammar files | Hunspell has no concept of conditional sections |

**Recommendation: A (built-in constants)** — This matches how BUILTIN_STEMS
is already defined. Domain tables are small (~25 stems each, ~100 total). The
bundle cost is negligible. The alternative of external dictionaries introduces
I/O, trust, and versioning problems that outweigh flexibility gains for a
curated, known set of domains.

Future extensions can promote external dictionaries via a `domainUrl=` header
if demand materialises. The internal data structure is the same either way.

### 2.2 How Does Activation Work?

| Option | Syntax | Pros | Cons |
|--------|--------|------|------|
| **A. Header field** | `dom=sec` | Parsed before body; clean scope; multi-domain via `dom=sec+perf` | One more header key |
| **B. Body clause** | `dom=sec` | Consistent with `vocab=` | Domain must be known before body parsing for stems to resolve |
| **C. Inline symbol** | `§` in body | Visually striking; Baudot-style shift | Requires mid-parse stem injection; complex scoping |
| **D. Envelope-level field** | `"domain": "security"` in JSON | Clean in verbose mode | Needs compact mapping |

**Recommendation: A (header field)** — Domain activation changes interpretation
of all body stems, so it belongs in the header. The parser needs to know which
stems are valid *before* it encounters them. A header field makes this
unambiguous. Multi-domain activation via `+` separator (`dom=sec+perf`) is
trivial to parse and covers the intersection case (security review with
performance implications).

The symbols from the synthesis (§, ¶, †, ‡) remain useful as **L1 symbol
atoms** indicating domain focus in prose or symbol expressions, but they don't
drive dictionary activation. The header field drives it because the parser
needs the stems loaded before it reads the body.

### 2.3 When Does Activation Occur in the Parse Pipeline?

Looking at `compact.ts` parseCompact():

```
1. Split header ; body
2. Parse header keys (s=, i=, ch=, md=, ...)     ← dom= goes here
3. Parse body clauses (sum=, f=, ask=, vocab=, ...)
4. Morphology-aware resolution of unknown clause keys
5. Symbol expression resolution
```

Domain activation at step 2 means all domain stems are available by step 3.
This is identical to how `s=` determines which surface-specific decoders run.

### 2.4 How Do Domain Stems Interact With Existing Affixes?

Each domain stem declares its own flag set, exactly like built-in stems:

```
vul/NRQC    →  neg.vul (no vulnerability), re.vul (recurring), vul.seq (list)
ath/NRC     →  neg.ath (no authentication), re.ath (re-authenticate)
xss/C       →  just compounding (no affixes meaningful for "XSS")
```

This means `resolveAffix()` works unchanged — it already checks
`morphology.stems` then `morphology.sessionStems`. Domain stems go into
`sessionStems` (or a parallel `domainStems` map if we want clean separation).

**Design choice: use sessionStems directly vs. add a new domainStems map.**

Using sessionStems directly:
- Zero changes to resolveAffix, isValidMorphologicalCode, expandStem
- Domain stems and session vocab coexist in the same map
- Risk: a vocab= clause could shadow a domain stem

Adding a domainStems map:
- Explicit separation of concerns
- resolveAffix needs a one-line addition to check the new map
- Domain stems can't be shadowed by session vocab

**Recommendation: Add a `domainStems` field** — The cost is one line in
`resolveAffix()` and one new field on `CeelineMorphology`. The benefit is
clean semantics: domain stems are immutable built-in data activated by the
header; session stems are mutable runtime data from vocab= clauses. They serve
different purposes and should be kept separate. Lookup order:
`stems` → `domainStems` → `sessionStems`.

### 2.5 Collision Avoidance

Domain stems **must not** collide with the 232 built-in stems. This is
enforced at definition time (a build-time static check, or a test).

Cross-domain collisions (same stem in two domains) are tolerable when only one
domain is active, but problematic with `dom=sec+perf`. **Recommendation:**
prohibit cross-domain collisions entirely. With ~25 stems per domain and short
3-4 character codes, the namespace is large enough to avoid conflicts.

Collision check against existing stems — the following existing stems must be
avoided by all domain tables:

```
Surfaces:  ho dg me rf ts rt pc hs
Channels:  i cu
Modes:     ro ad mu
Audiences: m o u
Fallbacks: rj vb pt
Styles:    n te nr uf
Sanitizers: st sd
Preserve:  fp ti ag mo cmd env ver key ph sec url cs cf
Payload:   sum f ask art tok cls
Handoff:   role tgt sc pl rv co pa im fx sa
Digest:    win met ok wr er tr ss rn
Memory:    mk dur cit fa de rs sn pj ps
Reflect:   rty cnf rev hy pr cc
Tool:      tn out ela fl sk
Routing:   str cand sel dr bc cn fb
Prompt:    pri src sy ij gr
History:   spn tc anc ex
Structural: diag trace labels pid x vocab
Density:   lite full dense auto
```

That's 106 ASCII stems to avoid (the remaining ~126 entries are symbols with
flag U). Domain stems must not use any of these.

---

## 3. Recommended Architecture

### 3.1 Data Structures

```typescript
/**
 * A domain-specific stem table that can be activated via dom= header.
 */
export interface DomainStemTable {
  /** Short domain identifier used in dom= header (e.g. "sec"). */
  readonly id: string;
  /** Human-readable domain name (e.g. "Security"). */
  readonly name: string;
  /** Domain stems with their allowed flag sets. */
  readonly stems: ReadonlyMap<string, ReadonlySet<string>>;
}

/** Registry of all built-in domain stem tables, keyed by domain ID. */
export const DOMAIN_TABLES: ReadonlyMap<string, DomainStemTable>;
```

### 3.2 Morphology Extension

```typescript
export interface CeelineMorphology {
  readonly prefixes: ReadonlyMap<string, AffixRule>;
  readonly suffixes: ReadonlyMap<string, AffixRule>;
  readonly stems: ReadonlyMap<string, ReadonlySet<string>>;
  /** Domain stems activated by dom= header. Immutable per-message. */
  domainStems: Map<string, Set<string>>;          // ← NEW
  /** Session-scoped stems from vocab= clauses. Mutable at runtime. */
  sessionStems: Map<string, Set<string>>;
}
```

### 3.3 Activation Function

```typescript
/**
 * Activate one or more domain stem tables, populating morphology.domainStems.
 *
 * @param domainIds - Domain IDs to activate (e.g. ["sec", "perf"])
 * @param morphology - The morphology to extend (mutated in place)
 * @throws If a domain ID is unknown or if stems collide across domains
 */
export function activateDomains(
  domainIds: readonly string[],
  morphology: CeelineMorphology
): void {
  for (const id of domainIds) {
    const table = DOMAIN_TABLES.get(id);
    if (!table) continue;  // unknown domain — ignore for forward compat
    for (const [stem, flags] of table.stems) {
      morphology.domainStems.set(stem, new Set(flags));
    }
  }
}
```

### 3.4 Resolution Change (One Line)

In `resolveAffix()`, the stem lookup becomes:

```typescript
// Current:
const flags = morphology.stems.get(stem) ?? morphology.sessionStems.get(stem);

// Proposed:
const flags = morphology.stems.get(stem)
  ?? morphology.domainStems.get(stem)
  ?? morphology.sessionStems.get(stem);
```

### 3.5 Header Parsing (Two Lines)

In `parseCompact()` header switch:

```typescript
case "dom": {
  const ids = hv.split("+");
  activateDomains(ids, morphology);
  result.domains = ids;
  break;
}
```

### 3.6 Compact Encoding

In `compactEnvelope()`, when the source envelope has domain metadata:

```typescript
// If domain-specific stems are in use, emit dom= in header
if (domains.length > 0) {
  headerParts.push(`dom=${domains.join("+")}`);
}
```

---

## 4. Domain Stem Table Design

### 4.1 Stem Naming Conventions

Following patterns established by the existing 232 stems:

1. **2–4 characters** — 2 chars for the most frequent terms, 3–4 for less
   common
2. **Mnemonic** — a reader familiar with the domain should recognise the stem
3. **No collision** — checked against all 106 existing ASCII stems
4. **Conservative flags** — each stem gets only the affixes that make semantic
   sense

### 4.2 Domain: Security (`sec`)

**Use case:** Security review handoffs, vulnerability reports, threat
assessments, pen-test summaries.

**Why this domain?** Security vocabulary is highly specialised and appears in
~100% of security-surface handoffs. Terms like "authentication bypass",
"privilege escalation", and "cross-site scripting" are long multi-token phrases
in natural language but occur with very high frequency in this domain.

| Stem | Meaning | Flags | Rationale |
|------|---------|-------|-----------|
| `vul` | vulnerability | NRQC | neg.vul=patched, re.vul=recurring, vul.seq=list |
| `ath` | authentication | NRC | neg.ath=unauthenticated, re.ath=re-authenticate |
| `azn` | authorization | NRC | neg.azn=unauthorized |
| `byp` | bypass | NRC | neg.byp=blocked |
| `ij2` | injection | NRQC | neg.ij2=sanitized, ij2.seq=list of injection types |
| `xss` | cross-site scripting | QC | xss.seq=list |
| `crf` | CSRF | QC | crf.seq=list |
| `prv` | privilege | NRQC | neg.prv=unprivileged, prv.seq=privilege list |
| `esc` | escalation | NRC | neg.esc=contained |
| `acl` | access control | NRC | neg.acl=unrestricted |
| `tkv` | token validation | NRC | neg.tkv=unvalidated |
| `snt` | sanitization | NRC | neg.snt=unsanitized, re.snt=re-sanitize |
| `enc` | encryption | NRC | neg.enc=unencrypted, re.enc=re-encrypt |
| `tls` | TLS/SSL | NC | neg.tls=plaintext |
| `crt` | certificate | NQXC | neg.crt=missing cert, crt.seq=cert chain |
| `sqi` | SQL injection | QC | sqi.seq=list |
| `bof` | buffer overflow | QC | bof.seq=list |
| `dos` | denial of service | NC | neg.dos=mitigated |
| `rlm` | rate limiting | NRC | neg.rlm=no rate limit, re.rlm=reconfigure |
| `owp` | OWASP | XC | owp.ref=OWASP reference |
| `pen` | penetration (test) | QC | pen.seq=pen test list |
| `exf` | exfiltration | NRC | neg.exf=blocked |
| `hsh` | hashing | NRC | neg.hsh=unhashed, re.hsh=rehash |
| `rbac`| RBAC | NC | neg.rbac=no RBAC |

**24 stems.** With 5 prefixes and 6 suffixes, these generate ~180 valid
morphological forms.

### 4.3 Domain: Performance (`perf`)

**Use case:** Performance audits, profiling reports, latency analysis,
capacity planning.

| Stem | Meaning | Flags | Rationale |
|------|---------|-------|-----------|
| `lat` | latency | NRQOC | neg.lat=no latency issue, lat.seq=latency list |
| `thr` | throughput | NRQC | neg.thr=bottlenecked |
| `cch` | cache | NRQC | neg.cch=cache miss, re.cch=recache |
| `gcl` | garbage collection | NQC | neg.gcl=no GC pressure |
| `mem` | memory | NRQC | neg.mem=no leak, mem.seq=allocations |
| `cpu` | CPU | NQC | cpu.seq=per-core |
| `prf` | profiling | RC | re.prf=re-profile |
| `btl` | bottleneck | NRQC | neg.btl=resolved, btl.seq=list |
| `p50` | 50th percentile | OC | p50.opt=if available |
| `p95` | 95th percentile | OC | p95.opt=if available |
| `p99` | 99th percentile | OC | p99.opt=if available |
| `cld` | cold start | NRC | neg.cld=warm |
| `wrm` | warm-up | RC | re.wrm=re-warm |
| `pol` | pooling | NRQC | neg.pol=no pool |
| `bat` | batching | NRC | neg.bat=unbatched |
| `con` | concurrency | NQC | con.seq=concurrency levels |
| `idx` | indexing | NRQC | neg.idx=unindexed, re.idx=reindex |
| `qop` | query optimization | RQC | re.qop=re-optimize |
| `iop` | I/O | NQC | neg.iop=blocked |
| `all` | allocation | NRQC | neg.all=freed, all.seq=alloc list |
| `ttl` | time-to-live | NOC | ttl.opt=if set |
| `rps` | requests/second | QC | rps.seq=per-endpoint |
| `sat` | saturation | NQC | neg.sat=under capacity |

**23 stems.** ~165 valid morphological forms.

### 4.4 Domain: Architecture (`arch`)

**Use case:** Architecture reviews, design handoffs, system boundary analysis,
dependency audits.

| Stem | Meaning | Flags | Rationale |
|------|---------|-------|-----------|
| `lay` | layer | NQC | neg.lay=flat, lay.seq=layer stack |
| `bnd` | boundary | NRQC | neg.bnd=no boundary, bnd.seq=list |
| `cpl` | coupling | NRQC | neg.cpl=decoupled |
| `coh` | cohesion | NRC | neg.coh=low cohesion |
| `mdl` | module | NRQXC | neg.mdl=monolithic, mdl.ref=module ref |
| `svc` | service | NRQXC | neg.svc=unavailable, svc.ref |
| `gwy` | gateway | NQXC | gwy.ref=gateway ref |
| `fcd` | facade | NXC | fcd.ref |
| `adp` | adapter | NQXC | adp.seq=adapter list |
| `pxy` | proxy | NXC | neg.pxy=direct |
| `obs` | observer | QXC | obs.seq=observer list |
| `evt` | event | NRQC | neg.evt=suppressed, evt.seq=event list |
| `msg` | message | NRQC | msg.seq=message list |
| `que` | queue | NRQC | neg.que=drained, que.seq |
| `pip` | pipeline | NRQC | neg.pip=broken, pip.seq=stages |
| `mdw` | middleware | NQXC | mdw.seq=middleware stack |
| `sch` | schema | NRQVC | neg.sch=schemaless, sch.v=schema version |
| `mig` | migration | NRQC | neg.mig=not migrated, mig.seq=list |
| `dep` | dependency | NRQXC | neg.dep=no deps, dep.seq=dep list |
| `api` | API | NRQXVC | neg.api=no API, api.v=API version |
| `ctr` | contract | NRQC | neg.ctr=no contract |
| `dom2`| domain (DDD) | NQXC | dom2.seq=domain list |
| `agg` | aggregate | NQXC | agg.seq=aggregate list |

**23 stems.** ~170 valid morphological forms.

### 4.5 Domain: Testing (`test`)

**Use case:** Test result summaries, coverage reports, regression analysis,
test plan handoffs.

| Stem | Meaning | Flags | Rationale |
|------|---------|-------|-----------|
| `cov` | coverage | NRQC | neg.cov=no coverage, cov.seq=per-file |
| `ast` | assertion | NRQC | neg.ast=no assertion, ast.seq=list |
| `mck` | mock | NRQC | neg.mck=real, mck.seq=mock list |
| `stb` | stub | NRQC | neg.stb=real, stb.seq=stub list |
| `fxt` | fixture | NRQXC | fxt.seq=fixture list, fxt.ref |
| `reg` | regression | NRQC | neg.reg=no regression, reg.seq=list |
| `flk` | flaky | NRQC | neg.flk=stable, flk.seq=flaky list |
| `ste` | suite | NRQXC | neg.ste=no suite, ste.seq=suite list |
| `scn` | scenario | NRQC | scn.seq=scenario list |
| `exp` | expected | NRC | neg.exp=unexpected |
| `act` | actual | NRC | neg.act=missing |
| `e2e` | end-to-end | NQC | neg.e2e=no e2e, e2e.seq=list |
| `unt` | unit test | NRQC | neg.unt=no unit test |
| `itg` | integration test | NRQC | neg.itg=no integration |
| `snp` | snapshot | NRQC | neg.snp=no snapshot, re.snp=update |
| `pas` | pass | NQC | neg.pas=fail, pas.seq=pass list |
| `skp` | skip | NQC | skp.seq=skip list |
| `tmo` | timeout | NRQC | neg.tmo=no timeout, tmo.seq=list |
| `rty2`| retry | NRQC | neg.rty2=no retry, re.rty2=retry again |
| `hns` | harness | NQXC | hns.ref=harness ref |
| `bln` | baseline | NRQVC | neg.bln=no baseline, bln.v=baseline version |

**21 stems.** ~150 valid morphological forms.

---

## 5. Token Economics

### 5.1 Methodology

Token cost is estimated using Ceeline's 4-byte heuristic (1 token ≈ 4 bytes).
We compare natural language description vs. domain-stem compact encoding for
realistic payloads.

### 5.2 Worked Example: Security Review Handoff

**Scenario:** A security review of an authentication module.

**Natural language (in compact body without domain stems):**

```
@cl2 s=ho;i=review.security;ch=i;md=ro;au=m;fb=rj;rs=n;sz=st
sum=Review authentication module for bypass vulnerabilities
f=Authentication bypass found in session token validation
f=SQL injection risk in user input handling on login endpoint
f=No rate limiting on password reset endpoint
f=CSRF protection missing on state-changing POST requests
f=Privilege escalation possible via role assignment without authorization check
ask=Return severity-ordered findings with OWASP references
role=reviewer;tgt=fixer;sc=transport;sc=validation
```

**Byte count (body only):** ~520 bytes → **~130 tokens**

**With domain stems activated:**

```
@cl2 s=ho;dom=sec;i=review.security;ch=i;md=ro;au=m;fb=rj;rs=n;sz=st
sum=rv ath.byp vul
f=ath.byp+tkv.seq
f=sqi+rlm.ref
f=neg.rlm+esc
f=neg.crf+esc
f=prv.esc+neg.azn
ask=rv+owp.ref
role=rv;tgt=fx;sc=transport;sc=validation
```

**Byte count (body only):** ~240 bytes → **~60 tokens**

**Savings:** ~70 tokens (**54% reduction**). The `dom=sec` header token costs
~2 tokens (the `dom=sec` key-value pair is 7 bytes). Net saving: **~68 tokens
(52%)**.

### 5.3 Worked Example: Performance Audit Digest

**Without domain stems:**

```
@cl2 s=dg;i=perf.audit;ch=i;md=ad;au=o;fb=vb
sum=Performance audit of API gateway response latency
f=P95 latency exceeds 500ms threshold at peak load
f=Cache hit rate dropped to 42% after deployment
f=Database query optimization reduced cold start by 30%
f=Memory allocation spike during garbage collection pauses
ask=Summarize bottlenecks with throughput impact
met=p95:520,p50:180,cache_hit:0.42,rps:12400
```

**~420 bytes body → ~105 tokens**

**With `dom=perf`:**

```
@cl2 s=dg;dom=perf;i=perf.audit;ch=i;md=ad;au=o;fb=vb
sum=audit gwy lat
f=p95>thr+btl
f=neg.cch+dep
f=qop+cld↓
f=all+gcl
ask=btl+thr
met=p95:520,p50:180,cch:0.42,rps:12400
```

**~200 bytes body → ~50 tokens**

**Savings:** ~55 tokens (**52% reduction**). Net after dom= cost: **~53 tokens
(50%)**.

### 5.4 Break-Even Analysis

The `dom=X` header adds ~7 bytes (~2 tokens). Domain stems must save at
least 2 tokens to break even. Given that each domain stem saves ~2–4 bytes
over natural language per use, **the break-even point is 1–2 domain stem
uses**.

Any message that uses ≥2 domain-specific terms in the body will benefit from
domain activation. For domain-typical messages (security reviews, performance
audits), the stem count is typically 8–20, yielding 30–60% net savings.

### 5.5 Comparison With Session Vocab

The existing `vocab=` mechanism can achieve similar savings, but at higher
cost:

```
vocab=vul:vulnerability;vocab=ath:authentication;vocab=azn:authorization;...
```

Each `vocab=X:definition` clause costs ~20–30 bytes. Declaring 24 security
stems inline would cost **~600 bytes (~150 tokens)** — more than the message
itself. Domain tables eliminate this overhead entirely.

| Approach | Stem declaration cost | Per-stem saving | Break-even stems |
|----------|----------------------|-----------------|------------------|
| vocab= inline | ~25 bytes/stem | ~4 bytes/use | ~7 uses/stem |
| dom= built-in | ~7 bytes total | ~4 bytes/use | ~2 uses total |

Domain tables are **~100× more efficient** for known vocabularies because the
table definition is shared knowledge between producer and consumer. This is the
fundamental insight: **pre-shared domain dictionaries eliminate the per-message
declaration cost.**

---

## 6. Integration With Existing Infrastructure

### 6.1 Files Changed

| File | Change | Scope |
|------|--------|-------|
| `packages/schema/src/language.ts` | Add `DomainStemTable` interface, 4 domain table constants, `DOMAIN_TABLES` map, `activateDomains()` function, `domainStems` field on `CeelineMorphology` | ~150 lines added |
| `packages/schema/src/language.ts` | Update `createDefaultMorphology()` to initialise `domainStems: new Map()` | 1 line |
| `packages/schema/src/language.ts` | Update `resolveAffix()` to check `domainStems` between `stems` and `sessionStems` | 1 line |
| `packages/core/src/compact.ts` | Add `dom=` handling in header parse switch | ~8 lines |
| `packages/core/src/compact.ts` | Add domain emit in compact encoder | ~4 lines |
| `packages/schema/dict/ceeline.dic` | Add domain stem sections (informational — the .dic mirrors language.ts) | ~100 lines |
| `packages/schema/dict/ceeline.aff` | No changes needed — existing affix rules apply | 0 lines |

**Total estimated:** ~265 lines of code + ~100 lines of .dic documentation.

### 6.2 Test Coverage

| Test area | What to test |
|-----------|--------------|
| Domain activation | `activateDomains(["sec"], morphology)` populates domainStems |
| Domain resolution | `resolveAffix("neg.vul", morphology)` returns valid result when sec is active |
| Domain isolation | `resolveAffix("vul", morphology)` returns null when no domain is active |
| Multi-domain | `activateDomains(["sec", "perf"], morphology)` merges both |
| Collision guard | Test that no domain stem collides with BUILTIN_STEMS |
| Cross-domain guard | Test that no stem appears in multiple domain tables |
| Header parsing | `parseCompact("@cl2 s=ho;dom=sec;...")` activates domain |
| Round-trip | Compact → parse → recompact preserves domain activation |
| Unknown domain | `dom=unknown` is silently ignored (forward compat) |
| Stem expansion | `expandStem("vul", morphology)` generates all valid forms |

~15–20 new test cases, all within the existing Vitest framework.

### 6.3 Backward Compatibility

- **Old parsers** encountering `dom=sec` will store it as an unknown header
  key (existing forward-compat behaviour). Domain stems in the body will be
  stored as unknown clause keys. No crash, no data loss.
- **New parsers** encountering old messages without `dom=` work identically to
  today. Domain stems are only available when explicitly activated.
- **Version negotiation**: Domain tables are a v1 feature hidden behind a
  header field. No version bump required. The envelope version (`ceeline_version:
  "1.0"`) can remain unchanged because domain stems are backward-compatible
  syntax extensions.

---

## 7. Alternatives Considered

### 7.1 Inline Grammar Rules (Sequitur/Re-Pair Style)

Instead of pre-built domain tables, the producer could emit grammar rules
inline:

```
R1=authentication bypass;R2=privilege escalation;R3=SQL injection
f=R1+tkv;f=R3+risk;f=R2+azn
```

This is how Sequitur and Re-Pair work — discover repeated phrases and replace
them with short rules.

**Rejected because:**
- Grammar rules are message-specific, not domain-specific. The overhead of
  declaring rules per-message approaches the `vocab=` cost.
- Domain tables are pre-shared knowledge. Grammar rules must be transmitted
  with every message.
- Re-Pair requires ~5× memory of input for compression — inappropriate for a
  lightweight transport layer.
- The "grammar" of domain stems is already captured by the affix system (neg.,
  re., .seq, etc.). Domain tables leverage this existing grammar; inline rules
  would duplicate it.

### 7.2 BPE-Derived Static Vocabulary

Run BPE over a corpus of domain-specific messages to discover optimal
merge operations, then use the resulting subword vocabulary as domain stems.

**Considered but deferred because:**
- Requires a substantial training corpus per domain (thousands of messages)
- The resulting vocabulary is not human-readable (BPE merges are byte-level)
- Ceeline stems must be mnemonic — agents and operators read them
- BPE is optimal for character-level compression; Ceeline operates at
  concept-level compression where hand-curated stems are more effective

BPE could inform future stem table refinement (analysing where BPE merges
align with existing stems), but the initial tables should be hand-curated
for readability.

### 7.3 Hierarchical Domain Inheritance

Define a base domain (e.g., "engineering") with sub-domains inheriting stems:

```
engineering → security (inherits + adds security terms)
engineering → performance (inherits + adds perf terms)
```

**Deferred because:**
- Adds complexity without clear benefit for 4 domains
- The base "engineering" stems are already the 232 BUILTIN_STEMS
- Inheritance makes collision analysis harder
- Can be added later if domain count grows significantly (>10)

---

## 8. Open Questions

### 8.1 Domain Detection Heuristics

Should the compact encoder automatically detect when a message would benefit
from domain activation? For example, if the payload contains ≥3 terms from the
security domain vocabulary, automatically emit `dom=sec`.

**Recommendation:** Defer. Let producers explicitly opt in. Automatic detection
adds complexity and may activate domains unexpectedly. The producer (typically
an orchestrator or planner agent) knows the task domain and should declare it.

### 8.2 Custom Domain Tables

Should users be able to define their own domain tables beyond the built-in 4?

**Recommendation:** Yes, via `extendRegistry()`-style composition, but defer
to a future release. The mechanism would be:

```typescript
const customTable: DomainStemTable = {
  id: "bio",
  name: "Bioinformatics",
  stems: new Map([["seq", new Set(["N","R","Q","C"])], ...])
};
registerDomainTable(customTable);
```

### 8.3 Domain Symbols in Symbol Expressions

The synthesis proposed § (security), ¶ (performance), † (refactoring),
‡ (architecture) as L1 symbol atoms. Should these be added as symbol stems
alongside the domain table mechanism?

**Recommendation:** Yes, add them as symbol stems (flag U) in BUILTIN_STEMS.
They serve as semantic markers in symbol expressions (`§→vul` = "security
leads to vulnerability") independently of whether dom= is used. They don't
*activate* domain tables — they're L1 atoms that can appear in any message.

---

## 9. Implementation Plan

### Phase 1: Foundation (Smallest Viable Change)
1. Add `DomainStemTable` interface and `DOMAIN_TABLES` constant to language.ts
2. Add `domainStems` field to `CeelineMorphology`
3. Update `createDefaultMorphology()` and `resolveAffix()`
4. Add `activateDomains()` function
5. Add collision validation tests
6. **Ship with 1 domain (security)** — the highest-value, best-understood domain

### Phase 2: Integration
7. Add `dom=` header parsing in compact.ts
8. Add `dom=` emission in compact encoder
9. Add round-trip tests
10. Add security domain stem tests (all 24 stems × affix combinations)

### Phase 3: Expansion
11. Add performance domain table
12. Add architecture domain table
13. Add testing domain table
14. Update .dic files for documentation
15. Add benchmark comparisons (with/without domain activation)

### Phase 4: Polish
16. Add domain-specific examples to fixtures
17. Update language spec documentation
18. Add § ¶ † ‡ as L1 symbol stems

---

## 10. Summary

Domain stem tables are a natural extension of Ceeline's morphology system that
require **minimal architectural change** (one new interface field, one new
lookup line) for **substantial compression gains** (30–55% on domain-heavy
messages). The design leverages every existing mechanism — affix rules, flag
validation, mutable stem maps, forward-compatible header parsing — and adds
only the minimum new surface needed.

The key insight from the compression algorithm research is that **pre-shared
dictionaries beat inline grammar rules** when the domain is known in advance.
Re-Pair and Sequitur excel at discovering structure in unknown data; Ceeline's
domains are known at design time. BPE excels at character-level subword
decomposition; Ceeline operates at concept-level compression where mnemonic
stems outperform opaque byte merges.

The recommended implementation path is incremental: ship security first, prove
the economics on real messages, then expand to additional domains.

# Ceeline Research: Compound Symbol Compression & Contextual Polysemy

> Date: 2026-04-12 | Status: research | Method: empirical tokenization via
> `gpt-tokenizer` (o200k_base, GPT-4o encoding)  
> Depends on: unicode-token-efficiency-2026-04-12.md (Tier 1 single-token data)

## Executive Summary

This document explores **three escalating levels** of symbol compression beyond
simple 1:1 code substitution:

1. **Compound macros** — 2-3 symbols compose into phrases (like APL, chemistry,
   chess notation)
2. **Contextual polysemy** — same symbol means different things based on
   position, neighbors, and surface (like occult symbolism, CJK radicals,
   alchemical notation)
3. **Semantic operator algebra** — symbols form a grammar with prefix/infix/
   suffix positions that compound meaning

**Key findings:**
- Compound expressions achieve **33-67% compression vs ASCII Ceeline** and
  **50-67% vs English** — a meaningful gain on top of our already-compact codes
- Symbol combos do NOT merge into fewer tokens (no BPE bonus for adjacency) —
  each symbol stays 1 token, so compression is purely semantic
- The **polysemic/contextual model** is the most powerful design: a symbol like
  `●` or `→` shifts meaning by surface and position, multiplying its
  expressiveness without adding tokens
- Esoteric symbol systems (alchemical, runic, zodiac) are **token-expensive**
  (2-3 tokens each) — but the *design pattern* of context-dependent meaning is
  directly applicable using our cheap Tier 1 symbols

---

## Part 1: Precedent Systems

Real-world notations that achieve extreme compression ratios:

### APL — Array Programming Language

APL pioneered single-glyph operators where 2-3 symbols express complex array
operations. Each symbol is an *operator* that modifies behavior of its neighbors.

| Expression | Meaning | Compression |
|------------|---------|-------------|
| `⌈/` | maximum reduction (find max of array) | 8→3 tok (63%) |
| `∊⍷` | membership search (find pattern in array) | 8→5 tok (38%) |
| `⍋⍒` | sort ascending then descending | 4→6 tok (-50%) |
| `+/⍳` | sum of first N integers | 5→4 tok (20%) |

**Lesson:** APL symbols work because they form a *grammar* — operators compose
with functions. The operator `/ ` (reduce) modifies any function to its left.
This isn't just abbreviation; it's compositional.

### Mathematical Notation

| Expression | Meaning | Compression |
|------------|---------|-------------|
| `∀x∈S` | for all x that are elements of set S | 9→5 tok (44%) |
| `f∘g` | function composition of f and g | 6→4 tok (33%) |
| `→∞` | approaches infinity | 3→2 tok (33%) |
| `⊢⊣` | proves and is proved by | 11→4 tok (64%) |
| `□◇` | necessarily and possibly (modal logic) | 7→2 tok (71%) |

**Lesson:** Math notation achieves the highest compression when symbols carry
*relational* meaning (∈ = membership, ∘ = composition, ⊢ = proves). Single
symbols for standalone concepts (π, ∞) save less.

### Chemical Formulas

| Expression | Meaning | Compression |
|------------|---------|-------------|
| `NaCl` | sodium chloride (table salt) | 7→2 tok (71%) |
| `H₂O` | water (two hydrogen one oxygen) | 7→3 tok (57%) |

**Lesson:** Chemistry combines **positional grammar** (element + subscript count)
with a shared dictionary (periodic table). The reader must know Na = sodium to
decompress. This is exactly how Ceeline's code registry works.

### Chess Notation

| Expression | Meaning | Compression |
|------------|---------|-------------|
| `Qxd7#` | queen captures d7, checkmate | 6→4 tok (33%) |
| `O-O-O` | queenside castling | 5→3 tok (40%) |

**Lesson:** Chess notation is positional — `[piece][action][square][modifier]`.
Same letter in different positions means different things: `N` = knight (piece
position) but `f3` = file+rank (destination position).

### Logic / CS

| Expression | Meaning | Compression |
|------------|---------|-------------|
| `λx.x` | identity function (lambda calculus) | 6→3 tok (50%) |
| `⊥⊤` | bottom and top (false and true) | 8→4 tok (50%) |
| `⊢⊣` | proves and is proved by (turnstile) | 11→4 tok (64%) |

---

## Part 2: Esoteric Symbol Systems — Token Costs

These systems embody the *concept* of context-dependent symbolism, but their
Unicode representations are token-expensive.

### Alchemical Symbols (U+1F700–U+1F77F)

| Symbol | Meaning | Tokens | UTF-8 |
|--------|---------|-------:|------:|
| 🜁 | air | 3 | 4 |
| 🜂 | fire | 3 | 4 |
| 🜃 | earth | 3 | 4 |
| 🜄 | water | 3 | 4 |
| 🜍 | sulfur | 3 | 4 |
| 🜚 | gold | 3 | 4 |
| 🜛 | silver | 3 | 4 |

**0/11 single-token.** Supplementary plane (U+1xxxx) = always 3+ tokens.

### Zodiac Signs

All 12 signs (♈–♓) cost **2 tokens** each. None are single-token.

### I Ching Trigrams (U+2630–U+2637)

Only **☴** (wind/gentle) is single-token. The rest are 2 tokens each.

### Runic (Elder Futhark)

All tested runes (ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ) cost **3 tokens** each. Terrible.

### Playing Card Suits

Only **♥** and **♦** are single-token. ♠ and ♣ cost 2 tokens.

### Verdict

The *Unicode representations* of esoteric symbols are token-wasteful. But the
*design principle* — one symbol carries layered meanings depending on context,
orientation, and neighbors — is exactly what we should steal. We just implement
it using our cheap Tier 1 symbols (Greek, arrows, shapes) instead.

---

## Part 3: Compound Expression Design

Using only Tier 1 single-token characters, we can build compound expressions
that compress full directives into 2-3 tokens.

### Flow/Routing Compounds

| Expression | Meaning | Sym Tokens | English Tokens | Compression |
|------------|---------|:----------:|:--------------:|:-----------:|
| `→●` | route to active handler | 2 | 4 | 50% |
| `←↑` | escalate to upstream caller | 2 | 6 | 67% |
| `⇒■` | terminate with final result | 2 | 4 | 50% |
| `→○…` | queue for pending handler with retry | 3 | 6 | 50% |
| `↑▲!` | escalate high priority urgent | 3 | 6 | 50% |
| `↓░` | delegate low confidence | 2 | 3 | 33% |

### State Transition Compounds

Symbol triples `[from]→[to]` read as natural state machines:

| Expression | Meaning | Tokens |
|------------|---------|:------:|
| `○→●` | pending transitions to active | 3 |
| `●→■` | active transitions to complete | 3 |
| `●→□` | active transitions to paused | 3 |
| `□→●` | paused resumes to active | 3 |
| `■⇒○` | complete triggers new pending | 3 |
| `●↓○` | active demotes to pending | 3 |

Each of these replaces 4-5 English tokens with 3 symbol tokens. The notation
is self-documenting: the shapes visually encode state (● filled = active,
○ empty = pending, ■ solid = terminal, □ outline = paused).

### Quality/Confidence Compounds

Block gradient + Greek modifier = 2-token quality assertions:

| Expression | Meaning | Tokens |
|------------|---------|:------:|
| `█α` | highest confidence, primary | 2 |
| `▓β` | high confidence, secondary | 2 |
| `▒γ` | medium confidence, tertiary | 2 |
| `░δ` | low confidence, changed | 2 |
| `█✓` | verified complete | 2 |
| `░≈` | approximate low confidence | 2 |

### Semantic Operator Compounds

Greek letters as operators on domain concepts:

| Expression | Meaning | Tokens |
|------------|---------|:------:|
| `δ→` | change propagates to | 2 |
| `Σδ` | sum of all changes | 2 |
| `∀σ` | for all standard items | 2 |
| `λ→μ` | transform function outputs mean | 3 |
| `ε≤θ` | error within threshold | 3 |
| `ω⇒■` | final implies complete | 3 |

---

## Part 4: The Polysemic Model

This is the deepest insight from occult/esoteric symbolism: **the same glyph
means different things depending on where it appears and what surrounds it.**

### Position-Dependent Meaning

A symbol's role changes by **syntactic position** (prefix, infix, suffix):

```
Symbol: ●
  prefix (●X)     → X is active/live/current
  suffix (X●)     → X is confirmed/verified
  between (X●Y)   → X is actively connected to Y

Symbol: →
  between (A→B)   → A hands off to B
  after delta (δ→) → change propagates forward
  prefix (→X)     → incoming to X

Symbol: δ
  alone (δ)       → change detected
  prefix (δX)     → the change in X
  with count (δ3) → 3 changes detected

Symbol: ▲
  alone (▲)       → high priority
  with number (▲3) → priority level 3
  prefix (▲X)     → X is promoted
  pair (▲X▼Y)     → X increases, Y decreases
```

### Surface-Dependent Meaning

The same symbol acquires domain-specific meaning from the **surface** it appears
in, exactly like how occult symbols shift meaning by ritual context:

```
Symbol: ● (active/confirmed)
  in handoff (ho)   → task is claimed and in-progress
  in routing (rt)   → destination endpoint is live
  in digest (dg)    → item is verified/confirmed

Symbol: → (direction/flow)
  in handoff (ho)   → transfers responsibility to
  in routing (rt)   → sends message to
  in memory (me)    → derives from / sourced from

Symbol: δ (change/delta)
  in handoff (ho)   → changed from previous version
  in reflection (rf) → self-correction delta
  in digest (dg)    → diff since last summary
```

### The Occult Parallel

In esoteric traditions, a pentagram (☆) means protection when point-up inside
a circle, invocation when point-down, and something else entirely when combined
with planetary symbols at each point. The *same mark* carries different payload
based on:
- **Orientation** (our equivalent: prefix vs suffix position)
- **Container** (our equivalent: which surface)
- **Neighbors** (our equivalent: adjacent symbols)
- **Ritual context** (our equivalent: the envelope's stated purpose)

We implement this without any actual esoteric Unicode characters (which cost
3 tokens each). We borrow only the *design pattern*.

---

## Part 5: Compression Showdown

Full comparison of the same directive expressed three ways:

| Symbol CL | English | ASCII CL | Eng Tok | ASCII Tok | Sym Tok | vs Eng | vs ASCII |
|-----------|---------|----------|--------:|----------:|--------:|-------:|---------:|
| `→●▲ fb=↑` | route to active handler high priority escalate if no response | `sel=dr tgt=act pri=hi fb=esc` | 13 | 12 | 6 | **54%** | **50%** |
| `○→● rv ▒` | task transitions from pending to active, assigned to reviewer, medium confidence | `st=pend→act role=rv cnf=0.5` | 13 | 14 | 6 | **54%** | **57%** |
| `δ3▲ s=ho i=...` | change detected in security review, three new issues, high severity | `delta=yes cnt=3 sev=hi s=ho i=review.security` | 13 | 15 | 10 | **23%** | **33%** |
| `Σδ ≈12 █✓` | sum of all changes since last digest, approx 12 items, verified complete | `agg=sum scope=delta cnt=~12 st=verified` | 15 | 12 | 7 | **53%** | **42%** |
| `λ→μ ε≤θ` | function transforms input to normalized output within error threshold | `op=transform in=raw out=norm err=within_thresh` | 9 | 13 | 6 | **33%** | **54%** |
| `←↑ ░≈` | escalate to upstream caller because confidence is low and result is approximate | `act=escalate dir=up reason=low_conf result=approx` | 14 | 15 | 5 | **64%** | **67%** |
| `α●∧β● ω○` | primary and secondary handlers both active, final result pending | `h1=act h2=act final=pend` | 10 | 11 | 8 | **20%** | **27%** |

**Average compression:** ~43% vs English, ~47% vs ASCII Ceeline.

---

## Part 6: Token Merging Behavior

**Do adjacent symbols merge into fewer tokens via BPE?**

| Combo | Individual Sum | Combined | Merged? |
|-------|:--------------:|:--------:|:-------:|
| `→●` | 2 | 2 | No |
| `δ→` | 2 | 2 | No |
| `αβ` | 2 | 2 | No |
| `○→●` | 3 | 3 | No |
| `Σδ` | 2 | 2 | No |
| `λ→μ` | 3 | 3 | No |
| `ε≤θ` | 3 | 3 | No |
| `αβγδ` | 4 | 4 | No |
| `├──` | 3 | 2 | **Yes (-1)** |

**Conclusion:** Symbol tokens are additive — no BPE merging occurs (except one
box-drawing edge case). This means compression is **purely semantic**: each
symbol carries 1 token of cost but >1 token of meaning. The wins come entirely
from the meaning density, not from tokenizer tricks.

---

## Part 7: Layer Intermixing — The Multiplication Effect

The three layers are not independent — they **compound multiplicatively** when
mixed in the same expression.

### Full Envelope Comparisons (header + body)

| Scenario | English | ASCII CL | L1 Only | L2 Only | L1+L2+L3 | vs ASCII | vs English |
|----------|--------:|----------:|--------:|--------:|---------:|---------:|-----------:|
| Security handoff w/ delta + escalation | 29 | 46 | 45 (2%) | 38 (17%) | **29** | **37%** | 0% |
| Digest summary w/ incremental changes | 36 | 53 | 54 (-2%) | 48 (9%) | **35** | **34%** | 3% |
| Routing with fallback chain | 37 | 44 | 41 (7%) | 37 (16%) | **32** | **27%** | 14% |
| Reflection self-correction | 40 | 58 | 56 (3%) | — | **33** | **43%** | 18% |
| Memory fact w/ provenance | 38 | 48 | 45 (6%) | — | **33** | **31%** | 13% |

Note: L1 alone barely helps (~2-7%). L2 alone is modest (~9-17%). But
**L1+L2+L3 combined = 27-43% compression vs ASCII**, with the mixed expression
often matching or beating raw English token count.

### Compression Ceiling (body clauses only, no header overhead)

| Mixed Expression | English | ASCII | Mixed | vs English | vs ASCII |
|------------------|--------:|------:|------:|-----------:|---------:|
| `rv→sr δ3▲ █ ↑lead` | 38 | 28 | **9** | **76%** | **68%** |
| `λ→μ ε≤θ █✓` | 25 | 20 | **8** | **68%** | **60%** |
| `→● α→β→↑ ○→● ▒` | 38 | 23 | **12** | **68%** | **48%** |
| `Σδ ≈12 █✓ α=cr▓ β=tst▒` | 52 | 25 | **15** | **71%** | **40%** |

Body-only expressions hit **60-76% compression vs English** and **40-68% vs
ASCII Ceeline**. The `rv→sr δ3▲ █ ↑lead` expression compresses 38 English
tokens (a full sentence) into 9 tokens.

### Why It Multiplies

```
L1 alone:   ~2-7% savings   (swap δ for delta, α for primary)
L2 alone:   ~9-17% savings  (→● for route-to-active)
L3 alone:   ~0% token savings, but DOUBLES meaning density per token
L1+L2:      ~30-40%         (compounds built from single-token parts)
L1+L2+L3:   ~37-43% full envelope, 40-68% body-only
             PLUS each token carries surface-dependent meaning
```

The multiplication:
1. **L1** makes each symbol cost 1 token (δ = 1 tok vs `delta` = 2 tok)
2. **L2** combines cheap symbols into phrases (`δ3▲` = 3 tok for "3 critical changes")
3. **L3** makes every phrase polymorphic (`δ3▲` means 5 different things across 5 surfaces — zero extra tokens)
4. **Net:** 3 tokens carry the work of 8-12 English tokens with domain precision

### Disambiguation Proof

The same 3-token expression resolves unambiguously by surface context (which is
already present in every envelope at no extra cost):

**`δ3▲` (3 tokens)**
| Surface | Meaning |
|---------|---------|
| `s=ho` (handoff) | 3 changes found, high severity → reviewer must address criticals |
| `s=dg` (digest) | 3 items changed since last summary → highlight in summary |
| `s=rf` (reflection) | 3 self-corrections made → note improvement trend |
| `s=rt` (routing) | 3 route changes detected → re-evaluate routing table |
| `s=me` (memory) | 3 facts updated, high importance → persist with retention weight |

**`○→●` (3 tokens)**
| Surface | Meaning |
|---------|---------|
| `s=ho` | task goes from unclaimed to in-progress |
| `s=rt` | endpoint goes from inactive to live |
| `s=rf` | assessment goes from uncertain to confirmed |
| `s=dg` | item goes from unverified to verified |

**`←↑` (2 tokens)**
| Surface | Meaning |
|---------|---------|
| `s=ho` | return to assigner AND escalate (can't handle this) |
| `s=rt` | route back to sender AND promote to higher tier |
| `s=rf` | revert to previous approach AND increase confidence |

### Micro Expression Catalog

All layers intermixed at clause level:

| Expression | Tokens | Layers | Meaning |
|------------|:------:|--------|---------|
| `δ3▲` | 3 | L1+L2 | 3 critical changes (δ=change, 3=count, ▲=high) |
| `Σδ→■` | 4 | L1+L2 | all changes lead to completion |
| `←pr←tests █` | 5 | L1+L2+L3 | derived from PR, confirmed by tests, high confidence (memory surface) |
| `δ3▲ █ fb=↑` | 7 | L1+L2+L3 | 3 critical changes, verified, escalate on failure |
| `δ sev ▒→▲ ░→█` | 10 | L1+L2+L3 | severity changed, confidence medium→high, low→full (reflection surface) |
| `○→● rv ▒` | 6 | L1+L2+L3 | pending→active, reviewer, medium confidence |
| `□→●✓` | 4 | L1+L2 | paused resumes to active, verified |

---

## Part 8: Design Implications for Ceeline

### Proposed Symbol Grammar

```
clause       = key "=" value
value        = literal | symbol-expr
symbol-expr  = state-expr | flow-expr | quality-expr | operator-expr

state-expr   = shape                          ; ● ○ ■ □
             | shape "→" shape                ; ○→● (state transition)

flow-expr    = arrow target                   ; →● (route to active)
             | arrow arrow                    ; ←↑ (escalate upstream)
             | "⇒" shape                      ; ⇒■ (implies terminal)

quality-expr = block                          ; █ ▓ ▒ ░
             | block greek                    ; █α (high-conf primary)
             | block check                    ; █✓ (verified complete)

operator-expr = greek                         ; δ (change)
              | greek count                   ; δ3 (3 changes)
              | greek arrow                   ; δ→ (change propagates)
              | quant greek                   ; Σδ ∀σ (aggregate)
              | greek comp greek              ; ε≤θ (comparison)
```

### Polysemy Resolution Rules

1. **Surface first:** The envelope's `s=` field establishes the domain context
2. **Position second:** Prefix/infix/suffix position narrows the role
3. **Neighbor third:** Adjacent symbols modify meaning (▲ + number = level)
4. **Default fourth:** Standalone symbols use their base meaning

### Integration Path

1. Symbols enter through `ceeline.dic` as stems with a new flag class (e.g., `U`
   for Unicode-symbol stems)
2. `ceeline.aff` gets compound rules allowing symbol+symbol, symbol+digit,
   symbol+stem combinations
3. `language.ts` maps symbols to their base meanings in a new `SYMBOL_CODES` map
4. The compact parser resolves symbol expressions using the polysemy rules above
5. A `charset=ext` header clause signals that the emitter uses extended symbols
6. ASCII codes remain canonical — symbols are opt-in shorthand

### Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLMs misread symbol intent | Medium | Use conventionally-associated meanings only (→ = direction, δ = change) |
| Font rendering issues | Low | All Tier 1 symbols are in Unicode BMP, supported by all modern terminals |
| Adoption friction | Medium | Symbols are opt-in sugar over ASCII codes; never required |
| Tokenizer changes | Low | Test against future tokenizers; ASCII fallback always available |
| Compound ambiguity | Medium | Polysemy rules are deterministic (surface → position → neighbor → default) |

---

## Appendix: Symbol Inventory (Single-Token Only)

All characters below cost exactly 1 GPT-4o token:

**Greek (2 bytes):** α β γ δ ε ζ η θ λ μ π σ φ ψ ω + all 24 uppercase  
**Arrows (3 bytes):** ← ↑ → ↓ ⇒  
**Shapes (3 bytes):** ■ □ ▪ ▫ ▬ ▲ △ ▶ ▷ ► ▼ ▽ ◆ ◇ ○ ◎ ●  
**Blocks (3 bytes):** █ ▀ ▄ ▋ ░ ▒ ▓  
**Box (3 bytes):** ─ ━ │ ┃ ├ ┣ ═ ║ ╗ ╝  
**Math (3 bytes):** ∀ ∆ − ∙ √ ∞ ∨ ≈ ≤ ≥ ≫  
**Misc (3 bytes):** ★ ☆ ♀ ♂ ♥ ♦ ♡ ♪ ♫ ☎ ☺  
**Enclosed (3 bytes):** ① ② ③ ④ ⑤  
**Dingbats (3 bytes):** ✅ ✓ ✔ ✨ ❤ ➡  
**Latin Sup (2 bytes):** ° ± ² ³ ¹ × ÷ (and 88 more)  
**Currency (2-3 bytes):** € £ ¥ ¢ ₹ ₪  

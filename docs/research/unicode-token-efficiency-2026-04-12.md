# Ceeline Research: Unicode & Symbol Token Efficiency

> Date: 2026-04-12 | Status: research | Method: empirical tokenization via
> `gpt-tokenizer` (o200k_base, GPT-4o encoding)

## Executive Summary

We tested every character in 21 Unicode ranges against the GPT-4o tokenizer to
find non-ASCII symbols that encode as **single tokens** (1 token per character).
The goal: identify character sets that Ceeline could use alongside ASCII to
convey more semantic meaning per token.

**Key finding:** A small number of non-ASCII characters are genuinely
single-token and semantically useful. The best candidates are **Greek letters**
(all 24 are single-token, 2 UTF-8 bytes each), **geometric shapes** (17
single-token), and **5 arrow characters** (←↑→↓⇒). Most other Unicode ranges
cost 2-3 tokens per character and are *worse* than ASCII codes.

---

## Category-Level Token Costs (GPT-4o / o200k_base)

| Category                    | Chars | Tokens | Tok/Char | UTF-8 Bytes | Tok/Byte |
|-----------------------------|------:|-------:|---------:|------------:|---------:|
| ASCII letters a-z           |    26 |      1 |     0.04 |          26 |    0.038 |
| ASCII digits 0-9            |    10 |      4 |     0.40 |          10 |    0.400 |
| **Greek letters**           |    24 |     19 |     0.79 |          48 |    0.396 |
| **Cyrillic**                |    32 |     23 |     0.72 |          64 |    0.359 |
| CJK characters              |    13 |     12 |     0.92 |          39 |    0.308 |
| Latin Extended-A            |    30 |     38 |     1.27 |          60 |    0.633 |
| **Geometric shapes**        |    32 |     52 |     1.63 |          96 |    0.542 |
| Block elements              |    32 |     57 |     1.78 |          96 |    0.594 |
| Math operators              |    32 |     58 |     1.81 |          96 |    0.604 |
| Arrows                      |    32 |     60 |     1.88 |          96 |    0.625 |
| Superscripts                |    16 |     29 |     1.81 |          45 |    0.644 |
| Misc symbols                |    32 |     61 |     1.91 |          96 |    0.635 |
| Dingbats                    |    31 |     59 |     1.90 |          93 |    0.634 |
| Braille patterns            |    32 |     94 |   **2.94** |         96 |    0.979 |
| Math double-struck          |    10 |     28 |   **2.80** |         38 |    0.737 |
| Technical symbols           |    28 |     56 |     2.00 |          84 |    0.667 |
| **Ceeline header (ASCII)**  |    43 |     17 |     0.40 |          43 |    0.395 |
| **Ceeline: neg.ok (ASCII)** |     6 |      2 |     0.33 |           6 |    0.333 |

**Conclusion:** Ceeline's ASCII codes already achieve 0.33-0.40 tokens/char.
Only Greek (0.79) and CJK (0.92) approach ASCII efficiency for non-ASCII.
Everything else is 1.6-2.9× worse.

---

## Tier 1: Single-Token Characters Worth Using

These are non-ASCII characters that the GPT-4o tokenizer encodes as exactly
**1 token** each. They are candidates for semantic enhancements.

### Greek Letters (24/24 lowercase are single-token, 2 bytes each)

| Char | Code   | Token ID | Proposed Ceeline Role            |
|------|--------|----------|----------------------------------|
| α    | U+03B1 |      727 | first / primary / alpha version  |
| β    | U+03B2 |     6331 | second / beta version            |
| γ    | U+03B3 |     2728 | third / gamma threshold          |
| δ    | U+03B4 |     3356 | delta / change / diff            |
| ε    | U+03B5 |      891 | epsilon / error margin / small   |
| ζ    | U+03B6 |     9153 | zeta / unused reserve            |
| η    | U+03B7 |     1425 | eta / efficiency metric          |
| θ    | U+03B8 |     4114 | theta / angle / parameter        |
| λ    | U+03BB |     1727 | lambda / function / transform    |
| μ    | U+03BC |     1722 | mu / micro / mean                |
| π    | U+03C0 |     1345 | pi / pipeline                    |
| σ    | U+03C3 |     1168 | sigma / standard deviation / sum |
| φ    | U+03C6 |     4106 | phi / phase                      |
| ψ    | U+03C8 |    15927 | psi / unused reserve             |
| ω    | U+03C9 |     2806 | omega / final / end              |

**Advantages:**
- All single-token at 2 UTF-8 bytes — same token cost as ASCII letters
- Universally understood semantic associations (math/physics/CS)
- Already used in programming (λ for functions, δ for diffs, etc.)
- LLMs trained heavily on math/science content recognize these

### Arrows (5 single-token, 3 bytes each)

| Char | Code   | Token ID | Proposed Role        |
|------|--------|----------|----------------------|
| →    | U+2192 |    20216 | maps-to / produces   |
| ←    | U+2190 |    75391 | derived-from / input |
| ↑    | U+2191 |    38816 | promotes / escalates |
| ↓    | U+2193 |    38040 | demotes / delegates  |
| ⇒    | U+21D2 |   113961 | implies / therefore  |

### Geometric Shapes (17 single-token, 3 bytes each)

| Char | Code   | Token ID | Proposed Role                |
|------|--------|----------|------------------------------|
| ●    | U+25CF |    21341 | filled / active / current    |
| ○    | U+25CB |    50608 | empty / inactive / pending   |
| ■    | U+25A0 |    24344 | block / complete / terminal  |
| □    | U+25A1 |    22324 | outline / incomplete / open  |
| ▲    | U+25B2 |    59382 | up / increase / high-pri     |
| ▼    | U+25BC |    56822 | down / decrease / low-pri    |
| ▶    | U+25B6 |    68849 | play / process / continue    |
| ◆    | U+25C6 |    49429 | key / important / highlight  |
| ◇    | U+25C7 |   102345 | optional / secondary         |
| ★    | U+2605 |  (misc)  | starred / critical           |

### Block Elements (7 single-token, 3 bytes each)

| Char | Code   | Token ID | Proposed Role                |
|------|--------|----------|------------------------------|
| █    | U+2588 |    26541 | full bar / 100% / complete   |
| ▀    | U+2580 |   169051 | upper half / partial         |
| ▄    | U+2584 |   123264 | lower half / partial         |
| ░    | U+2591 |   132595 | light fill / low confidence  |
| ▒    | U+2592 |   189377 | medium fill / mid confidence |
| ▓    | U+2593 |   157854 | heavy fill / high confidence |

### Box Drawing (10 single-token, 3 bytes each)

| Char | Code   | Token ID | Proposed Role               |
|------|--------|----------|-----------------------------|
| ─    | U+2500 |    17373 | horizontal separator        |
| │    | U+2502 |    74924 | vertical separator / scope  |
| ├    | U+251C |    97522 | branch / child node         |
| ═    | U+2550 |    40235 | double horizontal / header  |
| ║    | U+2551 |   108173 | double vertical / emphasis  |

### Other Notable Singles

| Char | Block               | Token ID | Proposed Role               |
|------|---------------------|----------|-----------------------------|
| ²    | Latin Supplement    |    13848 | squared / version 2         |
| ³    | Latin Supplement    |    45681 | cubed / version 3           |
| °    | Latin Supplement    |   (supp) | degree / quality grade      |
| ±    | Latin Supplement    |   (supp) | plus-or-minus / uncertainty |
| √    | Math Operators      |   103946 | check / verified            |
| ∞    | Math Operators      |   197798 | unbounded / infinite        |
| −    | Math Operators      |    39102 | minus / subtract / remove   |
| ≈    | Math Operators      |   171441 | approximately               |
| ≤    | Math Operators      |   104733 | less-or-equal / at-most     |
| ≥    | Math Operators      |    87319 | greater-or-equal / at-least |
| ∀    | Math Operators      |    94039 | for-all / universal         |
| ✓    | Dingbats            |   (ding) | ok / pass                   |
| ✔    | Dingbats            |   (ding) | confirmed / verified        |
| ①-⑤ | Enclosed Alphanum   |   (encl) | step numbers / ordinals     |
| €    | Currency            |     5087 | euro / cost marker          |
| ™    | Letterlike Symbols  |   (lett) | trademark / registered      |

---

## Tier 2: Avoid — High Token Cost

These look semantically appealing but cost 2-3 tokens each:

| Category               | Tok/Char | Verdict                          |
|------------------------|----------|----------------------------------|
| Braille patterns       | 2.94     | **Worst.** 3 tokens per character. Visually dense but token-wasteful. |
| Math double-struck (𝔸) | 2.80     | 4 UTF-8 bytes + 3 tokens. Terrible. |
| Math italic/bold (𝐀)   | 2.80     | Same. Supplementary plane penalty. |
| Technical symbols (⌘)  | 2.00     | All 2-token. No singles at all.   |
| Emoji (🔵🔴)           | 1.63+    | Multi-token, 4 bytes each. Only ✅✨ from dingbats are single. |
| Subscripts (₀-₉)      | 1.93     | Only ₂ is single-token. Rest are 2. |
| Superscripts (⁴-⁹)    | 2.00     | Only ¹²³ are single (they're Latin Supplement, not true superscripts). |

---

## Tier 3: Comprehensive Single-Token Counts by Range

| Unicode Range               | Range Size | Single-Token | % Efficient |
|-----------------------------|------------|-------------|-------------|
| Latin Supplement (U+A0-FF)  |         96 |          95 |   **99%**   |
| Cyrillic (U+400-4FF)       |        256 |         122 |     48%     |
| Latin Extended-A (U+100-17F)|        128 |          78 |     61%     |
| Greek (U+370-3FF)          |        144 |          63 |     44%     |
| General Punctuation         |        112 |          43 |     38%     |
| Geometric Shapes            |         96 |          17 |     18%     |
| Misc Symbols                |        256 |          12 |      5%     |
| Math Operators              |        256 |          11 |      4%     |
| Box Drawing                 |        128 |          10 |      8%     |
| Block Elements              |         32 |           7 |     22%     |
| Dingbats                    |        192 |           6 |      3%     |
| Number Forms                |         64 |           5 |      8%     |
| Enclosed Alphanumerics      |        160 |           5 |      3%     |
| Arrows                      |        112 |           5 |      4%     |
| Currency                    |         48 |           3 |      6%     |
| Letterlike Symbols          |         80 |           4 |      5%     |
| Superscripts/Subscripts     |         48 |           1 |      2%     |
| Braille                     |        256 |           1 |    <1%      |
| Misc Technical              |        256 |           0 |      0%     |
| Math Symbols-A              |         48 |           0 |      0%     |
| Math Symbols-B              |        128 |           0 |      0%     |

---

## Recommendations for Ceeline

### 1. Greek Letters as Semantic Operators

Greek letters are the **clear winner**: all single-token, 2 bytes each, and
carry strong semantic associations. Proposed integration:

```text
@cl1 s=ho i=review.security
sum="δ from prev scan: 3 new issues"    ; δ = delta/change
cnf=η:0.92                               ; η = efficiency metric
pri=α                                     ; α = primary/highest
```

Use in morphology: Greek letters could be a new affix class for **semantic
modifiers** that compress common adjectives/adverbs into single tokens.

### 2. Arrows for Flow Direction

The 5 single-token arrows (→←↑↓⇒) encode directional relationships in 1 token
that would otherwise take 4-8 tokens in English:

```text
role=rv→im          ; reviewer hands off to implementer
sel=dr↓sa           ; direct routing, delegated to subagent
```

### 3. Geometric Shapes for Status/State

Use shapes as single-character status codes in diagnostics and routing:

```text
st=●                ; active/complete
st=○                ; pending/open
st=■                ; terminal/blocked
pri=▲               ; high priority
```

### 4. Block Elements for Confidence Visualization

The gradient of ░▒▓█ maps naturally to confidence levels:

```text
cnf=░               ; low confidence (0.0-0.25)
cnf=▒               ; medium confidence (0.25-0.5)
cnf=▓               ; high confidence (0.5-0.75)
cnf=█               ; very high confidence (0.75-1.0)
```

### 5. What NOT to Use

- **Braille:** Visually appealing for dense data encoding, but 3 tokens per
  character destroys any advantage. A 2-char ASCII code beats any braille symbol.
- **Math font variants** (bold 𝐀, italic 𝐴, double-struck 𝔸, etc.): 3 tokens
  per character. Supplementary plane characters are always expensive.
- **Full emoji:** Multi-token. Only ✅ and ✨ are single-token from the dingbats
  range, and they're better expressed as ASCII codes.
- **Musical symbols, cuneiform, hieroglyphs:** Supplementary plane, 3-4 tokens
  each. Novelty without value.
- **Subscripts/superscripts** (beyond ¹²³): Only ₂ is single-token. The rest
  are 2 tokens each.

---

## Implementation Approach

If we adopt any non-ASCII symbols, they should enter the language through the
existing affix/morphology system:

1. **Add to `ceeline.dic`** with appropriate flags
2. **Add to `BUILTIN_STEMS`** in `language.ts`
3. **Document in `.aff`** as a new affix flag class if they're modifiers
4. **Remain opt-in**: ASCII codes remain the default; symbols are an optional
   enhancement layer for agents that support them
5. **Add a `charset=` header** (e.g. `charset=ascii` or `charset=ext`) so
   consumers can signal whether they understand extended symbols

### Risk: Model Comprehension

While these symbols are single-token, that doesn't guarantee LLMs understand
their Ceeline-specific meanings. Mitigation:
- Use symbols whose conventional meaning matches their Ceeline meaning
  (→ for "maps to", δ for "change", ● for "active")
- Include them in few-shot examples in the system prompt
- Keep ASCII codes as canonical; symbols are syntactic sugar

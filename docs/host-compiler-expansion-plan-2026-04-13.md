# Host Compiler Expansion Plan

> Date: 2026-04-13 | Status: complete | Scope: phased expansion of the host-side
> compiler

## Preamble: Governing Constraints

Before any expansion, these hard rules from the spec, ADRs, and design brief
constrain every decision:

| Constraint | Source | Impact |
|---|---|---|
| Spec rule #3: "Keep intent exact unless a future host-owned alias table exists" | language spec | Alias tables require fixture evidence before adoption |
| Spec rule #5: "Add host-specific alias tables only after fixture evidence shows they help" | language spec | No speculative alias infrastructure |
| ADR 0001: Fail-closed trust model — model output is always untrusted | ADR 0001 | Compiler output must be revalidated at every boundary |
| ADR 0002: Render is a distinct phase after decode | ADR 0002 | No conflation of compile-time IR with render output |
| ADR 0003: Dialect evolution via LLM-authored dialects | ADR 0003 | Dialect stems already have a persistence hierarchy; compiler extensions must respect it |
| Forward compat: Unknown codes are preserved, never rejected | language spec | New surfaces/codes must not require consumer upgrades |
| Stage 2 stubs: reflection, tool_summary, routing, prompt_context have compact field codes but are marked "stage 2" | language spec | Promotion to stage 3 requires sustained fixture evidence |
| ~~`packages/cli/package.json` `files` array only includes `dist/index.js`~~ | package.json | Resolved by P0 — `files` now includes `dist/` |

---

## Phase 1: Expand Intake Model and Source Coverage

### Problem

The compiler scans exactly 3 file patterns: `*.agent.md`, `SKILL.md`,
`hooks.json`. This misses:

- **Auxiliary reference docs** linked via markdown (`references/compact-grammar.md`,
  `references/examples.md` inside `plugin/skills/ceeline/`)
- **scripts/** directories that contain shell wrappers (`encode.sh`,
  `validate.sh` in `plugin/skills/ceeline/scripts/`)
- **Nested skill references** — when `SKILL.md` links to `references/foo.md`,
  those docs contribute routing signals and facts that are invisible to the
  compiler

### Approach: Hybrid Discovery (Frontmatter + Link Crawl)

Use both discovery modes. Link crawling is zero-config; manifest declaration is
the override.

#### Step 1a: Link-crawl discovery (zero-config)

When parsing a markdown document, extract all relative markdown links from the
body. Resolve each link relative to the source file. If the target exists and is
`.md`, ingest it as a new `HostContextDocument` with `kind: "reference"`.

- **New kind**: Add `"reference"` to `HostContextDocumentKind`
- **Link extraction function**: `extractMarkdownLinks(body: string, basePath: string): string[]`
- **Cycle detection**: Track visited paths in `collectCompilerSourceFiles` to
  avoid infinite recursion
- **Phase assignment**: Reference docs get `phase: "grounding"`,
  `priority: 60` (lower than the parent skill/agent)
- **Route signal inheritance**: Reference docs inherit the parent document's
  route signals plus their own extracted signals, but at reduced weight (×0.5)

#### Step 1b: Frontmatter manifest override

Add optional frontmatter keys to `*.agent.md` and `SKILL.md`:

```yaml
references:
  - references/compact-grammar.md
  - references/examples.md
exclude:
  - references/internal-notes.md
```

When `references:` is present, it replaces link-crawl discovery for that
document (explicit > implicit). When `exclude:` is present, those paths are
removed from the crawl set.

#### Step 1c: Script detection

For `scripts/*.sh` files adjacent to a skill/agent, create a minimal
`HostContextDocument` with `kind: "reference"`. One fact per script:
"Available script: encode.sh — <first comment line>". Route signal:
`tool:<script-name>`.

#### Risks and mitigations

- **False positives**: Only crawl relative paths that resolve to existing `.md`
  files.
- **Over-ingestion**: Configurable max reference count (default 5 per parent),
  plus existing `max_render_tokens` budget enforcement.

---

## Phase 2: Compiler Diagnostics

### Problem

The compiler silently succeeds even when inputs have quality issues: duplicate
document names, empty sections, unresolved markdown links, unused tools.

### Approach: Structured Diagnostic Levels with Fix Suggestions

Add diagnostics to `HostContextCompileOutput`:

```typescript
export interface HostContextDiagnostic {
  level: "error" | "warning" | "info";
  code: string;
  message: string;
  sourceRef: string;
  fix?: string;
}
```

Diagnostics do NOT prevent compilation from succeeding (unless `level: "error"`).
Warnings and infos are advisory.

#### Diagnostic rules

| Code | Level | Trigger |
|---|---|---|
| `duplicate_document_name` | warning | Two documents share the same `name` |
| `empty_section` | info | An `##` section has no extractable facts |
| `unresolved_reference` | warning | A markdown link targets a non-existent file |
| `unused_tool` | info | Tool in frontmatter never mentioned in sections |
| `missing_frontmatter_name` | warning | No `name:` in frontmatter |
| `no_route_signals` | warning | Document produces zero route signals |
| `overlapping_signals` | info | Two documents share >80% of route signals |
| `reference_cycle` | warning | Markdown link crawl hits a cycle |
| `large_reference` | info | Reference doc exceeds 200 facts |

Add `--strict` flag that promotes warnings to errors.

---

## Phase 3: Improve Routing

### Problem

Current routing is keyword intersection with weighted scoring. Limitations:
no negative signals, no confidence bands, hardcoded boosts, no ambiguity
detection.

### Step 3a: Confidence bands and ambiguity warnings

Add `confidence` and `ambiguous` fields to `HostContextRoutingMatch`:

| Band | Condition |
|---|---|
| `high` | Score > 0 and score ≥ 2× second-place |
| `medium` | Score > 0 and < 2× but > 0.67× second-place |
| `low` | Score > 0 but ≤ 0.67× second-place |
| `none` | Score = 0 |

`ambiguous: true` when top-2 are both `medium`+ and within 20% of each other.

### Step 3b: Negative signals

Allow `exclude_signals:` in frontmatter. Matched signals subtract weight
instead of adding it.

### Step 3c: Data-driven signal boosts

Replace speculative alias tables with a `--learn-signals` CLI mode:

1. Run compilation with `--task` for a set of test tasks
2. Output `signal-boosts.json` with per-token adjustments
3. Compiler loads this file at runtime

This satisfies spec rule #5: the fixture evidence IS the tasks file.

### Rejected alternatives

- TF-IDF/BM25: Over-engineered for 3–10 documents
- Embedding-based routing: Requires model dependency, violates dependency-free
  core
- Host-owned alias tables (as specced): Deferred per spec rules #3 and #5

---

## Phase 4: Emit Reflection and Tool Summary Surfaces

### Problem

The compiler emits 4 of 8 surfaces. Reflection and tool_summary have schemas
and stage-2 compact codes but no compiler emission.

### Step 4a: Compilation reflection envelope

Emit one `reflection` envelope after every compilation with:

- `reflection_type: "confidence_check"`
- `confidence`: 1.0 minus weighted diagnostic count
- `facts`: diagnostic summary, routing confidence per document

Serves ADR 0001: makes compilation quality machine-inspectable.

### Step 4b: Tool dependency envelope

Emit one `tool_summary` envelope mapping tool declarations across all compiled
documents. Lists per-document tools and unique tool set.

### Stage 2 → Stage 3 promotion path

Ship compiler emitting these surfaces → benchmark → promote if compression
ratios match other stage 3 surfaces.

---

## Phase 5: Productize as Build Artifact

### Step 5a: Fix publish `files` array

`packages/cli/package.json` must include `dist/host-compiler.*` or use
`"files": ["dist/"]`.

### Step 5b: Disk output mode

Add `--output <dir>` flag. Write manifest with SHA-256 hashes on inputs and
outputs, plus per-envelope JSON files and bundled compact `.cl1` files.

### Step 5c: Watch mode

Add `--watch` flag using `fs.watch` with 100ms debounce. Full recompilation on
change (incremental deferred until source count exceeds ~50).

### Step 5d: Architecture split (deferred)

Split into loaders/IR/emitters ONLY when triggered by:
1. A second input format appears
2. A second output target appears
3. The file exceeds 2000 lines
4. VS Code extension is un-shelved

---

## Implementation Priority

| Priority | Phase | Effort | Dependencies |
|---|---|---|---|
| **P0** ✅ | 5a: Fix publish `files` | 5 min | None |
| **P1** ✅ | 2: Compiler diagnostics | Medium | None |
| **P2** ✅ | 3a: Confidence bands | Small | None |
| **P3** ✅ | 1: Expanded intake | Medium | None |
| **P4** ✅ | 3b: Negative signals | Small | P3 |
| **P5** ✅ | 4a: Reflection envelope | Medium | P1 |
| **P6** ✅ | 4b: Tool summary envelope | Small | None |
| **P7** ✅ | 5b: Disk output + manifest | Medium | None |
| **P8** ✅ | 3c: Learned signal boosts | Medium | P1, P2 |
| **P9** ✅ | 5c: Watch mode | Small | P7 |

### Suggested batches

1. **Batch A (foundations)**: P0, P1, P2
2. **Batch B (intake)**: P3, P4
3. **Batch C (surfaces)**: P5, P6
4. **Batch D (productize)**: P7, P8, P9

Each batch is independently shippable and testable.

---

## Testing Strategy

| Phase | Test additions |
|---|---|
| 1 | Real `plugin/skills/ceeline/` layout as fixture. Cycle detection. `exclude:` frontmatter. |
| 2 | Duplicate name, empty section, unresolved link. `--strict` promotion. |
| 3 | Confidence bands. Ambiguity warning. Negative signals. Learned boosts loading. |
| 4 | Golden fixtures for reflection and tool_summary. Confidence decreases with warnings. |
| 5 | Manifest SHA-256 determinism. Output directory structure. Compile → write → verify. |

---

## Rejected Ideas

| Idea | Reason |
|---|---|
| Host-owned alias tables (as specced) | Spec rules #3/#5 require evidence. Replaced with learned boosts. |
| Loader/IR/Emitter split | Premature at 1028 lines with one format pair. |
| TF-IDF/BM25 routing | Over-engineered for ≤10 documents. |
| Embedding-based routing | Requires model dependency. |
| LSP diagnostic protocol | Over-engineering for CLI tool. |

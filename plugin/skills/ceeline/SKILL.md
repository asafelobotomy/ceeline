---
name: ceeline
description: >
  Encode, decode, validate, and render Ceeline compact envelopes for internal
  AI-to-AI communication. Use when compressing handoff payloads, session
  summaries, memory notes, tool summaries, routing metadata, or prompt context
  into token-efficient compact format. Also use when validating incoming compact
  text, checking for leaked Ceeline artifacts in user-facing output, or
  round-tripping between JSON envelope and compact wire format.
---

# Ceeline Compact Transport

Ceeline is a schema-first compact transport layer for internal AI communication.
It reduces token usage on machine-controlled surfaces without changing the
language of user-facing output.

## When to use Ceeline

Use Ceeline when the task involves **internal-only AI communication** on one of
these surfaces:

| Surface          | Code | Use case                                      |
|------------------|------|-----------------------------------------------|
| `handoff`        | `ho` | Planner-to-implementer or reviewer payloads   |
| `digest`         | `dg` | Session summaries, heartbeat state            |
| `memory`         | `me` | Internal memory notes, fact stores            |
| `reflection`     | `rf` | Self-check summaries, post-run audits         |
| `tool_summary`   | `ts` | Compact tool input/output summaries           |
| `routing`        | `rt` | Intent classification, scope hints            |
| `prompt_context` | `pc` | Host-owned prompt fragments (machine-private) |
| `history`        | `hs` | Participant-local conversation state          |

**Do NOT use Ceeline for:**
- User-facing chat responses
- Human-authored instruction files
- Public documentation
- Any surface the host does not control end-to-end

## Compact format overview

Three density levels:

- **lite** — one key=value per line, human-scannable, omits `tok=` preserve tokens
- **full** — semicolon-separated single line, includes `tok=` preserve tokens
- **dense** — like full but drops redundant fields (`cls=`, `ch=`, `md=`, etc.)

Every compact output ends with `#n=<bytecount>` — an integrity trailer that the
parser verifies on read.

See [the language spec reference](references/compact-grammar.md) for the full
grammar, field codes, and density rules.

## Policy modes

Every encode operation uses one of two policy modes:

| Policy | Channel | Audience | Render style | Use when |
|---|---|---|---|---|
| `internal` | `internal` | `machine` | `none` | Default; any AI-to-AI surface |
| `final_response` | `controlled_ui` | `user` | `user_facing` | Final boundary before user display |

- Omitting `policy` is equivalent to `policy: "internal"`.
- `final_response` sets `no_user_visible_output: false`, `fallback: "verbose"`, and `sanitizer: "strict"` automatically.
- `pass_through` fallback is never permitted on `controlled_ui` channels.

## How to encode a handoff

1. Determine the **surface** (e.g. `handoff`, `digest`, `memory`).
2. Choose the **policy**: omit (or pass `"internal"`) for machine-private payloads;
   pass `"final_response"` when the envelope will be rendered to a user at the final boundary.
3. Build the JSON input with at minimum `surface`, `intent`, and `payload.summary`.
4. Run the encode script:

```bash
./scripts/encode.sh '{"surface":"handoff","intent":"review.security","payload":{"summary":"Review codec.ts for safety","facts":["Preserve {{PROJECT_ID}}"],"ask":"Return findings only","role":"reviewer","target":"fixer","scope":["transport"]}}'
```

Or use the MCP tool `translate_to_ceeline` if available:

```json
{
  "surface": "history",
  "intent": "ui.final-response",
  "policy": "final_response",
  "payload": { "summary": "The fix is applied.", "span": "exchange", "turn_count": 1, "anchor": "assistant-final" }
}
```

5. The output is a validated Ceeline JSON envelope.
6. To get compact text, use `renderCeelineCompact(envelope, "full")` or the
   auto-density renderer `renderCeelineCompactAuto(envelope)`.

## How to validate

```bash
./scripts/validate.sh '<json envelope>'
```

Returns `{"ok": true}` or a list of typed validation issues.

## How to decode compact text

```bash
./scripts/decode.sh '<json envelope>'
```

Parses a JSON envelope and returns the decoded canonical meaning.

## How to detect leaks

Before emitting any user-facing output, scan for leaked Ceeline artifacts:

```bash
./scripts/detect-leak.sh 'some output text containing @cl1 s=ho ...'
```

Returns an array of leak findings. If non-empty, the output is unsafe.

## Compact format examples

### Lite density (handoff surface)

```
@cl1 s=ho i=test.handoff ch=i md=ro au=m fb=rj rs=n sz=st
sum="Test handoff summary."
f="Fact one."
ask="Test ask."
role=rv
tgt=fx
sc=transport
#n=143
```

### Full density (handoff surface)

```
@cl1 s=ho i=test.handoff ; sum="Test handoff summary." ; f="Fact one." ; ask="Test ask." ; role=rv ; tgt=fx ; sc=transport ; #n=122
```

## Key rules

1. **Preserve tokens exactly** — file paths, commands, env vars, placeholders,
   URLs, and version strings must survive encode/decode byte-for-byte.
2. **Integrity trailer** — every compact output ends with `#n=<bytecount>`.
   The parser verifies this; mismatches produce `integrity_mismatch` warnings.
3. **Budget-aware density** — `renderCeelineCompactAuto()` picks the densest
   format that fits the envelope's `max_render_tokens` budget. If no density
   fits, it returns `token_budget_exceeded`.
4. **CeelineResult** — all operations return `{ ok: true, value } | { ok: false, issues }`.
   Always check `.ok` before using the value.
5. **Leak prevention** — never emit raw compact text or envelope JSON in
   user-visible output. Always run `detectLeaks()` before final rendering.

## Available tools

If the Ceeline MCP server is active, these tools are available:

- `translate_to_ceeline` — encode canonical input into a Ceeline envelope; accepts optional `policy` (`"internal"` | `"final_response"`)
- `translate_from_ceeline` — decode an envelope to canonical meaning
- `validate_ceeline_payload` — validate an envelope against schemas
- `render_verbose_summary` — render a user-facing summary from an envelope
- `detect_ceeline_leak` — scan text for Ceeline artifacts
- `render_compact` — render a Ceeline envelope into compact text at a specified density (`lite`, `full`, `dense`, or `auto`)
- `parse_compact` — parse compact Ceeline text back into structured data

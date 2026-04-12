# ADR 0002: Ceeline Render Policy

- Status: Draft
- Date: 2026-04-11

## Context

Ceeline needs two different output behaviors:

- compact internal renderings for operators or machine-adjacent workflows
- clean user-facing renderings that cannot leak internal transport artifacts

If render behavior is underspecified, hosts will blur decode, render, and
sanitize phases and eventually expose raw envelopes, shorthand markers, or
routing metadata to users.

## Decision

Ceeline defines rendering as a distinct phase after decode.

1. Decode reconstructs canonical meaning, not final prose.
2. Render modes are explicit: `none`, `terse`, `normal`, and `user_facing`.
3. `user_facing` render mode must always run sanitization and leak detection.
4. `none` means no human-facing output may be emitted from that payload.
5. Internal renderings may be compact, but user-facing renderings must prefer
   clarity over compression.
6. When strict sanitization finds a leak, the renderer rejects output or falls
   back to safe verbose rendering if policy allows it.

## Consequences

Positive:

- Hosts can safely separate transport concerns from presentation concerns.
- The same envelope can support internal diagnostics and clean end-user output.
- Leak prevention becomes part of the product contract rather than host custom
  behavior.

Negative:

- Rendering logic becomes more explicit and slightly more complex.
- Hosts must choose render mode deliberately instead of treating all text as the
  same class of output.

## Follow-up

- Add fixture coverage for user-facing render and strict sanitizer failures.
- Keep render outputs deterministic for v1.
- Revisit whether shorthand operator renderings need their own versioned spec in
  v2.

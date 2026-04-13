# Ceeline Fixtures

This package contains canonical example inputs and envelope outputs for Ceeline
v1 tests.

## Structure

- `canonical/`: readable source content classified by surface
  - `handoff.review-security.json`
  - `history.exchange.json`
  - `prompt-context.system.json`
  - `reflection.self-critique.json`
  - `routing.direct.json`
  - `tool-summary.eslint.json`

- `envelopes/`: expected Ceeline v1 envelopes for all 8 surfaces
  - `digest.session-summary.envelope.json`
  - `handoff.review-security.envelope.json`
  - `history.exchange.envelope.json`
  - `memory.fact-capture.envelope.json`
  - `prompt-context.system.envelope.json`
  - `reflection.self-critique.envelope.json`
  - `routing.direct.envelope.json`
  - `tool-summary.eslint.envelope.json`

- `flows/`: end-to-end fixtures that model readable source in, Ceeline inside,
  and verbose user-facing output at the final boundary
  - `handoff-repair.boundary.json`
  - `internal-to-user.boundary.json`

Golden compact fixtures (24 files: 8 surfaces × 3 densities) live in the
top-level `fixtures/compact/` directory, not in this package.

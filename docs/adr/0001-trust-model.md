# ADR 0001: Ceeline Trust Model

- Status: Draft
- Date: 2026-04-11

## Context

Ceeline transports compact internal payloads across hosts, adapters, and model-
mediated systems. The product only remains safe if hosts distinguish between
trusted canonical inputs and untrusted outputs produced by models, external
services, or hand-edited envelopes.

Without a formal trust model, hosts will eventually treat model-produced text as
valid transport, allow unvalidated fallback paths, or render compact internal
artifacts directly to users.

## Decision

Ceeline adopts a fail-closed trust model.

1. Host-authored canonical content is trusted only before transform.
2. Every envelope is untrusted until it passes schema and semantic validation.
3. Any mutation after validation invalidates prior trust and requires
   revalidation.
4. Model output is always untrusted, even when it resembles a valid Ceeline
   envelope.
5. User-visible rendering is allowed only from decoded canonical meaning, never
   from raw envelope text.
6. `pass_through` fallback is forbidden on `controlled_ui` channels.
7. Adapters may add host metadata, but they may not bypass schema rules or
   redefine standard field semantics.

## Consequences

Positive:

- Hosts can reason about when Ceeline payloads are safe to consume.
- Leaks and schema drift become validation failures instead of silent behavior.
- Controlled UI surfaces have a clear guardrail against raw transport exposure.

Negative:

- Hosts must revalidate more often.
- Some optimistic integrations become impossible by design.
- Model-originated envelopes require explicit validation and may be rejected.

## Follow-up

- Keep envelope validation cheap enough to run at every boundary.
- Add typed validation errors so adapters can decide whether to reject or fall
  back to verbose rendering.
- Add fixture coverage for trusted, untrusted, and mutation-after-validation
  scenarios.

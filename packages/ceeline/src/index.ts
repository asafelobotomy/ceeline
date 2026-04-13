/**
 * @asafelobotomy/ceeline — full Ceeline suite meta-package.
 *
 * Install once:
 *   npm install @asafelobotomy/ceeline
 *
 * Then import from the individual packages:
 *   import { renderCeelineCompact, parseCeelineCompact } from "@asafelobotomy/ceeline-core";
 *   import type { CeelineEnvelope } from "@asafelobotomy/ceeline-schema";
 *
 * Or use the convenience re-exports:
 *   import { schema, core } from "@asafelobotomy/ceeline";
 */

export * as schema from "@asafelobotomy/ceeline-schema";
export * as core from "@asafelobotomy/ceeline-core";

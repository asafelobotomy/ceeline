import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { CeelineSurface } from "@asafelobotomy/ceeline-schema";
import { decodeEnvelope, encodeCanonical, renderCeelineCompact, renderUserFacing } from "../index.js";

const FLOW_FIXTURE_DIR = resolve(__dirname, "../../../../packages/fixtures/flows");

interface FlowStep {
  surface: CeelineSurface;
  intent: string;
  text: string;
  source: {
    kind: "fixture";
    name: string;
    instance: string;
    timestamp: string;
  };
  payload: Record<string, unknown>;
}

interface FlowFixture {
  instructions: FlowStep;
  final_response: FlowStep;
  expected: {
    internal_density: "lite" | "full" | "dense";
    internal_compact_markers: string[];
    final_user_facing_text: string;
  };
}

function readFlowFixtures(): Array<{ name: string; fixture: FlowFixture }> {
  return readdirSync(FLOW_FIXTURE_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => ({
      name,
      fixture: JSON.parse(readFileSync(resolve(FLOW_FIXTURE_DIR, name), "utf-8")) as FlowFixture
    }));
}

describe("encodeCanonical policy defaults", () => {
  it("defaults machine-private surfaces to internal compact policy", () => {
    const result = encodeCanonical(
      {
        text: "Compile system instructions for machine-private prompt assembly.",
        intent: "prompt.compile",
        source: {
          kind: "host",
          name: "ceeline.tests",
          instance: "policy-defaults-internal",
          timestamp: "2026-04-13T10:00:00Z"
        },
        payload: {
          summary: "Compile system instructions.",
          facts: ["Prompt assembly stays machine-private."],
          ask: "Keep the transport compact.",
          phase: "system",
          priority: 10,
          source_ref: "workspace://policy",
          artifacts: [],
          metadata: {}
        }
      },
      "prompt_context"
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.channel).toBe("internal");
    expect(result.value.constraints.audience).toBe("machine");
    expect(result.value.constraints.no_user_visible_output).toBe(true);
    expect(result.value.constraints.fallback).toBe("reject");
    expect(result.value.render.style).toBe("none");
  });

  it("supports final-response defaults for the user-facing boundary", () => {
    const result = encodeCanonical(
      {
        text: "Summarize the approved boundary for the user.",
        intent: "ui.final-response",
        source: {
          kind: "host",
          name: "ceeline.tests",
          instance: "policy-defaults-final-response",
          timestamp: "2026-04-13T10:00:00Z"
        },
        payload: {
          summary: "Ceeline stays inside the system.",
          facts: ["Only the final user response expands back into full prose."],
          ask: "Confirm the boundary clearly.",
          span: "exchange",
          turn_count: 1,
          anchor: "assistant-final",
          artifacts: [],
          metadata: {}
        }
      },
      "history",
      { policy: "final_response" }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.channel).toBe("controlled_ui");
    expect(result.value.constraints.audience).toBe("user");
    expect(result.value.constraints.no_user_visible_output).toBe(false);
    expect(result.value.constraints.fallback).toBe("verbose");
    expect(result.value.render.style).toBe("user_facing");
  });
});

describe("policy flow fixtures", () => {
  for (const { name, fixture } of readFlowFixtures()) {
    it(`${name} keeps the internal step compact and renders the final response verbosely`, () => {
      const instructions = encodeCanonical(
        {
          text: fixture.instructions.text,
          intent: fixture.instructions.intent,
          source: fixture.instructions.source,
          payload: fixture.instructions.payload as {
            summary: string;
            facts?: string[];
            ask?: string;
            artifacts?: unknown[];
            metadata?: Record<string, unknown>;
          }
        },
        fixture.instructions.surface
      );

      expect(instructions.ok).toBe(true);
      if (!instructions.ok) return;

      const compact = renderCeelineCompact(instructions.value, fixture.expected.internal_density);
      expect(compact.ok).toBe(true);
      if (!compact.ok) return;

      for (const marker of fixture.expected.internal_compact_markers) {
        expect(compact.value).toContain(marker);
      }

      const finalResponse = encodeCanonical(
        {
          text: fixture.final_response.text,
          intent: fixture.final_response.intent,
          source: fixture.final_response.source,
          payload: fixture.final_response.payload as {
            summary: string;
            facts?: string[];
            ask?: string;
            artifacts?: unknown[];
            metadata?: Record<string, unknown>;
          }
        },
        fixture.final_response.surface,
        { policy: "final_response" }
      );

      expect(finalResponse.ok).toBe(true);
      if (!finalResponse.ok) return;

      const rendered = renderUserFacing(decodeEnvelope(finalResponse.value));
      expect(rendered.ok).toBe(true);
      if (!rendered.ok) return;

      expect(rendered.value).toBe(fixture.expected.final_user_facing_text);
    });
  }
});
import { describe, expect, it } from "vitest";
import { encodeRequestToEnvelope } from "./index.js";

describe("CLI encode policy handling", () => {
  it("applies final_response policy defaults on encode", () => {
    const result = encodeRequestToEnvelope({
      surface: "history",
      intent: "ui.final-response",
      policy: "final_response",
      source: {
        kind: "host",
        name: "ceeline.cli.tests",
        instance: "final-response",
        timestamp: "2026-04-13T11:00:00Z"
      },
      payload: {
        summary: "Explain the repair outcome.",
        facts: ["Only the final user-facing answer should be verbose."],
        ask: "State the visible outcome clearly.",
        span: "exchange",
        turn_count: 1,
        anchor: "assistant-final",
        artifacts: [],
        metadata: {}
      }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.channel).toBe("controlled_ui");
    expect(result.value.constraints.audience).toBe("user");
    expect(result.value.constraints.no_user_visible_output).toBe(false);
    expect(result.value.render.style).toBe("user_facing");
  });

  it("rejects unknown policy values", () => {
    const result = encodeRequestToEnvelope({
      surface: "handoff",
      intent: "review.security",
      policy: "verbose_everywhere" as never,
      source: {
        kind: "host",
        name: "ceeline.cli.tests",
        instance: "invalid-policy",
        timestamp: "2026-04-13T11:00:00Z"
      },
      payload: {
        summary: "Review the transport boundary.",
        facts: [],
        ask: "Return findings only.",
        role: "reviewer",
        target: "fixer",
        scope: ["transport"],
        artifacts: [],
        metadata: {}
      }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === "invalid_policy")).toBe(true);
    }
  });
});
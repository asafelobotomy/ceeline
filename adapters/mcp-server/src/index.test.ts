import { describe, expect, it } from "vitest";
import { createCeelineMcpToolDescriptors, invokeCeelineMcpTool } from "./index.js";

describe("MCP translate_to_ceeline policy handling", () => {
  it("declares policy in the tool schema", () => {
    const descriptor = createCeelineMcpToolDescriptors().find((tool) => tool.name === "translate_to_ceeline");
    expect(descriptor).toBeDefined();
    expect(descriptor?.inputSchema.properties).toHaveProperty("policy");
  });

  it("applies final_response policy defaults on translate_to_ceeline", () => {
    const result = invokeCeelineMcpTool({
      name: "translate_to_ceeline",
      arguments: {
        surface: "history",
        intent: "ui.final-response",
        policy: "final_response",
        payload: {
          summary: "Explain the user-visible repair outcome.",
          facts: ["The output is now sanitized before it reaches the user."],
          ask: "State the visible effect only.",
          span: "exchange",
          turn_count: 1,
          anchor: "assistant-final",
          artifacts: [],
          metadata: {}
        }
      }
    }) as Record<string, unknown>;

    expect(result.channel).toBe("controlled_ui");
    expect((result.constraints as Record<string, unknown>).audience).toBe("user");
    expect((result.constraints as Record<string, unknown>).no_user_visible_output).toBe(false);
    expect((result.render as Record<string, unknown>).style).toBe("user_facing");
  });

  it("rejects unknown policy values", () => {
    const result = invokeCeelineMcpTool({
      name: "translate_to_ceeline",
      arguments: {
        surface: "handoff",
        intent: "review.security",
        policy: "verbose_everywhere",
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
      }
    }) as { errors?: Array<{ code: string }> };

    expect(result.errors?.some((error) => error.code === "invalid_policy")).toBe(true);
  });
});
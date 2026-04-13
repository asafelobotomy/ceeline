import { describe, expect, it } from "vitest";
import { createCeelineMcpToolDescriptors, handleRequest, invokeCeelineMcpTool, type FramingMode } from "./index.js";

describe("MCP stdio framing", () => {
  it("handleRequest returns initialize response", () => {
    const response = handleRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test", version: "0.1" }
      }
    });
    expect(response).not.toBeNull();
    expect(response!.jsonrpc).toBe("2.0");
    expect(response!.id).toBe(1);
    const result = response!.result as Record<string, unknown>;
    expect(result.protocolVersion).toBe("2025-03-26");
    expect(result.capabilities).toEqual({ tools: {} });
  });

  it("handleRequest returns null for notifications/initialized", () => {
    const response = handleRequest({
      jsonrpc: "2.0",
      method: "notifications/initialized"
    });
    expect(response).toBeNull();
  });

  it("handleRequest returns tools/list", () => {
    const response = handleRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list"
    });
    expect(response).not.toBeNull();
    const result = response!.result as { tools: unknown[] };
    expect(result.tools.length).toBeGreaterThan(0);
  });

  it("handleRequest returns error for unknown method", () => {
    const response = handleRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "unknown/method"
    });
    expect(response).not.toBeNull();
    expect(response!.error).toBeDefined();
    expect(response!.error!.code).toBe(-32601);
  });
});

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
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileHostContext } from "./host-compiler.js";
import { encodeRequestToEnvelope, formatCompileHostContextOutput, parseCompileHostContextArgs } from "./index.js";

const fixtureRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../plugin");

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

  it("parses compile-host-context arguments for compact-only output and task scoring", () => {
    const result = parseCompileHostContextArgs(["plugin", "--compact-only", "--task", "Review security handoffs"]);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(`parseCompileHostContextArgs failed: ${JSON.stringify(result.issues)}`);
    }

    expect(result.value.targetPath).toBe("plugin");
    expect(result.value.outputMode).toBe("compact-only");
    expect(result.value.task).toBe("Review security handoffs");
  });

  it("rejects a missing task value when the next token is another option", () => {
    const result = parseCompileHostContextArgs(["plugin", "--task", "--compact-only"]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === "missing_task")).toBe(true);
    }
  });

  it("parses the equals form for task scoring", () => {
    const result = parseCompileHostContextArgs(["plugin", "--task=Review security handoffs"]);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(`parseCompileHostContextArgs failed: ${JSON.stringify(result.issues)}`);
    }

    expect(result.value.targetPath).toBe("plugin");
    expect(result.value.outputMode).toBe("json");
    expect(result.value.task).toBe("Review security handoffs");
  });

  it("formats compact-only host compiler output as compact bundle text", () => {
    const compiled = compileHostContext(fixtureRoot, {
      task: "Review a Ceeline handoff for security validation issues and return findings."
    });

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      throw new Error(`compileHostContext failed: ${JSON.stringify(compiled.issues)}`);
    }

    const output = formatCompileHostContextOutput(compiled.value, "compact-only");
    expect(output).toContain("@cl1 s=pc");
    expect(output).toContain("@cl1 s=rt");
    expect(output).toContain("@cl1 s=dg");
    expect(output).toContain("@cl1 s=hs");
    expect(output).not.toContain('"rootRef"');
  });

  it("parses --strict flag", () => {
    const result = parseCompileHostContextArgs(["plugin", "--strict", "--task", "Review security"]);

    expect(result.ok).toBe(true);
    if (!result.ok) { return; }

    expect(result.value.strict).toBe(true);
    expect(result.value.task).toBe("Review security");
    expect(result.value.targetPath).toBe("plugin");
  });

  it("parses --output flag", () => {
    const result = parseCompileHostContextArgs(["plugin", "--output", "/tmp/out"]);

    expect(result.ok).toBe(true);
    if (!result.ok) { return; }

    expect(result.value.output).toBe("/tmp/out");
  });

  it("parses --signal-boosts flag", () => {
    const result = parseCompileHostContextArgs(["plugin", "--signal-boosts", "boosts.json", "--task", "Test"]);

    expect(result.ok).toBe(true);
    if (!result.ok) { return; }

    expect(result.value.signalBoosts).toBe("boosts.json");
    expect(result.value.task).toBe("Test");
  });

  it("parses --learn-signals flag", () => {
    const result = parseCompileHostContextArgs(["plugin", "--learn-signals", "tasks.json"]);

    expect(result.ok).toBe(true);
    if (!result.ok) { return; }

    expect(result.value.learnSignals).toBe("tasks.json");
  });

  it("parses --watch flag", () => {
    const result = parseCompileHostContextArgs(["plugin", "--watch", "--output", "/tmp/out"]);

    expect(result.ok).toBe(true);
    if (!result.ok) { return; }

    expect(result.value.watch).toBe(true);
    expect(result.value.output).toBe("/tmp/out");
  });

  it("rejects --output with missing directory", () => {
    const result = parseCompileHostContextArgs(["plugin", "--output"]);
    expect(result.ok).toBe(false);
  });

  it("rejects --signal-boosts with missing path", () => {
    const result = parseCompileHostContextArgs(["plugin", "--signal-boosts"]);
    expect(result.ok).toBe(false);
  });

  it("rejects --learn-signals with missing path", () => {
    const result = parseCompileHostContextArgs(["plugin", "--learn-signals"]);
    expect(result.ok).toBe(false);
  });
});
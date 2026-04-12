import type { CeelineEnvelope, RenderStyle } from "@ceeline/schema";
import { fail, ok, type CeelineResult, type ValidationIssue } from "./result";

export interface LeakFinding {
  code: string;
  message: string;
  snippet: string;
}

export interface DecodedEnvelope {
  envelope: CeelineEnvelope;
  summary: string;
  facts: string[];
  ask: string;
  artifacts: unknown[];
  metadata: Record<string, unknown>;
}

const LEAK_PATTERNS: Array<{ code: string; message: string; expression: RegExp }> = [
  {
    code: "raw_envelope_json",
    message: "Detected raw Ceeline envelope JSON in output.",
    expression: /"ceeline_version"\s*:\s*"1\.0"/
  },
  {
    code: "envelope_identifier",
    message: "Detected envelope identifier in output.",
    expression: /cel:[A-Za-z0-9]+/
  },
  {
    code: "compact_sigils",
    message: "Detected compact shorthand markers in output.",
    expression: /@cl1\b|(?:^|[;\n])(?:s|i|ch|md|au|fb|rs|sz|sum|f|ask|tok|cls|role|tgt|sc|win|met|mk|dur|cit)=/m
  },
  {
    code: "routing_metadata",
    message: "Detected internal routing metadata in output.",
    expression: /\b(?:routing|constraint|diagnostics)\b/i
  }
];

function toIssues(findings: LeakFinding[]): ValidationIssue[] {
  return findings.map((finding) => ({
    code: finding.code,
    message: finding.message,
    path: "$render"
  }));
}

export function decodeCanonical(envelope: CeelineEnvelope): DecodedEnvelope {
  return {
    envelope,
    summary: envelope.payload.summary,
    facts: envelope.payload.facts,
    ask: envelope.payload.ask,
    artifacts: envelope.payload.artifacts,
    metadata: envelope.payload.metadata
  };
}

export function detectLeaks(text: string): LeakFinding[] {
  const findings: LeakFinding[] = [];

  for (const pattern of LEAK_PATTERNS) {
    const match = text.match(pattern.expression);
    if (match) {
      findings.push({
        code: pattern.code,
        message: pattern.message,
        snippet: match[0]
      });
    }
  }

  return findings;
}

export function renderInternal(decoded: DecodedEnvelope, style: RenderStyle): string {
  if (style === "none") {
    return "";
  }

  const lines: string[] = [];
  lines.push(decoded.summary.trim());

  if (decoded.facts.length > 0) {
    if (style === "terse") {
      lines.push(`facts: ${decoded.facts.join(" | ")}`);
    } else {
      lines.push("Facts:");
      for (const fact of decoded.facts) {
        lines.push(`- ${fact}`);
      }
    }
  }

  if (decoded.ask) {
    lines.push(style === "terse" ? `ask: ${decoded.ask}` : `Ask: ${decoded.ask}`);
  }

  return lines.filter((line) => line.length > 0).join("\n");
}

export function sanitizeUserFacing(text: string): CeelineResult<string> {
  const findings = detectLeaks(text);
  if (findings.length > 0) {
    return fail(toIssues(findings));
  }

  return ok(text.trim());
}

export function renderUserFacing(decoded: DecodedEnvelope): CeelineResult<string> {
  const rendered = renderInternal(decoded, "normal");
  return sanitizeUserFacing(rendered);
}

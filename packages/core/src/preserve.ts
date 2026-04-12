import { PRESERVE_CLASSES, type PreserveClass, type PreserveSet } from "@ceeline/schema";

const EXTRACTORS: Record<PreserveClass, RegExp> = {
  file_path: /(?:\.{0,2}\/)?(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+/g,
  tool_identifier: /\b[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\b/gi,
  agent_name: /\b[A-Z][A-Za-z0-9_-]{2,}\b/g,
  model_name: /\b(?:GPT|Claude|gemini|o[1-9]|gpt)-[A-Za-z0-9.:-]+\b/g,
  command: /\b(?:npm|pnpm|yarn|bun|npx|python|node|git|cargo|go|uv)\s+[A-Za-z0-9:_./@=-]+(?:\s+[A-Za-z0-9:_./@=-]+)*/g,
  env_var: /\$[A-Z_][A-Z0-9_]*\b/g,
  version: /\bv?\d+\.\d+(?:\.\d+)?\b/g,
  schema_key: /\b[a-z][a-z0-9_]*\b/g,
  placeholder: /\{\{[A-Z0-9_]+\}\}/g,
  section_label: /\b[A-Z]\d+\b/g,
  url: /https?:\/\/[^\s)]+/g,
  code_span: /`[^`]+`/g,
  code_fence: /```[\s\S]*?```/g
};

function collectMatches(text: string, expression: RegExp): string[] {
  const matches = text.match(expression);
  return matches ? matches.filter(Boolean) : [];
}

export function extractPreserveTokens(
  input: string,
  classes: readonly PreserveClass[] = PRESERVE_CLASSES
): PreserveSet {
  const tokens = new Set<string>();

  for (const preserveClass of classes) {
    for (const match of collectMatches(input, EXTRACTORS[preserveClass])) {
      tokens.add(match);
    }
  }

  return {
    tokens: Array.from(tokens),
    classes: Array.from(new Set(classes))
  };
}

export function validatePreservation(
  before: string,
  after: string,
  preserveSet: PreserveSet | string[]
): string[] {
  const tokens = Array.isArray(preserveSet) ? preserveSet : preserveSet.tokens;
  const missing: string[] = [];

  for (const token of tokens) {
    if (before.includes(token) && !after.includes(token)) {
      missing.push(token);
    }
  }

  return missing;
}

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { encodeCanonical, renderCeelineCompact, type CeelineResult, type ValidationIssue } from "@asafelobotomy/ceeline-core";
import { CEELINE_POLICIES, SURFACES } from "@asafelobotomy/ceeline-schema";
import type { CeelineEnvelope, PromptContextPayload, SourceInfo } from "@asafelobotomy/ceeline-schema";

export type HostContextDocumentKind = "agent" | "skill" | "hooks" | "reference";
export type HostContextBundleSurface = "prompt_context" | "routing" | "digest" | "history" | "reflection" | "tool_summary";
export type HostContextCompactDensity = "lite" | "full" | "dense";

export interface HostContextSection {
  id: string;
  heading: string;
  phase: PromptContextPayload["phase"];
  priority: number;
  summary: string;
  facts: string[];
  ask: string;
}

export interface HostContextDocument {
  kind: HostContextDocumentKind;
  name: string;
  description: string;
  tools: string[];
  excludeSignals: string[];
  sourceRef: string;
  routeHint: string;
  routeSignals: string[];
  sections: HostContextSection[];
}

export interface HostContextCompactBundleItem {
  surface: HostContextBundleSurface;
  intent: string;
  sourceRef: string;
  density: HostContextCompactDensity;
  text: string;
  byteLength: number;
}

export interface HostContextCompactBundle {
  surface: HostContextBundleSurface;
  density: HostContextCompactDensity;
  itemCount: number;
  totalBytes: number;
  items: HostContextCompactBundleItem[];
  text: string;
}

export interface HostContextCompactBundles {
  promptContext: HostContextCompactBundle;
  routing: HostContextCompactBundle;
  digest: HostContextCompactBundle;
  history: HostContextCompactBundle;
  reflection: HostContextCompactBundle;
  toolSummary: HostContextCompactBundle;
}

export type HostContextDiagnosticLevel = "error" | "warning" | "info";

export interface HostContextDiagnostic {
  level: HostContextDiagnosticLevel;
  code: string;
  message: string;
  sourceRef: string;
  fix?: string;
}

export type HostContextConfidenceBand = "high" | "medium" | "low" | "none";

export interface HostContextRoutingMatch {
  name: string;
  kind: HostContextDocumentKind;
  sourceRef: string;
  routeHint: string;
  score: number;
  confidence: HostContextConfidenceBand;
  matchedSignals: string[];
  selected: boolean;
}

export interface HostContextRoutingMatches {
  task: string;
  taskSignals: string[];
  matches: HostContextRoutingMatch[];
  ambiguous: boolean;
}

export interface HostContextCompileOptions {
  task?: string;
  strict?: boolean;
  signalBoostsPath?: string;
}

export interface HostContextSignalBoost {
  signal: string;
  adjustment: number;
}

export interface HostContextSignalBoosts {
  version: "1.0";
  generatedAt: string;
  boosts: HostContextSignalBoost[];
}

export interface HostContextCompileOutput {
  rootRef: string;
  documents: HostContextDocument[];
  diagnostics: HostContextDiagnostic[];
  promptContext: CeelineEnvelope<"prompt_context">[];
  routing: CeelineEnvelope<"routing">[];
  digest: CeelineEnvelope<"digest">;
  history: CeelineEnvelope<"history">;
  reflection: CeelineEnvelope<"reflection">;
  toolSummary: CeelineEnvelope<"tool_summary">;
  compactBundles: HostContextCompactBundles;
  routingMatches?: HostContextRoutingMatches;
}

interface CompilerSourceFile {
  kind: HostContextDocumentKind;
  filePath: string;
}

interface FrontmatterData {
  name?: string;
  description?: string;
  tools: string[];
  excludeSignals: string[];
  references?: string[];
  exclude?: string[];
}

interface RawMarkdownSection {
  heading: string;
  lines: string[];
}

const ROUTE_SIGNAL_STOPWORDS = new Set([
  "a", "an", "and", "any", "are", "as", "at", "be", "before", "by", "can", "context",
  "description", "document", "documents", "during", "each", "for", "from", "given", "host", "how",
  "if", "in", "into", "internal", "job", "loaded", "machine", "must", "never", "note", "notes",
  "of", "on", "only", "or", "output", "outputs", "private", "prompt", "ready", "rendered", "rule",
  "rules", "section", "sections", "skill", "skills", "source", "step", "steps", "summary", "system",
  "task", "tasks", "text", "that", "the", "their", "them", "these", "this", "through", "to", "tool",
  "tools", "use", "used", "user", "using", "workflow", "you", "your", "ceeline",
  "agent", "agents", "payload", "payloads", "facts", "ask", "format", "when"
]);

const TASK_SIGNAL_PRIORITY_BOOSTS = new Map<string, number>([
  ["review", 5],
  ["security", 6],
  ["validation", 5],
  ["validate", 4],
  ["transport", 4],
  ["handoff", 4],
  ["encode", 4],
  ["decode", 4],
  ["render", 3],
  ["compact", 3],
  ["routing", 3],
  ["memory", 3],
  ["digest", 3],
  ["history", 3],
  ["leak", 3],
  ["injection", 4],
  ["inject", 4],
  ["auth", 4],
  ["secrets", 4],
  ["findings", 3],
  ["fix", 2],
  ["implement", 2]
]);

const KNOWN_SURFACES = SURFACES;

const KNOWN_POLICIES = CEELINE_POLICIES;

const COMPACT_BUNDLE_DENSITIES: Readonly<Record<HostContextBundleSurface, HostContextCompactDensity>> = {
  prompt_context: "dense",
  routing: "dense",
  digest: "full",
  history: "full",
  reflection: "full",
  tool_summary: "full"
};

function issue(code: string, message: string, path = "$" ): ValidationIssue {
  return { code, message, path };
}

function workspaceRef(rootPath: string, targetPath: string): string {
  const rel = relative(rootPath, targetPath).split(sep).join("/");
  return `workspace://${rel || "."}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
}

function uniqueStrings(values: readonly (string | undefined | null)[]): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function stripQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function splitFrontmatter(content: string): { frontmatter?: string; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { body: content };
  }

  return {
    frontmatter: match[1],
    body: match[2]
  };
}

function parseFrontmatter(frontmatter: string | undefined): FrontmatterData {
  if (!frontmatter) {
    return { tools: [], excludeSignals: [] };
  }

  const lines = frontmatter.split(/\r?\n/);
  const data: FrontmatterData = { tools: [], excludeSignals: [] };

  for (let index = 0; index < lines.length;) {
    const line = lines[index].trimEnd();
    const nameMatch = line.match(/^name:\s*(.+)$/);
    if (nameMatch) {
      data.name = stripQuotes(nameMatch[1].trim());
      index += 1;
      continue;
    }

    const descriptionMatch = line.match(/^description:\s*(.*)$/);
    if (descriptionMatch) {
      const value = descriptionMatch[1].trim();
      if (value === ">" || value === "|") {
        const descriptionLines: string[] = [];
        index += 1;
        while (index < lines.length && (lines[index].startsWith(" ") || lines[index].startsWith("\t"))) {
          const nextLine = lines[index].trim();
          if (nextLine) {
            descriptionLines.push(nextLine);
          }
          index += 1;
        }
        data.description = descriptionLines.join(" ");
        continue;
      }

      if (value) {
        data.description = stripQuotes(value);
      }
      index += 1;
      continue;
    }

    if (/^tools:\s*$/.test(line)) {
      index += 1;
      while (index < lines.length && /^\s*-\s+/.test(lines[index])) {
        data.tools.push(stripQuotes(lines[index].replace(/^\s*-\s+/, "").trim()));
        index += 1;
      }
      continue;
    }

    if (/^references:\s*$/.test(line)) {
      const refs: string[] = [];
      index += 1;
      while (index < lines.length && /^\s*-\s+/.test(lines[index])) {
        refs.push(stripQuotes(lines[index].replace(/^\s*-\s+/, "").trim()));
        index += 1;
      }
      data.references = uniqueStrings(refs);
      continue;
    }

    if (/^exclude:\s*$/.test(line)) {
      const excl: string[] = [];
      index += 1;
      while (index < lines.length && /^\s*-\s+/.test(lines[index])) {
        excl.push(stripQuotes(lines[index].replace(/^\s*-\s+/, "").trim()));
        index += 1;
      }
      data.exclude = uniqueStrings(excl);
      continue;
    }

    if (/^exclude_signals:\s*$/.test(line)) {
      const sigs: string[] = [];
      index += 1;
      while (index < lines.length && /^\s*-\s+/.test(lines[index])) {
        sigs.push(stripQuotes(lines[index].replace(/^\s*-\s+/, "").trim()));
        index += 1;
      }
      data.excludeSignals = uniqueStrings(sigs);
      continue;
    }

    index += 1;
  }

  data.tools = uniqueStrings(data.tools);
  return data;
}

function extractMarkdownLinks(body: string, basePath: string): string[] {
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(body)) !== null) {
    const target = match[2];
    if (target.startsWith("http://") || target.startsWith("https://") || target.startsWith("#")) {
      continue;
    }
    const resolved = resolve(dirname(basePath), target);
    if (resolved.endsWith(".md") && existsSync(resolved)) {
      links.push(resolved);
    }
  }
  return [...new Set(links)];
}

function extractScriptFacts(dirPath: string): Array<{ name: string; fact: string }> {
  const scriptsDir = resolve(dirPath, "scripts");
  if (!existsSync(scriptsDir) || !statSync(scriptsDir).isDirectory()) {
    return [];
  }
  const results: Array<{ name: string; fact: string }> = [];
  for (const entry of readdirSync(scriptsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".sh")) {
      continue;
    }
    const scriptPath = resolve(scriptsDir, entry.name);
    const content = readFileSync(scriptPath, "utf8");
    const lines = content.split(/\r?\n/);
    const commentLine = lines.find((l) => /^#[^!]/.test(l));
    const desc = commentLine ? commentLine.replace(/^#\s*/, "").trim() : "shell script";
    results.push({ name: entry.name.replace(/\.sh$/, ""), fact: `Available script: ${entry.name} — ${desc}` });
  }
  return results;
}

function splitMarkdownSections(body: string): { introLines: string[]; sections: RawMarkdownSection[] } {
  const lines = body.split(/\r?\n/);
  const introLines: string[] = [];
  const sections: RawMarkdownSection[] = [];
  let current: RawMarkdownSection | null = null;

  for (const line of lines) {
    if (/^#\s+/.test(line)) {
      continue;
    }

    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      current = { heading: headingMatch[1].trim(), lines: [] };
      sections.push(current);
      continue;
    }

    if (current) {
      current.lines.push(line);
    } else {
      introLines.push(line);
    }
  }

  return { introLines, sections };
}

function normalizeMarkdownText(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFacts(lines: readonly string[]): string[] {
  const facts: string[] = [];
  const paragraph: string[] = [];
  const listItem: string[] = [];
  let inCodeBlock = false;

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }
    facts.push(normalizeMarkdownText(paragraph.join(" ")));
    paragraph.length = 0;
  };

  const flushListItem = () => {
    if (listItem.length === 0) {
      return;
    }
    facts.push(normalizeMarkdownText(listItem.join(" ")));
    listItem.length = 0;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      flushListItem();
      flushParagraph();
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) {
      continue;
    }
    if (!trimmed) {
      flushListItem();
      flushParagraph();
      continue;
    }
    if (trimmed.startsWith("|") || /^:?-{3,}/.test(trimmed)) {
      flushListItem();
      flushParagraph();
      continue;
    }
    const listMatch = trimmed.match(/^(?:[-*]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      flushListItem();
      flushParagraph();
      listItem.push(listMatch[1]);
      continue;
    }
    if (listItem.length > 0) {
      if (/^###\s+/.test(trimmed)) {
        flushListItem();
      } else {
        listItem.push(trimmed);
        continue;
      }
    }
    if (/^###\s+/.test(trimmed)) {
      flushParagraph();
      facts.push(normalizeMarkdownText(trimmed.replace(/^###\s+/, "")));
      continue;
    }
    paragraph.push(trimmed);
  }

  flushListItem();
  flushParagraph();
  return uniqueStrings(facts);
}

function inferSectionProfile(kind: HostContextDocumentKind, heading: string): Pick<HostContextSection, "phase" | "priority" | "ask"> {
  const normalized = heading.toLowerCase();

  if (kind === "hooks") {
    if (normalized.includes("sessionstart")) {
      return { phase: "system", priority: 100, ask: "Apply this startup context before prompt assembly begins." };
    }
    if (normalized.includes("posttooluse")) {
      return { phase: "injection", priority: 85, ask: "Apply this validation step after matching tool calls." };
    }
    return { phase: "grounding", priority: 95, ask: "Apply this render-boundary guard before user-visible output." };
  }

  if (kind === "reference") {
    return { phase: "grounding", priority: 60, ask: "Use this reference material to ground the current context." };
  }

  if (normalized === "overview") {
    return { phase: "system", priority: 95, ask: "Use this host-owned context during prompt assembly." };
  }
  if (normalized.includes("rule")) {
    return { phase: "system", priority: 100, ask: "Apply these rules during prompt assembly." };
  }
  if (normalized.includes("workflow") || normalized.startsWith("how to")) {
    return { phase: "injection", priority: 85, ask: "Follow this procedure when invoking this context." };
  }
  if (normalized.includes("tool")) {
    return { phase: "grounding", priority: 70, ask: "Use these tools and capabilities when selecting execution paths." };
  }
  if (normalized.includes("when to use") || normalized.includes("policy") || normalized.includes("format")) {
    return { phase: "retrieval", priority: 75, ask: "Select this context when the task matches these conditions." };
  }

  return { phase: "retrieval", priority: 70, ask: "Use this retrieved context to ground the next prompt." };
}

function buildPromptContextSection(kind: HostContextDocumentKind, documentName: string, heading: string, facts: readonly string[]): HostContextSection | null {
  const cleanedFacts = uniqueStrings(facts);
  if (cleanedFacts.length === 0) {
    return null;
  }

  const profile = inferSectionProfile(kind, heading);
  return {
    id: slugify(heading),
    heading,
    phase: profile.phase,
    priority: profile.priority,
    summary: heading === "overview"
      ? `Compile ${documentName} overview context.`
      : `Compile ${documentName} ${heading.toLowerCase()} context.`,
    facts: cleanedFacts,
    ask: profile.ask
  };
}

function addKeywordSignal(scores: Map<string, number>, rawValue: string, weight = 1): void {
  const normalized = rawValue.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (normalized.length < 3 || ROUTE_SIGNAL_STOPWORDS.has(normalized)) {
    return;
  }
  const signal = `task:${normalized}`;
  scores.set(signal, (scores.get(signal) ?? 0) + weight + (TASK_SIGNAL_PRIORITY_BOOSTS.get(normalized) ?? 0));
}

function extractRouteSignals(documentName: string, description: string, tools: readonly string[], sections: readonly HostContextSection[]): string[] {
  const typedSignals: string[] = [];
  const keywordScores = new Map<string, number>();
  const signalCorpus = [
    documentName,
    description,
    ...tools,
    ...sections.map((section) => section.heading),
    ...sections.flatMap((section) => [section.summary, ...section.facts, section.ask])
  ];
  const combinedText = signalCorpus.join("\n").toLowerCase();

  for (const surface of KNOWN_SURFACES) {
    if (new RegExp(`\\b${surface}\\b`, "u").test(combinedText)) {
      typedSignals.push(`surface:${surface}`);
    }
  }

  for (const policy of KNOWN_POLICIES) {
    if (new RegExp(`\\b${policy}\\b`, "u").test(combinedText)) {
      typedSignals.push(`policy:${policy}`);
    }
  }

  for (const tool of tools) {
    typedSignals.push(`tool:${tool}`);
    for (const part of tool.split(/[._-]+/u)) {
      addKeywordSignal(keywordScores, part, 1);
    }
  }

  const intentMatches = combinedText.match(/\b[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+\b/gu) ?? [];
  for (const intent of intentMatches) {
    typedSignals.push(`intent:${intent}`);
    for (const part of intent.split(".")) {
      addKeywordSignal(keywordScores, part, 3);
    }
  }

  for (const text of signalCorpus) {
    const normalized = normalizeMarkdownText(text).toLowerCase();
    for (const token of normalized.match(/[a-z][a-z0-9_.-]+/gu) ?? []) {
      for (const part of token.split(/[._-]+/u)) {
        addKeywordSignal(keywordScores, part, token.includes(".") ? 2 : 1);
      }
    }
  }

  const keywordSignals = Array.from(keywordScores.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([signal]) => signal)
    .slice(0, 10);

  return uniqueStrings([...typedSignals, ...keywordSignals]);
}

function extractTaskSignals(task: string): string[] {
  const typedSignals: string[] = [];
  const keywordScores = new Map<string, number>();
  const normalizedTask = normalizeMarkdownText(task).toLowerCase();

  for (const surface of KNOWN_SURFACES) {
    if (new RegExp(`\\b${surface}\\b`, "u").test(normalizedTask)) {
      typedSignals.push(`surface:${surface}`);
    }
  }

  for (const policy of KNOWN_POLICIES) {
    if (new RegExp(`\\b${policy}\\b`, "u").test(normalizedTask)) {
      typedSignals.push(`policy:${policy}`);
    }
  }

  const intentMatches = normalizedTask.match(/\b[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+\b/gu) ?? [];
  for (const intent of intentMatches) {
    typedSignals.push(`intent:${intent}`);
    for (const part of intent.split(".")) {
      addKeywordSignal(keywordScores, part, 3);
    }
  }

  for (const token of normalizedTask.match(/[a-z][a-z0-9_.-]+/gu) ?? []) {
    for (const part of token.split(/[._-]+/u)) {
      addKeywordSignal(keywordScores, part, token.includes(".") ? 2 : 1);
    }
  }

  const keywordSignals = Array.from(keywordScores.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([signal]) => signal)
    .slice(0, 12);

  return uniqueStrings([...typedSignals, ...keywordSignals]);
}

function signalWeight(signal: string, boosts?: ReadonlyMap<string, number>): number {
  const boost = boosts?.get(signal) ?? 0;
  if (signal.startsWith("surface:")) {
    return 6 + boost;
  }
  if (signal.startsWith("policy:")) {
    return 5 + boost;
  }
  if (signal.startsWith("intent:")) {
    return 6 + boost;
  }
  if (signal.startsWith("tool:")) {
    return 3 + boost;
  }
  if (signal.startsWith("task:")) {
    const token = signal.slice("task:".length);
    return 2 + (TASK_SIGNAL_PRIORITY_BOOSTS.get(token) ?? 0) + boost;
  }

  return 1 + boost;
}

function computeConfidenceBand(score: number, secondScore: number): HostContextConfidenceBand {
  if (score === 0) { return "none"; }
  if (secondScore === 0) { return "high"; }
  const ratio = score / secondScore;
  if (ratio >= 2) { return "high"; }
  if (ratio > 0.67) { return "medium"; }
  return "low";
}

function scoreRoutingMatches(task: string, documents: readonly HostContextDocument[], boosts?: ReadonlyMap<string, number>): HostContextRoutingMatches {
  const taskSignals = extractTaskSignals(task);
  const taskSignalSet = new Set(taskSignals);

  const scored = documents
    .filter((document) => document.kind !== "hooks" && document.kind !== "reference")
    .map((document) => {
      const matchedSignals = document.routeSignals
        .filter((signal) => taskSignalSet.has(signal))
        .sort((left, right) => signalWeight(right, boosts) - signalWeight(left, boosts) || left.localeCompare(right));

      const positiveScore = matchedSignals.reduce((total, signal) => total + signalWeight(signal, boosts), 0);

      const excludeSet = new Set(document.excludeSignals);
      const matchedExclude = taskSignals.filter((signal) => excludeSet.has(signal));
      const penalty = matchedExclude.reduce((total, signal) => total + signalWeight(signal, boosts), 0);

      return {
        name: document.name,
        kind: document.kind,
        sourceRef: document.sourceRef,
        routeHint: document.routeHint,
        score: Math.max(0, positiveScore - penalty),
        matchedSignals,
        selected: false,
        confidence: "none" as HostContextConfidenceBand
      } satisfies HostContextRoutingMatch;
    })
    .sort((left, right) => right.score - left.score || right.matchedSignals.length - left.matchedSignals.length || left.name.localeCompare(right.name));

  const topScore = scored[0]?.score ?? 0;
  const secondScore = scored[1]?.score ?? 0;

  const matches = scored.map((match, index) => ({
    ...match,
    selected: index === 0 && match.score > 0,
    confidence: computeConfidenceBand(match.score, index === 0 ? secondScore : topScore)
  }));

  const ambiguous = matches.length >= 2
    && topScore > 0
    && secondScore > 0
    && matches[0].confidence !== "high"
    && matches[1].confidence !== "none"
    && Math.abs(topScore - secondScore) / Math.max(topScore, secondScore) <= 0.2;

  return {
    task,
    taskSignals,
    matches,
    ambiguous
  };
}

function extractEnvelopeSourceRef(
  surface: HostContextBundleSurface,
  envelope: CeelineEnvelope<"prompt_context"> | CeelineEnvelope<"routing"> | CeelineEnvelope<"digest"> | CeelineEnvelope<"history"> | CeelineEnvelope<"reflection"> | CeelineEnvelope<"tool_summary">
): string {
  if (surface === "prompt_context") {
    return (envelope as CeelineEnvelope<"prompt_context">).payload.source_ref;
  }
  const metadata = envelope.payload.metadata;
  if (metadata && typeof metadata.source_ref === "string") {
    return metadata.source_ref;
  }
  if (metadata && typeof metadata.root_ref === "string") {
    return metadata.root_ref;
  }
  return "workspace://.";
}

function renderCompactBundle(
  surface: HostContextBundleSurface,
  envelopes: readonly (CeelineEnvelope<"prompt_context"> | CeelineEnvelope<"routing"> | CeelineEnvelope<"digest"> | CeelineEnvelope<"history"> | CeelineEnvelope<"reflection"> | CeelineEnvelope<"tool_summary">)[]
): CeelineResult<HostContextCompactBundle> {
  const density = COMPACT_BUNDLE_DENSITIES[surface];
  const items: HostContextCompactBundleItem[] = [];

  for (const envelope of envelopes) {
    const rendered = renderCeelineCompact(envelope, density);
    if (!rendered.ok) {
      return rendered;
    }

    items.push({
      surface,
      intent: envelope.intent,
      sourceRef: extractEnvelopeSourceRef(surface, envelope),
      density,
      text: rendered.value,
      byteLength: Buffer.byteLength(rendered.value, "utf8")
    });
  }

  return {
    ok: true,
    value: {
      surface,
      density,
      itemCount: items.length,
      totalBytes: items.reduce((total, item) => total + item.byteLength, 0),
      items,
      text: items.map((item) => item.text).join("\n")
    }
  };
}

function compileCompactBundles(
  promptContext: readonly CeelineEnvelope<"prompt_context">[],
  routing: readonly CeelineEnvelope<"routing">[],
  digest: CeelineEnvelope<"digest">,
  history: CeelineEnvelope<"history">,
  reflection: CeelineEnvelope<"reflection">,
  toolSummary: CeelineEnvelope<"tool_summary">
): CeelineResult<HostContextCompactBundles> {
  const promptContextBundle = renderCompactBundle("prompt_context", promptContext);
  if (!promptContextBundle.ok) {
    return promptContextBundle;
  }

  const routingBundle = renderCompactBundle("routing", routing);
  if (!routingBundle.ok) {
    return routingBundle;
  }

  const digestBundle = renderCompactBundle("digest", [digest]);
  if (!digestBundle.ok) {
    return digestBundle;
  }

  const historyBundle = renderCompactBundle("history", [history]);
  if (!historyBundle.ok) {
    return historyBundle;
  }

  const reflectionBundle = renderCompactBundle("reflection", [reflection]);
  if (!reflectionBundle.ok) {
    return reflectionBundle;
  }

  const toolSummaryBundle = renderCompactBundle("tool_summary", [toolSummary]);
  if (!toolSummaryBundle.ok) {
    return toolSummaryBundle;
  }

  return {
    ok: true,
    value: {
      promptContext: promptContextBundle.value,
      routing: routingBundle.value,
      digest: digestBundle.value,
      history: historyBundle.value,
      reflection: reflectionBundle.value,
      toolSummary: toolSummaryBundle.value
    }
  };
}

function collectCompilerSourceFiles(targetPath: string): CompilerSourceFile[] {
  const resolvedPath = resolve(targetPath);
  const stats = statSync(resolvedPath);
  if (stats.isFile()) {
    const fileName = basename(resolvedPath);
    if (fileName.endsWith(".agent.md")) {
      return [{ kind: "agent", filePath: resolvedPath }];
    }
    if (fileName === "SKILL.md") {
      return [{ kind: "skill", filePath: resolvedPath }];
    }
    if (fileName === "hooks.json") {
      return [{ kind: "hooks", filePath: resolvedPath }];
    }
    return [];
  }

  const collected: CompilerSourceFile[] = [];
  for (const entry of readdirSync(resolvedPath, { withFileTypes: true })) {
    const childPath = resolve(resolvedPath, entry.name);
    if (entry.isDirectory()) {
      collected.push(...collectCompilerSourceFiles(childPath));
      continue;
    }
    if (entry.name.endsWith(".agent.md")) {
      collected.push({ kind: "agent", filePath: childPath });
    } else if (entry.name === "SKILL.md") {
      collected.push({ kind: "skill", filePath: childPath });
    } else if (entry.name === "hooks.json") {
      collected.push({ kind: "hooks", filePath: childPath });
    }
  }

  return collected.sort((left, right) => left.filePath.localeCompare(right.filePath));
}

function parseMarkdownDocument(rootPath: string, filePath: string, kind: HostContextDocumentKind): HostContextDocument {
  const content = readFileSync(filePath, "utf8");
  const { frontmatter, body } = splitFrontmatter(content);
  const parsedFrontmatter = parseFrontmatter(frontmatter);
  const { introLines, sections } = splitMarkdownSections(body);
  const documentName = parsedFrontmatter.name ?? basename(filePath).replace(/\.(agent\.md|md)$/u, "");
  const description = parsedFrontmatter.description ?? "";

  const compiledSections: HostContextSection[] = [];
  const overviewFacts = uniqueStrings([
    description,
    ...extractFacts(introLines),
    parsedFrontmatter.tools.length > 0 ? `Available tools: ${parsedFrontmatter.tools.join(", ")}` : ""
  ]);
  const overviewSection = buildPromptContextSection(kind, documentName, "overview", overviewFacts);
  if (overviewSection) {
    compiledSections.push(overviewSection);
  }

  for (const section of sections) {
    const compiledSection = buildPromptContextSection(kind, documentName, section.heading, extractFacts(section.lines));
    if (compiledSection) {
      compiledSections.push(compiledSection);
    }
  }

  const routeHint = compiledSections.find((section) => section.heading.toLowerCase().includes("when to use"))?.facts[0]
    ?? compiledSections.find((section) => section.heading.toLowerCase().includes("workflow"))?.facts[0]
    ?? compiledSections[0]?.facts[0]
    ?? `${documentName} provides host-owned ${kind} context.`;

  return {
    kind,
    name: documentName,
    description,
    tools: parsedFrontmatter.tools,
    excludeSignals: parsedFrontmatter.excludeSignals,
    sourceRef: workspaceRef(rootPath, filePath),
    routeHint,
    routeSignals: extractRouteSignals(documentName, description, parsedFrontmatter.tools, compiledSections),
    sections: compiledSections
  };
}

function parseHooksDocument(rootPath: string, filePath: string): HostContextDocument {
  const content = readFileSync(filePath, "utf8");
  const parsed = JSON.parse(content) as { hooks?: Array<{ event?: string; filter?: { toolNames?: string[] }; steps?: Array<{ type?: string; tool?: string; description?: string; message?: string; onFailure?: string }> }> };
  const hooks = Array.isArray(parsed.hooks) ? parsed.hooks : [];

  const sections = hooks
    .map((hook, index) => {
      const eventName = typeof hook.event === "string" ? hook.event : `hook-${index + 1}`;
      const facts = uniqueStrings([
        `Event: ${eventName}`,
        ...(Array.isArray(hook.filter?.toolNames) && hook.filter.toolNames.length > 0
          ? [`Filtered tools: ${hook.filter.toolNames.join(", ")}`]
          : []),
        ...(Array.isArray(hook.steps)
          ? hook.steps.flatMap((step) => [
              step.description,
              step.message,
              step.tool ? `Uses tool: ${step.tool}` : undefined,
              step.type ? `Step type: ${step.type}` : undefined,
              step.onFailure ? `On failure: ${step.onFailure}` : undefined
            ])
          : [])
      ]);

      return buildPromptContextSection("hooks", "hooks", eventName, facts);
    })
    .filter((section): section is HostContextSection => section !== null);

  return {
    kind: "hooks",
    name: "hooks",
    description: "Host hook configuration for prompt injection, post-tool validation, and pre-render leak guarding.",
    tools: uniqueStrings(hooks.flatMap((hook) => Array.isArray(hook.filter?.toolNames) ? hook.filter.toolNames : [])),
    excludeSignals: [],
    sourceRef: workspaceRef(rootPath, filePath),
    routeHint: "Apply host lifecycle rules when prompt assembly crosses startup, tool, or render boundaries.",
    routeSignals: extractRouteSignals(
      "hooks",
      "Host hook configuration for prompt injection, post-tool validation, and pre-render leak guarding.",
      uniqueStrings(hooks.flatMap((hook) => Array.isArray(hook.filter?.toolNames) ? hook.filter.toolNames : [])),
      sections
    ),
    sections
  };
}

function parseCompilerDocument(rootPath: string, sourceFile: CompilerSourceFile): HostContextDocument {
  if (sourceFile.kind === "hooks") {
    return parseHooksDocument(rootPath, sourceFile.filePath);
  }

  return parseMarkdownDocument(rootPath, sourceFile.filePath, sourceFile.kind);
}

function discoverReferencePaths(filePath: string, parsedFrontmatter: FrontmatterData): string[] {
  if (parsedFrontmatter.references) {
    const baseDir = dirname(filePath);
    return parsedFrontmatter.references
      .map((ref) => resolve(baseDir, ref))
      .filter((p) => p.endsWith(".md") && existsSync(p));
  }

  const content = readFileSync(filePath, "utf8");
  const { body } = splitFrontmatter(content);
  let links = extractMarkdownLinks(body, filePath);

  if (parsedFrontmatter.exclude) {
    const baseDir = dirname(filePath);
    const excludeSet = new Set(parsedFrontmatter.exclude.map((e) => resolve(baseDir, e)));
    links = links.filter((l) => !excludeSet.has(l));
  }

  return links;
}

function discoverScriptDocuments(rootPath: string, filePath: string, parentDocument: HostContextDocument): HostContextDocument[] {
  const scriptFacts = extractScriptFacts(dirname(filePath));
  if (scriptFacts.length === 0) {
    return [];
  }

  const allFacts = scriptFacts.map((sf) => sf.fact);
  const toolSignals = scriptFacts.map((sf) => `tool:${sf.name}`);
  const section = buildPromptContextSection("reference", parentDocument.name, "scripts", allFacts);
  if (!section) {
    return [];
  }

  return [{
    kind: "reference" as const,
    name: `${parentDocument.name}-scripts`,
    description: `Shell scripts available for ${parentDocument.name}.`,
    tools: scriptFacts.map((sf) => sf.name),
    excludeSignals: [],
    sourceRef: workspaceRef(rootPath, resolve(dirname(filePath), "scripts")),
    routeHint: `Use these scripts when working with ${parentDocument.name}.`,
    routeSignals: uniqueStrings([...toolSignals, ...parentDocument.routeSignals.slice(0, 5)]),
    sections: [section]
  }];
}

const MAX_REFERENCES_PER_PARENT = 5;

function discoverAndParseReferences(
  rootPath: string,
  primaryDocuments: readonly HostContextDocument[],
  sourceFiles: readonly CompilerSourceFile[]
): HostContextDocument[] {
  const visited = new Set(sourceFiles.map((sf) => sf.filePath));
  const referenceDocuments: HostContextDocument[] = [];

  for (const sourceFile of sourceFiles) {
    if (sourceFile.kind === "hooks") {
      continue;
    }

    const content = readFileSync(sourceFile.filePath, "utf8");
    const { frontmatter } = splitFrontmatter(content);
    const parsedFrontmatter = parseFrontmatter(frontmatter);
    const refPaths = discoverReferencePaths(sourceFile.filePath, parsedFrontmatter);
    const parentDoc = primaryDocuments.find((d) => d.sourceRef === workspaceRef(rootPath, sourceFile.filePath));

    let added = 0;
    for (const refPath of refPaths) {
      if (visited.has(refPath) || added >= MAX_REFERENCES_PER_PARENT) {
        continue;
      }
      visited.add(refPath);
      added += 1;
      referenceDocuments.push(parseMarkdownDocument(rootPath, refPath, "reference"));
    }

    if (parentDoc) {
      const scriptDocs = discoverScriptDocuments(rootPath, sourceFile.filePath, parentDoc);
      for (const sd of scriptDocs) {
        if (!visited.has(sd.sourceRef)) {
          referenceDocuments.push(sd);
        }
      }
    }
  }

  return referenceDocuments;
}

function buildCompilerSource(rootLabel: string): SourceInfo {
  return {
    kind: "host",
    name: "ceeline.host-compiler",
    instance: rootLabel,
    timestamp: new Date().toISOString()
  };
}

function compilePromptContextEnvelope(document: HostContextDocument, section: HostContextSection, source: SourceInfo) {
  return encodeCanonical(
    {
      text: [section.summary, ...section.facts, section.ask].join("\n"),
      intent: `prompt.compile.${document.kind}.${slugify(document.name)}.${section.id}`,
      source,
      payload: {
        summary: section.summary,
        facts: section.facts,
        ask: section.ask,
        phase: section.phase,
        priority: section.priority,
        source_ref: `${document.sourceRef}#${section.id}`,
        artifacts: [],
        metadata: {
          document_kind: document.kind,
          document_name: document.name,
          section: section.heading,
          tools: document.tools
        }
      }
    },
    "prompt_context"
  );
}

function compileRoutingEnvelope(document: HostContextDocument, candidates: string[], source: SourceInfo) {
  const facts = uniqueStrings([
    document.description,
    document.routeHint,
    document.routeSignals.length > 0 ? `Task-match signals: ${document.routeSignals.join(", ")}` : "",
    document.tools.length > 0 ? `Available tools: ${document.tools.join(", ")}` : ""
  ]);

  return encodeCanonical(
    {
      text: [`Route tasks to ${document.name}.`, ...facts].join("\n"),
      intent: `route.${document.kind}.${slugify(document.name)}`,
      source,
      payload: {
        summary: `Route matching host tasks to ${document.name}.`,
        facts,
        ask: `Select ${document.name} when task cues overlap with these compiled signals.`,
        strategy: candidates.length > 1 ? "conditional" : "direct",
        candidates,
        selected: document.name,
        artifacts: [],
        metadata: {
          document_kind: document.kind,
          source_ref: document.sourceRef,
          tools: document.tools,
          route_signals: document.routeSignals,
          section_ids: document.sections.map((section) => section.id)
        }
      }
    },
    "routing"
  );
}

function compileDigestEnvelope(rootRef: string, documents: readonly HostContextDocument[], promptContextCount: number, routingCount: number, source: SourceInfo) {
  const agentCount = documents.filter((document) => document.kind === "agent").length;
  const skillCount = documents.filter((document) => document.kind === "skill").length;
  const hookCount = documents.filter((document) => document.kind === "hooks").length;
  const referenceCount = documents.filter((document) => document.kind === "reference").length;

  return encodeCanonical(
    {
      text: `Compiled ${documents.length} documents from ${rootRef}.`,
      intent: "digest.host-compiler.bundle",
      source,
      payload: {
        summary: `Summarize the compiled host context bundle from ${rootRef}.`,
        facts: [
          `Compiled ${documents.length} source files.`,
          `Generated ${promptContextCount} prompt_context envelopes.`,
          `Generated ${routingCount} routing envelopes.`,
          `Agents=${agentCount}, skills=${skillCount}, hooks=${hookCount}, references=${referenceCount}.`
        ],
        ask: "Use this digest as an index for host-owned prompt assembly.",
        window: "run",
        status: "ok",
        metrics: {
          documents: documents.length,
          prompt_context: promptContextCount,
          routing: routingCount,
          agents: agentCount,
          skills: skillCount,
          hooks: hookCount,
          references: referenceCount
        },
        artifacts: [],
        metadata: {
          root_ref: rootRef
        }
      }
    },
    "digest"
  );
}

function compileHistoryEnvelope(rootRef: string, documents: readonly HostContextDocument[], promptContextCount: number, routingCount: number, source: SourceInfo) {
  return encodeCanonical(
    {
      text: `Carry compiled host context from ${rootRef} forward.`,
      intent: "history.host-compiler.bundle",
      source,
      payload: {
        summary: `Record the host compiler bundle emitted from ${rootRef}.`,
        facts: [
          `Sources: ${documents.map((document) => document.name).join(", ")}`,
          `Prompt context sections compiled: ${promptContextCount}.`,
          `Routing entries compiled: ${routingCount}.`
        ],
        ask: "Carry this compilation anchor forward for downstream prompt assembly.",
        span: "session",
        turn_count: documents.length,
        anchor: `host-compiler:${slugify(rootRef)}:${documents.length}`,
        artifacts: documents.map((document) => document.sourceRef),
        metadata: {
          root_ref: rootRef,
          document_names: documents.map((document) => document.name)
        }
      }
    },
    "history"
  );
}

function compileReflectionEnvelope(
  rootRef: string,
  documents: readonly HostContextDocument[],
  diagnostics: readonly HostContextDiagnostic[],
  routingMatches: HostContextRoutingMatches | undefined,
  source: SourceInfo
) {
  const errorCount = diagnostics.filter((d) => d.level === "error").length;
  const warningCount = diagnostics.filter((d) => d.level === "warning").length;
  const infoCount = diagnostics.filter((d) => d.level === "info").length;
  const confidence = Math.max(0, Math.min(1, 1 - errorCount * 0.3 - warningCount * 0.1 - infoCount * 0.02));

  const facts: string[] = [
    `Compilation confidence: ${confidence.toFixed(2)}.`,
    `Diagnostics: ${errorCount} errors, ${warningCount} warnings, ${infoCount} info.`
  ];

  if (routingMatches) {
    const topMatch = routingMatches.matches[0];
    if (topMatch && topMatch.score > 0) {
      facts.push(`Top routing match: ${topMatch.name} (confidence: ${topMatch.confidence}, score: ${topMatch.score}).`);
    }
    if (routingMatches.ambiguous) {
      facts.push(`Routing is ambiguous between ${routingMatches.matches[0]?.name} and ${routingMatches.matches[1]?.name}.`);
    }
  }

  for (const diag of diagnostics.filter((d) => d.level === "error" || d.level === "warning")) {
    facts.push(`[${diag.level}] ${diag.code}: ${diag.message}`);
  }

  return encodeCanonical(
    {
      text: `Compilation reflection for ${rootRef}.`,
      intent: "reflection.host-compiler.confidence",
      source,
      payload: {
        summary: `Confidence check for host compiler output from ${rootRef}.`,
        facts,
        ask: "Use this reflection to judge the quality and reliability of the compiled host context.",
        reflection_type: "confidence_check" as const,
        confidence,
        revision: diagnostics.length === 0 ? "No issues detected." : `${diagnostics.length} diagnostic(s) raised.`,
        artifacts: [],
        metadata: {
          root_ref: rootRef,
          diagnostic_counts: { errors: errorCount, warnings: warningCount, info: infoCount }
        }
      }
    },
    "reflection"
  );
}

function compileToolSummaryEnvelope(
  rootRef: string,
  documents: readonly HostContextDocument[],
  source: SourceInfo
) {
  const toolMap = new Map<string, string[]>();
  for (const doc of documents) {
    for (const tool of doc.tools) {
      const owners = toolMap.get(tool) ?? [];
      owners.push(doc.name);
      toolMap.set(tool, owners);
    }
  }

  const uniqueTools = [...toolMap.keys()].sort();
  const facts = [
    `Total unique tools: ${uniqueTools.length}.`,
    ...uniqueTools.map((tool) => {
      const owners = toolMap.get(tool)!;
      return `Tool '${tool}' declared in: ${owners.join(", ")}.`;
    })
  ];

  // Use the first tool name or a placeholder
  const primaryTool = uniqueTools[0] ?? "none";

  return encodeCanonical(
    {
      text: `Tool dependency summary for ${rootRef}.`,
      intent: "tool_summary.host-compiler.dependencies",
      source,
      payload: {
        summary: `Tool dependencies across ${documents.length} compiled documents.`,
        facts,
        ask: "Use this tool summary to understand which tools are available and where they are declared.",
        tool_name: primaryTool,
        outcome: "success" as const,
        elapsed_ms: 0,
        artifacts: [],
        metadata: {
          root_ref: rootRef,
          unique_tools: uniqueTools,
          tool_document_map: Object.fromEntries(toolMap)
        }
      }
    },
    "tool_summary"
  );
}

function collectDiagnostics(
  documents: readonly HostContextDocument[],
  sourceFiles: readonly CompilerSourceFile[],
  routingMatches?: HostContextRoutingMatches
): HostContextDiagnostic[] {
  const diagnostics: HostContextDiagnostic[] = [];

  // duplicate_document_name: Two documents share the same name
  const nameCount = new Map<string, string[]>();
  for (const doc of documents) {
    const refs = nameCount.get(doc.name) ?? [];
    refs.push(doc.sourceRef);
    nameCount.set(doc.name, refs);
  }
  for (const [name, refs] of nameCount) {
    if (refs.length > 1) {
      diagnostics.push({
        level: "warning",
        code: "duplicate_document_name",
        message: `Document name '${name}' appears ${refs.length} times: ${refs.join(", ")}.`,
        sourceRef: refs[0],
        fix: "Add a unique 'name:' key in the frontmatter of each document."
      });
    }
  }

  // empty_section: A section has no extractable facts
  for (const doc of documents) {
    for (const section of doc.sections) {
      if (section.facts.length === 0) {
        diagnostics.push({
          level: "info",
          code: "empty_section",
          message: `Section '${section.heading}' in '${doc.name}' has no extractable facts.`,
          sourceRef: doc.sourceRef,
          fix: "Add content under this heading, or remove the empty section."
        });
      }
    }
  }

  // unresolved_reference: Frontmatter references point to missing files
  for (const sf of sourceFiles) {
    if (sf.kind === "hooks") { continue; }
    const content = readFileSync(sf.filePath, "utf8");
    const { frontmatter, body } = splitFrontmatter(content);
    const parsed = parseFrontmatter(frontmatter);
    if (parsed.references) {
      const baseDir = dirname(sf.filePath);
      for (const ref of parsed.references) {
        const resolved = resolve(baseDir, ref);
        if (!existsSync(resolved)) {
          diagnostics.push({
            level: "warning",
            code: "unresolved_reference",
            message: `Frontmatter reference '${ref}' in '${basename(sf.filePath)}' does not exist.`,
            sourceRef: workspaceRef(resolve(sf.filePath, ".."), sf.filePath),
            fix: `Create the file at '${ref}' or remove it from the references list.`
          });
        }
      }
    } else {
      // Check link-crawled references for broken links
      const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
      let match: RegExpExecArray | null;
      while ((match = linkPattern.exec(body)) !== null) {
        const target = match[2];
        if (target.startsWith("http://") || target.startsWith("https://") || target.startsWith("#")) {
          continue;
        }
        const resolved = resolve(dirname(sf.filePath), target);
        if (resolved.endsWith(".md") && !existsSync(resolved)) {
          diagnostics.push({
            level: "warning",
            code: "unresolved_reference",
            message: `Markdown link '${target}' in '${basename(sf.filePath)}' points to a missing file.`,
            sourceRef: workspaceRef(resolve(sf.filePath, ".."), sf.filePath),
            fix: `Create '${target}' or remove the broken link.`
          });
        }
      }
    }
  }

  // unused_tool: Tool declared in frontmatter but never mentioned in any section fact
  for (const doc of documents) {
    if (doc.tools.length === 0 || doc.kind === "reference") { continue; }
    const allFacts = doc.sections.flatMap((s) => s.facts).join(" ").toLowerCase();
    for (const tool of doc.tools) {
      if (!allFacts.includes(tool.toLowerCase())) {
        diagnostics.push({
          level: "info",
          code: "unused_tool",
          message: `Tool '${tool}' declared in '${doc.name}' frontmatter is never mentioned in section content.`,
          sourceRef: doc.sourceRef,
          fix: "Reference this tool in the document body or remove it from frontmatter tools."
        });
      }
    }
  }

  // missing_frontmatter_name: No name: in frontmatter (non-hooks, non-reference)
  for (const sf of sourceFiles) {
    if (sf.kind === "hooks") { continue; }
    const content = readFileSync(sf.filePath, "utf8");
    const { frontmatter } = splitFrontmatter(content);
    const parsed = parseFrontmatter(frontmatter);
    if (!parsed.name) {
      diagnostics.push({
        level: "warning",
        code: "missing_frontmatter_name",
        message: `'${basename(sf.filePath)}' has no 'name:' in frontmatter; name is inferred from filename.`,
        sourceRef: workspaceRef(resolve(sf.filePath, ".."), sf.filePath),
        fix: "Add 'name: <document-name>' to the YAML frontmatter."
      });
    }
  }

  // no_route_signals: Document produces zero route signals
  for (const doc of documents) {
    if (doc.kind === "hooks" || doc.kind === "reference") { continue; }
    if (doc.routeSignals.length === 0) {
      diagnostics.push({
        level: "warning",
        code: "no_route_signals",
        message: `Document '${doc.name}' produces zero route signals and cannot be matched by task routing.`,
        sourceRef: doc.sourceRef,
        fix: "Add descriptive content, tool references, or task keywords to the document."
      });
    }
  }

  // overlapping_signals: Two routable documents share >80% of route signals
  const routableDocs = documents.filter((d) => d.kind !== "hooks" && d.kind !== "reference" && d.routeSignals.length > 0);
  for (let i = 0; i < routableDocs.length; i++) {
    for (let j = i + 1; j < routableDocs.length; j++) {
      const setA = new Set(routableDocs[i].routeSignals);
      const setB = new Set(routableDocs[j].routeSignals);
      const intersection = routableDocs[j].routeSignals.filter((s) => setA.has(s));
      const overlapRatio = intersection.length / Math.min(setA.size, setB.size);
      if (overlapRatio > 0.8) {
        diagnostics.push({
          level: "info",
          code: "overlapping_signals",
          message: `'${routableDocs[i].name}' and '${routableDocs[j].name}' share ${Math.round(overlapRatio * 100)}% of route signals, which may cause routing ambiguity.`,
          sourceRef: routableDocs[i].sourceRef,
          fix: "Differentiate the documents with distinct content, tools, or frontmatter."
        });
      }
    }
  }

  // large_reference: Reference doc exceeds 200 facts
  for (const doc of documents) {
    if (doc.kind !== "reference") { continue; }
    const totalFacts = doc.sections.reduce((sum, s) => sum + s.facts.length, 0);
    if (totalFacts > 200) {
      diagnostics.push({
        level: "info",
        code: "large_reference",
        message: `Reference '${doc.name}' has ${totalFacts} facts, which may bloat prompt context.`,
        sourceRef: doc.sourceRef,
        fix: "Split the reference into smaller files or trim non-essential content."
      });
    }
  }

  // reference_cycle: Detected during discovery — already handled via visited set,
  // but we flag when discoverReferencePaths returns paths that were already visited
  // This is informational and handled implicitly by the cycle-safe crawler.

  // ambiguous_routing: Routing result is ambiguous
  if (routingMatches?.ambiguous) {
    diagnostics.push({
      level: "warning",
      code: "ambiguous_routing",
      message: `Task routing is ambiguous: '${routingMatches.matches[0]?.name}' and '${routingMatches.matches[1]?.name}' have similar scores (${routingMatches.matches[0]?.score} vs ${routingMatches.matches[1]?.score}).`,
      sourceRef: routingMatches.matches[0]?.sourceRef ?? ".",
      fix: "Refine your --task query or differentiate the documents' routing signals."
    });
  }

  return diagnostics;
}

export function compileHostContext(targetPath = ".", options: HostContextCompileOptions = {}): CeelineResult<HostContextCompileOutput> {
  try {
    const resolvedTargetPath = resolve(targetPath);
    const sourceFiles = collectCompilerSourceFiles(resolvedTargetPath);
    if (sourceFiles.length === 0) {
      return {
        ok: false,
        issues: [issue("no_host_context_sources", `No .agent.md, SKILL.md, or hooks.json files were found under '${resolvedTargetPath}'.`)]
      };
    }

    const rootLabel = basename(resolvedTargetPath) || "host-context";
    const source = buildCompilerSource(rootLabel);
    const rootRef = workspaceRef(resolvedTargetPath, resolvedTargetPath);
    const primaryDocuments = sourceFiles.map((sourceFile) => parseCompilerDocument(resolvedTargetPath, sourceFile));
    const referenceDocuments = discoverAndParseReferences(resolvedTargetPath, primaryDocuments, sourceFiles);
    const documents = [...primaryDocuments, ...referenceDocuments];
    const promptContext: CeelineEnvelope<"prompt_context">[] = [];
    const routing: CeelineEnvelope<"routing">[] = [];
    const issues: ValidationIssue[] = [];

    for (const document of documents) {
      for (const section of document.sections) {
        const envelope = compilePromptContextEnvelope(document, section, source);
        if (envelope.ok) {
          promptContext.push(envelope.value);
        } else {
          issues.push(...envelope.issues.map((item) => ({ ...item, path: `${document.sourceRef}#${section.id}:${item.path}` })));
        }
      }
    }

    const routedDocuments = documents.filter((document) => document.kind !== "hooks" && document.kind !== "reference");
    const candidates = routedDocuments.map((document) => document.name);

    for (const document of routedDocuments) {
      const envelope = compileRoutingEnvelope(document, candidates, source);
      if (envelope.ok) {
        routing.push(envelope.value);
      } else {
        issues.push(...envelope.issues.map((item) => ({ ...item, path: `${document.sourceRef}:${item.path}` })));
      }
    }

    if (issues.length > 0) {
      return { ok: false, issues };
    }

    const digest = compileDigestEnvelope(rootRef, documents, promptContext.length, routing.length, source);
    if (!digest.ok) {
      return { ok: false, issues: digest.issues };
    }

    const history = compileHistoryEnvelope(rootRef, documents, promptContext.length, routing.length, source);
    if (!history.ok) {
      return { ok: false, issues: history.issues };
    }

    let signalBoosts: Map<string, number> | undefined;
    if (options.signalBoostsPath) {
      const loaded = loadSignalBoosts(options.signalBoostsPath);
      if (!loaded.ok) {
        return { ok: false, issues: loaded.issues };
      }
      signalBoosts = loaded.value;
    }

    const routingMatches = typeof options.task === "string" && options.task.trim().length > 0
      ? scoreRoutingMatches(options.task.trim(), documents, signalBoosts)
      : undefined;

    const diagnostics = collectDiagnostics(documents, sourceFiles, routingMatches);

    if (options.strict) {
      const promoted = diagnostics.filter((d) => d.level === "warning");
      if (promoted.length > 0) {
        return {
          ok: false,
          issues: promoted.map((d) => issue(d.code, d.message))
        };
      }
    }

    const reflection = compileReflectionEnvelope(rootRef, documents, diagnostics, routingMatches, source);
    if (!reflection.ok) {
      return { ok: false, issues: reflection.issues };
    }

    const toolSummary = compileToolSummaryEnvelope(rootRef, documents, source);
    if (!toolSummary.ok) {
      return { ok: false, issues: toolSummary.issues };
    }

    const compactBundles = compileCompactBundles(promptContext, routing, digest.value, history.value, reflection.value, toolSummary.value);
    if (!compactBundles.ok) {
      return { ok: false, issues: compactBundles.issues };
    }

    return {
      ok: true,
      value: {
        rootRef,
        documents,
        diagnostics,
        promptContext,
        routing,
        digest: digest.value,
        history: history.value,
        reflection: reflection.value,
        toolSummary: toolSummary.value,
        compactBundles: compactBundles.value,
        routingMatches
      }
    };
  } catch (error) {
    return {
      ok: false,
      issues: [issue("host_context_compile_failed", error instanceof Error ? error.message : "Host context compilation failed.")]
    };
  }
}

// ---------------------------------------------------------------------------
// P7: Disk output + manifest
// ---------------------------------------------------------------------------

export interface HostContextManifestEntry {
  file: string;
  surface: string;
  sha256: string;
  bytes: number;
}

export interface HostContextManifest {
  version: "1.0";
  rootRef: string;
  generatedAt: string;
  entries: HostContextManifestEntry[];
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function writeHostContextToDisk(
  output: HostContextCompileOutput,
  outputDir: string
): CeelineResult<HostContextManifest> {
  try {
    mkdirSync(outputDir, { recursive: true });

    const envelopesDir = join(outputDir, "envelopes");
    mkdirSync(envelopesDir, { recursive: true });

    const compactDir = join(outputDir, "compact");
    mkdirSync(compactDir, { recursive: true });

    const entries: HostContextManifestEntry[] = [];

    // Write individual envelope JSON files
    const allEnvelopes: { surface: string; envelope: unknown; index: number }[] = [];

    for (let i = 0; i < output.promptContext.length; i++) {
      allEnvelopes.push({ surface: "prompt_context", envelope: output.promptContext[i], index: i });
    }
    for (let i = 0; i < output.routing.length; i++) {
      allEnvelopes.push({ surface: "routing", envelope: output.routing[i], index: i });
    }
    allEnvelopes.push({ surface: "digest", envelope: output.digest, index: 0 });
    allEnvelopes.push({ surface: "history", envelope: output.history, index: 0 });
    allEnvelopes.push({ surface: "reflection", envelope: output.reflection, index: 0 });
    allEnvelopes.push({ surface: "tool_summary", envelope: output.toolSummary, index: 0 });

    for (const { surface, envelope, index } of allEnvelopes) {
      const fileName = `${surface}.${index}.json`;
      const filePath = join(envelopesDir, fileName);
      const content = JSON.stringify(envelope, null, 2);
      writeFileSync(filePath, content, "utf8");
      entries.push({
        file: `envelopes/${fileName}`,
        surface,
        sha256: sha256(content),
        bytes: Buffer.byteLength(content, "utf8")
      });
    }

    // Write compact bundle .cl1 files
    const bundles: { key: string; bundle: HostContextCompactBundle }[] = [
      { key: "prompt_context", bundle: output.compactBundles.promptContext },
      { key: "routing", bundle: output.compactBundles.routing },
      { key: "digest", bundle: output.compactBundles.digest },
      { key: "history", bundle: output.compactBundles.history },
      { key: "reflection", bundle: output.compactBundles.reflection },
      { key: "tool_summary", bundle: output.compactBundles.toolSummary }
    ];

    for (const { key, bundle } of bundles) {
      const fileName = `${key}.cl1`;
      const filePath = join(compactDir, fileName);
      const content = bundle.text;
      writeFileSync(filePath, content, "utf8");
      entries.push({
        file: `compact/${fileName}`,
        surface: key,
        sha256: sha256(content),
        bytes: Buffer.byteLength(content, "utf8")
      });
    }

    const manifest: HostContextManifest = {
      version: "1.0",
      rootRef: output.rootRef,
      generatedAt: new Date().toISOString(),
      entries
    };

    const manifestContent = JSON.stringify(manifest, null, 2);
    writeFileSync(join(outputDir, "manifest.json"), manifestContent, "utf8");

    return { ok: true, value: manifest };
  } catch (error) {
    return {
      ok: false,
      issues: [issue("disk_write_failed", error instanceof Error ? error.message : "Failed to write host context to disk.")]
    };
  }
}

// ---------------------------------------------------------------------------
// P8: Learned signal boosts
// ---------------------------------------------------------------------------

function loadSignalBoosts(filePath: string): CeelineResult<Map<string, number>> {
  try {
    const resolvedPath = resolve(filePath);
    if (!existsSync(resolvedPath)) {
      return { ok: false, issues: [issue("signal_boosts_not_found", `Signal boosts file not found: ${resolvedPath}`)] };
    }
    const raw = readFileSync(resolvedPath, "utf8");
    const parsed = JSON.parse(raw) as HostContextSignalBoosts;
    if (parsed.version !== "1.0" || !Array.isArray(parsed.boosts)) {
      return { ok: false, issues: [issue("invalid_signal_boosts", "Signal boosts file must have version '1.0' and a boosts array.")] };
    }
    const map = new Map<string, number>();
    for (const entry of parsed.boosts) {
      if (typeof entry.signal === "string" && typeof entry.adjustment === "number") {
        map.set(entry.signal, entry.adjustment);
      }
    }
    return { ok: true, value: map };
  } catch (error) {
    return {
      ok: false,
      issues: [issue("signal_boosts_load_failed", error instanceof Error ? error.message : "Failed to load signal boosts.")]
    };
  }
}

export interface LearnSignalBoostsTask {
  task: string;
  expectedWinner: string;
}

export function learnSignalBoosts(
  targetPath: string,
  tasks: readonly LearnSignalBoostsTask[]
): CeelineResult<HostContextSignalBoosts> {
  const resolvedTargetPath = resolve(targetPath);
  const sourceFiles = collectCompilerSourceFiles(resolvedTargetPath);
  if (sourceFiles.length === 0) {
    return {
      ok: false,
      issues: [issue("no_host_context_sources", `No source files found under '${resolvedTargetPath}'.`)]
    };
  }

  const rootLabel = basename(resolvedTargetPath) || "host-context";
  const primaryDocuments = sourceFiles.map((sourceFile) => parseCompilerDocument(resolvedTargetPath, sourceFile));
  const referenceDocuments = discoverAndParseReferences(resolvedTargetPath, primaryDocuments, sourceFiles);
  const documents = [...primaryDocuments, ...referenceDocuments];

  // Accumulate adjustments: for each task, check if the expected winner matches.
  // If not, boost signals shared between task and expected winner, penalize signals of the wrong winner.
  const adjustments = new Map<string, number>();

  for (const { task, expectedWinner } of tasks) {
    const result = scoreRoutingMatches(task, documents);
    const topMatch = result.matches[0];
    if (!topMatch || topMatch.score === 0) {
      continue;
    }

    const expectedDoc = documents.find((d) => d.name === expectedWinner);
    if (!expectedDoc) {
      continue;
    }

    if (topMatch.name === expectedWinner) {
      // Already correct — reinforce matched signals with small boost
      for (const signal of topMatch.matchedSignals) {
        adjustments.set(signal, (adjustments.get(signal) ?? 0) + 0.5);
      }
      continue;
    }

    // Wrong winner — boost signals shared between task and expected winner
    const taskSignals = new Set(extractTaskSignals(task));
    const expectedSignals = expectedDoc.routeSignals.filter((s) => taskSignals.has(s));
    for (const signal of expectedSignals) {
      adjustments.set(signal, (adjustments.get(signal) ?? 0) + 2);
    }

    // Penalize signals that the wrong winner matched
    for (const signal of topMatch.matchedSignals) {
      adjustments.set(signal, (adjustments.get(signal) ?? 0) - 1);
    }
  }

  const boosts: HostContextSignalBoost[] = Array.from(adjustments.entries())
    .filter(([, adj]) => Math.abs(adj) >= 0.5)
    .map(([signal, adjustment]) => ({ signal, adjustment: Math.round(adjustment * 10) / 10 }))
    .sort((a, b) => Math.abs(b.adjustment) - Math.abs(a.adjustment) || a.signal.localeCompare(b.signal));

  return {
    ok: true,
    value: {
      version: "1.0",
      generatedAt: new Date().toISOString(),
      boosts
    }
  };
}
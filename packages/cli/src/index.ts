#!/usr/bin/env node

import { readFileSync, watch as fsWatch } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { compileHostContext, learnSignalBoosts, writeHostContextToDisk, type HostContextCompileOutput, type LearnSignalBoostsTask } from "./host-compiler.js";
import {
  type CanonicalPayloadInput,
  decodeEnvelope,
  detectLeaks,
  encodeCanonical,
  parseCeelineCompact,
  parseEnvelope,
  renderCeelineCompact,
  renderCeelineCompactAuto,
  renderInternal,
  renderUserFacing,
  type ValidationIssue,
  validateEnvelope
} from "@asafelobotomy/ceeline-core";
import {
  CEELINE_POLICIES,
  type CeelinePolicy,
  type CeelineSurface,
  type CommonPayload,
  type DigestPayload,
  type HandoffPayload,
  type MemoryPayload,
  type SourceInfo
} from "@asafelobotomy/ceeline-schema";

export type EncodeRequest =
  | SurfaceEncodeRequest<"handoff", HandoffPayload>
  | SurfaceEncodeRequest<"digest", DigestPayload>
  | SurfaceEncodeRequest<"memory", MemoryPayload>
  | SurfaceEncodeRequest<Exclude<CeelineSurface, "handoff" | "digest" | "memory">, CommonPayload>;

export type { HostContextCompileOutput };
export type CompileHostContextOutputMode = "json" | "compact-only";

export interface CompileHostContextCliOptions {
  targetPath: string;
  outputMode: CompileHostContextOutputMode;
  task?: string;
  strict?: boolean;
  output?: string;
  signalBoosts?: string;
  learnSignals?: string;
  watch?: boolean;
}

interface SurfaceEncodeRequest<S extends CeelineSurface, P extends CommonPayload> {
  surface: S;
  text?: string;
  intent: string;
  policy?: CeelinePolicy;
  source?: SourceInfo;
  payload: CanonicalPayloadInput<P>;
}

function isCeelinePolicy(value: unknown): value is CeelinePolicy {
  return typeof value === "string" && CEELINE_POLICIES.includes(value as CeelinePolicy);
}

function invalidPolicyResult(value: unknown) {
  return {
    ok: false as const,
    issues: [
      {
        code: "invalid_policy",
        message: `policy must be one of: ${CEELINE_POLICIES.join(", ")}. Received '${String(value)}'.`,
        path: "policy"
      }
    ]
  };
}

function compileArgFailure(code: string, message: string, path: string) {
  return {
    ok: false as const,
    issues: [
      {
        code,
        message,
        path
      } satisfies ValidationIssue
    ]
  };
}

export function parseCompileHostContextArgs(args: string[]) {
  let targetPath = ".";
  let outputMode: CompileHostContextOutputMode = "json";
  let explicitOutputMode: CompileHostContextOutputMode | undefined;
  let task: string | undefined;
  let strict = false;
  let output: string | undefined;
  let signalBoosts: string | undefined;
  let learnSignalsPath: string | undefined;
  let watchMode = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json" || arg === "--compact-only") {
      const nextMode = arg === "--json" ? "json" : "compact-only";
      if (explicitOutputMode && explicitOutputMode !== nextMode) {
        return compileArgFailure("conflicting_output_mode", "Choose either --json or --compact-only, not both.", arg);
      }
      explicitOutputMode = nextMode;
      outputMode = nextMode;
      continue;
    }

    if (arg === "--task") {
      const nextValue = args[index + 1];
      if (!nextValue || nextValue.startsWith("--")) {
        return compileArgFailure("missing_task", "--task requires a non-empty task string.", "--task");
      }
      task = nextValue.trim();
      index += 1;
      if (!task) {
        return compileArgFailure("missing_task", "--task requires a non-empty task string.", "--task");
      }
      continue;
    }

    if (arg.startsWith("--task=")) {
      task = arg.slice("--task=".length).trim();
      if (!task) {
        return compileArgFailure("missing_task", "--task requires a non-empty task string.", "--task");
      }
      continue;
    }

    if (arg === "--strict") {
      strict = true;
      continue;
    }

    if (arg === "--watch") {
      watchMode = true;
      continue;
    }

    if (arg === "--output") {
      const nextValue = args[index + 1];
      if (!nextValue || nextValue.startsWith("--")) {
        return compileArgFailure("missing_output", "--output requires a directory path.", "--output");
      }
      output = nextValue;
      index += 1;
      continue;
    }

    if (arg.startsWith("--output=")) {
      output = arg.slice("--output=".length);
      if (!output) {
        return compileArgFailure("missing_output", "--output requires a directory path.", "--output");
      }
      continue;
    }

    if (arg === "--signal-boosts") {
      const nextValue = args[index + 1];
      if (!nextValue || nextValue.startsWith("--")) {
        return compileArgFailure("missing_signal_boosts", "--signal-boosts requires a file path.", "--signal-boosts");
      }
      signalBoosts = nextValue;
      index += 1;
      continue;
    }

    if (arg.startsWith("--signal-boosts=")) {
      signalBoosts = arg.slice("--signal-boosts=".length);
      if (!signalBoosts) {
        return compileArgFailure("missing_signal_boosts", "--signal-boosts requires a file path.", "--signal-boosts");
      }
      continue;
    }

    if (arg === "--learn-signals") {
      const nextValue = args[index + 1];
      if (!nextValue || nextValue.startsWith("--")) {
        return compileArgFailure("missing_learn_signals", "--learn-signals requires a tasks JSON file path.", "--learn-signals");
      }
      learnSignalsPath = nextValue;
      index += 1;
      continue;
    }

    if (arg.startsWith("--learn-signals=")) {
      learnSignalsPath = arg.slice("--learn-signals=".length);
      if (!learnSignalsPath) {
        return compileArgFailure("missing_learn_signals", "--learn-signals requires a tasks JSON file path.", "--learn-signals");
      }
      continue;
    }

    if (arg.startsWith("--")) {
      return compileArgFailure("unknown_option", `Unknown option '${arg}'.`, arg);
    }

    if (targetPath !== ".") {
      return compileArgFailure("unexpected_argument", `Unexpected extra argument '${arg}'.`, arg);
    }

    targetPath = arg;
  }

  return {
    ok: true as const,
    value: {
      targetPath,
      outputMode,
      ...(task ? { task } : {}),
      ...(strict ? { strict } : {}),
      ...(output ? { output } : {}),
      ...(signalBoosts ? { signalBoosts } : {}),
      ...(learnSignalsPath ? { learnSignals: learnSignalsPath } : {}),
      ...(watchMode ? { watch: true } : {})
    } satisfies CompileHostContextCliOptions
  };
}

export function formatCompileHostContextOutput(output: HostContextCompileOutput, outputMode: CompileHostContextOutputMode): string {
  if (outputMode === "json") {
    return JSON.stringify(output, null, 2);
  }

  const routingOrder = new Map(
    (output.routingMatches?.matches ?? []).map((match, index) => [match.sourceRef, index])
  );
  const sortedRoutingItems = [...output.compactBundles.routing.items].sort((left, right) => {
    const leftRank = routingOrder.get(left.sourceRef) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = routingOrder.get(right.sourceRef) ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank || left.sourceRef.localeCompare(right.sourceRef);
  });

  return [
    ...output.compactBundles.promptContext.items.map((item) => item.text),
    ...sortedRoutingItems.map((item) => item.text),
    ...output.compactBundles.digest.items.map((item) => item.text),
    ...output.compactBundles.history.items.map((item) => item.text),
    ...output.compactBundles.reflection.items.map((item) => item.text),
    ...output.compactBundles.toolSummary.items.map((item) => item.text)
  ].join("\n\n");
}

export function encodeRequestToEnvelope(request: EncodeRequest) {
  if (typeof request.policy !== "undefined" && !isCeelinePolicy(request.policy)) {
    return invalidPolicyResult(request.policy);
  }

  return encodeCanonical(
    {
      text: request.text,
      intent: request.intent,
      source: request.source ?? {
        kind: "host",
        name: "ceeline.cli",
        instance: "manual",
        timestamp: new Date().toISOString()
      },
      payload: request.payload
    },
    request.surface,
    request.policy ? { policy: request.policy } : undefined
  );
}

function printUsage(): void {
  process.stdout.write(
    [
      "Usage:",
      "  ceeline encode <json>",
      "  ceeline decode <json>",
      "  ceeline render <json>",
      "  ceeline validate <json>",
      "  ceeline detect-leak <text>",
      "  ceeline render-compact <json> [--density lite|full|dense|auto]",
      "  ceeline parse-compact <compact-text>",
      "  ceeline compile-host-context [path] [options]",
      "",
      "If no payload argument is provided, the CLI reads from stdin.",
      "compile-host-context scans [path] (default '.') for .agent.md, SKILL.md, and hooks.json files.",
      "Use --compact-only to emit only compact text bundles instead of structured JSON.",
      "Use --task <text> or --task=<text> to include scored routing matches for a concrete task string.",
      "Use --output <dir> to write envelopes, compact bundles, and manifest to disk.",
      "Use --signal-boosts <file> to apply learned signal weight adjustments.",
      "Use --learn-signals <file> to generate signal boosts from a tasks JSON file.",
      "Use --watch with --output to recompile on file changes."
    ].join("\n") + "\n"
  );
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      buffer += chunk;
    });
    process.stdin.on("end", () => resolve(buffer.trim()));
    process.stdin.on("error", reject);
    process.stdin.resume();
  });
}

async function readInput(argumentsList: string[]): Promise<string> {
  if (argumentsList.length > 0) {
    return argumentsList.join(" ").trim();
  }

  return readStdin();
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function writeError(message: string): void {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

async function handleEncode(inputText: string): Promise<void> {
  const request = JSON.parse(inputText) as EncodeRequest;
  const result = encodeRequestToEnvelope(request);

  if (!result.ok) {
    writeJson(result.issues);
    process.exitCode = 1;
    return;
  }

  writeJson(result.value);
}

function handleDecode(inputText: string): void {
  const parsed = parseEnvelope(inputText);
  if (!parsed.ok) {
    writeJson(parsed.issues);
    process.exitCode = 1;
    return;
  }

  writeJson(decodeEnvelope(parsed.value));
}

function handleRender(inputText: string): void {
  const parsed = parseEnvelope(inputText);
  if (!parsed.ok) {
    writeJson(parsed.issues);
    process.exitCode = 1;
    return;
  }

  const decoded = decodeEnvelope(parsed.value);
  const rendered =
    parsed.value.render.style === "user_facing"
      ? renderUserFacing(decoded)
      : { ok: true as const, value: renderInternal(decoded, parsed.value.render.style) };

  if (!rendered.ok) {
    writeJson(rendered.issues);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`${rendered.value}\n`);
}

function handleValidate(inputText: string): void {
  const parsed = JSON.parse(inputText) as unknown;
  const result = validateEnvelope(parsed);
  writeJson(result.ok ? { ok: true } : result.issues);
  if (!result.ok) {
    process.exitCode = 1;
  }
}

function handleDetectLeak(inputText: string): void {
  writeJson(detectLeaks(inputText));
}

function handleRenderCompact(inputText: string, densityArg: string | undefined): void {
  const parsed = parseEnvelope(inputText);
  if (!parsed.ok) {
    writeJson(parsed.issues);
    process.exitCode = 1;
    return;
  }

  const validDensities = ["lite", "full", "dense", "auto"] as const;
  const density = densityArg ?? "auto";
  if (!validDensities.includes(density as typeof validDensities[number])) {
    writeError(`Invalid density '${density}'. Must be one of: ${validDensities.join(", ")}`);
    return;
  }

  const result = density === "auto"
    ? renderCeelineCompactAuto(parsed.value)
    : renderCeelineCompact(parsed.value, density as "lite" | "full" | "dense");

  if (!result.ok) {
    writeJson(result.issues);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`${result.value}\n`);
}

function handleParseCompact(inputText: string): void {
  const result = parseCeelineCompact(inputText);
  if (!result.ok) {
    writeJson(result.issues);
    process.exitCode = 1;
    return;
  }

  writeJson(result.value);
}

function handleCompileHostContext(options: CompileHostContextCliOptions): void {
  if (options.learnSignals) {
    handleLearnSignals(options.targetPath, options.learnSignals);
    return;
  }

  if (options.watch && !options.output) {
    writeError("--watch requires --output <dir>.");
    process.exitCode = 1;
    return;
  }

  // Run initial compilation
  const ran = runCompileHostContext(options);
  if (!ran || !options.watch) {
    return;
  }

  // Watch mode: recompile on changes
  const resolvedTarget = resolve(options.targetPath);
  const DEBOUNCE_MS = 100;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  process.stderr.write(`Watching ${resolvedTarget} for changes...\n`);

  fsWatch(resolvedTarget, { recursive: true }, (_eventType, filename) => {
    if (!filename) { return; }
    if (!filename.endsWith(".md") && !filename.endsWith(".json") && !filename.endsWith(".sh")) {
      return;
    }
    if (debounceTimer) { clearTimeout(debounceTimer); }
    debounceTimer = setTimeout(() => {
      process.stderr.write(`\nChange detected: ${filename}\n`);
      runCompileHostContext(options);
    }, DEBOUNCE_MS);
  });
}

function runCompileHostContext(options: CompileHostContextCliOptions): boolean {
  const result = compileHostContext(options.targetPath, {
    ...(options.task ? { task: options.task } : {}),
    ...(options.strict ? { strict: options.strict } : {}),
    ...(options.signalBoosts ? { signalBoostsPath: options.signalBoosts } : {})
  });
  if (!result.ok) {
    writeJson(result.issues);
    process.exitCode = 1;
    return false;
  }

  if (options.output) {
    const diskResult = writeHostContextToDisk(result.value, options.output);
    if (!diskResult.ok) {
      writeJson(diskResult.issues);
      process.exitCode = 1;
      return false;
    }
    writeJson(diskResult.value);
    return true;
  }

  const output = formatCompileHostContextOutput(result.value, options.outputMode);
  process.stdout.write(output.endsWith("\n") ? output : `${output}\n`);
  return true;
}

function handleLearnSignals(targetPath: string, tasksFilePath: string): void {
  let tasks: LearnSignalBoostsTask[];
  try {
    const raw = readFileSync(resolve(tasksFilePath), "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      writeError("Tasks file must contain a JSON array of { task, expectedWinner } objects.");
      return;
    }
    tasks = parsed as LearnSignalBoostsTask[];
  } catch (error) {
    writeError(error instanceof Error ? error.message : "Failed to read tasks file.");
    return;
  }

  const result = learnSignalBoosts(targetPath, tasks);
  if (!result.ok) {
    writeJson(result.issues);
    process.exitCode = 1;
    return;
  }

  writeJson(result.value);
}

export async function runCli(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;

  if (!command || command === "-h" || command === "--help") {
    printUsage();
    return;
  }

  if (command === "compile-host-context") {
    const parsedArgs = parseCompileHostContextArgs(rest);
    if (!parsedArgs.ok) {
      writeJson(parsedArgs.issues);
      process.exitCode = 1;
      return;
    }
    handleCompileHostContext(parsedArgs.value);
    return;
  }

  const inputText = await readInput(rest);
  if (!inputText && command !== "detect-leak") {
    writeError("Expected JSON input via argument or stdin.");
    return;
  }

  try {
    switch (command) {
      case "encode":
        await handleEncode(inputText);
        break;
      case "decode":
        handleDecode(inputText);
        break;
      case "render":
        handleRender(inputText);
        break;
      case "validate":
        handleValidate(inputText);
        break;
      case "detect-leak":
        handleDetectLeak(inputText);
        break;
      case "render-compact": {
        const densityIdx = rest.indexOf("--density");
        const densityArg = densityIdx >= 0 ? rest[densityIdx + 1] : undefined;
        const filteredRest = rest.filter((_, i) => i !== densityIdx && i !== densityIdx + 1);
        const compactInput = await readInput(filteredRest);
        handleRenderCompact(compactInput || inputText, densityArg);
        break;
      }
      case "parse-compact":
        handleParseCompact(inputText);
        break;
      default:
        writeError(`Unknown command '${command}'.`);
        printUsage();
    }
  } catch (error) {
    writeError(error instanceof Error ? error.message : "CLI command failed.");
  }
}

const invokedDirectly = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  void runCli(process.argv.slice(2));
}

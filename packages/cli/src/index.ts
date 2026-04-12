#!/usr/bin/env node

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
  validateEnvelope
} from "@ceeline/core";
import type { CeelineSurface, CommonPayload, DigestPayload, HandoffPayload, MemoryPayload, SourceInfo } from "@ceeline/schema";

type EncodeRequest =
  | SurfaceEncodeRequest<"handoff", HandoffPayload>
  | SurfaceEncodeRequest<"digest", DigestPayload>
  | SurfaceEncodeRequest<"memory", MemoryPayload>
  | SurfaceEncodeRequest<Exclude<CeelineSurface, "handoff" | "digest" | "memory">, CommonPayload>;

interface SurfaceEncodeRequest<S extends CeelineSurface, P extends CommonPayload> {
  surface: S;
  text?: string;
  intent: string;
  source?: SourceInfo;
  payload: CanonicalPayloadInput<P>;
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
      "",
      "If no payload argument is provided, the CLI reads from stdin."
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
  const result = encodeCanonical(
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
    request.surface
  );

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

export async function runCli(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;

  if (!command || command === "-h" || command === "--help") {
    printUsage();
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

void runCli(process.argv.slice(2));

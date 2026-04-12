import {
  decodeEnvelope,
  detectLeaks,
  encodeCanonical,
  parseCeelineCompact,
  parseEnvelope,
  renderCeelineCompact,
  renderCeelineCompactAuto,
  renderUserFacing,
  validateEnvelope
} from "@ceeline/core";
import { SURFACES, type CeelineSurface } from "@ceeline/schema";

export interface McpToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

const MCP_PROTOCOL_VERSION = "2025-03-26";
const SERVER_NAME = "ceeline-mcp-server";
const SERVER_VERSION = "0.1.0";

export function createCeelineMcpToolDescriptors(): McpToolDescriptor[] {
  return [
    {
      name: "translate_to_ceeline",
      description: "Encode canonical host content into a Ceeline envelope.",
      inputSchema: {
        type: "object",
        required: ["surface", "intent", "payload"],
        properties: {
          surface: { type: "string" },
          intent: { type: "string" },
          text: { type: "string" },
          payload: { type: "object" }
        }
      }
    },
    {
      name: "translate_from_ceeline",
      description: "Decode a Ceeline envelope into canonical meaning.",
      inputSchema: {
        type: "object",
        required: ["envelope"],
        properties: {
          envelope: { type: "object" }
        }
      }
    },
    {
      name: "validate_ceeline_payload",
      description: "Validate a Ceeline envelope.",
      inputSchema: {
        type: "object",
        required: ["envelope"],
        properties: {
          envelope: { type: "object" }
        }
      }
    },
    {
      name: "render_verbose_summary",
      description: "Render a user-facing summary from a Ceeline envelope.",
      inputSchema: {
        type: "object",
        required: ["envelope"],
        properties: {
          envelope: { type: "object" }
        }
      }
    },
    {
      name: "detect_ceeline_leak",
      description: "Detect whether text contains internal Ceeline artifacts.",
      inputSchema: {
        type: "object",
        required: ["text"],
        properties: {
          text: { type: "string" }
        }
      }
    },
    {
      name: "render_compact",
      description: "Render a Ceeline envelope into compact text format.",
      inputSchema: {
        type: "object",
        required: ["envelope"],
        properties: {
          envelope: { type: "object" },
          density: { type: "string", enum: ["lite", "full", "dense", "auto"] }
        }
      }
    },
    {
      name: "parse_compact",
      description: "Parse compact Ceeline text back into structured data.",
      inputSchema: {
        type: "object",
        required: ["text"],
        properties: {
          text: { type: "string" }
        }
      }
    }
  ];
}

export function invokeCeelineMcpTool(call: McpToolCall): unknown {
  switch (call.name) {
    case "translate_to_ceeline": {
      const surface = call.arguments.surface;
      if (typeof surface !== "string" || !SURFACES.includes(surface as CeelineSurface)) {
        return { errors: [{ code: "invalid_surface", message: `Invalid surface '${String(surface)}'. Must be one of: ${SURFACES.join(", ")}`, path: "surface" }] };
      }
      const payload = call.arguments.payload;
      if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
        return { errors: [{ code: "invalid_payload", message: "payload must be a non-null object.", path: "payload" }] };
      }
      const payloadRecord = payload as Record<string, unknown>;
      if (typeof payloadRecord.summary !== "string") {
        return { errors: [{ code: "missing_summary", message: "payload.summary is required and must be a string.", path: "payload.summary" }] };
      }

      const result = encodeCanonical(
        {
          text: typeof call.arguments.text === "string" ? call.arguments.text : undefined,
          intent: String(call.arguments.intent ?? "adapter.encode"),
          source: {
            kind: "adapter",
            name: "ceeline.mcp",
            instance: "manual",
            timestamp: new Date().toISOString()
          },
          payload: payloadRecord as {
            summary: string;
            facts?: string[];
            ask?: string;
            artifacts?: unknown[];
            metadata?: Record<string, unknown>;
          }
        },
        surface as CeelineSurface
      );

      return result.ok ? result.value : { errors: result.issues };
    }
    case "translate_from_ceeline": {
      const validation = validateEnvelope(call.arguments.envelope);
      return validation.ok ? decodeEnvelope(validation.value) : { errors: validation.issues };
    }
    case "validate_ceeline_payload": {
      const validation = validateEnvelope(call.arguments.envelope);
      return validation.ok ? { ok: true } : { errors: validation.issues };
    }
    case "render_verbose_summary": {
      const parsed = parseEnvelope(JSON.stringify(call.arguments.envelope));
      if (!parsed.ok) {
        return { errors: parsed.issues };
      }
      const rendered = renderUserFacing(decodeEnvelope(parsed.value));
      return rendered.ok ? { text: rendered.value } : { errors: rendered.issues };
    }
    case "detect_ceeline_leak": {
      return { findings: detectLeaks(String(call.arguments.text ?? "")) };
    }
    case "render_compact": {
      const parsed = parseEnvelope(JSON.stringify(call.arguments.envelope));
      if (!parsed.ok) {
        return { errors: parsed.issues };
      }
      const density = call.arguments.density;
      const validDensities = ["lite", "full", "dense", "auto"];
      if (density !== undefined && (typeof density !== "string" || !validDensities.includes(density))) {
        return { errors: [{ code: "invalid_density", message: `Invalid density '${String(density)}'. Must be one of: ${validDensities.join(", ")}`, path: "density" }] };
      }
      const result = density === "auto" || density === undefined
        ? renderCeelineCompactAuto(parsed.value)
        : renderCeelineCompact(parsed.value, density as "lite" | "full" | "dense");
      return result.ok ? { text: result.value } : { errors: result.issues };
    }
    case "parse_compact": {
      const text = call.arguments.text;
      if (typeof text !== "string") {
        return { errors: [{ code: "invalid_text", message: "text must be a string.", path: "text" }] };
      }
      const result = parseCeelineCompact(text);
      return result.ok ? result.value : { errors: result.issues };
    }
    default:
      return { errors: [{ code: "unknown_tool", message: `Unknown tool '${call.name}'.`, path: "$tool" }] };
  }
}

function toToolResult(payload: unknown, isError = false): Record<string, unknown> {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2)
      }
    ],
    structuredContent: payload,
    isError
  };
}

function makeResponse(id: string | number | null, result: unknown): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    result
  };
}

function makeError(id: string | number | null, code: number, message: string, data?: unknown): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      ...(typeof data === "undefined" ? {} : { data })
    }
  };
}

function serializeMessage(message: JsonRpcResponse): string {
  const body = JSON.stringify(message);
  return `Content-Length: ${body.length}\r\n\r\n${body}`;
}

function writeResponse(message: JsonRpcResponse): void {
  process.stdout.write(serializeMessage(message));
}

function handleRequest(request: JsonRpcRequest): JsonRpcResponse | null {
  switch (request.method) {
    case "initialize":
      return makeResponse(request.id ?? null, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        serverInfo: {
          name: SERVER_NAME,
          version: SERVER_VERSION
        },
        capabilities: {
          tools: {}
        }
      });
    case "notifications/initialized":
      return null;
    case "ping":
      return makeResponse(request.id ?? null, {});
    case "tools/list":
      return makeResponse(request.id ?? null, {
        tools: createCeelineMcpToolDescriptors()
      });
    case "tools/call": {
      const name = typeof request.params?.name === "string" ? request.params.name : "";
      const args = request.params?.arguments;

      if (!name || typeof args !== "object" || args === null || Array.isArray(args)) {
        return makeError(request.id ?? null, -32602, "Invalid tools/call params.");
      }

      const result = invokeCeelineMcpTool({
        name,
        arguments: args as Record<string, unknown>
      });
      const isError = typeof result === "object" && result !== null && "errors" in result;
      return makeResponse(request.id ?? null, toToolResult(result, isError));
    }
    default:
      return makeError(request.id ?? null, -32601, `Method '${request.method}' not found.`);
  }
}

function tryReadFrame(buffer: string): { body: string; rest: string } | null {
  const headerEnd = buffer.indexOf("\r\n\r\n");
  if (headerEnd === -1) {
    return null;
  }

  const headerText = buffer.slice(0, headerEnd);
  const contentLengthHeader = headerText
    .split("\r\n")
    .find((line) => line.toLowerCase().startsWith("content-length:"));

  if (!contentLengthHeader) {
    return null;
  }

  const lengthText = contentLengthHeader.split(":")[1]?.trim();
  const contentLength = Number(lengthText);
  if (!Number.isFinite(contentLength) || contentLength < 0) {
    return null;
  }

  const bodyStart = headerEnd + 4;
  const bodyEnd = bodyStart + contentLength;
  if (buffer.length < bodyEnd) {
    return null;
  }

  return {
    body: buffer.slice(bodyStart, bodyEnd),
    rest: buffer.slice(bodyEnd)
  };
}

export function startStdioServer(): void {
  let buffer = "";

  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    buffer += chunk;

    while (true) {
      const frame = tryReadFrame(buffer);
      if (!frame) {
        break;
      }

      buffer = frame.rest;

      try {
        const request = JSON.parse(frame.body) as JsonRpcRequest;
        const response = handleRequest(request);
        if (response) {
          writeResponse(response);
        }
      } catch (error) {
        writeResponse(
          makeError(
            null,
            -32700,
            "Failed to parse JSON-RPC request.",
            error instanceof Error ? error.message : "unknown error"
          )
        );
      }
    }
  });
  process.stdin.resume();
}

if (typeof process !== "undefined" && process.stdin && process.stdout) {
  startStdioServer();
}

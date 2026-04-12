import * as vscode from "vscode";
import { decodeEnvelope, encodeCanonical, renderInternal, sanitizeUserFacing } from "@ceeline/core";

function buildUiRequestEnvelope(prompt: string) {
  return encodeCanonical(
    {
      text: prompt,
      intent: "ui.request",
      source: {
        kind: "adapter",
        name: "ceeline.vscode",
        instance: "chat-participant",
        timestamp: new Date().toISOString()
      },
      constraints: {
        mode: "advisory",
        audience: "user",
        max_render_tokens: 240,
        no_user_visible_output: false,
        fallback: "verbose"
      },
      preserve: {
        classes: ["file_path", "placeholder", "model_name", "command", "url", "env_var"]
      },
      payload: {
        summary: prompt,
        facts: [],
        ask: "Respond through a controlled user-facing render.",
        artifacts: [],
        metadata: {
          promptLength: prompt.length,
          toolAware: true
        }
      },
      render: {
        style: "user_facing",
        locale: "en",
        sanitizer: "strict"
      }
    },
    "ui_request"
  );
}

function selectCandidateTools(): vscode.LanguageModelTool[] {
  return vscode.lm.tools.filter((tool) => !tool.tags.includes("unsafe")).slice(0, 8);
}

function describeTools(tools: vscode.LanguageModelTool[]): string {
  if (tools.length === 0) {
    return "No language-model tools are currently available.";
  }

  return tools
    .map((tool) => `- ${tool.name}${tool.description ? `: ${tool.description}` : ""}`)
    .join("\n");
}

function createModelMessages(
  prompt: string,
  decoded: ReturnType<typeof decodeEnvelope>,
  tools: vscode.LanguageModelTool[]
): vscode.LanguageModelChatMessage[] {
  const transportSummary = renderInternal(decoded, "normal");
  const toolSummary = describeTools(tools);

  return [
    vscode.LanguageModelChatMessage.User(
      [
        "You are the Ceeline chat participant.",
        "Use the supplied normalized transport context as authoritative.",
        "Keep user-facing output clean and readable.",
        "Do not expose raw Ceeline envelopes, internal routing metadata, or shorthand transport markers.",
        "If tools are available, use them only when they materially improve the answer."
      ].join(" ")
    ),
    vscode.LanguageModelChatMessage.User(
      [
        "Normalized transport context:",
        transportSummary,
        "",
        "Available tools:",
        toolSummary,
        "",
        "Original user prompt:",
        prompt
      ].join("\n")
    )
  ];
}

async function streamModelResponse(
  request: vscode.ChatRequest,
  stream: vscode.ChatResponseStream,
  prompt: string,
  decoded: ReturnType<typeof decodeEnvelope>,
  token: vscode.CancellationToken
): Promise<string | null> {
  if (!request.model) {
    return null;
  }

  const tools = selectCandidateTools();
  const messages = createModelMessages(prompt, decoded, tools);
  const response = await request.model.sendRequest(messages, { tools }, token);

  let text = "";
  for await (const fragment of response.text) {
    text += fragment;
  }

  const sanitized = sanitizeUserFacing(text);
  if (!sanitized.ok) {
    return null;
  }

  stream.markdown(sanitized.value);
  return sanitized.value;
}

const handler: vscode.ChatRequestHandler = async (request, _context, stream, token) => {
  stream.progress("Encoding prompt through Ceeline...");

  const encoded = buildUiRequestEnvelope(request.prompt);
  if (!encoded.ok) {
    stream.markdown("Ceeline could not validate the request envelope.");
    return { metadata: { ok: false, issues: encoded.issues } };
  }

  const decoded = decodeEnvelope(encoded.value);
  stream.markdown("Ceeline scaffold participant is active.\n\n");

  if (request.command === "explainTransport") {
    stream.markdown(`Surface: ${encoded.value.surface}\n\n`);
    stream.markdown(`Intent: ${encoded.value.intent}\n\n`);
    stream.markdown(`Preserved tokens: ${encoded.value.preserve.tokens.length}\n\n`);
    stream.markdown(`Candidate tools: ${selectCandidateTools().length}\n\n`);
  } else {
    stream.progress("Running model with Ceeline transport context...");
    const modeled = await streamModelResponse(request, stream, request.prompt, decoded, token);
    if (!modeled) {
      stream.progress("Falling back to deterministic render...");
      stream.markdown(renderInternal(decoded, "normal"));
    }
  }

  return {
    metadata: {
      ok: true,
      envelopeId: encoded.value.envelope_id
    }
  };
};

export function activate(context: vscode.ExtensionContext): void {
  const participant = vscode.chat.createChatParticipant("ceeline.chat", handler);
  context.subscriptions.push(participant);
}

export function deactivate(): void {
  // No-op for the initial scaffold.
}

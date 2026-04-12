declare module "vscode" {
  export interface Disposable {
    dispose(): void;
  }

  export interface ExtensionContext {
    subscriptions: Disposable[];
  }

  export interface ChatRequest {
    prompt: string;
    command?: string;
    model?: LanguageModelChat;
  }

  export interface ChatContext {
    history: unknown[];
  }

  export interface ChatResponseStream {
    progress(value: string): void;
    markdown(value: string): void;
  }

  export interface LanguageModelTool {
    name: string;
    description?: string;
    tags: string[];
  }

  export interface LanguageModelChatResponse {
    text: AsyncIterable<string>;
  }

  export interface LanguageModelChat {
    sendRequest(
      messages: LanguageModelChatMessage[],
      options: { tools?: LanguageModelTool[] },
      token: CancellationToken
    ): Promise<LanguageModelChatResponse>;
  }

  export class LanguageModelChatMessage {
    static User(value: string): LanguageModelChatMessage;
    static Assistant(value: string): LanguageModelChatMessage;
  }

  export interface CancellationToken {
    readonly isCancellationRequested: boolean;
  }

  export type ChatRequestHandler = (
    request: ChatRequest,
    context: ChatContext,
    stream: ChatResponseStream,
    token: CancellationToken
  ) => Promise<unknown>;

  export interface ChatParticipant extends Disposable {
    iconPath?: unknown;
    followupProvider?: unknown;
  }

  export namespace chat {
    function createChatParticipant(id: string, handler: ChatRequestHandler): ChatParticipant;
  }

  export namespace lm {
    const tools: LanguageModelTool[];
  }
}

export type HookContext = string;

const dependencies = `interface ThinkingBlock {
  id: string;
  messageId: string;
  content: string;
}
type MessageRole = "user" | "assistant" | "system";
interface HistoryMessage {
  id: string;
  role: MessageRole;
  parentId: string | null
  text: string;
  thinkingBlocks: ThinkingBlock[];
  createdAt: number;
  editedAt?: number;
}
interface Memory {
  id: string;
  content: string;
  messageIds: string[]
  createdAt: number;
  editedAt?: number;
}
interface StoryCard {
  id: string;
  title: string;
  content: string;
  triggers: string[];
  tags: string[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}
interface ModelParams {
  contextWindow: number;
  maxOutputTokens: number;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stop: string[];
  thinkingEnabled: boolean;
}
interface PromptSettings {
  defaultSystemPrompt: string;
  storyCardGeneratorPrompt: string;
  memoryGeneratorPrompt: string;
  scenarioGeneratorPrompt: string;
}
interface ResolvedConfig {
  providerId: string;
  endpoint: string;
  apiKey: string;
  model: string;
  authorNotes: string;
  params: ModelParams;
  prompts: PromptSettings;
}
enum LLMErrorCode {
  NetworkError = "NETWORK_ERROR",
  Timeout = "TIMEOUT",
  Aborted = "ABORTED",
  Unauthorized = "UNAUTHORIZED",
  Forbidden = "FORBIDDEN",
  RateLimited = "RATE_LIMITED",
  InsufficientQuota = "INSUFFICIENT_QUOTA",
  InvalidRequest = "INVALID_REQUEST",
  ContextLengthExceeded = "CONTEXT_LENGTH_EXCEEDED",
  ModelNotFound = "MODEL_NOT_FOUND",
  ProviderError = "PROVIDER_ERROR",
  ProviderUnavailable = "PROVIDER_UNAVAILABLE",
  UnknownProvider = "UNKNOWN_PROVIDER",
  Unknown = "UNKNOWN",
}
interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
type LLMChunk =
  | { type: "text"; delta: string }
  | { type: "thinking"; delta: string }
  | { type: "error"; code: LLMErrorCode; message: string };
type ScriptStream = (
  input: string | LLMMessage[]
) => AsyncIterable<LLMChunk>;`

export const baseContext = `${dependencies}
interface BaseHookContext {
  readonly state: {
    readonly messages: readonly HistoryMessage[];
    readonly memories: readonly Memory[];
    readonly storyCards: readonly StoryCard[];
  };
  essentials: string;
  scriptState: string;
  kvMemory: {
    get<T = unknown>(key: string): T | undefined;
    set<T = unknown>(key: string, value: T): void;
    delete(key: string): void;
    all(): Record<string, unknown>;
  };
  readonly config: Readonly<ResolvedConfig>;
  ai: { stream: ScriptStream };
  console: {
    log:   (...args: unknown[]) => void,
    warn:  (...args: unknown[]) => void,
    error: (...args: unknown[]) => void,
  }
  stop(reason?: string): void;
}` as HookContext;

export const inputHookContext = `${baseContext}
interface InputHookContext extends BaseHookContext {
  input: string;
  inject(text: string): void;
}
declare const ctx: InputHookContext;` as HookContext;

export const buildContextHookContext = `${baseContext}
interface ContextMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
interface BuildContextHookContext extends BaseHookContext {
  messages: ContextMessage[];
  readonly estimatedTokens: number;
  readonly activeStoryCards: readonly StoryCard[];
}
declare const ctx: BuildContextHookContext;` as HookContext;

export const outputHookContext = `${baseContext}
interface OutputHookContext extends BaseHookContext {
  output: string;
  readonly rawOutput: string;
  addStoryCard(card: Omit<StoryCard, "id" | "createdAt" | "updatedAt">): void;
}
declare const ctx: OutputHookContext;` as HookContext;





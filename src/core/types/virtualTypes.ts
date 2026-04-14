export type HookContext = string;

export const baseContext = `
interface BaseHookContext {
  readonly state: {
    readonly messages: readonly {
      id: string;
      role: "user" | "assistant" | "system";
      parentId: string | null;
      text: string;
      thinkingBlocks: {
        id: string;
        messageId: string;
        content: string;
      }[];
      createdAt: number;
      editedAt?: number;
    }[];
    readonly memories: readonly {
      id: string;
      content: string;
      messageIds: string[];
      createdAt: number;
      editedAt?: number;
    }[];
    readonly storyCards: readonly {
      id: string;
      title: string;
      content: string;
      triggers: string[];
      tags: string[];
      enabled: boolean;
      createdAt: number;
      updatedAt: number;
    }[];
  };
  readonly currentTurnIds: {
    readonly user: string | null;
  };
  essentials: string;
  scriptState: string;
  addMemory(memory: {
    content: string;
    messageIds: string[];
  }): void;
  editMemory(id: string, content: string | ((prev: string) => string)): void;
  removeMemory(id: string): void;
  kvMemory: {
    get<T = unknown>(key: string): T | undefined;
    set<T = unknown>(key: string, value: T): void;
    delete(key: string): void;
    all(): Record<string, unknown>;
  };
  readonly config: Readonly<{
    providerId: string;
    endpoint: string;
    apiKey: string;
    model: string;
    authorNotes: string;
    params: {
      contextWindow: number;
      maxOutputTokens: number;
      temperature: number;
      topP: number;
      frequencyPenalty: number;
      presencePenalty: number;
      thinkingEnabled: boolean;
    };
    prompts: {
      defaultSystemPrompt: string;
      storyCardGeneratorPrompt: string;
      memoryGeneratorPrompt: string;
      scenarioGeneratorPrompt: string;
    };
  }>;
  ai: {
    stream: (
      input: string | {
        role: "system" | "user" | "assistant";
        content: string;
      }[]
    ) => AsyncIterable<
      | { type: "text"; delta: string }
      | { type: "thinking"; delta: string }
      | { type: "error"; code: string; message: string }
    >;
  };
  console: {
    log: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
  stop(reason?: string): void;
  cancel(reason?: string): void;
}` as HookContext;

export const inputHookContext = `${baseContext}
interface InputHookContext extends BaseHookContext {
  input: string;
  inject(text: string): void;
}
declare const ctx: InputHookContext;` as HookContext;

export const buildContextHookContext = `${baseContext}
interface BuildContextHookContext extends BaseHookContext {
  messages: {
    role: "system" | "user" | "assistant";
    content: string;
  }[];
  readonly estimatedTokens: number;
  readonly activeStoryCards: readonly {
    id: string;
    title: string;
    content: string;
    triggers: string[];
    tags: string[];
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
  }[];
}
declare const ctx: BuildContextHookContext;` as HookContext;

export const outputHookContext = `${baseContext}
interface OutputHookContext extends BaseHookContext {
  output: string;
  readonly rawOutput: string;
  readonly currentTurnIds: {
    readonly user: string | null;
    readonly assistant: string;
  };
  addStoryCard(card: {
    title: string;
    content: string;
    triggers: string[];
    tags: string[];
    enabled: boolean;
  }): void;
  editStoryCard(
    id: string, 
    card: {
      title: string;
      content: string;
      triggers: string[];
      tags: string[];
      enabled: boolean;
    } | 
    ((prev: {
      title: string;
      content: string;
      triggers: string[];
      tags: string[];
      enabled: boolean;
    }) => {
      title: string;
      content: string;
      triggers: string[];
      tags: string[];
      enabled: boolean;
    })
  ): void;
  removeStoryCard(id: string): void;
  suppressDefaultSummarizer: boolean;
}
declare const ctx: OutputHookContext;` as HookContext;
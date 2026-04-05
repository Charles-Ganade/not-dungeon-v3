import type { Scenario } from "@/core/types/scenarios";
import type { Story, StoryCard } from "@/core/types/stories";
import type { ScriptBundle } from "@/core/types/stories";
import type { ResolvedConfig } from "@/core/types/stories";
import type {
  InputHookContext,
  BuildContextHookContext,
  OutputHookContext,
  BaseHookContext,
} from "@/core/types/hooks";
import type { ContextMessage } from "@/core/types/hooks";
import type { ScriptStream } from "@/services/llm/types";
import type { HistoryMessage, Memory } from "@/core/types/stories";
import { RunnerApi, SandboxCallbacks } from "./script.worker";
import * as Comlink from "comlink";
import ScriptWorker from "./script.worker?worker";
import { unwrap } from "solid-js/store";

/**
 * Merges a scenario's full ScriptBundle with a story's partial
 * overrides. Rules:
 *   library    — concatenated (scenario first, then story)
 *   input      — story overrides scenario if non-empty
 *   buildContext — story overrides scenario if non-empty
 *   output     — story overrides scenario if non-empty
 */
export function mergeScriptBundle(
  scenario: Scenario | undefined,
  story: Pick<Story, "scripts">
): ScriptBundle {
  const base: ScriptBundle = scenario?.scripts ?? {
    library: "",
    input: "",
    buildContext: "",
    output: "",
  };

  const override = story.scripts;

  return {
    library: [base.library, override.library].filter(Boolean).join("\n\n"),
    input: override.input || base.input,
    buildContext: override.buildContext || base.buildContext,
    output: override.output || base.output,
  };
}

const SCRIPT_TIMEOUT_MS = 5000;

/**
 * Executes a hook script string with the given context object.
 * The library string is prepended so library-defined names are
 * available. Empty scripts are a no-op.
 *
 * Throws if the script exceeds SCRIPT_TIMEOUT_MS or throws itself.
 */
export async function runScript(
  library: string,
  hookScript: string,
  ctx: Record<string, any>
): Promise<void> {
  if (!hookScript.trim()) return;

  // 1. Spin up a fresh, isolated worker thread for this script execution
  const worker = new ScriptWorker();
  const api = Comlink.wrap<RunnerApi>(worker);

  // 2. Extract static/clonable data from the complex ctx object
  const ctxData = {
    state: ctx.state,
    config: ctx.config,
    essentials: ctx.essentials,
    scriptState: ctx.scriptState,
    currentTurnIds: ctx.currentTurnIds,
    input: ctx.input,
    messages: ctx.messages,
    estimatedTokens: ctx.estimatedTokens,
    activeStoryCards: ctx.activeStoryCards,
    output: ctx.output,
    rawOutput: ctx.rawOutput,
    suppressDefaultSummarizer: ctx.suppressDefaultSummarizer,
    kvMemoryData: ctx.kvMemory?.all() || {},
    _injected: ctx._injected || []
  };

  const streamHandlers = new Map<string, AsyncIterator<any>>();

  // 3. Define the callbacks that the worker can trigger via proxy
  const callbacks: SandboxCallbacks = {
    log: (...args) => ctx.console?.log(...args),
    warn: (...args) => ctx.console?.warn(...args),
    error: (...args) => ctx.console?.error(...args),
    stop: (reason) => ctx.stop?.(reason),
    startStream: async (input) => {
      const id = crypto.randomUUID();
      const iterable = ctx.ai.stream(input);
      streamHandlers.set(id, iterable[Symbol.asyncIterator]());
      return id;
    },
    streamNext: async (id) => {
      const iterator = streamHandlers.get(id);
      if (!iterator) return { done: true, value: undefined };
      const res = await iterator.next();
      if (res.done) streamHandlers.delete(id);
      return res;
    }
  };

  const proxyCallbacks = Comlink.proxy(callbacks);

  try {
    const resultPromise = api.execute(library, hookScript, unwrap(ctxData), proxyCallbacks);
    
    const result = await Promise.race([
      resultPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Script timed out after ${SCRIPT_TIMEOUT_MS}ms`)), SCRIPT_TIMEOUT_MS)
      ),
    ]);

    // 5. Apply the returned mutations back to the main thread's live ctx object
    if (result.essentials !== undefined) ctx.essentials = result.essentials;
    if (result.scriptState !== undefined) ctx.scriptState = result.scriptState;
    if (result.input !== undefined) ctx.input = result.input;
    if (result.output !== undefined) ctx.output = result.output;
    if (result.messages !== undefined) ctx.messages = result.messages;
    if (result.suppressDefaultSummarizer !== undefined) ctx.suppressDefaultSummarizer = result.suppressDefaultSummarizer;
    if (result._injected !== undefined) (ctx as any)._injected = result._injected;

    // Merge operations safely back into the context arrays
    if (result.memoriesOperations && ctx.memoriesOperations) {
        ctx.memoriesOperations.add.push(...result.memoriesOperations.add);
        ctx.memoriesOperations.edit.push(...result.memoriesOperations.edit);
        ctx.memoriesOperations.delete.push(...result.memoriesOperations.delete);
    }
    if (result.storyCardOperations && ctx.storyCardOperations) {
        ctx.storyCardOperations.add.push(...result.storyCardOperations.add);
        ctx.storyCardOperations.edit.push(...result.storyCardOperations.edit);
        ctx.storyCardOperations.delete.push(...result.storyCardOperations.delete);
    }

    if (ctx.kvMemory && result.kvMemoryData) {
      const oldKeys = Object.keys(ctx.kvMemory.all());
      for (const key of oldKeys) ctx.kvMemory.delete(key);
      for (const [k, v] of Object.entries(result.kvMemoryData)) {
        ctx.kvMemory.set(k, v);
      }
    }

  } finally {
    worker.terminate();
  }
}

interface StopFlag { stopped: boolean; reason: string }

function makeStopFlag(): StopFlag {
  return { stopped: false, reason: "" };
}

export type ScriptLogEntry = { level: "log" | "warn" | "error"; args: unknown[] };

function makeLogger(entries: ScriptLogEntry[], onLog?: (entry: ScriptLogEntry) => void) {
  const push = (entry: ScriptLogEntry) => {
    entries.push(entry);
    onLog?.(entry);
  };
  return {
    log:   (...args: unknown[]) => push({ level: "log",   args }),
    warn:  (...args: unknown[]) => push({ level: "warn",  args }),
    error: (...args: unknown[]) => push({ level: "error", args }),
  };
}

function makeMemoryProxy(bag: Record<string, unknown>) {
  return {
    get: <T = unknown>(key: string): T | undefined => bag[key] as T | undefined,
    set: <T = unknown>(key: string, value: T): void => { bag[key] = value; },
    delete: (key: string): void => { delete bag[key]; },
    all: (): Record<string, unknown> => ({ ...bag }),
  };
}

export interface StoryCardOperations {
  add: Omit<StoryCard, "id" | "createdAt" | "updatedAt">[];
  edit: {
    id: string;
    prev: StoryCard;
    next: Omit<StoryCard, "id" | "createdAt" | "updatedAt">;
  }[];
  delete: StoryCard[]
}

export interface MemoryOperations {
  add: Pick<Memory, "content" | "messageIds">[];
  edit: {
    id: string;
    prev: string;
  next: string;
  }[];
  delete: Memory[];
}

export interface HookContexts {
  input: InputHookContext & {
    memoriesOperations: MemoryOperations;
  };
  buildContext: (
    state: {
      memories: readonly Memory[];
      storyCards: readonly StoryCard[];
    },
    messages: ContextMessage[], 
    estimatedTokens: number, 
    activeStoryCards: StoryCard[],
    essentials: string,
    scriptState: string
  ) => BuildContextHookContext & {
    memoriesOperations: MemoryOperations;
  };
  output: (
    state: {
      memories: readonly Memory[];
      storyCards: readonly StoryCard[];
    },
    output: string, 
    rawOutput: string,
    essentials: string,
    scriptState: string
  ) => OutputHookContext & {
    storyCardOperations: StoryCardOperations,
    memoriesOperations: MemoryOperations;
  };
  stopFlag: StopFlag;
  logEntries: ScriptLogEntry[];
}

export function createHookContexts(params: {
  inputText: string;
  story: Story;
  activePath: HistoryMessage[];
  activeMemories: Memory[];
  config: ResolvedConfig;
  scriptStream: ScriptStream;
  essentials: string;
  scriptState: string;
  onLog?: (entry: ScriptLogEntry) => void;
  assistantMsgId: string;
  userMsgId: string | null;
}): HookContexts {
  
  const { inputText, story, activePath, activeMemories, config, scriptStream } = params;
 
  const stopFlag = makeStopFlag();
  const logEntries: ScriptLogEntry[] = [];
  const logger = makeLogger(logEntries, params.onLog);

  const stateSnapshot = Object.freeze({
    messages: Object.freeze([...activePath]),
    memories: Object.freeze([...activeMemories]),
    storyCards: Object.freeze([...story.storyCards]),
  });

  const storyCardOperations: StoryCardOperations = {
    add: [],
    edit: [],
    delete: [],
  }

  const memoryOperationsBuilder = (source: {
    memories: readonly Memory[];
    storyCards: readonly StoryCard[];
  }) => {
    const memoriesOperations: MemoryOperations = {
      add: [],
      edit: [],
      delete: []
    }
    const addMemory = (memory: Pick<Memory, "content" | "messageIds">) => { memoriesOperations.add.push(memory)}
    const editMemory = (id: string, content: string | ((prev: string) => string)) => {
      if (memoriesOperations.delete.some(m => m.id === id)) return;
      const pendingEdit = memoriesOperations.edit.find(e => e.id === id);
      const baseContent = pendingEdit 
        ? pendingEdit.next 
        : source.memories.find(m => m.id === id)?.content;
      if (baseContent === undefined) return;
      const nextContent = typeof content === "string" ? content : content(baseContent);
      if (pendingEdit) {
        pendingEdit.next = nextContent;
      } else {
        const prevMemory = source.memories.find(m => m.id === id)!;
        memoriesOperations.edit.push({id, prev: prevMemory.content, next: nextContent});
      }
    }
    const removeMemory = (id: string) => {
      const prevMemory = source.memories.find(m => m.id === id);
      if (!prevMemory) return;
      memoriesOperations.delete.push(prevMemory)
    }
    return {addMemory, editMemory, removeMemory, memoriesOperations}
  }

  const base = {
    state: stateSnapshot,
    kvMemory: makeMemoryProxy(story.kvMemory),
    config: Object.freeze(config),
    console: logger,
    stop: (reason = "") => { stopFlag.stopped = true; stopFlag.reason = reason; },
    ai: { stream: scriptStream },  
    essentials: params.essentials,
    scriptState: params.scriptState,
    currentTurnIds: {
      user: params.userMsgId
    }
  };

  const inputCtx = {
    ...base,
    input: inputText,
    inject: (_text: string) => {
    },
    ...memoryOperationsBuilder(base.state)
  };

  const injectedMessages: ContextMessage[] = [];
  inputCtx.inject = (text: string) => {
    injectedMessages.push({ role: "system", content: text });
  };
  (inputCtx as unknown as { _injected: ContextMessage[] })._injected = injectedMessages;

  const buildContextFn = (
    state: {
      memories: readonly Memory[];
      storyCards: readonly StoryCard[];
    },
    messages: ContextMessage[],
    estimatedTokens: number,
    activeStoryCards: StoryCard[], 
    essentials: string, 
    scriptState: string
  ) => ({
    ...base,
    state: {...base.state, ...state},
    messages,
    estimatedTokens,
    essentials,
    scriptState,
    activeStoryCards: Object.freeze([...activeStoryCards]),
    ...memoryOperationsBuilder(state)
  });

  const outputFn = (
    state: {
      memories: readonly Memory[];
      storyCards: readonly StoryCard[];
    },
    output: string, 
    rawOutput: string, 
    essentials: string, 
    scriptState: string
  ): OutputHookContext & {
    storyCardOperations: StoryCardOperations,
    memoriesOperations: MemoryOperations;
  } => ({
    ...base,
    currentTurnIds: {
      ...base.currentTurnIds,
      assistant: params.assistantMsgId
    },
    state: {...base.state, ...state},
    output,
    rawOutput,
    essentials,
    scriptState,
    ...memoryOperationsBuilder(state),
    addStoryCard: (card) => { storyCardOperations.add.push(card); },
    editStoryCard(id, card) {
      if (storyCardOperations.delete.some(m => m.id === id)) return;
      const pendingEdit = storyCardOperations.edit.find(e => e.id === id);
      const baseContent = pendingEdit 
        ? pendingEdit.next 
        : state.storyCards.find(s => s.id === id);
      if (!baseContent) return;
      const nextContent = typeof card === "function" ? card(baseContent) : card;
      if (pendingEdit) {
        pendingEdit.next = nextContent;
      } else {
        const prevCard = state.storyCards.find(m => m.id === id)!;
        storyCardOperations.edit.push({id, prev: prevCard, next: nextContent});
      }
    },
    suppressDefaultSummarizer: false,
    removeStoryCard(id) {
      const prevStoryCard = state.storyCards.find(c => c.id === id);
      if (!prevStoryCard) return;
      storyCardOperations.delete.push(prevStoryCard);
    },
    storyCardOperations
  });

  return {
    input: inputCtx,
    buildContext: buildContextFn,
    output: outputFn,
    stopFlag,
    logEntries,
  };
}
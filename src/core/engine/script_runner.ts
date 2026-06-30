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

export type ScriptPhase = "input" | "buildContext" | "output";

/**
 * Thrown when a hook exceeds its idle or absolute (ceiling) time budget.
 * The engine distinguishes this from a script throw to decide whether to
 * discard the turn or keep the already-streamed output.
 */
export class ScriptTimeoutError extends Error {
  constructor(
    public readonly phase: ScriptPhase,
    public readonly kind: "idle" | "ceiling",
    public readonly limitMs: number,
  ) {
    super(`Script ${phase} hook timed out (${kind}, ${limitMs}ms)`);
    this.name = "ScriptTimeoutError";
  }
}

export interface RunScriptOptions {
  /** The turn's abort signal. When it fires, the worker is torn down. */
  signal: AbortSignal;
  /** Which hook is running — used for error reporting. */
  phase: ScriptPhase;
  /**
   * Max ms with no observable progress before timing out. Paused while a
   * `ctx.ai` call is in flight, so slow model calls are never killed.
   */
  idleMs: number;
  /** Absolute ceiling (ms) for the whole hook, including model calls. */
  ceilingMs: number;
  /**
   * Builds a ScriptStream bound to a per-script signal, so a timeout or a
   * cancel actually aborts the underlying LLM request.
   */
  makeScriptStream: (signal: AbortSignal) => ScriptStream;
}

function abortError(): DOMException {
  return new DOMException("Aborted", "AbortError");
}

/**
 * How often the host watchdog re-evaluates the idle/ceiling budgets.
 * The check runs on the main thread, which the worker can never block.
 */
const WATCHDOG_INTERVAL_MS = 250;

/**
 * Executes a hook script string with the given context object.
 * The library string is prepended so library-defined names are
 * available. Empty scripts are a no-op.
 *
 * Throws ScriptTimeoutError if the hook exceeds its idle/ceiling budget,
 * AbortError if the turn is cancelled, or whatever the script itself throws.
 */
export async function runScript(
  library: string,
  hookScript: string,
  ctx: Record<string, any>,
  options: RunScriptOptions,
): Promise<void> {
  if (!hookScript.trim()) return;

  const { signal, phase, idleMs, ceilingMs, makeScriptStream } = options;
  if (signal.aborted) throw abortError();

  const worker = new ScriptWorker();
  const api = Comlink.wrap<RunnerApi>(worker);

  // Per-script abort, tripped by the turn signal (user cancel) or a timeout.
  // The script's AI calls bind to it, so an in-flight LLM fetch is aborted.
  const scriptAbort = new AbortController();
  const scriptStream = makeScriptStream(scriptAbort.signal);

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
    _injected: ctx._injected || [],
    pluginConfig: ctx.pluginConfig ?? null,
  };

  const streamHandlers = new Map<string, AsyncIterator<any>>();

  // Progress tracking for the idle watchdog. Any worker→host callback counts
  // as activity; AI calls pause the idle timer until they finish streaming.
  const startedAt = Date.now();
  let lastActivityAt = startedAt;
  let activeAiCalls = 0;
  const bump = () => { lastActivityAt = Date.now(); };

  const callbacks: SandboxCallbacks = {
    log: (...args) => { bump(); ctx.console?.log(...args); },
    warn: (...args) => { bump(); ctx.console?.warn(...args); },
    error: (...args) => { bump(); ctx.console?.error(...args); },
    stop: (reason) => ctx.stop?.(reason),
    cancel: (reason) => ctx.cancel?.(reason),
    startStream: async (input) => {
      bump();
      activeAiCalls++;
      const id = crypto.randomUUID();
      const iterable = scriptStream(input);
      streamHandlers.set(id, iterable[Symbol.asyncIterator]());
      return id;
    },
    streamNext: async (id) => {
      const iterator = streamHandlers.get(id);
      if (!iterator) return { done: true, value: undefined };
      const res = await iterator.next();
      bump();
      if (res.done) {
        streamHandlers.delete(id);
        activeAiCalls = Math.max(0, activeAiCalls - 1);
      }
      return res;
    }
  };

  const proxyCallbacks = Comlink.proxy(callbacks);

  let watchdog: ReturnType<typeof setInterval> | undefined;
  let onAbort: (() => void) | undefined;

  try {
    const execution = api.execute(library, hookScript, unwrap(ctxData), proxyCallbacks);

    const timeout = new Promise<never>((_, reject) => {
      watchdog = setInterval(() => {
        const now = Date.now();
        if (now - startedAt > ceilingMs) {
          reject(new ScriptTimeoutError(phase, "ceiling", ceilingMs));
        } else if (activeAiCalls === 0 && now - lastActivityAt > idleMs) {
          reject(new ScriptTimeoutError(phase, "idle", idleMs));
        }
      }, WATCHDOG_INTERVAL_MS);
    });

    const aborted = new Promise<never>((_, reject) => {
      onAbort = () => reject(abortError());
      signal.addEventListener("abort", onAbort, { once: true });
    });

    const result = await Promise.race([execution, timeout, aborted]);

    if (result.essentials !== undefined) ctx.essentials = result.essentials;
    if (result.scriptState !== undefined) ctx.scriptState = result.scriptState;
    if (result.input !== undefined) ctx.input = result.input;
    if (result.output !== undefined) ctx.output = result.output;
    if (result.messages !== undefined) ctx.messages = result.messages;
    if (result.suppressDefaultSummarizer !== undefined) ctx.suppressDefaultSummarizer = result.suppressDefaultSummarizer;
    if (result._injected !== undefined) (ctx as any)._injected = result._injected;

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
    if (watchdog !== undefined) clearInterval(watchdog);
    if (onAbort) signal.removeEventListener("abort", onAbort);
    // Abort any LLM fetch this script started and release host iterators,
    // then kill the worker. Safe to call on the normal-completion path too.
    scriptAbort.abort();
    for (const iterator of streamHandlers.values()) {
      iterator.return?.(undefined);
    }
    streamHandlers.clear();
    worker.terminate();
  }
}

interface StopFlag { stopped: boolean; canceled: boolean; reason: string }

function makeStopFlag(): StopFlag {
  return { stopped: false, canceled: false, reason: "" };
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
    storyCardOperations: StoryCardOperations;
    /**
     * System messages collected by `ctx.inject(...)` during the input hook.
     * Populated by the worker and read by the engine, which splices them
     * into the request after the default system prompt.
     */
    _injected: ContextMessage[];
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
    storyCardOperations: StoryCardOperations;
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

  type StoryCardInput = Omit<StoryCard, "id" | "createdAt" | "updatedAt">;

  const storyCardOperationsBuilder = (source: {
    memories: readonly Memory[];
    storyCards: readonly StoryCard[];
  }) => {
    const storyCardOperations: StoryCardOperations = {
      add: [],
      edit: [],
      delete: [],
    }
    const addStoryCard = (card: StoryCardInput) => { storyCardOperations.add.push(card); }
    const editStoryCard = (
      id: string,
      card: StoryCardInput | ((prev: StoryCardInput) => StoryCardInput),
    ) => {
      if (storyCardOperations.delete.some(m => m.id === id)) return;
      const pendingEdit = storyCardOperations.edit.find(e => e.id === id);
      const baseContent = pendingEdit
        ? pendingEdit.next
        : source.storyCards.find(s => s.id === id);
      if (!baseContent) return;
      const nextContent = typeof card === "function" ? card(baseContent) : card;
      if (pendingEdit) {
        pendingEdit.next = nextContent;
      } else {
        const prevCard = source.storyCards.find(m => m.id === id)!;
        storyCardOperations.edit.push({id, prev: prevCard, next: nextContent});
      }
    }
    const removeStoryCard = (id: string) => {
      const prevStoryCard = source.storyCards.find(c => c.id === id);
      if (!prevStoryCard) return;
      storyCardOperations.delete.push(prevStoryCard);
    }
    return {addStoryCard, editStoryCard, removeStoryCard, storyCardOperations}
  }

  const base = {
    state: stateSnapshot,
    kvMemory: makeMemoryProxy(story.kvMemory),
    config: Object.freeze(config),
    console: logger,
    stop: (reason = "") => { stopFlag.stopped = true; stopFlag.reason = reason; },
    cancel: (reason = "") => { stopFlag.canceled = true; stopFlag.reason = reason; },
    ai: { stream: scriptStream },
    essentials: params.essentials,
    scriptState: params.scriptState,
    // Any hook may suppress the end-of-turn summarizer; the engine ORs the
    // per-phase values, so the turn is summarized only if no hook opted out.
    suppressDefaultSummarizer: false,
    currentTurnIds: {
      user: params.userMsgId
    }
  };

  const injectedMessages: ContextMessage[] = [];
  const inputCtx = {
    ...base,
    input: inputText,
    inject: (text: string) => {
      injectedMessages.push({ role: "system", content: text });
    },
    _injected: injectedMessages,
    ...memoryOperationsBuilder(base.state),
    ...storyCardOperationsBuilder(base.state),
  };

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
    ...memoryOperationsBuilder(state),
    ...storyCardOperationsBuilder(state),
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
    ...storyCardOperationsBuilder(state),
  });

  return {
    input: inputCtx,
    buildContext: buildContextFn,
    output: outputFn,
    stopFlag,
    logEntries,
  };
}
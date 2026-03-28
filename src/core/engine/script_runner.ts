import type { Scenario } from "@/core/types/scenarios";
import type { Story, StoryCard } from "@/core/types/stories";
import type { ScriptBundle } from "@/core/types/stories";
import type { ResolvedConfig } from "@/core/types/stories";
import type {
  InputHookContext,
  BuildContextHookContext,
  OutputHookContext,
} from "@/core/types/hooks";
import type { ContextMessage } from "@/core/types/hooks";
import type { ScriptStream } from "@/services/llm/types";
import type { HistoryMessage, Memory } from "@/core/types/stories";

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
  ctx: Record<string, unknown>
): Promise<void> {
  if (!hookScript.trim()) return;

  const code = [library, hookScript].filter(Boolean).join("\n\n");

  // Wrap in an async IIFE so scripts can use await freely.
  // All argument names besides `ctx` are shadowed to prevent
  // access to globals via the argument list trick.
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const fn = new AsyncFunction(
    "ctx",
    // Shadow common escape hatches
    "window", "document", "globalThis", "self", "fetch", "XMLHttpRequest",
    `"use strict";\n${code}`
  ) as (...args: unknown[]) => Promise<void>;

  await Promise.race([
    fn(ctx, undefined, undefined, undefined, undefined, undefined, undefined),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Script timed out after ${SCRIPT_TIMEOUT_MS}ms`)),
        SCRIPT_TIMEOUT_MS
      )
    ),
  ]);
}

interface StopFlag { stopped: boolean; reason: string }

function makeStopFlag(): StopFlag {
  return { stopped: false, reason: "" };
}

export type ScriptLogEntry = { level: "log" | "warn" | "error"; args: unknown[] };

function makeLogger(entries: ScriptLogEntry[]) {
  return {
    log: (...args: unknown[]) => entries.push({ level: "log", args }),
    warn: (...args: unknown[]) => entries.push({ level: "warn", args }),
    error: (...args: unknown[]) => entries.push({ level: "error", args }),
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

export interface HookContexts {
  input: InputHookContext;
  buildContext: (messages: ContextMessage[], estimatedTokens: number, activeStoryCards: StoryCard[]) => BuildContextHookContext;
  output: (output: string, rawOutput: string) => OutputHookContext;
  stopFlag: StopFlag;
  logEntries: ScriptLogEntry[];
  pendingStoryCards: Omit<StoryCard, "id" | "createdAt" | "updatedAt">[];
}

export function createHookContexts(params: {
  inputText: string;
  story: Story;
  activePath: HistoryMessage[];
  activeMemories: Memory[];
  config: ResolvedConfig;
  scriptStream: ScriptStream;
}): HookContexts {
  const { inputText, story, activePath, activeMemories, config, scriptStream } = params;

  const stopFlag = makeStopFlag();
  const logEntries: ScriptLogEntry[] = [];
  const logger = makeLogger(logEntries);
  const memory = makeMemoryProxy(story.memory);
  const pendingStoryCards: Omit<StoryCard, "id" | "createdAt" | "updatedAt">[] = [];

  // Immutable state snapshot scripts can inspect
  const stateSnapshot = Object.freeze({
    messages: Object.freeze([...activePath]),
    memories: Object.freeze([...activeMemories]),
    storyCards: Object.freeze([...story.storyCards]),
  });

  const base = {
    state: stateSnapshot,
    memory,
    config: Object.freeze(config),
    log: logger.log,
    stop: (reason = "") => { stopFlag.stopped = true; stopFlag.reason = reason; },
    ai: { stream: scriptStream },
  };

  // Mutable input box — the script can reassign ctx.input
  const inputCtx: InputHookContext = {
    ...base,
    input: inputText,
    inject: (_text: string) => {
      // Injected messages are queued here; the engine reads them back
      // from inputCtx after the hook runs.
    },
  };

  // Injected messages collected by inject()
  const injectedMessages: ContextMessage[] = [];
  inputCtx.inject = (text: string) => {
    injectedMessages.push({ role: "system", content: text });
  };
  (inputCtx as unknown as { _injected: ContextMessage[] })._injected = injectedMessages;

  const buildContextFn = (
    messages: ContextMessage[],
    estimatedTokens: number,
    activeStoryCards: StoryCard[]
  ): BuildContextHookContext => ({
    ...base,
    messages,
    estimatedTokens,
    activeStoryCards: Object.freeze([...activeStoryCards]),
  });

  const outputFn = (output: string, rawOutput: string): OutputHookContext => ({
    ...base,
    output,
    rawOutput,
    addStoryCard: (card) => { pendingStoryCards.push(card); },
  });

  return {
    input: inputCtx,
    buildContext: buildContextFn,
    output: outputFn,
    stopFlag,
    logEntries,
    pendingStoryCards,
  };
}
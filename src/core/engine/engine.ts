import { createSignal } from "solid-js";
import { sessionStore, configStore, settingsStore, pluginsStore } from "@/store/";
import { resolvePluginConfig } from "@/core/utils/pluginIO";
import type { InstalledPlugin } from "@/core/types/plugins";
import {
  stream as llmStream,
  createScriptStream,
  LLMChunk,
  LLMMessage,
  ScriptStream,
} from "@/services/llm";
import { buildDefaultContext } from "./context_builder";
import {
  mergeScriptBundle,
  runScript,
  createHookContexts,
  ScriptLogEntry,
  ScriptTimeoutError,
  MemoryOperations,
  StoryCardOperations,
} from "./script_runner";
import type { HistoryMessage, ThinkingBlock } from "@/core/types/stories";
import type { ContextMessage } from "@/core/types/hooks";
import { summarizeHistory } from "./summarizer";
import { unwrap } from "solid-js/store";

const [streamingText, setStreamingText] = createSignal("");
const [streamingThinking, setStreamingThinking] = createSignal("");

export { streamingText, streamingThinking };

let _abortController: AbortController | null = null;

export function cancel(): void {
  _abortController?.abort();
}

function newMessage(
  overrides: Partial<HistoryMessage> &
    Pick<HistoryMessage, "role" | "text" | "parentId">,
): HistoryMessage {
  return {
    id: crypto.randomUUID(),
    thinkingBlocks: [],
    createdAt: Date.now(),
    ...overrides,
  };
}

function clearStreaming(): void {
  setStreamingText("");
  setStreamingThinking("");
}

const resolveMemoryOperations = (operations: MemoryOperations) => {
  for (const memoryAdd of operations.add) {
    sessionStore.enqueue({
      type: "memory:add",
      memory: {
        ...memoryAdd,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        editedAt: Date.now(),
      },
    });
  }
  for (const memoryEdit of operations.edit) {
    const { id, prev, next } = memoryEdit;
    sessionStore.enqueue({
      type: "memory:edit",
      memoryId: id,
      prev,
      next,
    });
  }
  for (const memoryRemove of operations.delete) {
    sessionStore.enqueue({
      type: "memory:remove",
      memory: memoryRemove,
    });
  }
};

const resolveStoryOperations = (operations: StoryCardOperations) => {
  for (const card of operations.add) {
    sessionStore.enqueue({
      type: "storyCard:add",
      card: {
        ...card,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    });
  }

  for (const cardEdit of operations.edit) {
    const { id, prev, next } = cardEdit;
    sessionStore.enqueue({
      type: "storyCard:edit",
      cardId: id,
      prev,
      next,
    });
  }

  for (const cardDelete of operations.delete) {
    sessionStore.enqueue({
      type: "storyCard:remove",
      card: cardDelete,
    });
  }
};

/**
 * Creates a fresh state snapshot from the current sessionStore.
 * Used after each script phase to ensure the next phase sees mutations.
 */
function getCurrentStateSnapshot() {
  const story = sessionStore.story;
  return {
    memories: Object.freeze([...sessionStore.activeMemories]),
    storyCards: Object.freeze([...(story?.storyCards ?? [])]),
  };
}

/**
 * Runs the full generation pipeline from a given parent message ID.
 * Used by both run() and retry().
 *
 * @param parentId  The message the new assistant response hangs off.
 * @param userMsg   The user message to enqueue first (null for retry).
 */
async function generate(options: {
  parentId: string | null;
  userMsg: HistoryMessage | null;
  notes?: string;
  txDescription: string;
  onLog?: (entry: ScriptLogEntry) => void;
  onChunk?: (chunk: LLMChunk) => void;
}): Promise<void> {
  let parentId = options.parentId;
  const { userMsg, notes, txDescription, onLog, onChunk } = options;
  const story = sessionStore.story;
  const config = configStore.config;

  if (!story || !config) return;
  if (sessionStore.isGenerating) return;

  _abortController = new AbortController();
  const { signal } = _abortController;

  sessionStore.setGenerating(true);
  sessionStore.beginTransaction(txDescription);

  const scriptBundle = mergeScriptBundle(
    story.scenarioId
      ? await import("@/store/library").then((m) =>
          m.libraryStore.scenarios.find((s) => s.id === story.scenarioId),
        )
      : undefined,
    story,
  );

  const makeScriptStream = (streamSignal: AbortSignal): ScriptStream =>
    createScriptStream(
      config.providerId,
      config.endpoint,
      config.apiKey,
      config.model,
      {
        model: config.model,
        params: config.params,
      },
      streamSignal,
    );

  const scriptStream = makeScriptStream(signal);

  const scriptRunOptions = (phase: "input" | "buildContext" | "output") => ({
    signal,
    phase,
    idleMs: settingsStore.settings.Scripts.idleTimeoutMs,
    ceilingMs: settingsStore.settings.Scripts.maxTimeoutMs,
    makeScriptStream,
  });

  // Resolve the story's enabled plugins against the installed set once for the
  // whole turn (so a missing plugin is logged only once, not per phase).
  const pluginRuns = (story.enabledPlugins ?? [])
    .filter((e) => e.enabled)
    .map((e) => {
      const manifest = pluginsStore.installed.find((p) => p.id === e.pluginId);
      if (!manifest) {
        onLog?.({
          level: "warn",
          args: [`Enabled plugin "${e.pluginId}" is not installed; skipping.`],
        });
        return null;
      }
      return { manifest, config: resolvePluginConfig(manifest, e) };
    })
    .filter(
      (r): r is { manifest: InstalledPlugin; config: Record<string, unknown> } =>
        r !== null,
    );

  /**
   * Runs one hook phase: the scenario/story script first, then each enabled
   * plugin in order (the outer layer). State threads through the shared
   * `hookCtx` via runScript's write-back; each plugin sees its own
   * `ctx.pluginConfig`. Stops early if a script halts/cancels the turn.
   * Errors (incl. ScriptTimeoutError) propagate to the caller.
   */
  const runPhaseWithPlugins = async (
    phase: "input" | "buildContext" | "output",
    library: string,
    hookScript: string,
    hookCtx: Record<string, unknown>,
  ): Promise<void> => {
    await runScript(library, hookScript, hookCtx, scriptRunOptions(phase));

    for (const run of pluginRuns) {
      if (hookCtxs.stopFlag.stopped || hookCtxs.stopFlag.canceled) break;
      const code = run.manifest.hooks[phase];
      if (!code || !code.trim()) continue;
      hookCtx.pluginConfig = run.config;
      try {
        await runScript(
          run.manifest.hooks.library ?? "",
          code,
          hookCtx,
          scriptRunOptions(phase),
        );
      } finally {
        hookCtx.pluginConfig = undefined;
      }
    }
  };

  let activePath = sessionStore.activePath;
  let activeMemories = sessionStore.activeMemories;

  const finalUserMsgId = userMsg ? crypto.randomUUID() : null;
  const assistantMsgId = crypto.randomUUID();

  const hookCtxs = createHookContexts({
    inputText: userMsg?.text ?? "",
    story: unwrap(story),
    activePath,
    activeMemories,
    config,
    scriptStream,
    essentials: story.essentials,
    scriptState: story.scriptState,
    onLog,
    userMsgId: finalUserMsgId,
    assistantMsgId,
  });

  try {
    if (userMsg) {
      const prevEssentials = story.essentials;
      const prevScriptState = story.scriptState;
      await runPhaseWithPlugins(
        "input",
        scriptBundle.library,
        scriptBundle.input,
        hookCtxs.input as unknown as Record<string, unknown>,
      );

      if (hookCtxs.stopFlag.canceled) {
        sessionStore.rollback();
        return;
      }

      if (hookCtxs.input.essentials !== prevEssentials) {
        sessionStore.enqueue({
          type: "essentials:edit",
          prev: prevEssentials,
          next: hookCtxs.input.essentials,
        });
      }

      if (hookCtxs.input.scriptState !== prevScriptState) {
        sessionStore.enqueue({
          type: "scriptState:edit",
          prev: prevScriptState,
          next: hookCtxs.input.scriptState,
        });
      }

      const finalUserMsg = newMessage({
        ...userMsg,
        text: hookCtxs.input.input,
        parentId,
        id: finalUserMsgId!,
      });
      sessionStore.enqueue({ type: "message:add", message: finalUserMsg });

      if (settingsStore.settings.Game.countInputsAsActions) {
        sessionStore.commit();
        sessionStore.beginTransaction(txDescription + "-Assistant");
      }

      parentId = finalUserMsg.id;

      resolveMemoryOperations(hookCtxs.input.memoriesOperations);

      if (hookCtxs.stopFlag.stopped) {
        sessionStore.commit();
        return;
      }
    }

    activePath = sessionStore.activePath;
    activeMemories = sessionStore.activeMemories;

    let defaultCtx = buildDefaultContext({
      activePath,
      activeMemories,
      storyCards: story.storyCards,
      instructions: story.instructions,
      essentials: hookCtxs.input.essentials,
      config,
      injectedMessages: hookCtxs.input._injected,
    });

    if (defaultCtx.hasOverflow) {
      onLog?.({
        level: "warn",
        args: [
          `Context overflow detected. Triggering emergency summarization to compress history.`,
        ],
      });

      const autoMemory = await summarizeHistory();
      if (autoMemory) {
        sessionStore.enqueue({
          type: "memory:add",
          memory: {
            ...autoMemory,
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            editedAt: Date.now(),
          },
        });

        activeMemories = sessionStore.activeMemories;
        defaultCtx = buildDefaultContext({
          activePath,
          activeMemories,
          storyCards: story.storyCards,
          instructions: story.instructions,
          essentials: hookCtxs.input.essentials,
          config,
          injectedMessages: hookCtxs.input._injected,
        });
      }
    }

    const buildCtx = hookCtxs.buildContext(
      getCurrentStateSnapshot(),
      defaultCtx.messages as ContextMessage[],
      defaultCtx.estimatedTokens,
      defaultCtx.activeStoryCards,
      hookCtxs.input.essentials,
      hookCtxs.input.scriptState,
    );

    await runPhaseWithPlugins(
      "buildContext",
      scriptBundle.library,
      scriptBundle.buildContext,
      buildCtx as unknown as Record<string, unknown>,
    );

    if (hookCtxs.stopFlag.canceled) {
      sessionStore.rollback();
      return;
    }

    if (buildCtx.essentials !== hookCtxs.input.essentials) {
      sessionStore.enqueue({
        type: "essentials:edit",
        prev: hookCtxs.input.essentials,
        next: buildCtx.essentials,
      });
    }

    if (buildCtx.scriptState !== hookCtxs.input.scriptState) {
      sessionStore.enqueue({
        type: "scriptState:edit",
        prev: hookCtxs.input.scriptState,
        next: buildCtx.scriptState,
      });
    }

    resolveMemoryOperations(buildCtx.memoriesOperations);

    if (hookCtxs.stopFlag.stopped) {
      sessionStore.commit();
      return;
    }

    if (notes && buildCtx.messages && buildCtx.messages.length > 0) {
      const length = buildCtx.messages.length;
      const last = buildCtx.messages[length - 1];
      last.content += `\n\n[SPECIAL NOTES]\n${notes}\n`;
      buildCtx.messages[length - 1] = last;
    }

    const outputStateSnapshot = getCurrentStateSnapshot();

    let accText = "";
    let accThinking = "";
    const thinkingBlocks: ThinkingBlock[] = [];
    let currentThinkingId: string | null = null;

    setStreamingText("");
    setStreamingThinking("");

    for await (const chunk of llmStream(
      config.providerId,
      {
        model: config.model,
        messages: buildCtx.messages as LLMMessage[],
        params: config.params,
      },
      config.endpoint,
      config.apiKey,
      signal,
    )) {
      onChunk?.(chunk);
      if (chunk.type === "text") {
        accText += chunk.delta;
        setStreamingText(accText);
      } else if (chunk.type === "thinking") {
        accThinking += chunk.delta;
        setStreamingThinking(accThinking);
        if (!currentThinkingId) currentThinkingId = crypto.randomUUID();
      } else if (chunk.type === "error") {
        clearStreaming();
        sessionStore.rollback();
        throw new Error(`[${chunk.code}] ${chunk.message}`);
      }
    }

    if (accThinking && currentThinkingId) {
      thinkingBlocks.push({
        id: currentThinkingId,
        messageId: "",
        content: accThinking,
      });
    }

    const outputCtx = hookCtxs.output(
      outputStateSnapshot,
      accText,
      accText,
      buildCtx.essentials,
      buildCtx.scriptState,
    );
    // If the output hook times out, the model response has already streamed,
    // so we keep that raw output and skip the hook's pending mutations rather
    // than discarding the whole (already-paid-for) turn.
    let outputTimedOut = false;
    try {
      await runPhaseWithPlugins(
        "output",
        scriptBundle.library,
        scriptBundle.output,
        outputCtx as unknown as Record<string, unknown>,
      );
    } catch (err) {
      if (err instanceof ScriptTimeoutError) {
        outputTimedOut = true;
        onLog?.({
          level: "warn",
          args: [
            `Output hook timed out (${err.kind}, ${err.limitMs}ms). Keeping the raw model output and skipping the hook's pending changes.`,
          ],
        });
      } else {
        throw err;
      }
    }

    if (!outputTimedOut && hookCtxs.stopFlag.canceled) {
      clearStreaming();
      sessionStore.rollback();
      return;
    }

    if (!outputTimedOut && outputCtx.essentials !== buildCtx.essentials) {
      sessionStore.enqueue({
        type: "essentials:edit",
        prev: buildCtx.essentials,
        next: outputCtx.essentials,
      });
    }

    if (!outputTimedOut && outputCtx.scriptState !== buildCtx.scriptState) {
      sessionStore.enqueue({
        type: "scriptState:edit",
        prev: buildCtx.scriptState,
        next: outputCtx.scriptState,
      });
    }

    for (const block of thinkingBlocks) {
      block.messageId = assistantMsgId;
    }

    const assistantMsg = newMessage({
      id: assistantMsgId,
      role: "assistant",
      text: outputTimedOut ? accText : outputCtx.output,
      parentId,
      thinkingBlocks,
      steeringNotes: notes,
    });

    sessionStore.enqueue({ type: "message:add", message: assistantMsg });

    if (!outputTimedOut) {
      resolveMemoryOperations(outputCtx.memoriesOperations);
      resolveStoryOperations(outputCtx.storyCardOperations);
    }

    if (!outputTimedOut && hookCtxs.stopFlag.stopped) {
      sessionStore.commit();
      return;
    }

    if (!outputCtx.suppressDefaultSummarizer) {
      const autoMemory = await summarizeHistory();
      if (autoMemory) {
        sessionStore.enqueue({
          type: "memory:add",
          memory: {
            ...autoMemory,
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            editedAt: Date.now(),
          },
        });
      }
    }

    sessionStore.commit();
  } catch (err) {
    clearStreaming();
    if (sessionStore.session?.pendingTransactionId) {
      sessionStore.rollback();
    }
    if (err instanceof ScriptTimeoutError) {
      onLog?.({
        level: "error",
        args: [
          `Script ${err.phase} hook timed out (${err.kind}, ${err.limitMs}ms). Turn discarded.`,
        ],
      });
      return;
    }
    if (err instanceof DOMException && err.name === "AbortError") {
      // Turn cancelled by the user — already rolled back, stay silent.
      return;
    }
    throw err;
  } finally {
    clearStreaming();
    sessionStore.setGenerating(false);
    _abortController = null;
  }
}

/**
 * Runs a full turn: adds a user message then generates a response.
 */
export async function run(
  input: string,
  onLog?: (entry: ScriptLogEntry) => void,
  onChunk?: (chunk: LLMChunk) => void,
): Promise<void> {
  const story = sessionStore.story;
  if (!story) return;

  const userMsg = newMessage({
    role: "user",
    text: input,
    parentId: story.currentLeafId,
  });
  await generate({
    parentId: story.currentLeafId,
    userMsg,
    txDescription: `Turn: "${userMsg.text.slice(0, 50)}"`,
    onLog,
    onChunk,
  });
}

/**
 * Generates a new response as a sibling of the current leaf,
 * without adding a new user message.
 *
 * The current leaf stays in the tree; the new response becomes
 * the active branch (currentLeafId updates via message:add delta).
 */
export async function retry(options: {
  notes?: string;
  onLog?: (entry: ScriptLogEntry) => void;
  onChunk?: (entry: LLMChunk) => void;
}): Promise<void> {
  const { notes, onLog, onChunk } = options;
  const story = sessionStore.story;
  if (!story || !story.currentLeafId) return;

  const currentLeaf = story.messages.find((m) => m.id === story.currentLeafId);
  if (!currentLeaf) return;

  sessionStore.switchBranch(currentLeaf.parentId!);

  await generate({
    parentId: currentLeaf.parentId,
    userMsg: null,
    notes,
    txDescription: `Retry from message ${currentLeaf.parentId}`,
    onLog,
    onChunk,
  });
}

export async function continueStory(options: {
  notes?: string;
  onLog?: (entry: ScriptLogEntry) => void;
  onChunk?: (entry: LLMChunk) => void;
}): Promise<void> {
  const { notes, onLog, onChunk } = options;
  const story = sessionStore.story;
  if (!story || !story.currentLeafId) return;

  const currentLeaf = story.messages.find((m) => m.id === story.currentLeafId);
  if (!currentLeaf) return;

  await generate({
    parentId: currentLeaf.id,
    userMsg: null,
    notes,
    txDescription: `Continue from message ${currentLeaf.id}`,
    onLog,
    onChunk,
  });
}

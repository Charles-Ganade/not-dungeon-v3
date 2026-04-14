import { createSignal } from "solid-js";
import { sessionStore, configStore } from "@/store/";
import { stream as llmStream, createScriptStream, LLMChunk, LLMMessage } from "@/services/llm";
import { buildDefaultContext } from "./context_builder";
import { mergeScriptBundle, runScript, createHookContexts, ScriptLogEntry, MemoryOperations, StoryCardOperations } from "./script_runner";
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
  overrides: Partial<HistoryMessage> & Pick<HistoryMessage, "role" | "text" | "parentId">
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
    const {id, prev, next} = memoryEdit;
    sessionStore.enqueue({
      type: "memory:edit",
      memoryId: id,
      prev,
      next
    })
  }
  for (const memoryRemove of operations.delete) {
    sessionStore.enqueue({
      type: "memory:remove",
      memory: memoryRemove
    })
  }
}

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
    const {id, prev, next} = cardEdit;
    sessionStore.enqueue({
      type: "storyCard:edit",
      cardId: id,
      prev,
      next
    })
  }

  for (const cardDelete of operations.delete) {
    sessionStore.enqueue({
      type: "storyCard:remove",
      card: cardDelete
    })
  }
}

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
async function generate(
  parentId: string | null,
  userMsg: HistoryMessage | null,
  txDescription: string,
  onLog?: (entry: ScriptLogEntry) => void,
  onChunk?: (chunk: LLMChunk) => void
): Promise<void> {
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
      ? (await import("@/store/library").then((m) =>
          m.libraryStore.scenarios.find((s) => s.id === story.scenarioId)
        ))
      : undefined,
    story
  );

  const scriptStream = createScriptStream(
    config.providerId,
    config.endpoint,
    config.apiKey,
    config.model,
    {
      model: config.model,
      params: config.params,
    },
    signal
  );

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
    assistantMsgId
  });

  try {
    if (userMsg) {
      const prevEssentials = story.essentials;
      const prevScriptState = story.scriptState;
      await runScript(scriptBundle.library, scriptBundle.input, hookCtxs.input as unknown as Record<string, unknown>);

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
        id: finalUserMsgId!
      });
      sessionStore.enqueue({ type: "message:add", message: finalUserMsg });
      parentId = finalUserMsg.id;

      resolveMemoryOperations(hookCtxs.input.memoriesOperations);

      if (hookCtxs.stopFlag.stopped) {
        sessionStore.commit();
        return;
      }
    }

    activePath = sessionStore.activePath;
    activeMemories = sessionStore.activeMemories;

    const defaultCtx = buildDefaultContext({
      activePath,
      activeMemories,
      storyCards: story.storyCards,
      instructions: story.instructions,
      essentials: hookCtxs.input.essentials,
      config,
    });

    const buildCtx = hookCtxs.buildContext(
      getCurrentStateSnapshot(),
      defaultCtx.messages as ContextMessage[],
      defaultCtx.estimatedTokens,
      defaultCtx.activeStoryCards,
      hookCtxs.input.essentials,
      hookCtxs.input.scriptState,
    );

    await runScript(scriptBundle.library, scriptBundle.buildContext, buildCtx as unknown as Record<string, unknown>);

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
      signal
    )) {
      onChunk?.(chunk)
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
    await runScript(scriptBundle.library, scriptBundle.output, outputCtx as unknown as Record<string, unknown>);

    if (hookCtxs.stopFlag.canceled) {
      clearStreaming();
      sessionStore.rollback();
      return;
    }

    if (outputCtx.essentials !== buildCtx.essentials) {
      sessionStore.enqueue({
        type: "essentials:edit",
        prev: buildCtx.essentials,
        next: outputCtx.essentials,
      });
    }

    if (outputCtx.scriptState !== buildCtx.scriptState) {
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
      text: outputCtx.output,
      parentId,
      thinkingBlocks,
    });

    sessionStore.enqueue({ type: "message:add", message: assistantMsg });

    resolveMemoryOperations(outputCtx.memoriesOperations);
    resolveStoryOperations(outputCtx.storyCardOperations);

    if (hookCtxs.stopFlag.stopped) {
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
export async function run(input: string, onLog?: (entry: ScriptLogEntry) => void, onChunk?: (chunk: LLMChunk) => void): Promise<void> {
  const story = sessionStore.story;
  if (!story) return;

  const userMsg = newMessage({
    role: "user",
    text: input,
    parentId: story.currentLeafId,
  });
  await generate(story.currentLeafId, userMsg,`Turn: "${userMsg.text.slice(0, 50)}"`, onLog, onChunk);
}

/**
 * Generates a new response as a sibling of the current leaf,
 * without adding a new user message.
 *
 * The current leaf stays in the tree; the new response becomes
 * the active branch (currentLeafId updates via message:add delta).
 */
export async function retry(onLog?: (entry: ScriptLogEntry) => void, onChunk?: (entry: LLMChunk) => void): Promise<void> {
  const story = sessionStore.story;
  if (!story || !story.currentLeafId) return;

  const currentLeaf = story.messages.find((m) => m.id === story.currentLeafId);
  if (!currentLeaf) return;

  sessionStore.switchBranch(currentLeaf.parentId!);

  await generate(currentLeaf.parentId, null,`Retry from message ${currentLeaf.parentId}`, onLog, onChunk);
}

export async function continueStory(onLog?: (entry: ScriptLogEntry) => void, onChunk?: (chunk: LLMChunk) => void): Promise<void> {
  const story = sessionStore.story;
  if (!story || !story.currentLeafId) return;

  const currentLeaf = story.messages.find((m) => m.id === story.currentLeafId);
  if (!currentLeaf) return;

  await generate(currentLeaf.id, null,`Continue from message ${currentLeaf.id}`, onLog, onChunk);
}
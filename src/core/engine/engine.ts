import { createSignal } from "solid-js";
import { sessionStore, configStore } from "@/store/";
import { stream as llmStream, createScriptStream } from "@/services/llm";
import { buildDefaultContext } from "./context_builder";
import { mergeScriptBundle, runScript, createHookContexts } from "./script_runner";
import type { HistoryMessage, ThinkingBlock } from "@/core/types/stories";
import type { ContextMessage } from "@/core/types/hooks";

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

/**
 * Runs the full generation pipeline from a given parent message ID.
 * Used by both run() and retry().
 *
 * @param parentId  The message the new assistant response hangs off.
 * @param userMsg   The user message to enqueue first (null for retry).
 */
async function generate(
  parentId: string | null,
  userMsg: HistoryMessage | null
): Promise<void> {
  const story = sessionStore.story;
  const config = configStore.config;

  if (!story || !config) return;
  if (sessionStore.isGenerating) return;

  _abortController = new AbortController();
  const { signal } = _abortController;

  sessionStore.setGenerating(true);
  const txDescription = userMsg
    ? `Turn: "${userMsg.text.slice(0, 50)}"`
    : `Retry from message ${parentId}`;
  sessionStore.beginTransaction(txDescription);

  const scriptBundle = mergeScriptBundle(
    // Resolve the scenario from the library store (already in memory)
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

  const activePath = sessionStore.activePath;
  const activeMemories = sessionStore.activeMemories;

  const hookCtxs = createHookContexts({
    inputText: userMsg?.text ?? "",
    story,
    activePath,
    activeMemories,
    config,
    scriptStream,
  });

  try {
    if (userMsg) {
      await runScript(scriptBundle.library, scriptBundle.input, hookCtxs.input as unknown as Record<string, unknown>);

      if (hookCtxs.stopFlag.stopped) {
        sessionStore.rollback();
        return;
      }

      // Enqueue the (possibly mutated) user message
      const finalUserMsg = newMessage({
        ...userMsg,
        text: hookCtxs.input.input,
        parentId,
      });
      sessionStore.enqueue({ type: "message:add", message: finalUserMsg });
      parentId = finalUserMsg.id;
    }

    // Run default builder first, then let script mutate the result.
    const defaultCtx = buildDefaultContext({
      activePath: sessionStore.activePath, // re-read: user msg was just added
      activeMemories,
      storyCards: story.storyCards,
      config,
    });

    const buildCtx = hookCtxs.buildContext(
      defaultCtx.messages as ContextMessage[],
      defaultCtx.estimatedTokens,
      defaultCtx.activeStoryCards
    );

    await runScript(scriptBundle.library, scriptBundle.buildContext, buildCtx as unknown as Record<string, unknown>);

    if (hookCtxs.stopFlag.stopped) {
      sessionStore.rollback();
      return;
    }

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
        messages: buildCtx.messages as import("@/services/llm/types").LLMMessage[],
        params: config.params,
      },
      config.endpoint,
      config.apiKey,
      signal
    )) {
      if (chunk.type === "text") {
        accText += chunk.delta;
        setStreamingText(accText);
      } else if (chunk.type === "thinking") {
        accThinking += chunk.delta;
        setStreamingThinking(accThinking);
        // Each contiguous thinking stream is one block
        if (!currentThinkingId) currentThinkingId = crypto.randomUUID();
      } else if (chunk.type === "error") {
        clearStreaming();
        sessionStore.rollback();
        // Re-throw so callers (or the UI) can surface the error
        throw new Error(`[${chunk.code}] ${chunk.message}`);
      }
    }

    // Finalize thinking blocks
    if (accThinking && currentThinkingId) {
      thinkingBlocks.push({
        id: currentThinkingId,
        messageId: "", // filled in below after we have the message id
        content: accThinking,
      });
    }

    const outputCtx = hookCtxs.output(accText, accText);
    await runScript(scriptBundle.library, scriptBundle.output, outputCtx as unknown as Record<string, unknown>);

    if (hookCtxs.stopFlag.stopped) {
      clearStreaming();
      sessionStore.rollback();
      return;
    }

    const assistantMsgId = crypto.randomUUID();

    // Fix up thinking block messageId references
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

    // Enqueue any story cards added by the onOutput hook
    for (const cardDef of hookCtxs.pendingStoryCards) {
      sessionStore.enqueue({
        type: "storyCard:add",
        card: {
          ...cardDef,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      });
    }

    sessionStore.commit();
  } catch (err) {
    clearStreaming();
    // If not already rolled back (e.g. stream error path above already did it)
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
export async function run(input: string): Promise<void> {
  const story = sessionStore.story;
  if (!story) return;

  const userMsg = newMessage({
    role: "user",
    text: input,
    parentId: story.currentLeafId,
  });

  await generate(story.currentLeafId, userMsg);
}

/**
 * Generates a new response as a sibling of the current leaf,
 * without adding a new user message.
 *
 * The current leaf stays in the tree; the new response becomes
 * the active branch (currentLeafId updates via message:add delta).
 */
export async function retry(): Promise<void> {
  const story = sessionStore.story;
  if (!story || !story.currentLeafId) return;

  const currentLeaf = story.messages.find((m) => m.id === story.currentLeafId);
  if (!currentLeaf) return;

  await generate(currentLeaf.parentId, null);
}
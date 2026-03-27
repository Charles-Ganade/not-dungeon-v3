import { Flex, Text } from "@/app/components";
import {
  extractTemplateQuestions,
  resolveStoryTemplates,
} from "@/core/templates";
import { Story } from "@/core/types";
import { libraryStore, sessionStore, settingsStore } from "@/store";
import { useNavigate, useParams } from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  Show,
} from "solid-js";
import { createStore, unwrap } from "solid-js/store";
import { Questionnaire } from "./Questionnaire";
import { FiSliders } from "solid-icons/fi";
import { OcRedo2, OcUndo2 } from "solid-icons/oc";
import { ScriptLogEntry } from "@/core/engine/script_runner";
import { LLMChunk } from "@/services/llm";
import { HistoryView } from "./HistoryView";
import { MessageInput } from "./MessageInput";
import { PlayContext } from "./context";
import { ActionRow } from "./ActionRow";
import { Config } from "./Config";
import { streamingText, streamingThinking } from "@/core/engine/engine";

export function PlayPage() {
  const { id } = useParams();
  const navigator = useNavigate();
  const originalStory = createMemo(() =>
    unwrap(libraryStore.stories.find((v) => v.id === id)),
  );
  if (!originalStory()) {
    navigator(-1);
    return null;
  }
  const [currentStory, setCurrentStory] = createStore<Story>(
    structuredClone(unwrap(originalStory()!)),
  );
  const [debugLogs, setDebugLogs] = createStore<
    (ScriptLogEntry & { ts: number })[]
  >([]);
  const [isConfigOpen, setConfigOpen] = createSignal(false);

  const isUninitialized = createMemo(() => currentStory.messages.length === 0);
  const unresolvedQuestions = createMemo(() => {
    currentStory.messages.length;
    return extractTemplateQuestions(unwrap(currentStory));
  });
  const hasUnresolvedQuestions = createMemo(
    () => unresolvedQuestions().length > 0,
  );

  const onResolveQuestions = async (answers: Record<string, string>) => {
    const updatedStory = resolveStoryTemplates(unwrap(currentStory), answers);
    setCurrentStory(await libraryStore.editStory(id!, updatedStory));
  };
  createEffect(() => {
    if (!isUninitialized() || !hasUnresolvedQuestions()) {
      if (sessionStore.story?.id !== currentStory.id)
        sessionStore.open(unwrap(currentStory));
    }
  });
  onCleanup(() => {
    sessionStore.close();
  });
  let scrollRef: HTMLDivElement | undefined;
  const onLog = (entry: ScriptLogEntry) =>
    setDebugLogs(debugLogs.length, { ...entry, ts: Date.now() });
  const onChunk = (chunk: LLMChunk) => {};
  createEffect(() => {
    sessionStore.activePath;
    streamingText();
    streamingThinking();
    scrollRef?.scrollTo({ behavior: "smooth", top: scrollRef.scrollHeight });
  });

  return (
    <PlayContext.Provider value={{ onLog, onChunk, debugLogs, setDebugLogs }}>
      <Show when={isUninitialized() && hasUnresolvedQuestions()}>
        <Questionnaire
          questions={unresolvedQuestions()}
          onSubmit={onResolveQuestions}
        />
      </Show>
      <Show when={!isUninitialized() || !hasUnresolvedQuestions()}>
        <div class="flex-1 flex flex-col min-h-0">
          <Flex ref={scrollRef!} class="w-full h-full overflow-y-auto">
            <Flex
              direction={"col"}
              class="flex-1 min-h-full h-fit relative gap-0"
            >
              <Flex
                justify={"end"}
                class="w-full sticky top-0 left-0 gap-3 p-6"
              >
                <button
                  class="btn btn-soft btn-circle"
                  disabled={!sessionStore.canUndo || sessionStore.isGenerating}
                  onClick={() => {
                    sessionStore.undo();
                  }}
                >
                  <Text variant={"h4"}>
                    <OcUndo2 />
                  </Text>
                </button>
                <button
                  class="btn btn-soft btn-circle"
                  disabled={!sessionStore.canRedo || sessionStore.isGenerating}
                  onClick={() => {
                    sessionStore.redo();
                  }}
                >
                  <Text variant={"h4"}>
                    <OcRedo2 />
                  </Text>
                </button>
                <button
                  class="btn btn-soft btn-circle"
                  onClick={() => setConfigOpen(true)}
                >
                  <Text variant={"h4"} class="rotate-90">
                    <FiSliders />
                  </Text>
                </button>
              </Flex>
              <div class="w-full flex flex-col items-center justify-center">
                <HistoryView />
              </div>
              <Flex
                align={"center"}
                justify={"center"}
                direction={"col"}
                class="w-full fixed bottom-0 left-0 p-6"
              >
                <div class="flex flex-col gap-2 w-full max-w-3xl">
                  <ActionRow />
                  <MessageInput />
                </div>
              </Flex>
            </Flex>
          </Flex>
        </div>
      </Show>
      <Config open={isConfigOpen} onClose={() => setConfigOpen(false)} />
    </PlayContext.Provider>
  );
}

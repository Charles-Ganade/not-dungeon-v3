import { sessionStore, settingsStore } from "@/store";
import {
  createMemo,
  createEffect,
  Show,
  createSignal,
  onCleanup,
  Match,
  Switch,
} from "solid-js";
import { PlayModes, usePlay } from "./context";
import { Text } from "@/app/components";
import { cancel, continueStory, retry, run } from "@/core/engine/engine";
import { cn } from "@/utils";
import {
  FiPlay,
  FiRefreshCw,
  FiSkipForward,
  FiDelete,
  FiChevronLeft,
  FiChevronRight,
  FiSend,
} from "solid-icons/fi";
import { toast } from "solid-sonner";
import { FaSolidStop } from "solid-icons/fa";
// @ts-ignore
import TextareaAutosize from "solid-textarea-autosize";

export function ActionRow() {
  const { onLog, onChunk } = usePlay();
  const [currentMode, setCurrentMode] = createSignal<PlayModes>("next");
  const allBranches = createMemo(() => {
    const current = sessionStore.story?.messages.find(
      (m) => m.id === sessionStore.story?.currentLeafId,
    );
    if (!current) return [];
    return [...sessionStore.siblingLeaves, current].sort(
      (a, b) => a.createdAt - b.createdAt,
    );
  });

  const currentIndex = createMemo(() =>
    allBranches().findIndex((m) => m.id === sessionStore.story?.currentLeafId),
  );

  const isLastMessageAssistant = createMemo(
    () =>
      sessionStore.story?.messages.filter(
        (m) => m.id === sessionStore.story?.currentLeafId,
      )[0]?.role === "assistant",
  );

  createEffect(() => {
    if (!isLastMessageAssistant() && currentMode() === "retry") {
      setCurrentMode("next");
    }
  });

  const [input, setInput] = createSignal("");

  const send = async () => {
    const message = input().trim();
    setInput("");
    try {
      switch (currentMode()) {
        case "next":
          await run(message, onLog, onChunk);
          break;
        case "continue":
          await continueStory({
            notes: message,
            onLog,
            onChunk,
          });
          break;
        case "retry":
          await retry({
            notes: message,
            onLog,
            onChunk,
          });
          break;
      }
    } catch (e) {
      toast.error(`Error [${(e as any).code}]: ${(e as any).message}`);
      if (settingsStore.settings.Game.preserveTextboxOnFail) {
        setInput(message);
      }
    } finally {
      setCurrentMode("next");
    }
  };

  onCleanup(cancel);
  return (
    <>
      <>
        <div class="w-full bg-base-200 p-3 md:px-6 rounded-xl flex">
          <div class="flex gap-2 overflow-x-auto">
            <button
              class={cn(
                "flex items-center gap-2",
                "btn btn-soft",
                currentMode() === "next" && "btn-active btn-accent",
              )}
              onClick={() => {
                setCurrentMode("next");
              }}
              disabled={sessionStore.isGenerating}
            >
              <Text>
                <FiPlay />
              </Text>
              <Text>Turn</Text>
            </button>
            <Show when={isLastMessageAssistant()}>
              <button
                class={cn(
                  "flex items-center gap-2",
                  "btn btn-soft",
                  currentMode() === "retry" && "btn-active btn-accent",
                )}
                disabled={
                  sessionStore.activePath.length < 2 ||
                  sessionStore.isGenerating
                }
                onClick={async () => {
                  if (currentMode() !== "retry") {
                    setCurrentMode("retry");
                  } else {
                    try {
                      await send();
                    } catch (e) {
                      toast.error(
                        `Error [${(e as any).code}]: ${(e as any).message}`,
                      );
                    } finally {
                      setCurrentMode("next");
                    }
                  }
                }}
              >
                <Text>
                  <FiRefreshCw />
                </Text>
                <Text>Retry</Text>
              </button>
            </Show>
            <button
              class={cn(
                "flex items-center gap-2",
                "btn btn-soft",
                currentMode() === "continue" && "btn-active btn-accent",
              )}
              onClick={async () => {
                if (currentMode() !== "continue") {
                  setCurrentMode("continue");
                } else {
                  try {
                    await send();
                  } catch (e) {
                    toast.error(
                      `Error [${(e as any).code}]: ${(e as any).message}`,
                    );
                  } finally {
                    setCurrentMode("next");
                  }
                }
              }}
              disabled={sessionStore.isGenerating}
            >
              <Text>
                <FiSkipForward />
              </Text>
              <Text>Continue</Text>
            </button>
            <button
              class={cn("flex items-center gap-2", "btn btn-soft")}
              disabled={
                sessionStore.activePath.length < 2 || sessionStore.isGenerating
              }
              onClick={() => {
                sessionStore.eraseLastMessage();
              }}
            >
              <Text>
                <FiDelete />
              </Text>
              <Text>Erase</Text>
            </button>
            <Show when={allBranches().length > 1}>
              <div class="join">
                <button
                  class="btn btn-soft hover:btn-accent join-item px-2"
                  disabled={currentIndex() === 0}
                  onClick={() =>
                    sessionStore.switchBranch(
                      allBranches()[currentIndex() - 1].id,
                    )
                  }
                >
                  <Text variant={"h4"}>
                    <FiChevronLeft />
                  </Text>
                </button>
                <Text class="join-item hidden md:inline-flex md:btn btn-soft no-animation pointer-events-none">
                  {currentIndex() + 1} / {allBranches().length}
                </Text>
                <button
                  class="btn btn-soft hover:btn-accent join-item px-2"
                  disabled={currentIndex() === allBranches().length - 1}
                  onClick={() =>
                    sessionStore.switchBranch(
                      allBranches()[currentIndex() + 1].id,
                    )
                  }
                >
                  <Text variant={"h4"}>
                    <FiChevronRight />
                  </Text>
                </button>
              </div>
            </Show>
          </div>
        </div>
      </>
      <>
        <div class="w-full bg-base-200 h-fit p-4 md:p-6 rounded-xl flex items-center gap-4">
          <div class="flex-1">
            <Text variant={"h5"}>
              <TextareaAutosize
                placeholder={
                  currentMode() === "next"
                    ? "What happens next..."
                    : currentMode() === "continue"
                      ? "Notes for continuing..."
                      : "Notes for retrying..."
                }
                class="textarea textarea-ghost textarea-lg resize-none overflow-y-auto flex-1 max-h-40 w-full focus:outline-none min-h-0! bg-transparent p-0"
                maxRows={5}
                cacheMeasurements
                value={input()}
                onInput={({
                  currentTarget,
                }: InputEvent & {
                  currentTarget: HTMLTextAreaElement;
                  target: HTMLTextAreaElement;
                }) => {
                  setInput(currentTarget.value);
                }}
                onKeyDown={(
                  e: KeyboardEvent & {
                    currentTarget: HTMLTextAreaElement;
                    target: Element;
                  },
                ) => {
                  if (!(input().trim() === "" || sessionStore.isGenerating)) {
                    if (e.key === "Enter" && e.ctrlKey) {
                      e.preventDefault();
                      send();
                    }
                  }
                }}
              />
            </Text>
          </div>
          <Show
            when={!sessionStore.isGenerating}
            fallback={
              <button
                class="btn btn-primary btn-circle hover:btn-error"
                onClick={cancel}
              >
                <Text>
                  <FaSolidStop />
                </Text>
              </button>
            }
          >
            <button
              class="btn btn-primary btn-circle hover:btn-accent"
              disabled={currentMode() === "next" && input().trim() === ""}
              onClick={send}
            >
              <Text>
                <Switch>
                  <Match when={currentMode() === "next"}>
                    <FiSend />
                  </Match>
                  <Match when={currentMode() === "continue"}>
                    <FiSkipForward />
                  </Match>
                  <Match when={currentMode() === "retry"}>
                    <FiRefreshCw />
                  </Match>
                </Switch>
              </Text>
            </button>
          </Show>
        </div>
      </>
    </>
  );
}

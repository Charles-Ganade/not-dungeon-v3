import { Text } from "@/app/components";
import { sessionStore } from "@/store";
import { cn } from "@/utils";
import {
  FiRefreshCw,
  FiPlay,
  FiDelete,
  FiChevronLeft,
  FiChevronRight,
  FiSend,
  FiSkipForward,
} from "solid-icons/fi";
import { createEffect, createMemo, Show } from "solid-js";
import { usePlay } from "./context";
import { toast } from "solid-sonner";
import { continueStory, retry } from "@/core/engine/engine";

export function ActionRow() {
  const { currentMode, setCurrentMode, onLog, onChunk } = usePlay();
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
  return (
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
              sessionStore.activePath.length < 2 || sessionStore.isGenerating
            }
            onClick={async () => {
              if (currentMode() !== "retry") {
                setCurrentMode("retry");
              } else {
                try {
                  await retry({ onLog, onChunk });
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
                await continueStory({ onLog, onChunk });
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
                sessionStore.switchBranch(allBranches()[currentIndex() - 1].id)
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
                sessionStore.switchBranch(allBranches()[currentIndex() + 1].id)
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
  );
}

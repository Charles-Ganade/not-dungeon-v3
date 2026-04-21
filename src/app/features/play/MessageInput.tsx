import { Text } from "@/app/components";
import { cancel, continueStory, retry, run } from "@/core/engine/engine";
import { sessionStore } from "@/store";
import { FiRefreshCw, FiSend, FiSkipForward } from "solid-icons/fi";
import { createSignal, Match, onCleanup, Show, Switch } from "solid-js";
// @ts-ignore
import TextareaAutosize from "solid-textarea-autosize";
import { usePlay } from "./context";
import { toast } from "solid-sonner";
import { FaSolidStop } from "solid-icons/fa";
export function MessageInput() {
  const { currentMode, setCurrentMode, onLog, onChunk } = usePlay();
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
    } finally {
      setCurrentMode("next");
    }
  };

  onCleanup(cancel);
  return (
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
  );
}

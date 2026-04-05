import { Text } from "@/app/components";
import { run } from "@/core/engine/engine";
import { sessionStore } from "@/store";
import { FiSend } from "solid-icons/fi";
import { createSignal } from "solid-js";
// @ts-ignore
import TextareaAutosize from "solid-textarea-autosize";
import { usePlay } from "./context";
import { toast } from "solid-sonner";

export function MessageInput() {
  const { onLog, onChunk } = usePlay();
  const [input, setInput] = createSignal("");

  const save = async () => {
    const message = input();
    setInput("");
    try {
      await run(message, onLog, onChunk);
    } catch (e) {
      toast.error(`Error [${(e as any).code}]: ${(e as any).message}`);
    }
  };
  return (
    <div class="w-full bg-base-200 h-fit p-4 md:p-6 rounded-xl flex items-center gap-4">
      <div class="flex-1">
        <Text variant={"h5"}>
          <TextareaAutosize
            placeholder="You..."
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
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  save();
                }
              }
            }}
          />
        </Text>
      </div>
      <button
        class="btn btn-primary btn-circle hover:btn-accent"
        disabled={input().trim() === "" || sessionStore.isGenerating}
        onClick={save}
      >
        <Text>
          <FiSend />
        </Text>
      </button>
    </div>
  );
}

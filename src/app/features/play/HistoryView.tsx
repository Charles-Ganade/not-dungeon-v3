import { cn } from "@/utils";
import { marked } from "marked";
import {
  createSignal,
  createUniqueId,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
// @ts-ignore
import TextareaAutosize from "solid-textarea-autosize";
import { sessionStore } from "@/store";
import { Flex, Text } from "@/app/components";
import type { HistoryMessage } from "@/core/types/stories";
import { streamingText, streamingThinking } from "@/core/engine/engine";

export function HistoryView() {
  return (
    <div class="w-full max-w-3xl h-fit flex flex-col">
      <For each={sessionStore.activePath}>
        {(item) => <HistoryEntry message={item} />}
      </For>
      <Show when={streamingText() || streamingThinking()}>
        <HistoryEntry
          message={{
            id: "optimistic-stream",
            role: "assistant",
            text: streamingText(),
            thinkingBlocks: streamingThinking()
              ? [
                  {
                    id: "temp-think",
                    messageId: "optimistic-stream",
                    content: streamingThinking(),
                  },
                ]
              : [],
            createdAt: Date.now(),
            parentId: sessionStore.story?.currentLeafId || null,
          }}
          disableEdits
          openThoughts
        />
      </Show>
    </div>
  );
}

function HistoryEntry(props: {
  message: HistoryMessage;
  openThoughts?: boolean;
  disableEdits?: boolean;
}) {
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal(props.message.text);
  const id = createUniqueId();

  let rootRef: HTMLDivElement | undefined;

  const startEdit = () => {
    setDraft(props.message.text);
    setEditing(true);
  };

  const save = () => {
    const next = draft().trim();
    if (next && next !== props.message.text) {
      sessionStore.editMessage(props.message.id, next);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(props.message.text);
    setEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") cancel();
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save();
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (!editing()) return;
    if (rootRef && !rootRef.contains(e.target as Node)) {
      cancel();
    }
  };

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
  });

  return (
    <Flex
      ref={rootRef}
      direction={"col"}
      class={cn(
        "w-full p-4 rounded-lg gap-0",
        "transition duration-100 ease-linear",
        editing()
          ? "bg-base-200 shadow"
          : "hover:bg-base-200 hover:shadow cursor-pointer",
      )}
      onClick={() => {
        if (!editing() && !props.disableEdits) startEdit();
      }}
      onBlur={() => {
        if (editing()) cancel();
      }}
    >
      <Show when={props.message.steeringNotes?.length}>
        <div
          class={cn("collapse", props.openThoughts && "collapse-open")}
          onClick={(e) => e.stopPropagation()}
        >
          <input id={`collapse-notes-${id}`} type="checkbox" class="peer" />
          <label
            for={`collapse-notes-${id}`}
            class="fixed inset-0 hidden peer-checked:block"
          ></label>
          <div class="collapse-title font-semibold p-0 h-fit">
            <Text variant={"overline"} color={"subtle"}>
              User Notes
            </Text>
          </div>
          <div class="collapse-content text-sm z-1">
            {props.message.steeringNotes}
          </div>
        </div>
      </Show>
      <Show when={props.message.thinkingBlocks.length > 0}>
        <div
          class={cn("collapse", props.openThoughts && "collapse-open")}
          onClick={(e) => e.stopPropagation()}
        >
          <input id={`collapse-${id}`} type="checkbox" class="peer" />
          <label
            for={`collapse-${id}`}
            class="fixed inset-0 hidden peer-checked:block"
          ></label>
          <div class="collapse-title font-semibold p-0 h-fit">
            <Text variant={"overline"} color={"subtle"}>
              Thoughts
            </Text>
          </div>
          <div class="collapse-content text-sm z-1">
            <For each={props.message.thinkingBlocks}>
              {(block) => (
                <Text as="p" variant={"bodySm"} color={"subtle"}>
                  {block.content}
                </Text>
              )}
            </For>
          </div>
        </div>
      </Show>
      <Show when={editing()}>
        <div
          class="flex flex-col gap-2 w-full"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Text variant={"h5"} class="pb-3">
            <TextareaAutosize
              class={cn(
                "textarea w-full resize-none bg-transparent",
                "focus:outline-none",
                props.message.role === "user" ? "text-primary" : "",
              )}
              value={draft()}
              onInput={({
                currentTarget,
              }: InputEvent & {
                currentTarget: HTMLTextAreaElement;
                target: HTMLTextAreaElement;
              }) => setDraft(currentTarget.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </Text>
          <Flex class="gap-2 justify-end">
            <button class="btn" onClick={cancel}>
              Cancel
            </button>
            <button class="btn btn-primary" onClick={save}>
              Save
            </button>
          </Flex>
        </div>
      </Show>
      <Show when={!editing()}>
        <Text
          class={cn(
            "prose flex-1 min-w-full flex flex-col gap-4  ",
            props.message.role === "user" ? "text-primary" : "text-inherit",
          )}
          variant={"h5"}
          as="p"
          innerHTML={marked(props.message.text) as string}
        />
      </Show>
    </Flex>
  );
}

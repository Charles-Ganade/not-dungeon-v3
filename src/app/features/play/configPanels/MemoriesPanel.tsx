import { For, Show, createSignal } from "solid-js";
import { sessionStore } from "@/store";
import { Text } from "@/app/components";
// @ts-ignore
import TextareaAutosize from "solid-textarea-autosize";
import { BsPencil, BsCheckLg, BsXLg } from "solid-icons/bs";
import type { Memory } from "@/core/types/stories";

function MemoryItem(props: { memory: Memory }) {
  const [isEditing, setIsEditing] = createSignal(false);
  const [editContent, setEditContent] = createSignal(props.memory.content);

  const handleSave = () => {
    const trimmed = editContent().trim();
    if (trimmed !== props.memory.content) {
      sessionStore.editMemory(props.memory.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(props.memory.content);
    setIsEditing(false);
  };

  return (
    <div class="card bg-base-200 border border-base-300 shadow-sm">
      <div class="card-body p-4 gap-3">
        <div class="flex flex-wrap items-center gap-1.5">
          <Text variant="caption" color="muted" class="pr-1">
            Covers:
          </Text>
          <For each={props.memory.messageIds}>
            {(id) => (
              <div
                class="badge badge-sm badge-outline badge-ghost font-mono opacity-75"
                title={id}
              >
                {id.split("-")[0]}
              </div>
            )}
          </For>
        </div>
        <Show
          when={isEditing()}
          fallback={
            <div class="flex items-start justify-between gap-4 group">
              <Text
                variant="body"
                class="whitespace-pre-wrap leading-relaxed flex-1"
              >
                {props.memory.content}
              </Text>
              <button
                class="btn btn-ghost btn-lg lg:btn-sm btn-square lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
                onClick={() => setIsEditing(true)}
                title="Edit Memory"
              >
                <BsPencil />
              </button>
            </div>
          }
        >
          <div class="flex flex-col gap-2">
            <TextareaAutosize
              class="textarea textarea-bordered w-full resize-none leading-relaxed"
              value={editContent()}
              // @ts-ignore
              onInput={(e) => setEditContent(e.currentTarget.value)}
              autofocus
            />
            <div class="flex justify-end gap-2 pt-1">
              <button class="btn btn-ghost btn-sm" onClick={handleCancel}>
                <BsXLg /> Cancel
              </button>
              <button class="btn btn-primary btn-sm" onClick={handleSave}>
                <BsCheckLg /> Save
              </button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}

export function MemoriesPanel() {
  return (
    <div class="flex flex-1 flex-col gap-2 p-4 min-h-0">
      <div class="w-full pb-2">
        <Text variant="h4" class="leading-none font-bold">
          Memories
        </Text>
      </div>
      <div class="flex-1 relative">
        <div class="absolute inset-0 overflow-y-auto flex flex-col gap-3 pr-2">
          <Show
            when={sessionStore.activeMemories.length > 0}
            fallback={
              <div class="flex flex-1 items-center justify-center p-8 text-center opacity-50">
                <Text variant="body" color="muted">
                  No memories generated for this branch yet.
                </Text>
              </div>
            }
          >
            <For each={sessionStore.activeMemories}>
              {(memory) => <MemoryItem memory={memory} />}
            </For>
          </Show>
        </div>
      </div>
    </div>
  );
}

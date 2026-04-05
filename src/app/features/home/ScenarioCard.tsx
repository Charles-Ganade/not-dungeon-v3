// app/features/dashboard/ScenarioCard.tsx

import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { cn } from "@/utils";
import { Modal, Text } from "@/app/components";
import { FiPlay, FiPlus, FiTrash2 } from "solid-icons/fi";
import type { Scenario } from "@/core/types/scenarios";
import { BsPencil } from "solid-icons/bs";
import { getThumbnailUrl } from "@/services/db";
import { A } from "@solidjs/router";

interface ScenarioCardProps {
  scenario: Scenario;
  onNewStory: () => void;
  onDelete: () => void;
  class?: string;
}

export function ScenarioCard(props: ScenarioCardProps) {
  const [thumbUrl, setThumbUrl] = createSignal<string | null>(null);
  const [openDelete, setOpenDelete] = createSignal(false);

  onMount(async () => {
    if (props.scenario.thumbnailId) {
      setThumbUrl(await getThumbnailUrl(props.scenario.thumbnailId));
    }
  });

  onCleanup(() => {
    const url = thumbUrl();
    if (url) URL.revokeObjectURL(url);
  });

  return (
    <>
      <div
        class={cn(
          "card bg-base-100 border border-base-300 w-64 lg:w-80 shrink-0",
          props.class,
        )}
      >
        <figure class="aspect-video bg-base-200 relative overflow-hidden ">
          <Show when={thumbUrl()}>
            <img
              src={thumbUrl()!}
              alt={props.scenario.name}
              class="w-full h-full object-cover"
            />
          </Show>
          {/* Hover overlay completely removed */}
        </figure>

        <div class="card-body p-4 gap-1.5 flex flex-col">
          <Text variant="h5" truncate>
            {props.scenario.name}
          </Text>

          <Show when={props.scenario.description}>
            <Text variant="body" color="muted" clamp={2}>
              {props.scenario.description}
            </Text>
          </Show>

          <div class="flex-1"></div>

          <div class="mt-2 flex flex-col gap-3">
            {/* Tags Row */}
            <Show when={props.scenario.tags.length > 0}>
              <div class="flex flex-wrap gap-1">
                <For each={props.scenario.tags.slice(0, 3)}>
                  {(tag) => (
                    <span class="badge badge-outline badge-sm">
                      <Text variant="caption">{tag}</Text>
                    </span>
                  )}
                </For>
                <Show when={props.scenario.tags.length > 3}>
                  <span class="badge badge-ghost badge-sm">
                    <Text variant="caption" color="subtle">
                      +{props.scenario.tags.length - 3}
                    </Text>
                  </span>
                </Show>
              </div>
            </Show>

            {/* Actions Row */}
            <div class="card-actions justify-end items-center mt-1">
              <button
                class="btn btn-ghost btn-sm btn-square text-error"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenDelete(true);
                }}
                title="Delete"
              >
                <FiTrash2 />
              </button>
              <A
                class="btn btn-ghost btn-sm btn-square text-base-content/70"
                href={`/edit-scenario/${props.scenario.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                title="Edit"
              >
                <BsPencil />
              </A>
              <button
                class="btn btn-primary btn-sm ml-1"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onNewStory();
                }}
              >
                <FiPlay /> <Text variant={"bodySm"}>New Story</Text>
              </button>
            </div>
          </div>
        </div>

        <Modal
          open={openDelete()}
          onClose={() => setOpenDelete(false)}
          class="p-0! flex flex-col bg-base-200 shadow"
          onClick={(e) => e.stopPropagation()}
          size={"sm"}
        >
          <div class="flex flex-col gap-4 p-6">
            <Text variant={"h4"} weight={"bold"}>
              Delete scenario "{props.scenario.name}"?
            </Text>
            <div class="flex w-full gap-2">
              <button class="btn flex-1" onClick={() => setOpenDelete(false)}>
                <Text class="text-inherit">Cancel</Text>
              </button>
              <button class="btn btn-error flex-1" onClick={props.onDelete}>
                <Text class="text-inherit">Delete</Text>
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </>
  );
}

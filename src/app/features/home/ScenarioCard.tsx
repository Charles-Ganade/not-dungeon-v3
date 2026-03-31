// app/features/dashboard/ScenarioCard.tsx

import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { cn } from "@/utils";
import { Text } from "@/app/components";
import { FiPlus, FiTrash2 } from "solid-icons/fi";
import type { Scenario } from "@/core/types/scenarios";
import { BsPencil } from "solid-icons/bs";
import { getThumbnailUrl } from "@/services/db";

interface ScenarioCardProps {
  scenario: Scenario;
  onNewStory: () => void;
  onEdit: () => void;
  onDelete: () => void;
  class?: string;
}

export function ScenarioCard(props: ScenarioCardProps) {
  const [thumbUrl, setThumbUrl] = createSignal<string | null>(null);

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
    <div
      class={cn(
        "card bg-base-100 border border-base-300 w-80 shrink-0 group",
        props.class,
      )}
    >
      <figure class="aspect-video bg-base-200 relative overflow-hidden rounded-t-2xl">
        <Show when={thumbUrl()}>
          <img
            src={thumbUrl()!}
            alt={props.scenario.name}
            class="w-full h-full object-cover"
          />
        </Show>
        <div class="absolute inset-0 bg-base-300/80 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            class="btn btn-primary"
            onClick={(e) => {
              e.stopPropagation();
              props.onNewStory();
            }}
            title="New story"
          >
            <FiPlus />
          </button>
          <button
            class="btn btn-secondary btn-outline"
            onClick={(e) => {
              e.stopPropagation();
              props.onEdit();
            }}
            title="Edit"
          >
            <BsPencil />
          </button>
          <button
            class="btn btn-error btn-outline"
            onClick={(e) => {
              e.stopPropagation();
              props.onDelete();
            }}
            title="Delete"
          >
            <FiTrash2 />
          </button>
        </div>
      </figure>

      <div class="card-body p-4 gap-1.5">
        <Text variant="h5" truncate>
          {props.scenario.name}
        </Text>

        <Show when={props.scenario.description}>
          <Text variant="body" color="muted" clamp={2}>
            {props.scenario.description}
          </Text>
        </Show>

        <div class="mt-auto pt-2 flex flex-col gap-2">
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
        </div>
      </div>
    </div>
  );
}

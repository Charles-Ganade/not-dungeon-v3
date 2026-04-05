import {
  Accessor,
  createSignal,
  onCleanup,
  onMount,
  Setter,
  Show,
} from "solid-js";
import { cn, formatRelative } from "@/utils";
import { Text } from "@/app/components";
import { FiPlay, FiTrash2 } from "solid-icons/fi";
import type { Story } from "@/core/types/stories";
import type { Scenario } from "@/core/types/scenarios";
import { BsPencil } from "solid-icons/bs";
import { getThumbnailUrl } from "@/services/db";
import { DeleteStoryModal } from "./modals/DeleteStoryModal";
import { EditStoryModal } from "./modals/EditStoryModal";
import { A } from "@solidjs/router";

interface StoryCardProps {
  story: Story;
  scenario?: Scenario;
  class?: string;
}

export function StoryCard(props: StoryCardProps) {
  const [thumbUrl, setThumbUrl] = createSignal<string | null>(null);
  const [openDeleteModal, setOpenDeleteModal] = createSignal(false);
  const [openEditModal, setOpenEditModal] = createSignal(false);

  onMount(async () => {
    if (props.story.thumbnailId) {
      setThumbUrl(await getThumbnailUrl(props.story.thumbnailId));
    }
  });

  onCleanup(() => {
    const url = thumbUrl();
    if (url) URL.revokeObjectURL(url);
  });
  return (
    <>
      <DeleteStoryModal
        open={openDeleteModal()}
        onClose={() => setOpenDeleteModal(false)}
        story={props.story}
      />
      <EditStoryModal
        open={openEditModal()}
        onClose={() => setOpenEditModal(false)}
        story={props.story}
      />
      <div
        class={cn(
          "card bg-base-100 border border-base-300 w-64 lg:w-80 shrink-0",
          props.class,
        )}
      >
        <figure class="aspect-video bg-base-200 relative overflow-hidden">
          <Show when={thumbUrl()}>
            <img
              src={thumbUrl()!}
              alt={props.story.name}
              class="w-full h-full object-cover"
            />
          </Show>
        </figure>

        <div class="card-body p-4 gap-1 flex flex-col">
          <Text variant="h5" truncate>
            {props.story.name}
          </Text>

          <Show when={props.story.description}>
            <Text variant="body" color="muted" clamp={2}>
              {props.story.description}
            </Text>
          </Show>
          <div class="flex-1"></div>
          <div class="mt-2 flex flex-col gap-3">
            <div class="flex items-center gap-2">
              <Show when={props.scenario}>
                <span class="badge badge-ghost">
                  <Text variant="caption" color="subtle" truncate>
                    {props.scenario!.name}
                  </Text>
                </span>
              </Show>
              <Text variant="caption" color="subtle" class="ml-auto shrink-0">
                {formatRelative(props.story.lastPlayedAt)}
              </Text>
            </div>
            <div class="card-actions justify-end items-center mt-1">
              <button
                class="btn btn-ghost btn-sm btn-square text-error"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenDeleteModal(true);
                }}
                title="Delete"
              >
                <FiTrash2 />
              </button>
              <button
                class="btn btn-ghost btn-sm btn-square text-base-content/70"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenEditModal(true);
                }}
                title="Edit"
              >
                <BsPencil />
              </button>
              <A
                class="btn btn-primary btn-sm ml-1"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                href={`/play/${props.story.id}`}
              >
                <FiPlay /> <Text variant={"bodySm"}>Continue</Text>
              </A>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

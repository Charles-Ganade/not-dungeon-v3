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
  onPlay: () => void;
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
          "card bg-base-100 border border-base-300 w-80 shrink-0 group",
          props.class,
        )}
      >
        {/* aspect-video gives a 16:9 thumbnailId — proportional to card width,
          no hardcoded heights needed */}
        <figure class="aspect-video bg-base-200 relative overflow-hidden rounded-t-2xl">
          <Show when={thumbUrl()}>
            <img
              src={thumbUrl()!}
              alt={props.story.name}
              class="w-full h-full object-cover"
            />
          </Show>
          <div class="absolute inset-0 bg-base-300/80 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <A
              class="btn btn-primary"
              onClick={(e) => {
                e.stopPropagation();
              }}
              title="Continue"
              href={`/play/${props.story.id}`}
            >
              <FiPlay />
            </A>
            <button
              class="btn btn-secondary btn-outline"
              onClick={(e) => {
                e.stopPropagation();
                setOpenEditModal(true);
              }}
              title="Edit"
            >
              <BsPencil />
            </button>
            <button
              class="btn btn-error btn-outline"
              onClick={(e) => {
                e.stopPropagation();
                setOpenDeleteModal(true);
              }}
              title="Delete"
            >
              <FiTrash2 />
            </button>
          </div>
        </figure>

        <div class="card-body p-4 gap-1">
          <Text variant="h5" truncate>
            {props.story.name}
          </Text>

          <Show when={props.story.description}>
            <Text variant="body" color="muted" clamp={2}>
              {props.story.description}
            </Text>
          </Show>

          <div class="mt-auto pt-2 flex items-center gap-2">
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
        </div>
      </div>
    </>
  );
}

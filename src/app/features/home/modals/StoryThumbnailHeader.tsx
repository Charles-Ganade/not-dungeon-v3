import { Text } from "@/app/components";
import { FiEdit, FiX } from "solid-icons/fi";
import { Show } from "solid-js";

interface StoryThumbnailHeaderProps {
  /** Object URL for the current thumbnail, or a falsy value when none is set. */
  thumbUrl: string | null;
  /** Fired when the user picks a new thumbnail image. */
  onFile: (e: Event) => void;
  /** Fired when the user clicks the close (X) button. */
  onClose: () => void;
}

/**
 * The banner at the top of the Create/Edit story modals: the thumbnail image
 * with a hover-reveal file picker and a close button. Shared by both modals.
 */
export function StoryThumbnailHeader(props: StoryThumbnailHeaderProps) {
  return (
    <figure class="group w-full h-64 relative overflow-hidden rounded-t-2xl bg-secondary  ">
      <Show when={props.thumbUrl}>
        <img src={props.thumbUrl!} class="w-full h-full object-cover" />
      </Show>
      <div class="absolute top-0 right-0 p-6 z-10">
        <button
          onClick={() => props.onClose()}
          class="btn btn-outline border-2 btn-error btn-circle text-error hover:text-error-content"
        >
          <Text variant={"h4"} class="text-inherit">
            <FiX />
          </Text>
        </button>
      </div>
      <div class="absolute inset-0 bg-base-300/80 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <label
          class="btn btn-lg btn-circle btn-primary"
          onClick={(e) => e.stopPropagation()}
        >
          <Text>
            <FiEdit />
          </Text>
          <input
            type="file"
            class="hidden"
            onInput={props.onFile}
            accept="image/*"
          />
        </label>
      </div>
    </figure>
  );
}

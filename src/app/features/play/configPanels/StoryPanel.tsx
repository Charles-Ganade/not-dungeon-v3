import { Text } from "@/app/components";
import { getThumbnailBlob } from "@/services/db";
import { sessionStore } from "@/store";
import { FiEdit, FiInfo } from "solid-icons/fi";
import { createResource, onCleanup, Show } from "solid-js";
// @ts-ignore
import TextareaAutosize from "solid-textarea-autosize";

export function StoryPanel() {
  const [thumbUrl] = createResource(
    () => sessionStore.story?.thumbnailId,
    async (id) => {
      if (!id) return null;
      const blob = await getThumbnailBlob(id);
      if (!blob) return null;
      return URL.createObjectURL(blob);
    },
  );

  const handleFile = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    sessionStore.editThumbnail(file);
  };

  onCleanup(() => {
    const url = thumbUrl();
    if (url) URL.revokeObjectURL(url);
  });
  return (
    <div class="flex flex-1 flex-col gap-2 p-4 min-h-0">
      <div class="w-full pb-2">
        <Text variant={"h4"} class="leading-none font-bold">
          Story Details
        </Text>
      </div>
      <div class="flex-1 relative">
        <div class="absolute inset-0 overflow-y-auto flex flex-col gap-4">
          <div class="join join-vertical rounded-xl border border-base-300">
            <figure class="group w-full h-64 relative overflow-hidden bg-secondary join-item rounded-t-xl">
              <Show when={thumbUrl()}>
                <img src={thumbUrl()!} class="w-full h-full object-cover" />
              </Show>
              <div class="absolute inset-0 bg-base-300/60 flex items-center justify-center gap-2">
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
                    accept="image/*"
                    onInput={handleFile}
                  />
                </label>
              </div>
            </figure>
            <div class="join-item flex flex-col gap-4 p-2 pt-4">
              <div class="w-full flex flex-col gap-1">
                <div class="flex gap-2">
                  <Text variant={"bodySm"} weight={"bold"}>
                    Title
                  </Text>
                </div>
                <label class="input w-full">
                  <Text variant={"bodySm"}>
                    <input
                      type="text"
                      value={sessionStore.story?.name ?? ""}
                      onInput={({ currentTarget }) => {
                        sessionStore.editStoryMetadata({
                          name: currentTarget.value,
                        });
                      }}
                    />
                  </Text>
                </label>
              </div>
              <div class="w-full flex flex-col gap-1">
                <div class="flex gap-2">
                  <Text variant={"bodySm"} weight={"bold"}>
                    Description
                  </Text>
                  <Text
                    class="tooltip tooltip-right tooltip-info"
                    data-tip="Rules and guidelines for the AI to follow. Inserted below the system prompt."
                  >
                    <FiInfo />
                  </Text>
                </div>
                <Text>
                  <TextareaAutosize
                    class="textarea w-full h-64 resize-none"
                    value={sessionStore.story?.description ?? ""}
                    // @ts-ignore
                    onInput={({ currentTarget }) => {
                      sessionStore.editStoryMetadata({
                        description: currentTarget.value,
                      });
                    }}
                  />
                </Text>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Flex, Modal, Text } from "@/app/components";
import { makeDefaultStory } from "@/core/defaults";
import { Story } from "@/core/types";
import { getThumbnailBlob } from "@/services/db";
import { libraryStore } from "@/store";
import { FiSave } from "solid-icons/fi";
import { createEffect, createMemo, createSignal, on, onCleanup } from "solid-js";
import { createStore, unwrap } from "solid-js/store";
// @ts-ignore
import TextareaAutosize from "solid-textarea-autosize";
import { StoryThumbnailHeader } from "./StoryThumbnailHeader";
import { ConfirmCloseModal } from "./ConfirmCloseModal";

interface EditStoryModalProps {
  open: boolean;
  onClose: () => void;
  story: Story;
}

export function EditStoryModal(props: EditStoryModalProps) {
  const originalStory = makeDefaultStory(props.story);
  const [story, setStory] = createStore(structuredClone(unwrap(originalStory)));
  const [confirmModalOpen, setConfirmModalOpen] = createSignal(false);
  const [thumbBlob, setThumbBlob] = createSignal<Blob | null>(null);
  const [thumbBlobOriginal, setThumbBlobOriginal] = createSignal<Blob | null>(
    null,
  );

  const thumbUrl = createMemo(() =>
    thumbBlob() ? URL.createObjectURL(thumbBlob()!) : "",
  );

  const handleFile = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const files = input.files;

    if (!files || files.length === 0) return;

    const file = files[0];
    setThumbBlob(file);
  };

  createEffect(
    on(
      () => props.open,
      async (open) => {
        if (open && props.story.thumbnailId) {
          const blob = await getThumbnailBlob(props.story.thumbnailId);
          setThumbBlob(blob);
          setThumbBlobOriginal(blob);
        }
      },
    ),
  );

  onCleanup(() => {
    const url = thumbUrl();
    if (url) URL.revokeObjectURL(url);
  });

  const close = () => {
    setStory(originalStory);
    setThumbBlob(null);
    setConfirmModalOpen(false);
    props.onClose();
  };

  const saveAndClose = async () => {
    await libraryStore.editStory(
      props.story.id,
      structuredClone(unwrap(story)),
      thumbBlob() ?? undefined,
    );
    close();
  };

  const isChanged = createMemo(() => {
    return (
      story.name !== originalStory.name ||
      story.description !== originalStory.description ||
      story.essentials !== originalStory.essentials ||
      story.authorNotes !== originalStory.authorNotes ||
      thumbBlob() !== thumbBlobOriginal()
    );
  });

  return (
    <Modal
      open={props.open}
      class="p-0! h-[80vh] flex flex-col bg-base-200 shadow"
      size={"full"}
      onClose={props.onClose}
      closeOnOverlayClick={false}
      closeOnEsc={false}
    >
      <StoryThumbnailHeader
        thumbUrl={thumbUrl()}
        onFile={handleFile}
        onClose={() => {
          if (isChanged()) {
            setConfirmModalOpen(true);
          } else {
            close();
          }
        }}
      />
      <Flex direction={"col"} class="p-6 flex-1 min-h-0">
        <Flex justify={"between"} align={"center"} class="h-fit">
          <Text variant={"h3"} weight={"bold"}>
            Edit Story: {story.name}
          </Text>
          <button
            class="btn btn-secondary"
            onClick={saveAndClose}
            disabled={!isChanged()}
          >
            <Text>
              <FiSave />
            </Text>
            <Text>Save Edits</Text>
          </button>
        </Flex>
        <Flex direction={"col"} class="min-h-0 overflow-y-auto flex-1 h-fit">
          <div class="flex flex-col gap-1">
            <Text weight={"semibold"} color={"muted"}>
              Title
            </Text>
            <label class="input w-full">
              <input
                type="text"
                value={story.name}
                onInput={({ currentTarget }) => {
                  setStory("name", currentTarget.value);
                }}
                accept="image/*"
              />
            </label>
          </div>
          <div class="flex flex-col gap-1">
            <Text weight={"semibold"} color={"muted"}>
              Description
            </Text>
            <TextareaAutosize
              class="textarea w-full h-32 resize-none"
              value={story.description}
              // @ts-ignore
              onInput={({ currentTarget }) => {
                setStory("description", currentTarget.value);
              }}
            />
          </div>
          <Flex class="gap-3 flex-1">
            <div class="flex flex-col gap-1 flex-1">
              <Text weight={"semibold"} color={"muted"}>
                Essentials
              </Text>
              <TextareaAutosize
                class="textarea w-full h-48 resize-none"
                value={story.essentials}
                // @ts-ignore
                onInput={({ currentTarget }) => {
                  setStory("essentials", currentTarget.value);
                }}
              />
            </div>
            <div class="flex flex-col gap-1 flex-1">
              <Text weight={"semibold"} color={"muted"}>
                Author's Notes
              </Text>
              <TextareaAutosize
                class="textarea w-full h-48 resize-none"
                value={story.authorNotes}
                // @ts-ignore
                onInput={({ currentTarget }) => {
                  setStory("authorNotes", currentTarget.value);
                }}
              />
            </div>
          </Flex>
        </Flex>
      </Flex>
      <ConfirmCloseModal
        open={confirmModalOpen()}
        onCancel={() => setConfirmModalOpen(false)}
        onConfirm={close}
      />
    </Modal>
  );
}

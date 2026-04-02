import { Text } from "@/app/components";
import { sessionStore } from "@/store";
import { FiInfo } from "solid-icons/fi";
// @ts-ignore
import TextareaAutosize from "solid-textarea-autosize";

export function PlotPanel() {
  return (
    <div class="flex flex-1 flex-col gap-2 p-4 min-h-0">
      <div class="w-full pb-2">
        <Text variant={"h4"} class="leading-none font-bold">
          Plot Details
        </Text>
      </div>
      <div class="flex-1 relative">
        <div class="absolute inset-0 overflow-y-auto flex flex-col gap-4">
          <div class="w-full flex flex-col gap-1">
            <div class="flex gap-2">
              <Text variant={"bodySm"} weight={"bold"}>
                AI Instructions
              </Text>
              <Text
                class="tooltip tooltip-bottom tooltip-info"
                data-tip="Rules and guidelines for the AI to follow. Inserted below the system prompt."
              >
                <FiInfo />
              </Text>
            </div>
            <TextareaAutosize
              class="textarea w-full h-64 resize-none"
              value={sessionStore.story?.instructions ?? ""}
              // @ts-ignore
              onInput={({ currentTarget }) => {
                sessionStore.editStoryMetadata({
                  instructions: currentTarget.value,
                });
              }}
            />
          </div>
          <div class="w-full flex flex-col gap-1">
            <div class="flex gap-2">
              <Text variant={"bodySm"} weight={"bold"}>
                Essentials
              </Text>
              <Text
                class="tooltip tooltip-right tooltip-info"
                data-tip="Keeps track of the most important aspects of the story. Can be edited and modified by the scripts in game."
              >
                <FiInfo />
              </Text>
            </div>
            <TextareaAutosize
              class="textarea w-full h-64 resize-none"
              value={sessionStore.story?.essentials ?? ""}
              // @ts-ignore
              onInput={({ currentTarget }) => {
                sessionStore.editEssentials(currentTarget.value);
              }}
            />
          </div>
          <div class="w-full flex flex-col gap-1">
            <div class="flex gap-2">
              <Text variant={"bodySm"} weight={"bold"}>
                Author's Notes
              </Text>
              <Text
                class="tooltip tooltip-right tooltip-info"
                data-tip="Used to give the AI details about the story’s genre(s), your preferred writing style, overall tone, etc."
              >
                <FiInfo />
              </Text>
            </div>
            <TextareaAutosize
              class="textarea w-full h-64 resize-none"
              value={sessionStore.story?.authorNotes ?? ""}
              // @ts-ignore
              onInput={({ currentTarget }) => {
                sessionStore.editStoryMetadata({
                  authorNotes: currentTarget.value,
                });
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

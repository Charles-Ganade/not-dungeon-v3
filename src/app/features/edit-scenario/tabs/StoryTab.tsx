import { Text } from "@/app/components";
import { FiInfo } from "solid-icons/fi";
import { useEditScenario } from "../context";

export function StoryTab() {
  const { currentScenario, setCurrentScenario } = useEditScenario();
  return (
    <div class="tab-content bg-base-200 p-6">
      <div class="flex flex-col gap-4">
        <div class="w-full flex flex-col gap-1">
          <div class="flex gap-2">
            <Text variant={"bodySm"} weight={"bold"}>
              Opening Prompt
            </Text>
            <Text
              class="tooltip tooltip-right tooltip-info"
              data-tip="The prompt at the very beginning of the story. This is what the player character first responds to."
            >
              <FiInfo />
            </Text>
          </div>
          <textarea
            class="textarea w-full h-64 resize-none"
            value={currentScenario.openingPrompt}
            onInput={({ currentTarget }) => {
              setCurrentScenario("openingPrompt", currentTarget.value);
            }}
          />
        </div>
        <div class="w-full flex flex-col gap-1">
          <div class="flex gap-2">
            <Text variant={"bodySm"} weight={"bold"}>
              AI Instructions
            </Text>
            <Text
              class="tooltip tooltip-right tooltip-info"
              data-tip="Rules and guidelines for the AI to follow. Inserted below the system prompt."
            >
              <FiInfo />
            </Text>
          </div>
          <textarea
            class="textarea w-full h-64 resize-none"
            value={currentScenario.instructions}
            onInput={({ currentTarget }) => {
              setCurrentScenario("instructions", currentTarget.value);
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
          <textarea
            class="textarea w-full h-64 resize-none"
            value={currentScenario.essentials}
            onInput={({ currentTarget }) => {
              setCurrentScenario("essentials", currentTarget.value);
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
          <textarea
            class="textarea w-full h-64 resize-none"
            value={currentScenario.authorNotes}
            onInput={({ currentTarget }) => {
              setCurrentScenario("authorNotes", currentTarget.value);
            }}
          />
        </div>
      </div>
    </div>
  );
}

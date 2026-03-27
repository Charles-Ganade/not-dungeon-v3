import { Flex, Modal, Text } from "@/app/components";
import { PanelLabel } from "../PanelLabel";
import { settingsStore } from "@/store";
import { debouncedPatch } from "../Settings";
import { createStore } from "solid-js/store";
import { DEFAULT_SETTINGS } from "@/core/defaults";
// @ts-ignore
import TextareaAutosize from "solid-textarea-autosize";
import { createSignal } from "solid-js";

export function PromptsPanel() {
  const PROMPTS = () => settingsStore.settings.Prompts;
  const DEFAULT_PROMPTS = DEFAULT_SETTINGS.Prompts;
  const [useDefaultPrompts, setUseDefaultPrompts] = createStore({
    defaultSystemPrompt:
      PROMPTS().defaultSystemPrompt === DEFAULT_PROMPTS.defaultSystemPrompt,
    memoryGeneratorPrompt:
      PROMPTS().memoryGeneratorPrompt === DEFAULT_PROMPTS.memoryGeneratorPrompt,
    scenarioGeneratorPrompt:
      PROMPTS().scenarioGeneratorPrompt ===
      DEFAULT_PROMPTS.scenarioGeneratorPrompt,
    storyCardGeneratorPrompt:
      PROMPTS().storyCardGeneratorPrompt ===
      DEFAULT_PROMPTS.storyCardGeneratorPrompt,
  });
  const [confirmModalOpen, setConfirmModalOpen] = createSignal(false);

  return (
    <Flex direction={"col"} class="gap-2 w-full h-full overflow-y-auto">
      <PanelLabel>Prompts</PanelLabel>
      <Flex direction={"col"} class="gap-2 px-4 pb-4">
        <Flex justify={"between"} align={"center"} class="w-full py-1">
          <Text variant={"h5"} class="leading-none">
            System Prompts
          </Text>
          <button
            class="btn btn-error btn-sm"
            onClick={() => setConfirmModalOpen(true)}
          >
            <Text class="text-error-content">Reset to Default</Text>
          </button>
        </Flex>
        <hr class="border-base-300" />
        <details class="collapse collapse-arrow bg-base-100 border-base-300 rounded border-b shadow hover:shadow-lg">
          <summary class="collapse-title font-semibold cursor-pointer select-none">
            Main System Prompt
          </summary>
          <div class="collapse-content">
            <Flex direction={"col"} class="w-full gap-2 pt-2">
              <Text color={"muted"}>
                Injected at the top of every request as the system prompt. Can
                be overridden per-scenario or per-adventure.
              </Text>
              <label class="flex items-center gap-2 mb-1 cursor-pointer">
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm"
                  checked={!useDefaultPrompts.defaultSystemPrompt}
                  onChange={(e) => {
                    if (!e.currentTarget.checked) {
                      debouncedPatch({
                        Prompts: {
                          defaultSystemPrompt:
                            DEFAULT_PROMPTS.defaultSystemPrompt,
                        },
                      });
                    }
                    setUseDefaultPrompts("defaultSystemPrompt", (v) => !v);
                  }}
                />
                <Text>Use Custom Prompt</Text>
              </label>
              <TextareaAutosize
                placeholder="Type here"
                class="textarea textarea-bordered resize-none w-full min-h-40"
                value={settingsStore.settings.Prompts.defaultSystemPrompt}
                disabled={useDefaultPrompts.defaultSystemPrompt}
                // @ts-ignore
                onInput={(e) => {
                  debouncedPatch({
                    Prompts: {
                      defaultSystemPrompt: e.currentTarget.value,
                    },
                  });
                }}
              />
            </Flex>
          </div>
        </details>
        <details class="collapse collapse-arrow bg-base-100 border-base-300 rounded border-b shadow hover:shadow-lg">
          <summary class="collapse-title font-semibold cursor-pointer select-none">
            Memory Generator Prompt
          </summary>
          <div class="collapse-content">
            <Flex direction={"col"} class="w-full gap-2 pt-2">
              <Text color={"muted"}>
                Used as the System Prompt when summarizing the story.
              </Text>
              <label class="flex items-center gap-2 mb-1 cursor-pointer">
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm"
                  checked={!useDefaultPrompts.memoryGeneratorPrompt}
                  onChange={(e) => {
                    if (!e.currentTarget.checked) {
                      debouncedPatch({
                        Prompts: {
                          memoryGeneratorPrompt:
                            DEFAULT_PROMPTS.memoryGeneratorPrompt,
                        },
                      });
                    }
                    setUseDefaultPrompts("memoryGeneratorPrompt", (v) => !v);
                  }}
                />
                <Text>Use Custom Prompt</Text>
              </label>
              <TextareaAutosize
                placeholder="Type here"
                class="textarea textarea-bordered resize-none w-full min-h-40"
                value={settingsStore.settings.Prompts.memoryGeneratorPrompt}
                disabled={useDefaultPrompts.memoryGeneratorPrompt}
                // @ts-ignore
                onInput={(e) => {
                  debouncedPatch({
                    Prompts: {
                      memoryGeneratorPrompt: e.currentTarget.value,
                    },
                  });
                }}
              />
            </Flex>
          </div>
        </details>
        <details class="collapse collapse-arrow bg-base-100 border-base-300 rounded border-b shadow hover:shadow-lg">
          <summary class="collapse-title font-semibold cursor-pointer select-none">
            Story Card Generator Prompt
          </summary>
          <div class="collapse-content">
            <Flex direction={"col"} class="w-full gap-2 pt-2">
              <Text color={"muted"}>
                Used as the System Prompt when creating new story cards.
              </Text>
              <label class="flex items-center gap-2 mb-1 cursor-pointer">
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm"
                  checked={!useDefaultPrompts.storyCardGeneratorPrompt}
                  onChange={(e) => {
                    if (!e.currentTarget.checked) {
                      debouncedPatch({
                        Prompts: {
                          storyCardGeneratorPrompt:
                            DEFAULT_PROMPTS.storyCardGeneratorPrompt,
                        },
                      });
                    }
                    setUseDefaultPrompts("storyCardGeneratorPrompt", (v) => !v);
                  }}
                />
                <Text>Use Custom Prompt</Text>
              </label>
              <TextareaAutosize
                placeholder="Type here"
                class="textarea textarea-bordered resize-none w-full min-h-40"
                value={settingsStore.settings.Prompts.storyCardGeneratorPrompt}
                disabled={useDefaultPrompts.storyCardGeneratorPrompt}
                // @ts-ignore
                onInput={(e) => {
                  debouncedPatch({
                    Prompts: {
                      storyCardGeneratorPrompt: e.currentTarget.value,
                    },
                  });
                }}
              />
            </Flex>
          </div>
        </details>
        <details class="collapse collapse-arrow bg-base-100 border-base-300 rounded border-b shadow hover:shadow-lg">
          <summary class="collapse-title font-semibold cursor-pointer select-none">
            Scenario Generator Prompt
          </summary>
          <div class="collapse-content">
            <Flex direction={"col"} class="w-full gap-2 pt-2">
              <Text color={"muted"}>
                Used as the System Prompt when creating new scenarios.
              </Text>
              <label class="flex items-center gap-2 mb-1 cursor-pointer">
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm"
                  checked={!useDefaultPrompts.scenarioGeneratorPrompt}
                  onChange={(e) => {
                    if (!e.currentTarget.checked) {
                      debouncedPatch({
                        Prompts: {
                          scenarioGeneratorPrompt:
                            DEFAULT_PROMPTS.scenarioGeneratorPrompt,
                        },
                      });
                    }
                    setUseDefaultPrompts("scenarioGeneratorPrompt", (v) => !v);
                  }}
                />
                <Text>Use Custom Prompt</Text>
              </label>
              <TextareaAutosize
                placeholder="Type here"
                class="textarea textarea-bordered resize-none w-full min-h-40"
                value={settingsStore.settings.Prompts.scenarioGeneratorPrompt}
                disabled={useDefaultPrompts.scenarioGeneratorPrompt}
                // @ts-ignore
                onInput={(e) => {
                  debouncedPatch({
                    Prompts: {
                      scenarioGeneratorPrompt: e.currentTarget.value,
                    },
                  });
                }}
              />
            </Flex>
          </div>
        </details>
      </Flex>

      <Modal
        class="p-0! bg-base-200 shadow"
        open={confirmModalOpen()}
        onClose={() => setConfirmModalOpen(false)}
      >
        <Flex direction={"col"} class="p-6 gap-4">
          <Text variant={"h3"} weight={"bold"}>
            Reset settings to default?
          </Text>
          <Flex class="w-full gap-2 mt-2">
            <button
              class="btn flex-1"
              onClick={() => setConfirmModalOpen(false)}
            >
              Cancel
            </button>
            <button
              class="btn btn-error flex-1"
              onClick={() => {
                debouncedPatch({
                  Prompts: DEFAULT_PROMPTS,
                });
                setConfirmModalOpen(false);
              }}
            >
              Reset
            </button>
          </Flex>
        </Flex>
      </Modal>
    </Flex>
  );
}

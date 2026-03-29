import { Flex, Text } from "@/app/components";
import { PanelLabel } from "./PanelLabel";
import { settingsStore } from "@/store";
import { debouncedPatch } from "./Settings";
import { createStore } from "solid-js/store";
import { DEFAULT_SETTINGS } from "@/core/defaults";

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
  return (
    <Flex direction={"col"} class="gap-2">
      <PanelLabel>Prompts</PanelLabel>
      <Flex direction={"col"} class="gap-2 px-4">
        <Flex justify={"between"} align={"center"} class="w-full py-1">
          <Text variant={"h5"} class="leading-none">
            System Prompts
          </Text>
          <button class="btn btn-error">
            <Text class="text-error-content">Reset to Default</Text>
          </button>
        </Flex>
        <hr />
        <div class="collapse collapse-arrow flex-1 border-base-300 rounded-none border-b shadow hover:shadow-lg ">
          <input type="checkbox" />
          <Text class="collapse-title font-semibold">Main System Prompt</Text>
          <div class="collapse-content">
            <Flex direction={"col"} class="flex-1 gap-1">
              <Text color={"muted"}>
                Injected at the top of every request as the system prompt. Can
                be overridden per-scenario or per-adventure.
              </Text>
              <label class="flex gap-2 md-2">
                <Text>Use Custom Prompt</Text>
                <input
                  type="checkbox"
                  class="checkbox"
                  checked={!useDefaultPrompts.defaultSystemPrompt}
                  onClick={(e) => {
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
              </label>
              <textarea
                placeholder="Type here"
                class="textarea resize-none w-full h-40"
                value={settingsStore.settings.Prompts.defaultSystemPrompt}
                disabled={useDefaultPrompts.defaultSystemPrompt}
                onInput={({ target }) => {
                  debouncedPatch({
                    Prompts: {
                      defaultSystemPrompt: target.value,
                    },
                  });
                }}
              />
            </Flex>
          </div>
        </div>
        <div class="collapse collapse-arrow flex-1 border-base-300 rounded-none border-b shadow hover:shadow-lg ">
          <input type="checkbox" />
          <Text class="collapse-title font-semibold">
            Memory Generator Prompt
          </Text>
          <div class="collapse-content">
            <Flex direction={"col"} class="flex-1 gap-1">
              <Text color={"muted"}>
                Used as the System Prompt when summarizing the story.
              </Text>
              <label class="flex gap-2 md-2">
                <Text>Use Custom Prompt</Text>
                <input
                  type="checkbox"
                  class="checkbox"
                  checked={!useDefaultPrompts.memoryGeneratorPrompt}
                  onClick={(e) => {
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
              </label>
              <textarea
                placeholder="Type here"
                class="textarea resize-none w-full h-40"
                value={settingsStore.settings.Prompts.memoryGeneratorPrompt}
                disabled={useDefaultPrompts.memoryGeneratorPrompt}
                onInput={({ target }) => {
                  debouncedPatch({
                    Prompts: {
                      memoryGeneratorPrompt: target.value,
                    },
                  });
                }}
              />
            </Flex>
          </div>
        </div>
        <div class="collapse collapse-arrow flex-1 border-base-300 rounded-none border-b shadow hover:shadow-lg ">
          <input type="checkbox" />
          <Text class="collapse-title font-semibold">
            Story Card Generator Prompt
          </Text>
          <div class="collapse-content">
            <Flex direction={"col"} class="flex-1 gap-1">
              <Text color={"muted"}>
                Used as the System Prompt when creating new story cards.
              </Text>
              <label class="flex gap-2 md-2">
                <Text>Use Custom Prompt</Text>
                <input
                  type="checkbox"
                  class="checkbox"
                  checked={!useDefaultPrompts.storyCardGeneratorPrompt}
                  onClick={(e) => {
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
              </label>
              <textarea
                placeholder="Type here"
                class="textarea resize-none w-full h-40"
                value={settingsStore.settings.Prompts.storyCardGeneratorPrompt}
                disabled={useDefaultPrompts.storyCardGeneratorPrompt}
                onInput={({ target }) => {
                  debouncedPatch({
                    Prompts: {
                      storyCardGeneratorPrompt: target.value,
                    },
                  });
                }}
              />
            </Flex>
          </div>
        </div>
        <div class="collapse collapse-arrow flex-1 border-base-300 rounded-none border-b shadow hover:shadow-lg ">
          <input type="checkbox" />
          <Text class="collapse-title font-semibold">
            Scenario Generator Prompt
          </Text>
          <div class="collapse-content">
            <Flex direction={"col"} class="flex-1 gap-1">
              <Text color={"muted"}>
                Used as the System Prompt when creating new scenarios.
              </Text>
              <label class="flex gap-2 md-2">
                <Text>Use Custom Prompt</Text>
                <input
                  type="checkbox"
                  class="checkbox"
                  checked={!useDefaultPrompts.scenarioGeneratorPrompt}
                  onClick={(e) => {
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
              </label>
              <textarea
                placeholder="Type here"
                class="textarea resize-none w-full h-40"
                value={settingsStore.settings.Prompts.scenarioGeneratorPrompt}
                disabled={useDefaultPrompts.scenarioGeneratorPrompt}
                onInput={({ target }) => {
                  debouncedPatch({
                    Prompts: {
                      scenarioGeneratorPrompt: target.value,
                    },
                  });
                }}
              />
            </Flex>
          </div>
        </div>
      </Flex>
    </Flex>
  );
}

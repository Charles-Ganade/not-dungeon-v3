import { Modal, Flex, Text, Box } from "@/app/components";
import { GlobalSettings } from "@/core/types";
import {
  createEffect,
  createResource,
  createSignal,
  For,
  Match,
  Show,
  Switch,
} from "solid-js";
import { PanelLabel } from "./PanelLabel";
import { listModels, listProviders } from "@/services/llm";
import { settingsStore } from "@/store";
import { FaSolidEye, FaSolidEyeSlash, FaSolidRefresh } from "solid-icons/fa";
import { debounce, cn } from "@/utils";

interface SettingsProps {
  open: () => boolean;
  onClose: () => void;
}

const GLOBAL_SETTING_KEYS: (keyof GlobalSettings)[] = [
  "UI",
  "API",
  "Parameters",
  "Prompts",
];

const fetchModels = ([providerId, endpoint, apiKey]: Parameters<
  typeof listModels
>) => listModels(providerId, endpoint, apiKey);

const debouncedPatch = debounce(settingsStore.patch, 200);

export function Settings(props: SettingsProps) {
  const source = () =>
    [
      settingsStore.settings.API.providerId,
      settingsStore.settings.API.endpoint,
      settingsStore.settings.API.apiKey,
    ] as Parameters<typeof listModels>;
  const [listModelsResult, { refetch: refetchModels }] = createResource(
    source,
    fetchModels,
  );
  const [showApiKey, setShowApiKey] = createSignal(false);

  const [currentSettingsTab, setCurrentSettingsTab] =
    createSignal<keyof GlobalSettings>("UI");
  return (
    <Modal
      open={props.open()}
      class="p-0! min-h-[80vh] grid bg-base-200 shadow"
      size={"full"}
      closeOnEsc
      onClose={props.onClose}
    >
      <div class="grid grid-cols-6 h-full">
        <Flex
          direction={"col"}
          class="col-span-1 menu w-full p-4 gap-2 bg-base-300"
        >
          <For each={GLOBAL_SETTING_KEYS}>
            {(key) => (
              <li>
                <Text
                  as="a"
                  class={cn(
                    currentSettingsTab() === key &&
                      "menu-active text-white font-extrabold",
                    "rounded-md",
                  )}
                  onClick={() => {
                    setCurrentSettingsTab(key);
                  }}
                >
                  {key}
                </Text>
              </li>
            )}
          </For>
        </Flex>
        <Box class="col-span-5 flex-col">
          <Switch>
            <Match when={currentSettingsTab() === "UI"}>
              <Flex direction={"col"} class="gap-2">
                <PanelLabel>UI Settings</PanelLabel>
              </Flex>
            </Match>
            <Match when={currentSettingsTab() === "API"}>
              <Flex direction={"col"} class="gap-2">
                <PanelLabel>API Settings</PanelLabel>
                <Flex direction={"col"} class="px-4">
                  <Flex>
                    <div>
                      <Text>Provider</Text>
                      <select class="select rounded-md">
                        <For each={listProviders()}>
                          {(provider) => (
                            <option
                              selected={
                                settingsStore.settings.API.providerId ===
                                provider.id
                              }
                              onClick={async () => {
                                await settingsStore.patch({
                                  API: { providerId: provider.id },
                                });
                              }}
                            >
                              {provider.label}
                            </option>
                          )}
                        </For>
                      </select>
                    </div>
                    <div class="flex-1">
                      <Text>Base URL</Text>
                      <input
                        type="text"
                        placeholder="Type here"
                        class="input rounded-md w-full"
                        value={settingsStore.settings.API.endpoint}
                        onInput={({ target }) => {
                          debouncedPatch({
                            API: {
                              endpoint: target.value,
                            },
                          });
                        }}
                      />
                    </div>
                  </Flex>
                  <div>
                    <Text>API Key</Text>
                    <label class="input w-full rounded-md">
                      <input
                        type={showApiKey() ? "text" : "password"}
                        class="grow"
                        placeholder="API Key"
                        value={settingsStore.settings.API.apiKey}
                        onInput={({ target }) => {
                          debouncedPatch({
                            API: {
                              apiKey: target.value,
                            },
                          });
                        }}
                      />
                      <button
                        class="btn btn-xs btn-ghost"
                        onClick={() => setShowApiKey((v) => !v)}
                      >
                        <Show when={showApiKey()} fallback={<FaSolidEye />}>
                          <FaSolidEyeSlash />
                        </Show>
                      </button>
                    </label>
                  </div>
                  <div>
                    <Text>Model</Text>
                    <Flex class="gap-2">
                      <select class="select rounded-md flex-1">
                        <Show when={!listModelsResult.error}>
                          <For each={listModelsResult() ?? []}>
                            {(model) => (
                              <option
                                selected={
                                  settingsStore.settings.API.model === model
                                }
                                onClick={() => {
                                  settingsStore.patch({ API: { model } });
                                }}
                              >
                                {model}
                              </option>
                            )}
                          </For>
                        </Show>
                      </select>
                      <button
                        class="btn btn-primary rounded-md"
                        onClick={refetchModels}
                      >
                        <FaSolidRefresh />
                      </button>
                    </Flex>
                  </div>
                </Flex>
              </Flex>
            </Match>
            <Match when={currentSettingsTab() === "Prompts"}>
              <Flex direction={"col"} class="gap-2">
                <PanelLabel>Prompts</PanelLabel>
              </Flex>
            </Match>
            <Match when={currentSettingsTab() === "Parameters"}>
              <Flex direction={"col"} class="gap-2">
                <PanelLabel>Model Parameters</PanelLabel>
              </Flex>
            </Match>
          </Switch>
        </Box>
      </div>
    </Modal>
  );
}

import {
  get as getProvider,
  list as listProviders,
} from "@/services/llm/registry";
import { settingsStore } from "@/store";
import { FaSolidEye, FaSolidEyeSlash, FaSolidRefresh } from "solid-icons/fa";
import {
  For,
  Show,
  createSignal,
  createEffect,
  createResource,
  on,
} from "solid-js";
import { PanelLabel } from "../PanelLabel";
import { Flex, Text } from "@/app/components";
import { listModels } from "@/services/llm";
import { toast } from "solid-sonner";
import { debouncedPatch } from "../Settings";

const fetchModels = async ([providerId, endpoint, apiKey]: Parameters<
  typeof listModels
>) => {
  try {
    return await listModels(providerId, endpoint, apiKey);
  } catch (err) {
    toast.error((err as Error).message ?? "Something went wrong");
    return [];
  }
};

export function APIPanel() {
  const [showApiKey, setShowApiKey] = createSignal(false);
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

  return (
    <Flex direction={"col"} class="gap-2 w-full">
      <PanelLabel>API Settings</PanelLabel>
      <Flex direction={"col"} class="px-4">
        <Flex>
          <div>
            <Text>Provider</Text>
            <select
              class="select inline"
              value={settingsStore.settings.API.providerId}
              onChange={(e) => {
                settingsStore.patch({
                  API: { providerId: e.currentTarget.value, model: "" },
                });
              }}
            >
              <option
                disabled
                selected={
                  listProviders().findIndex(
                    (v) => v.id === settingsStore.settings.API.providerId,
                  ) === -1
                }
              >
                Select a provider
              </option>
              <For each={listProviders()}>
                {(provider) => (
                  <option
                    value={provider.id}
                    selected={
                      settingsStore.settings.API.providerId === provider.id
                    }
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
              placeholder={
                getProvider(settingsStore.settings.API.providerId).baseURL
              }
              class="input  w-full"
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
          <label class="input w-full ">
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
            <select
              class="select inline flex-1"
              value={settingsStore.settings.API.model}
              onChange={(e) => {
                settingsStore.patch({ API: { model: e.currentTarget.value } });
              }}
            >
              <option
                disabled
                selected={
                  listModelsResult()?.findIndex(
                    (model) => settingsStore.settings.API.model === model,
                  ) === -1 || !listModelsResult()
                }
              >
                Select a model
              </option>
              <Show when={!listModelsResult.error}>
                <For each={listModelsResult() ?? []}>
                  {(model) => (
                    <option
                      value={model}
                      selected={settingsStore.settings.API.model === model}
                    >
                      {model}
                    </option>
                  )}
                </For>
              </Show>
            </select>
            <button class="btn btn-primary " onClick={refetchModels}>
              <FaSolidRefresh />
            </button>
          </Flex>
        </div>
      </Flex>
    </Flex>
  );
}

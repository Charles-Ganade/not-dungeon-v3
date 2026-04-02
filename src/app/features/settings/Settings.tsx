import { Modal, Flex, Text, Box } from "@/app/components";
import { GlobalSettings } from "@/core/types";
import { createSignal, For } from "solid-js";
import { cn } from "@/utils";
import { settingsStore } from "@/store";
import { debounce } from "lodash";
import { APIPanel } from "./panels/ApiPanel";
import { ParametersPanel } from "./panels/ParametersPanel";
import { PromptsPanel } from "./panels/PromptsPanel";
import { UiPanel } from "./panels/UiPanel";

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

const PATCH_DEBOUNCE_DURATION = 1000;
export const debouncedPatch = debounce(
  settingsStore.patch,
  PATCH_DEBOUNCE_DURATION,
);

export function Settings(props: SettingsProps) {
  const [currentSettingsTab, setCurrentSettingsTab] =
    createSignal<keyof GlobalSettings>("UI");
  return (
    <Modal
      open={props.open()}
      class="p-0! h-[80vh] bg-base-200 shadow rounded-b-xl"
      size={"full"}
      closeOnEsc
      onClose={props.onClose}
    >
      <div class="flex flex-col md:grid md:grid-cols-6 h-full min-h-0 w-full">
        <ul class="menu menu-horizontal md:menu-vertical md:col-span-1 w-full flex-nowrap md:flex-wrap overflow-x-auto bg-base-300 shrink-0 p-2 md:p-4 gap-1 md:gap-2 z-10 shadow-sm md:shadow-none">
          <For each={GLOBAL_SETTING_KEYS}>
            {(key) => (
              <li>
                <Text
                  as="a"
                  class={cn(
                    currentSettingsTab() === key &&
                      "menu-active text-white font-extrabold",
                    "rounded-md whitespace-nowrap",
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
        </ul>
        <Box class="md:col-span-5 flex flex-col flex-1 min-h-0">
          <div
            class={cn(
              "flex-1 flex w-full min-h-0",
              currentSettingsTab() !== "API" && "hidden",
            )}
          >
            <APIPanel />
          </div>
          <div
            class={cn(
              "flex-1 flex w-full min-h-0",
              currentSettingsTab() !== "Parameters" && "hidden",
            )}
          >
            <ParametersPanel />
          </div>
          <div
            class={cn(
              "flex-1 flex w-full min-h-0",
              currentSettingsTab() !== "Prompts" && "hidden",
            )}
          >
            <PromptsPanel />
          </div>
          <div
            class={cn(
              "flex-1 flex w-full min-h-0",
              currentSettingsTab() !== "UI" && "hidden",
            )}
          >
            <UiPanel />
          </div>
        </Box>
      </div>
    </Modal>
  );
}

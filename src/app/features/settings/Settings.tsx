import { Modal, Flex, Text, Box } from "@/app/components";
import { GlobalSettings } from "@/core/types";
import { createSignal, For } from "solid-js";
import { cn, debounce } from "@/utils";
import { APIPanel } from "./ApiPanel";
import { settingsStore } from "@/store";
import { ParametersPanel } from "./ParametersPanel";
import { UiPanel } from "./UiPanel";
import { PromptsPanel } from "./PromptsPanel";

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
      class="p-0! min-h-[80vh] grid bg-base-200 shadow"
      size={"full"}
      closeOnEsc
      onClose={props.onClose}
    >
      <div class="grid grid-cols-6 h-full">
        <Flex
          direction={"col"}
          class="col-span-1 menu w-full p-4 gap-2 bg-base-300"
          as={"ul"}
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
          <div class={cn(currentSettingsTab() !== "API" && "hidden")}>
            <APIPanel />
          </div>
          <div class={cn(currentSettingsTab() !== "Parameters" && "hidden")}>
            <ParametersPanel />
          </div>
          <div class={cn(currentSettingsTab() !== "Prompts" && "hidden")}>
            <PromptsPanel />
          </div>
          <div class={cn(currentSettingsTab() !== "UI" && "hidden")}>
            <UiPanel />
          </div>
        </Box>
      </div>
    </Modal>
  );
}

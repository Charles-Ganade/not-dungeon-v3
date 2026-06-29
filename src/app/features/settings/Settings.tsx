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
import { GamePanel } from "./panels/GamePanel";
import { ScriptsPanel } from "./panels/ScriptsPanel";
import { DataPanel } from "./panels/DataPanel";
import { PluginsPanel } from "./panels/PluginsPanel";

interface SettingsProps {
  open: () => boolean;
  onClose: () => void;
}

/** Settings tabs: the stored GlobalSettings sections plus action-only tabs. */
type SettingsTab = keyof GlobalSettings | "Plugins" | "Data";

const GLOBAL_SETTING_KEYS: SettingsTab[] = [
  "UI",
  "API",
  "Parameters",
  "Prompts",
  "Game",
  "Scripts",
  "Plugins",
  "Data",
];

const PATCH_DEBOUNCE_DURATION = 1000;
export const debouncedPatch = debounce(
  settingsStore.patch,
  PATCH_DEBOUNCE_DURATION,
);

export function Settings(props: SettingsProps) {
  const [currentSettingsTab, setCurrentSettingsTab] =
    createSignal<SettingsTab>("UI");
  return (
    <Modal
      open={props.open()}
      class="p-0! h-[80vh] bg-base-200 shadow rounded-b-xl"
      size={"full"}
      closeOnEsc
      onClose={props.onClose}
    >
      <div class="flex flex-col md:grid md:grid-cols-6 h-full min-h-0 w-full">
        <ul class="menu menu-horizontal md:menu-vertical md:col-span-1 w-full flex-nowrap overflow-x-auto md:overflow-x-hidden md:overflow-y-auto bg-base-300 shrink-0 p-2 md:p-4 gap-1 md:gap-2 z-10 shadow-sm md:shadow-none">
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
              "flex-1 flex w-full min-h-0 overflow-y-auto",
              currentSettingsTab() !== "API" && "hidden",
            )}
          >
            <APIPanel />
          </div>
          <div
            class={cn(
              "flex-1 flex w-full min-h-0 overflow-y-auto",
              currentSettingsTab() !== "Parameters" && "hidden",
            )}
          >
            <ParametersPanel />
          </div>
          <div
            class={cn(
              "flex-1 flex w-full min-h-0 overflow-y-auto",
              currentSettingsTab() !== "Prompts" && "hidden",
            )}
          >
            <PromptsPanel />
          </div>
          <div
            class={cn(
              "flex-1 flex w-full min-h-0 overflow-y-auto",
              currentSettingsTab() !== "UI" && "hidden",
            )}
          >
            <UiPanel />
          </div>
          <div
            class={cn(
              "flex-1 flex w-full min-h-0 overflow-y-auto",
              currentSettingsTab() !== "Game" && "hidden",
            )}
          >
            <GamePanel />
          </div>
          <div
            class={cn(
              "flex-1 flex w-full min-h-0 overflow-y-auto",
              currentSettingsTab() !== "Scripts" && "hidden",
            )}
          >
            <ScriptsPanel />
          </div>
          <div
            class={cn(
              "flex-1 flex w-full min-h-0 overflow-y-auto",
              currentSettingsTab() !== "Plugins" && "hidden",
            )}
          >
            <PluginsPanel />
          </div>
          <div
            class={cn(
              "flex-1 flex w-full min-h-0 overflow-y-auto",
              currentSettingsTab() !== "Data" && "hidden",
            )}
          >
            <DataPanel />
          </div>
        </Box>
      </div>
    </Modal>
  );
}

import { Modal, Flex, Text, Box } from "@/app/components";
import { createSignal, For } from "solid-js";
import { cn } from "@/utils";
import { settingsStore } from "@/store";
import { debounce } from "lodash";
import { ScriptsPanel } from "./configPanels/ScriptsPanel";
import { DebugPanel } from "./configPanels/DebugPanel";
import { StoryCardPanel } from "./configPanels/StoryCardPanel";
import { PlotPanel } from "./configPanels/PlotPanel";
import { StoryPanel } from "./configPanels/StoryPanel";
import { MemoriesPanel } from "./configPanels/MemoriesPanel";

interface SettingsProps {
  open: () => boolean;
  onClose: () => void;
}

const CONFIG_TABS = [
  "Story",
  "Plot",
  "Story Cards",
  "Memories",
  "Scripts",
  "Debug Panel",
] as const;

const PATCH_DEBOUNCE_DURATION = 1000;
export const debouncedPatch = debounce(
  settingsStore.patch,
  PATCH_DEBOUNCE_DURATION,
);

export function Config(props: SettingsProps) {
  const [currentConfigTab, setCurrentConfigTab] =
    createSignal<(typeof CONFIG_TABS)[number]>("Story");
  return (
    <Modal
      open={props.open()}
      class="p-0! h-[80vh] bg-base-200 shadow"
      size={"full"}
      onClose={props.onClose}
      closeOnEsc={false}
    >
      <div class="flex flex-col md:grid md:grid-cols-6 h-full min-h-0 w-full">
        <ul class="menu menu-horizontal md:menu-vertical md:col-span-1 w-full flex-nowrap md:flex-wrap overflow-x-auto bg-base-300 shrink-0 p-2 md:p-4 gap-1 md:gap-2 z-10 shadow-sm md:shadow-none">
          <For each={CONFIG_TABS}>
            {(key) => (
              <li>
                <Text
                  as="a"
                  class={cn(
                    currentConfigTab() === key &&
                      "menu-active text-white font-extrabold",
                    "rounded-md whitespace-nowrap",
                  )}
                  onClick={() => {
                    setCurrentConfigTab(key);
                  }}
                >
                  {key}
                </Text>
              </li>
            )}
          </For>
        </ul>
        <Flex class="md:col-span-5 flex-col flex-1 min-h-0">
          <div
            class={cn(
              "flex-1 flex min-h-0",
              currentConfigTab() !== "Story" && "hidden",
            )}
          >
            <StoryPanel />
          </div>
          <div
            class={cn(
              "flex-1 flex min-h-0",
              currentConfigTab() !== "Plot" && "hidden",
            )}
          >
            <PlotPanel />
          </div>
          <div
            class={cn(
              "flex-1 flex min-h-0",
              currentConfigTab() !== "Story Cards" && "hidden",
            )}
          >
            <StoryCardPanel />
          </div>
          <div
            class={cn(
              "flex-1 flex min-h-0",
              currentConfigTab() !== "Memories" && "hidden",
            )}
          >
            <MemoriesPanel />
          </div>
          <div
            class={cn(
              "flex-1 flex min-h-0",
              currentConfigTab() !== "Scripts" && "hidden",
            )}
          >
            <ScriptsPanel />
          </div>
          <div
            class={cn(
              "flex-1 flex min-h-0",
              currentConfigTab() !== "Debug Panel" && "hidden",
            )}
          >
            <DebugPanel />
          </div>
        </Flex>
      </div>
    </Modal>
  );
}

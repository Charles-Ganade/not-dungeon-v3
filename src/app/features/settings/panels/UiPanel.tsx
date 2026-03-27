import { Flex, Text } from "@/app/components";
import { PanelLabel } from "../PanelLabel";
import { For } from "solid-js";
import { Themes } from "@/core/types";
import { settingsStore } from "@/store";
import { debouncedPatch } from "../Settings";

export function UiPanel() {
  return (
    <Flex direction={"col"} class="gap-2 w-full">
      <PanelLabel>UI Settings</PanelLabel>
      <Flex direction={"col"} class="px-4 gap-2">
        <div>
          <Text>Theme</Text>
          <select
            class="select"
            value={settingsStore.settings.UI.theme}
            onChange={(e) => {
              settingsStore.patch({
                UI: {
                  theme: e.currentTarget.value as "system" | "light" | "dark",
                },
              });
            }}
          >
            <For each={Themes}>
              {(theme) => (
                <option
                  value={theme}
                  selected={settingsStore.settings.UI.theme === theme}
                >
                  {theme}
                </option>
              )}
            </For>
          </select>
        </div>
        <div>
          <Text>UI Scale (0.8 - 1.5, default 1 )</Text>
          <input
            type="number"
            min={0.8}
            max={1.5}
            step={0.1}
            class="input"
            value={settingsStore.settings.UI.uiScale}
            onInput={({ target }) =>
              debouncedPatch({
                UI: { uiScale: Number(target.value) },
              })
            }
          />
        </div>
        <div>
          <Text>Font Size (12 - 32, default 16)</Text>
          <input
            type="number"
            min={12}
            max={32}
            class="input"
            value={settingsStore.settings.UI.fontSize}
            onInput={({ target }) =>
              debouncedPatch({
                UI: { fontSize: Math.round(Number(target.value)) },
              })
            }
          />
        </div>
      </Flex>
    </Flex>
  );
}

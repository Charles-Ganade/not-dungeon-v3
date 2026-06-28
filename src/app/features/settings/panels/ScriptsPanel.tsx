import { Flex, Text } from "@/app/components";
import { PanelLabel } from "../PanelLabel";
import { settingsStore } from "@/store";
import { debouncedPatch } from "../Settings";
import { AiOutlineInfoCircle } from "solid-icons/ai";

export function ScriptsPanel() {
  return (
    <Flex direction={"col"} class="gap-2 w-full">
      <PanelLabel>Script Settings</PanelLabel>
      <div class="grid grid-cols-2 gap-4 px-4">
        <div>
          <Text class="flex gap-1.5">
            <span>Idle Timeout (seconds)</span>
            <div
              class="tooltip tooltip-right"
              data-tip="Max time a hook may run without progress before it is stopped. Paused while a ctx.ai call is in flight, so slow model calls are never killed for being slow."
            >
              <AiOutlineInfoCircle />
            </div>
          </Text>
          <input
            type="number"
            min={1}
            step={1}
            class="input w-full"
            value={settingsStore.settings.Scripts.idleTimeoutMs / 1000}
            onInput={({ target }) =>
              debouncedPatch({
                Scripts: {
                  idleTimeoutMs: Math.max(
                    1000,
                    Math.round(Number(target.value) * 1000),
                  ),
                },
              })
            }
          />
        </div>
        <div>
          <Text class="flex gap-1.5">
            <span>Max Script Time (seconds)</span>
            <div
              class="tooltip tooltip-left"
              data-tip="Absolute ceiling for a single hook, including any model calls it makes. Backstops runaway scripts."
            >
              <AiOutlineInfoCircle />
            </div>
          </Text>
          <input
            type="number"
            min={1}
            step={1}
            class="input w-full"
            value={settingsStore.settings.Scripts.maxTimeoutMs / 1000}
            onInput={({ target }) =>
              debouncedPatch({
                Scripts: {
                  maxTimeoutMs: Math.max(
                    1000,
                    Math.round(Number(target.value) * 1000),
                  ),
                },
              })
            }
          />
        </div>
      </div>
    </Flex>
  );
}

import { Flex, Modal, Text } from "@/app/components";
import { PanelLabel } from "../PanelLabel";
import { settingsStore } from "@/store";
import { debouncedPatch } from "../Settings";
import { AiOutlineInfoCircle } from "solid-icons/ai";
import { DEFAULT_SETTINGS } from "@/core/defaults";
import { createSignal } from "solid-js";

export function ParametersPanel() {
  const [confirmModalOpen, setConfirmModalOpen] = createSignal(false);
  return (
    <Flex direction={"col"} class="gap-2 w-full">
      <PanelLabel>Model Parameters</PanelLabel>
      <div class="grid grid-cols-2 gap-4 px-4">
        <div>
          <Text class="flex gap-1.5">
            <span>Context Window ({">"}= 4096)</span>
            <div
              class="tooltip tooltip-right"
              data-tip="Maximum is determined by current model. Informs the engine on the available context budget."
            >
              <AiOutlineInfoCircle />
            </div>
          </Text>
          <input
            type="number"
            min={4096}
            step={1}
            class="input w-full"
            value={settingsStore.settings.Parameters.contextWindow}
            onInput={({ target }) =>
              debouncedPatch({
                Parameters: { contextWindow: Math.round(Number(target.value)) },
              })
            }
          />
        </div>
        <div>
          <Text>Max Output Tokens</Text>
          <input
            type="text"
            class="input w-full"
            value={settingsStore.settings.Parameters.maxOutputTokens}
            onInput={({ target }) =>
              debouncedPatch({
                Parameters: { maxOutputTokens: Number(target.value) },
              })
            }
          />
        </div>
        <div>
          <Text>Temperature (0.00 - 2.00)</Text>
          <input
            type="number"
            min={0.0}
            max={2.0}
            step={0.01}
            class="input w-full"
            value={settingsStore.settings.Parameters.temperature}
            onInput={({ target }) =>
              debouncedPatch({
                Parameters: { temperature: Number(target.value) },
              })
            }
          />
        </div>
        <div>
          <Text>Top P (0.00 - 1.00)</Text>
          <input
            type="number"
            min={0.0}
            max={1.0}
            step={0.01}
            class="input w-full"
            value={settingsStore.settings.Parameters.topP}
            onInput={({ target }) =>
              debouncedPatch({
                Parameters: { topP: Number(target.value) },
              })
            }
          />
        </div>
        <div>
          <Text>Frequency Penalty (-2.00 - 2.00)</Text>
          <input
            type="number"
            min={-2.0}
            max={2.0}
            step={0.01}
            class="input w-full"
            value={settingsStore.settings.Parameters.frequencyPenalty}
            onInput={({ target }) =>
              debouncedPatch({
                Parameters: { frequencyPenalty: Number(target.value) },
              })
            }
          />
        </div>
        <div>
          <Text>Presence Penalty (-2.00 - 2.00)</Text>
          <input
            type="number"
            min={-2.0}
            max={2.0}
            step={0.01}
            class="input w-full"
            value={settingsStore.settings.Parameters.presencePenalty}
            onInput={({ target }) =>
              debouncedPatch({
                Parameters: { presencePenalty: Number(target.value) },
              })
            }
          />
        </div>
        <div>
          <Text class="flex gap-1.5">
            <span>Stop Sequences</span>
            <div
              class="tooltip"
              data-tip="Comma-delineated sequences. The model halts generation at any of these."
            >
              <AiOutlineInfoCircle />
            </div>
          </Text>
          <input
            type="text"
            class="input w-full"
            value={settingsStore.settings.Parameters.stop.join(",")}
            onInput={({ target }) => {
              debouncedPatch({
                Parameters: {
                  stop: target.value
                    .split(",")
                    .map((v) => v.trim())
                    .filter((v) => v !== ""),
                },
              });
            }}
          />
        </div>
        <Flex align={"center"}>
          <Text class="flex gap-1.5">
            <span>Allow Thinking</span>
            <div
              class="tooltip"
              data-tip="Allow model reasoning if supported. Reasoning tokens are sent to a different panel in-game."
            >
              <AiOutlineInfoCircle />
            </div>
          </Text>
          <input
            type="checkbox"
            class="toggle"
            checked={settingsStore.settings.Parameters.thinkingEnabled}
            onChange={() => {
              debouncedPatch({
                Parameters: {
                  thinkingEnabled:
                    !settingsStore.settings.Parameters.thinkingEnabled,
                },
              });
            }}
          />
        </Flex>
        <div class="col-span-2">
          <button
            class="btn btn-error w-full"
            onClick={() => setConfirmModalOpen(true)}
          >
            <Text class="text-error-content">Reset to Default</Text>
          </button>
        </div>
      </div>
      <Modal
        class="p-0! grid bg-base-200 shadow"
        open={confirmModalOpen()}
        onClose={() => setConfirmModalOpen(false)}
      >
        <Flex direction={"col"} class="p-6 gap-4">
          <Text variant={"h3"} weight={"bold"}>
            Are you sure you want to reset the settings to default?
          </Text>
          <Flex class="p-2">
            <button
              class="btn btn-lg flex-1"
              onClick={() => setConfirmModalOpen(false)}
            >
              <Text>Cancel</Text>
            </button>
            <button
              class="btn btn-error flex-1"
              onClick={() => {
                debouncedPatch({
                  Parameters: DEFAULT_SETTINGS.Parameters,
                });
                setConfirmModalOpen(false);
              }}
            >
              <Text>Delete</Text>
            </button>
          </Flex>
        </Flex>
      </Modal>
    </Flex>
  );
}

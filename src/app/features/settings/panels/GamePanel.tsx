import { Flex, Text } from "@/app/components";
import { PanelLabel } from "../PanelLabel";
import { settingsStore } from "@/store";
import { AiOutlineInfoCircle } from "solid-icons/ai";

export function GamePanel() {
  return (
    <Flex direction={"col"} class="gap-2 w-full">
      <PanelLabel>Game Settings</PanelLabel>
      <Flex direction={"col"} class="px-4 gap-2">
        <label class="flex gap-6 items-center cursor-pointer">
          <Text class="flex gap-2 items-center">
            <span>Count Input as an action</span>

            <div
              class="tooltip"
              data-tip="When enabled, turns makes two separate deltas for the user input and the AI's response."
            >
              <AiOutlineInfoCircle />
            </div>
          </Text>
          <input
            class="checkbox checkbox-primary"
            type="checkbox"
            checked={settingsStore.settings.Game.countInputsAsActions}
            onChange={(e) => {
              settingsStore.patch({
                Game: { countInputsAsActions: e.currentTarget.checked },
              });
            }}
          />
        </label>
        <label class="flex gap-6 items-center cursor-pointer">
          <Text class="flex gap-2 items-center">
            <span>Preserve Textbox on Fail</span>

            <div
              class="tooltip"
              data-tip="When enabled, if the current response fails, the old response is preserved and restored on the input."
            >
              <AiOutlineInfoCircle />
            </div>
          </Text>
          <input
            class="checkbox checkbox-primary"
            type="checkbox"
            checked={settingsStore.settings.Game.preserveTextboxOnFail}
            onChange={(e) => {
              settingsStore.patch({
                Game: { preserveTextboxOnFail: e.currentTarget.checked },
              });
            }}
          />
        </label>
      </Flex>
    </Flex>
  );
}

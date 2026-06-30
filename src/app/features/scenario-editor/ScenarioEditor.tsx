import { Flex, Text } from "@/app/components";
import { BsTextCenter, BsPuzzleFill } from "solid-icons/bs";
import { FiArrowLeft, FiCode, FiList, FiSave } from "solid-icons/fi";
import { RiDocumentFilePaperFill } from "solid-icons/ri";
import { Accessor, Setter } from "solid-js";
import { SetStoreFunction, Store } from "solid-js/store";
import {
  DefaultScenario,
  ScenarioEditorContext,
  ScenarioEditorMode,
} from "./context";
import { DetailsTab } from "./tabs/DetailsTab";
import { StoryTab } from "./tabs/StoryTab";
import { StoryCardsTab } from "./tabs/StoryCardsTab";
import { ScriptsTab } from "./tabs/ScriptsTab";
import { PluginsTab } from "./tabs/PluginsTab";

interface ScenarioEditorProps {
  mode: ScenarioEditorMode;
  title: string;
  scenario: Store<DefaultScenario>;
  setScenario: SetStoreFunction<DefaultScenario>;
  thumbBlob: Accessor<Blob | null>;
  setThumbBlob: Setter<Blob | null>;
  saveDisabled: boolean;
  onSave: () => void;
  onBack: () => void;
}

/**
 * Shared scaffold for creating and editing scenarios. The two modes differ only
 * in their store source, header title, save-enabled rule, and the Details tab's
 * import-vs-export action (keyed off `mode`); everything else is identical, so
 * both <CreateScenario> and <EditScenario> render through this.
 */
export function ScenarioEditor(props: ScenarioEditorProps) {
  return (
    <ScenarioEditorContext.Provider
      value={{
        mode: props.mode,
        scenario: props.scenario,
        setScenario: props.setScenario,
        thumbBlob: props.thumbBlob,
        setThumbBlob: props.setThumbBlob,
      }}
    >
      <Flex justify={"center"} class="flex-1 grow gap-0 overflow-x-hidden min-h-0">
        <Flex direction={"col"} class="w-full max-w-4xl gap-4 p-6">
          <Flex align={"center"} justify={"between"} class="border-b py-2">
            <div class="flex items-center gap-4">
              <button class="btn" onClick={() => props.onBack()}>
                <Text variant={"h5"} class="text-inherit">
                  <FiArrowLeft />
                </Text>
              </button>
              <Text variant={"h3"}>{props.title}</Text>
            </div>
            <button
              class="btn btn-primary"
              disabled={props.saveDisabled}
              onClick={() => props.onSave()}
            >
              <Text variant={"h5"} class="text-inherit">
                <FiSave />
              </Text>
              <Text class="text-inherit">Save</Text>
            </button>
          </Flex>
          <div class="w-full h-fit min-h-0">
            <div class="tabs tabs-box">
              <label class="tab">
                <input type="radio" name="scenario-tab" checked />
                <div class="flex items-center gap-2">
                  <Text class="text-inherit">
                    <FiList />
                  </Text>
                  <Text class="text-inherit">Details</Text>
                </div>
              </label>
              <DetailsTab />
              <label class="tab">
                <input type="radio" name="scenario-tab" />
                <div class="flex items-center gap-2">
                  <Text class="text-inherit">
                    <BsTextCenter />
                  </Text>
                  <Text class="text-inherit">Story</Text>
                </div>
              </label>
              <StoryTab />

              <label class="tab">
                <input type="radio" name="scenario-tab" />
                <div class="flex items-center gap-2">
                  <Text class="text-inherit">
                    <RiDocumentFilePaperFill />
                  </Text>
                  <Text class="text-inherit">Story Cards</Text>
                </div>
              </label>
              <StoryCardsTab />

              <label class="tab">
                <input type="radio" name="scenario-tab" />
                <div class="flex items-center gap-2">
                  <Text class="text-inherit">
                    <FiCode />
                  </Text>
                  <Text class="text-inherit">Scripts</Text>
                </div>
              </label>
              <ScriptsTab />

              <label class="tab">
                <input type="radio" name="scenario-tab" />
                <div class="flex items-center gap-2">
                  <Text class="text-inherit">
                    <BsPuzzleFill />
                  </Text>
                  <Text class="text-inherit">Plugins</Text>
                </div>
              </label>
              <PluginsTab />
            </div>
          </div>
        </Flex>
      </Flex>
    </ScenarioEditorContext.Provider>
  );
}

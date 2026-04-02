import { Flex, Text } from "@/app/components";
import { makeDefaultScenario } from "@/core/defaults";
import { useNavigate } from "@solidjs/router";
import { BsTextCenter } from "solid-icons/bs";
import { FiArrowLeft, FiCode, FiList, FiSave } from "solid-icons/fi";
import { RiDocumentFilePaperFill } from "solid-icons/ri";
import { createStore, unwrap } from "solid-js/store";
import { CreateScenarioContext, DefaultScenario } from "./context";
import { ScriptsTab } from "./tabs/ScriptsTab";
import { StoryTab } from "./tabs/StoryTab";
import { DetailsTab } from "./tabs/DetailsTab";
import { StoryCardsTab } from "./tabs/StoryCardsTab";
import { createMemo, createSignal } from "solid-js";
import { toast } from "solid-sonner";
import { libraryStore } from "@/store";

export default function CreateScenario() {
  const emptyScenario = makeDefaultScenario({ name: "" });
  const [newScenario, setNewScenario] =
    createStore<DefaultScenario>(emptyScenario);
  const [thumbBlob, setThumbBlob] = createSignal<Blob | null>(null);

  const navigator = useNavigate();

  const isSaveDisabled = createMemo(
    () =>
      newScenario.name.trim() === "" || newScenario.openingPrompt.trim() === "",
  );

  const handleSave = async () => {
    try {
      const thumbnail = thumbBlob();
      const resolved = makeDefaultScenario(unwrap(newScenario));
      const scenario = await (thumbnail
        ? libraryStore.addScenario(resolved, thumbnail)
        : libraryStore.addScenario(resolved));

      navigator(-1);
    } catch (e) {
      toast.error((e as any).message);
    }
  };

  return (
    <CreateScenarioContext.Provider
      value={{ newScenario, setNewScenario, thumbBlob, setThumbBlob }}
    >
      <Flex
        justify={"center"}
        class="flex-1 grow gap-0 overflow-x-hidden min-h-0"
      >
        <Flex direction={"col"} class="w-full max-w-4xl gap-4 p-6">
          <Flex align={"center"} justify={"between"} class="border-b py-2">
            <div class="flex items-center gap-4">
              <button class="btn" onClick={() => navigator(-1)}>
                <Text variant={"h5"} class="text-inherit">
                  <FiArrowLeft />
                </Text>
              </button>
              <Text variant={"h3"}>Create Scenario</Text>
            </div>
            <button
              class="btn btn-primary"
              disabled={isSaveDisabled()}
              onClick={handleSave}
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
            </div>
          </div>
        </Flex>
      </Flex>
    </CreateScenarioContext.Provider>
  );
}

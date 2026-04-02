import { getThumbnailBlob } from "@/services/db";
import { libraryStore } from "@/store";
import { useNavigate, useParams } from "@solidjs/router";
import { createMemo, createSignal, onMount } from "solid-js";
import { createStore, unwrap } from "solid-js/store";
import { DefaultScenario, EditScenarioContext } from "./context";
import { Flex, Text } from "@/app/components";
import { FiArrowLeft, FiCode, FiList, FiSave } from "solid-icons/fi";
import { makeDefaultScenario } from "@/core/defaults";
import { toast } from "solid-sonner";
import { BsTextCenter } from "solid-icons/bs";
import { RiDocumentFilePaperFill } from "solid-icons/ri";
import { DetailsTab } from "./tabs/DetailsTab";
import { ScriptsTab } from "./tabs/ScriptsTab";
import { StoryCardsTab } from "./tabs/StoryCardsTab";
import { StoryTab } from "./tabs/StoryTab";
import { isEqual } from "lodash";

export function EditScenario() {
  const { id } = useParams();
  const navigator = useNavigate();

  if (!id) {
    navigator(-1);
  }

  const originalScenario = createMemo(() =>
    unwrap(libraryStore.scenarios.find((v) => v.id === id)),
  );

  if (!originalScenario()) {
    navigator(-1);
  }

  const [currentScenario, setCurrentScenario] = createStore<DefaultScenario>(
    structuredClone(unwrap(originalScenario())) ??
      makeDefaultScenario({ name: "YOU SHOULDNT SEE THIS" }),
  );
  const [thumbBlob, setThumbBlob] = createSignal<Blob | null>(null);
  const [thumbBlobOriginal, setThumbBlobOriginal] = createSignal<Blob | null>(
    null,
  );

  onMount(() => {
    const scenario = libraryStore.scenarios.find((v) => v.id === id);
    if (scenario) {
      setCurrentScenario(structuredClone(unwrap(scenario)));
      setThumbBlob(null);
      setThumbBlobOriginal(null);
      if (scenario.thumbnailId) {
        getThumbnailBlob(scenario.thumbnailId).then((blob) => {
          setThumbBlob(blob);
          setThumbBlobOriginal(blob);
        });
      }
    }
  });

  const isEdited = createMemo(() => {
    return (
      !isEqual(originalScenario(), currentScenario) ||
      thumbBlob() !== thumbBlobOriginal()
    );
  });

  const handleSave = async () => {
    try {
      const thumbnail = thumbBlob();
      const resolved = makeDefaultScenario(unwrap(currentScenario));
      const scenario = await libraryStore.editScenario(
        id!,
        resolved,
        thumbnail ?? undefined,
      );
      navigator(-1);
    } catch (e) {
      toast.error((e as any).message);
    }
  };

  return (
    <EditScenarioContext.Provider
      value={{ currentScenario, setCurrentScenario, thumbBlob, setThumbBlob }}
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
              <Text variant={"h3"}>Edit Scenario</Text>
            </div>
            <button
              class="btn btn-primary"
              disabled={!isEdited()}
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
    </EditScenarioContext.Provider>
  );
}

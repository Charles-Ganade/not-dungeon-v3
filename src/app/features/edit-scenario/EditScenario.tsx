import { getThumbnailBlob } from "@/services/db";
import { libraryStore } from "@/store";
import { useNavigate, useParams } from "@solidjs/router";
import { createMemo, createSignal, onMount } from "solid-js";
import { createStore, unwrap } from "solid-js/store";
import { makeDefaultScenario } from "@/core/defaults";
import { toast } from "solid-sonner";
import { isEqual } from "lodash";
import { DefaultScenario, ScenarioEditor } from "@/app/features/scenario-editor";

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
      await libraryStore.editScenario(id!, resolved, thumbnail ?? undefined);
      navigator(-1);
    } catch (e) {
      toast.error((e as any).message);
    }
  };

  return (
    <ScenarioEditor
      mode="edit"
      title="Edit Scenario"
      scenario={currentScenario}
      setScenario={setCurrentScenario}
      thumbBlob={thumbBlob}
      setThumbBlob={setThumbBlob}
      saveDisabled={!isEdited()}
      onSave={handleSave}
      onBack={() => navigator(-1)}
    />
  );
}

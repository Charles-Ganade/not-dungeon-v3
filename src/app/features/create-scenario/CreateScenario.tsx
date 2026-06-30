import { makeDefaultScenario } from "@/core/defaults";
import { useNavigate } from "@solidjs/router";
import { createMemo, createSignal } from "solid-js";
import { createStore, unwrap } from "solid-js/store";
import { toast } from "solid-sonner";
import { libraryStore } from "@/store";
import { DefaultScenario, ScenarioEditor } from "@/app/features/scenario-editor";

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
      await (thumbnail
        ? libraryStore.addScenario(resolved, thumbnail)
        : libraryStore.addScenario(resolved));

      navigator(-1);
    } catch (e) {
      toast.error((e as any).message);
    }
  };

  return (
    <ScenarioEditor
      mode="create"
      title="Create Scenario"
      scenario={newScenario}
      setScenario={setNewScenario}
      thumbBlob={thumbBlob}
      setThumbBlob={setThumbBlob}
      saveDisabled={isSaveDisabled()}
      onSave={handleSave}
      onBack={() => navigator(-1)}
    />
  );
}

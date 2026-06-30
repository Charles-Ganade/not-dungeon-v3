import { Scenario } from "@/core/types";
import { Accessor, createContext, Setter, useContext } from "solid-js";
import { SetStoreFunction, Store } from "solid-js/store";

export type DefaultScenario = Omit<Scenario, "updatedAt" | "createdAt" | "id">;

/** Whether the editor is creating a fresh scenario or editing an existing one. */
export type ScenarioEditorMode = "create" | "edit";

interface ScenarioEditorContext {
  mode: ScenarioEditorMode;
  scenario: Store<DefaultScenario>;
  setScenario: SetStoreFunction<DefaultScenario>;
  thumbBlob: Accessor<Blob | null>;
  setThumbBlob: Setter<Blob | null>;
}

export const ScenarioEditorContext = createContext<ScenarioEditorContext>();

export function useScenarioEditor() {
  const ctx = useContext(ScenarioEditorContext);
  if (!ctx) throw new Error("useScenarioEditor must be used inside <ScenarioEditor>");
  return ctx;
}

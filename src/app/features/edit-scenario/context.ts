import { Scenario } from "@/core/types";
import { Accessor, createContext, Setter, useContext } from "solid-js";
import { SetStoreFunction, Store } from "solid-js/store";

export type DefaultScenario = Omit<Scenario, "updatedAt" | "createdAt" | "id">

interface EditScenarioContext {
  currentScenario: Store<DefaultScenario>;
  setCurrentScenario: SetStoreFunction<DefaultScenario>;
  thumbBlob: Accessor<Blob | null>;
  setThumbBlob: Setter<Blob | null>
}

export const EditScenarioContext = createContext<EditScenarioContext>();

export function useEditScenario() {
  const ctx = useContext(EditScenarioContext);
  if (!ctx) throw new Error("use must be used inside <EditScenario>");
  return ctx;
}
import { Scenario } from "@/core/types";
import { Accessor, createContext, Setter, useContext } from "solid-js";
import { SetStoreFunction, Store } from "solid-js/store";

export type DefaultScenario = Omit<Scenario, "updatedAt" | "createdAt" | "id">

interface CreateScenarioContext {
  newScenario: Store<DefaultScenario>;
  setNewScenario: SetStoreFunction<DefaultScenario>;
  thumbBlob: Accessor<Blob | null>;
  setThumbBlob: Setter<Blob | null>
}

export const CreateScenarioContext = createContext<CreateScenarioContext>();

export function useCreateScenario() {
  const ctx = useContext(CreateScenarioContext);
  if (!ctx) throw new Error("use must be used inside <CreateScenario>");
  return ctx;
}
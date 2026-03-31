import { Flex } from "@/app/components";
import { libraryStore } from "@/store";
import { For } from "solid-js";
import { ScenarioCard } from "../ScenarioCard";

export function ScenariosView() {
  const scenarios = () => libraryStore.scenarios;
  return (
    <Flex justify={"center"} class="gap-4 flex-wrap flex-1 min-w-0">
      <For each={scenarios()}>
        {(scenario) => (
          <ScenarioCard
            scenario={scenario}
            onNewStory={() => {}}
            onEdit={() => {}}
            onDelete={() => {}}
          />
        )}
      </For>
    </Flex>
  );
}

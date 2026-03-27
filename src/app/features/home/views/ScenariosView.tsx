import { Flex } from "@/app/components";
import { libraryStore } from "@/store";
import { For } from "solid-js";
import { ScenarioCard } from "../ScenarioCard";
import { makeStoryFromScenario } from "@/core/defaults";
import { Scenario } from "@/core/types";
import { unwrap } from "solid-js/store";
import { useNavigate } from "@solidjs/router";

export function ScenariosView() {
  const scenarios = () => libraryStore.scenarios;
  const navigator = useNavigate();

  return (
    <Flex justify={"center"} class="gap-4 flex-wrap flex-1 min-w-0">
      <For each={scenarios()}>
        {(scenario) => (
          <ScenarioCard
            scenario={scenario as Scenario}
            onNewStory={async () => {
              const newStory = await libraryStore.addStory(
                makeStoryFromScenario(structuredClone(unwrap(scenario)), {
                  name: scenario.name,
                  description: scenario.description,
                }),
              );

              navigator(`/play/${newStory.id}`);
            }}
            onDelete={async () => {
              await libraryStore.removeScenario(scenario.id);
            }}
          />
        )}
      </For>
    </Flex>
  );
}

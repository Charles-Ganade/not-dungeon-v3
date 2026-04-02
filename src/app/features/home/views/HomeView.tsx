import { Flex, Text } from "@/app/components";
import { For, Show } from "solid-js";
import { ScenarioCard } from "../ScenarioCard";
import { StoryCard } from "../StoryCard";
import { libraryStore } from "@/store";
import { Scenario } from "@/core/types";
import { useNavigate } from "@solidjs/router";
import { makeStoryFromScenario } from "@/core/defaults";
import { unwrap } from "solid-js/store";

export function HomeView() {
  const scenarios = () => libraryStore.scenarios;
  const stories = () => libraryStore.stories;
  const navigator = useNavigate();

  return (
    <div class="flex flex-col gap-6">
      <Flex direction={"col"} class="gap-2">
        <Text color={"muted"} variant={"h6"}>
          Recently Played
        </Text>
        <Flex class="gap-4 overflow-x-auto min-w-0">
          <For
            each={stories()
              .slice(0, 5)
              .sort((a, b) => a.lastPlayedAt - b.lastPlayedAt)}
          >
            {(story) => <StoryCard story={story} onPlay={() => {}} />}
          </For>
        </Flex>
      </Flex>
      <Flex direction={"col"} class="gap-2">
        <Text color={"muted"} variant={"h6"}>
          Library
        </Text>
        <For each={scenarios().sort((a, b) => b.updatedAt - a.updatedAt)}>
          {(scenario) => (
            <Flex direction={"col"} class="gap-1 mb-4">
              <Flex align={"center"}>
                <Text variant={"h4"}>{scenario.name}</Text>
              </Flex>
              <Flex class="gap-4 overflow-x-auto min-w-0">
                <ScenarioCard
                  scenario={scenario as Scenario}
                  onNewStory={async () => {
                    const newStory = await libraryStore.addStory(
                      makeStoryFromScenario(structuredClone(unwrap(scenario)), {
                        name: scenario.name,
                      }),
                    );

                    navigator(`/play/${newStory.id}`);
                  }}
                  onDelete={async () => {
                    await libraryStore.removeScenario(scenario.id);
                  }}
                />
                <For each={libraryStore.grouped().get(scenario.id)}>
                  {(story) => <StoryCard story={story} onPlay={() => {}} />}
                </For>
              </Flex>
            </Flex>
          )}
        </For>
        <Show when={libraryStore.grouped().get(undefined)}>
          <Flex direction={"col"} class="gap-1 mb-4">
            <Flex align={"center"}>
              <Text variant={"h4"}>Quick Starts</Text>
            </Flex>
            <Flex class="gap-4 overflow-x-auto min-w-0">
              <For each={libraryStore.grouped().get(undefined)}>
                {(story) => <StoryCard story={story} onPlay={() => {}} />}
              </For>
            </Flex>
          </Flex>
        </Show>
      </Flex>
    </div>
  );
}

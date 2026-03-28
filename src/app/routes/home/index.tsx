import { libraryStore } from "@/store";
import { For } from "solid-js";

export default function Home() {
  return (
    <div>
      Scenarios
      <For each={libraryStore.scenarios}>
        {(scenario) => <>Scenario: {scenario.name}</>}
      </For>
      Stories
      <For each={libraryStore.stories} fallback={<>Nothing</>}>
        {(story) => <>Story: {story.name}</>}
      </For>
    </div>
  );
}

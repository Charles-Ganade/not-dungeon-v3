import { Flex } from "@/app/components";
import { libraryStore } from "@/store";
import { For } from "solid-js";
import { StoryCard } from "../StoryCard";

export function StoriesView() {
  const stories = () => libraryStore.stories;
  return (
    <Flex justify={"center"} class="gap-4 flex-wrap flex-1 min-w-0">
      <For each={stories()}>
        {(story) => <StoryCard story={story} onPlay={() => {}} />}
      </For>
    </Flex>
  );
}

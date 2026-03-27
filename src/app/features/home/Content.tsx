import { Flex, Text } from "@/app/components";
import { cn } from "@/utils";
import { useHome } from "./context";
import { HomeView } from "./views/HomeView";
import { A } from "@solidjs/router";
import { ScenariosView } from "./views/ScenariosView";
import { StoriesView } from "./views/StoriesView";
import { BsPlayFill } from "solid-icons/bs";
import { createSignal } from "solid-js";
import { CreateStoryModal } from "./modals/CreateStoryModal";
import { FiPlus, FiX } from "solid-icons/fi";

export function Content() {
  const { currentView } = useHome();
  const [isQuickStartOpen, setQuickStartopen] = createSignal(false);

  return (
    <>
      <Flex
        direction={"col"}
        class="p-8 gap-8 flex-1 min-w-0 min-h-0 overflow-y-auto"
      >
        <div class={cn(currentView() !== "home" && "hidden")}>
          <HomeView />
        </div>
        <div class={cn(currentView() !== "scenarios" && "hidden")}>
          <ScenariosView />
        </div>
        <div class={cn(currentView() !== "stories" && "hidden")}>
          <StoriesView />
        </div>
        <div class="fab bottom-8 right-8">
          <div
            tabindex="0"
            role="button"
            class="btn btn-lg btn-circle btn-secondary"
          >
            <Text variant={"h3"} class="text-secondary-content">
              <FiPlus />
            </Text>
          </div>

          <div class="fab-close">
            Close{" "}
            <span class="btn btn-circle btn-lg btn-error">
              <Text variant={"h3"} class="text-error-content">
                <FiX />
              </Text>
            </span>
          </div>

          <A class="btn btn-lg" href="/create-scenario">
            <Text variant={"h2"}>+</Text>
            <Text>Create Scenario</Text>
          </A>
          <button
            class="btn btn-lg"
            onClick={() => {
              setQuickStartopen(true);
            }}
          >
            <Text variant={"h3"}>
              <BsPlayFill />
            </Text>
            <Text>QuickStart</Text>
          </button>
        </div>
      </Flex>
      <CreateStoryModal
        open={isQuickStartOpen}
        onClose={() => setQuickStartopen(false)}
      />
    </>
  );
}

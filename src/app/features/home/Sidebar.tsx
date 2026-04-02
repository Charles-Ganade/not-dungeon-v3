import { Text } from "@/app/components";
import { cn, formatRelative } from "@/utils";
import { FiSidebar, FiCompass, FiLayers, FiBookOpen } from "solid-icons/fi";
import { createMemo, JSX, Show } from "solid-js";
import { useHome, View } from "./context";
import { libraryStore, sessionStore } from "@/store";
import { useNavigate } from "@solidjs/router";

interface SidebarItemProps {
  viewId: View;
  icon: JSX.Element;
  title: string;
}

function SidebarItem(props: SidebarItemProps) {
  const { currentView, setCurrentView, isSidebarOpen } = useHome();
  const isActive = () => props.viewId === currentView();

  return (
    <li>
      <a
        class={cn(
          "p-4 flex items-center tooltip tooltip-right",
          isActive() && "text-primary",
        )}
        data-tip={isSidebarOpen() ? undefined : props.title}
        onClick={() => setCurrentView(props.viewId)}
      >
        <Text variant="h3" class="text-inherit shrink-0">
          {props.icon}
        </Text>
        <div
          class={cn(
            "grid w-full transition-[grid-template-columns] duration-300 ease-linear",
            isSidebarOpen() ? "grid-cols-[1fr]" : "grid-cols-[0fr]",
          )}
        >
          <Text
            variant="h5"
            class={cn(
              "text-inherit leading-none whitespace-nowrap overflow-hidden pl-4",
              isActive() && "font-bold",
            )}
          >
            {props.title}
          </Text>
        </div>
      </a>
    </li>
  );
}

function HopBackCard() {
  const { isSidebarOpen } = useHome();
  const lastStory = createMemo(() => libraryStore.stories[0]);
  const navigator = useNavigate();

  return (
    <Show when={lastStory()}>
      {(story) => (
        <div
          class={cn(
            "hidden md:grid transition-[grid-template-rows] duration-300 ease-linear",
            isSidebarOpen() ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div
            class={cn(
              "grid overflow-hidden transition-[grid-template-columns] duration-300 ease-linear px-2",
              isSidebarOpen() ? "grid-cols-[1fr]" : "grid-cols-[0fr]",
            )}
          >
            <div class="overflow-hidden min-w-0 pb-2">
              <div
                class="rounded-lg bg-base-200 p-3 cursor-pointer hover:bg-base-300 transition-colors"
                onClick={() => navigator(`/play/${story().id}`)}
              >
                <Text
                  color={"muted"}
                  class="uppercase tracking-wide text-[0.625rem] text-xs"
                >
                  Continue
                </Text>
                <Text variant="h6" class="truncate mt-0.5">
                  {story().name}
                </Text>
                <Text color={"subtle"} class="text-[0.6875rem]">
                  {formatRelative(story().lastPlayedAt)}
                </Text>
              </div>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
}

export function Sidebar() {
  const { isSidebarOpen, setSidebarOpen } = useHome();
  return (
    <ul
      class={cn(
        "menu menu-lg bg-base-200 transition-[width] duration-300 ease-linear min-w-18 sticky left-0 top-0",
        isSidebarOpen() ? "w-18 md:w-64 lg:w-80" : "w-18",
      )}
    >
      <li class="hidden md:flex">
        <a
          onClick={() => {
            setSidebarOpen((v) => !v);
          }}
          class={cn("p-4 w-fit flex tooltip tooltip-right")}
          data-tip="Open/Close Sidebar"
        >
          <Text variant={"h3"}>
            <FiSidebar />
          </Text>
        </a>
      </li>
      <HopBackCard />
      <SidebarItem viewId="home" icon={<FiCompass />} title="Home" />
      <SidebarItem viewId="scenarios" icon={<FiLayers />} title="Scenarios" />
      <SidebarItem viewId="stories" icon={<FiBookOpen />} title="Stories" />
    </ul>
  );
}

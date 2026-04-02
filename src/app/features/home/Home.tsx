import { Flex } from "@/app/components";
import { createSignal } from "solid-js";
import { HomeContext, View } from "./context";
import { Sidebar } from "./Sidebar";
import { Content } from "./Content";

export function HomePage() {
  const [isSidebarOpen, setSidebarOpen] = createSignal(true);
  const [currentView, setCurrentView] = createSignal<View>("home");

  return (
    <HomeContext.Provider
      value={{ currentView, setCurrentView, isSidebarOpen, setSidebarOpen }}
    >
      <Flex class="flex-1 grow gap-0 overflow-x-hidden min-h-0">
        <Sidebar />
        <Content />
      </Flex>
    </HomeContext.Provider>
  );
}

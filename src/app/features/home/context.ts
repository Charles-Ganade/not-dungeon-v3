// features/dashboard/context.ts
import { createContext, useContext } from "solid-js";
import type { Accessor, Setter } from "solid-js";

export type View = "home" | "scenarios" | "stories";

interface HomeContext {
  currentView: Accessor<View>;
  setCurrentView: Setter<View>;
  isSidebarOpen: Accessor<boolean>;
  setSidebarOpen: Setter<boolean>
}

export const HomeContext = createContext<HomeContext>();

export function useHome() {
  const ctx = useContext(HomeContext);
  if (!ctx) throw new Error("useHome must be used inside <Home>");
  return ctx;
}
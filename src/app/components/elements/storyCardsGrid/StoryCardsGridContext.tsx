import { StoryCard } from "@/core/types";
import { createContext, useContext } from "solid-js";

interface StoryCardsGridContext {
  viewType: "grid" | "stack" | "list";
  onDelete: (card: StoryCard) => void;
  onDuplicate: (card: StoryCard) => void;
  onSave: (card: StoryCard) => void;
}

export const StoryCardsGridContext = createContext<StoryCardsGridContext>();

export function useStoryCardsGrid() {
  const ctx = useContext(StoryCardsGridContext);
  if (!ctx)
    throw new Error("useStoryCardsGrid must be used inside <StoryCardsGrid>");
  return ctx;
}

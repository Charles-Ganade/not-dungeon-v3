import { ScriptBundle } from "./stories";
import { ConfigOverride, Story, StoryCard } from "./stories";

/**
 * A Scenario is a reusable template. It defines the starting
 * world state, scripts, and story cards for an story.
 * Multiple stories can be created from the same scenario.
 */
export interface Scenario {
  id: string;
  name: string;
  description: string;
  thumbnail: string;

  /**
   * The author's notes are injected near the end of the context
   * (just before the most recent messages) to nudge the model's
   * tone, style, or focus without being part of the story text.
   */
  authorNotes: string;

  /** Tags for filtering in the library view. e.g. ["fantasy", "horror"] */
  tags: string[];

  /** Baseline story cards defined by the scenario. */
  storyCards: StoryCard[];

  /**
   * Scenario-level scripts. These run first in the pipeline.
   * Story scripts are merged on top.
   */
  scripts: ScriptBundle;

  override: ConfigOverride;

  createdAt: number;
  updatedAt: number;
}

/**
 * The library view browses both scenarios and stories.
 * This tagged union lets the UI render them in a single list.
 */
export type LibraryItem =
  | { kind: "scenario"; data: Scenario }
  | { kind: "story"; data: Story; scenario?: Scenario }
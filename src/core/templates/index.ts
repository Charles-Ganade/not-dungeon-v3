import type { Story } from "@/core/types/stories";

export interface TemplateQuestion {
  /** The raw question string — used as the dedup key and answer map key. */
  key: string;
  /** Human-readable prompt shown to the user. Same as key. */
  prompt: string;
}

const TEMPLATE_REGEX = /\$\{([^}]+)\}/g;

/** Extracts all unique question keys from a single string. */
function extractFromString(text: string, seen: Set<string>, out: TemplateQuestion[]): void {
  for (const match of text.matchAll(TEMPLATE_REGEX)) {
    const key = match[1].trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push({ key, prompt: key });
    }
  }
}

/** Replaces all template occurrences in a string using the answers map. */
function resolveString(text: string, answers: Record<string, string>): string {
  return text.replace(TEMPLATE_REGEX, (_, key) => {
    const trimmed = key.trim();
    return answers[trimmed] ?? "";
  });
}

/**
 * Scans all AI-facing story fields and returns a deduplicated list
 * of template questions in the order they first appear.
 *
 * Scanned fields (in order):
 *   openingPrompt, instructions, essentials, authorNotes,
 *   storyCards[].content
 *
 * If the returned array is empty, no templates exist and the story
 * can start immediately without prompting the user.
 */
export function extractTemplateQuestions(story: Story): TemplateQuestion[] {
  const seen = new Set<string>();
  const questions: TemplateQuestion[] = [];

  extractFromString(story.openingPrompt, seen, questions);
  extractFromString(story.name, seen, questions);
  extractFromString(story.instructions, seen, questions);
  extractFromString(story.essentials, seen, questions);
  extractFromString(story.authorNotes, seen, questions);

  for (const card of story.storyCards) {
    extractFromString(card.content, seen, questions);
    extractFromString(card.title, seen, questions);
    for (const trigger of card.triggers) {
      extractFromString(trigger, seen, questions)
    }
  }

  return questions;
}

/**
 * Returns a new Story with all template strings replaced by their
 * answers. Fields with no templates are returned unchanged.
 *
 * `answers` is a map of question key → answer string. Any template
 * whose key is missing from answers is replaced with an empty string.
 *
 * Does not mutate the input story.
 */
export function resolveStoryTemplates(
  story: Story,
  answers: Record<string, string>
): Story {
  return {
    ...story,
    openingPrompt: resolveString(story.openingPrompt, answers),
    name: resolveString(story.name, answers),
    instructions: resolveString(story.instructions, answers),
    essentials: resolveString(story.essentials, answers),
    authorNotes: resolveString(story.authorNotes, answers),
    storyCards: story.storyCards.map((card) => ({
      ...card,
      content: resolveString(card.content, answers),
      title: resolveString(card.title, answers),
      triggers: card.triggers.map(trigger => resolveString(trigger, answers))
    })),
  };
}
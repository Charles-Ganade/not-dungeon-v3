import type { 
  Story, 
  HistoryMessage, 
  Memory, 
  StoryCard, 
  ResolvedConfig 
} from "@/core/types/stories";
import type { Scenario } from "@/core/types/scenarios";
import type { LLMMessage, LLMRequest } from "@/services/llm/types";
import { stream as llmStream } from "@/services/llm";
import { makeDefaultStoryCard } from "../defaults";

let _abortController: AbortController | null = null;

export interface GenerateStoryCardOptions {
  targetTitle: string;
  config: ResolvedConfig;
  context: 
    | {
        type: "session";
        story: Story;
        activePath: HistoryMessage[];
        activeMemories: Memory[];
      }
    | {
        type: "scenario";
        scenario: Omit<Scenario, "id" | "createdAt" | "updatedAt">;
      };
}

/**
 * Calls the LLM to generate a new Story Card based on the provided context.
 * Throws an error if the network fails or if the output cannot be parsed as JSON.
 */
export async function generateStoryCard(
  options: GenerateStoryCardOptions
): Promise<Omit<StoryCard, "id" | "createdAt" | "updatedAt">> {
  const { targetTitle, config, context } = options;

  let userPrompt = `Context Information:\n\n`;

  if (context.type === "session") {
    const { story, activePath, activeMemories } = context;
    userPrompt += `Title: ${story.name}\n`;
    if (story.description) userPrompt += `Description: ${story.description}\n`;
    if (story.essentials) userPrompt += `Essentials:\n${story.essentials}\n`;
    const activeCards = story.storyCards.filter((c) => c.enabled);
    if (activeCards.length > 0) {
      userPrompt += `\nCurrent Story Cards:\n${activeCards
        .map((c) => `- [${c.title}]: ${c.content}`)
        .join("\n")}\n`;
    }
    if (activeMemories.length > 0) {
      userPrompt += `\nActive Memories:\n${activeMemories
        .map((m) => `- ${m.content}`)
        .join("\n")}\n`;
    }
    if (activePath.length > 0) {
      const recent = activePath
        .slice(-15)
        .map((m) => `${m.role === "user" ? "Player" : "Narrator"}: ${m.text}`)
        .join("\n");
      userPrompt += `\nRecent Story History:\n${recent}\n`;
    }
  } else {
    const { scenario } = context;
    userPrompt += `Title: ${scenario.name}\n`;
    if (scenario.description) userPrompt += `Description: ${scenario.description}\n`;
    if (scenario.essentials) userPrompt += `Essentials:\n${scenario.essentials}\n`;

    const activeCards = scenario.storyCards.filter((c) => c.enabled);
    if (activeCards.length > 0) {
      userPrompt += `\nCurrent Story Cards:\n${activeCards
        .map((c) => `- [${c.title}]: ${c.content}`)
        .join("\n")}\n`;
    }
  }

  userPrompt += `\n---\nGenerate a story card for the concept/title: "${targetTitle}"`;

  const messages: LLMMessage[] = [
    { role: "system", content: config.prompts.storyCardGeneratorPrompt },
    { role: "user", content: userPrompt },
  ];

  const request: LLMRequest = {
    model: config.model,
    messages,
    params: {
      ...config.params,
      temperature: 0.3, 
      maxOutputTokens: 500,
    },
  };

  _abortController = new AbortController();
  const { signal } = _abortController;
  let rawOutput = "";
  const stream = llmStream(config.providerId, request, config.endpoint, config.apiKey, signal);

  for await (const chunk of stream) {
    if (chunk.type === "text") {
      rawOutput += chunk.delta;
    } else if (chunk.type === "error") {
      throw new Error(`LLM Error: ${chunk.message}`);
    }
  }

  const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Failed to find valid JSON object in output.\nRaw Output: ${rawOutput}`);
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    console.log(parsed);
    return {
      title: parsed.title || targetTitle,
      content: parsed.value || "",
      triggers: Array.isArray(parsed.keys) ? parsed.keys : [],
      tags: Array.isArray(parsed.type) ? parsed.type : ["AI-Generated"],
      enabled: true,
    };
  } catch (err) {
    throw new Error(`Failed to parse extracted JSON.\nExtracted Text: ${jsonMatch[0]}`);
  }
}
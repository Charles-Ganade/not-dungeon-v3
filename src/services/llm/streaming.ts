import { LLMErrorCode } from "./types";
import type { LLMChunk } from "./types";

const OPEN_TAG = "<think>";
const CLOSE_TAG = "</think>";

/**
 * Some providers don't expose reasoning as a separate field — they inline it in
 * the normal content stream wrapped in `<think>...</think>` tags. This builds a
 * stateful splitter that tracks whether we're mid-thinking-block across deltas
 * and re-emits each slice as the correct chunk type. Call the returned function
 * once per content delta; it yields zero or more `text`/`thinking` chunks.
 */
export function createThinkingTagSplitter() {
  let inThinking = false;
  return function* (content: string): Iterable<LLMChunk> {
    let remaining = content;
    while (remaining) {
      if (inThinking) {
        const end = remaining.indexOf(CLOSE_TAG);
        if (end !== -1) {
          const chunk = remaining.slice(0, end);
          if (chunk) yield { type: "thinking", delta: chunk };
          inThinking = false;
          remaining = remaining.slice(end + CLOSE_TAG.length);
        } else {
          yield { type: "thinking", delta: remaining };
          remaining = "";
        }
      } else {
        const start = remaining.indexOf(OPEN_TAG);
        if (start !== -1) {
          const chunk = remaining.slice(0, start);
          if (chunk) yield { type: "text", delta: chunk };
          inThinking = true;
          remaining = remaining.slice(start + OPEN_TAG.length);
        } else {
          yield { type: "text", delta: remaining };
          remaining = "";
        }
      }
    }
  };
}

/**
 * Maps an error thrown mid-stream to a terminal error chunk: aborts become
 * `Aborted`, everything else `NetworkError`. Providers `yield` the result and
 * `return`.
 */
export function streamErrorToChunk(
  err: unknown,
  abortedMessage = "Request aborted",
): LLMChunk {
  if ((err as Error).name === "AbortError") {
    return { type: "error", code: LLMErrorCode.Aborted, message: abortedMessage };
  }
  return {
    type: "error",
    code: LLMErrorCode.NetworkError,
    message: (err as Error).message,
  };
}

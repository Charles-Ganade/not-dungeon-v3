export const DEFAULT_SCRIPT_LIBRARY = `\
// library.js
// Shared code available to all three hook files in this scenario.
// Define helper functions, constants, and shared state here.
//
// This file runs first in the same scope as each hook file,
// so anything defined here is accessible in input.js,
// buildContext.js, and output.js.




`;

export const DEFAULT_SCRIPT_INPUT = `\
// input.js
// Runs after the player submits their input, before the AI is called.
// Use this to sanitize or transform player input, inject context,
// or halt the turn entirely.
//
// Available:
//   ctx.input          — the player's raw input text (mutable)
//   ctx.essentials     — the story's essentials field (mutable)
//   ctx.scriptState    — persistent script state string (mutable)
//   ctx.state          — read-only snapshot of messages, memories, story cards
//   ctx.kvMemory       — persistent key-value store (get, set, delete, all)
//   ctx.config         — resolved config (model, params, prompts)
//   ctx.ai.stream()    — run a secondary AI call
//   ctx.inject(text)   — inject a system message into the next request
//   ctx.stop(reason?)  — cancel the turn entirely
//   ctx.console        — logger object. logged to the script debug panel

// your code here




`;

export const DEFAULT_SCRIPT_BUILD_CONTEXT = `\
// buildContext.js
// Runs after the default context is assembled, before the AI is called.
// Use this to reorder, filter, or inject into the messages array
// that will be sent to the model.
//
// Available:
//   ctx.messages           — the full messages array (mutable)
//   ctx.estimatedTokens    — rough token count of ctx.messages (read-only)
//   ctx.activeStoryCards   — story cards that matched the recent context (read-only)
//   ctx.essentials         — the story's essentials field (mutable)
//   ctx.scriptState        — persistent script state string (mutable)
//   ctx.state              — read-only snapshot of messages, memories, story cards
//   ctx.kvMemory           — persistent key-value store (get, set, delete, all)
//   ctx.config             — resolved config (model, params, prompts)
//   ctx.ai.stream()        — run a secondary AI call
//   ctx.stop(reason?)      — cancel the turn entirely
//   ctx.console            — logger object. logged to the script debug panel

// your code here




`;

export const DEFAULT_SCRIPT_OUTPUT = `\
// output.js
// Runs after the AI responds, before the message is saved to history.
// Use this to transform the AI's output, add story cards, or update
// persistent state based on what the model said.
//
// Available:
//   ctx.output         — the AI's response text (mutable)
//   ctx.rawOutput      — the original unmodified response (read-only)
//   ctx.essentials     — the story's essentials field (mutable)
//   ctx.scriptState    — persistent script state string (mutable)
//   ctx.state          — read-only snapshot of messages, memories, story cards
//   ctx.kvMemory       — persistent key-value store (get, set, delete, all)
//   ctx.config         — resolved config (model, params, prompts)
//   ctx.ai.stream()    — run a secondary AI call
//   ctx.addStoryCard() — add a story card (tracked by undo system)
//   ctx.stop(reason?)  — cancel the turn (output is discarded)
//   ctx.console        — logger object. logged to the script debug panel

// your code here




`;
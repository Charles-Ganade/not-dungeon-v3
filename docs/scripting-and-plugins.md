# Scripting & Plugins API

Not Dungeon lets you run your own JavaScript at three points in every turn. The
same API powers two things:

- **Scenario / story scripts** — code attached directly to a scenario (and
  optionally overridden per story) via the **Scripts** tab.
- **Plugins** — installable, shareable packages that run the same kind of code,
  plus a manifest, a consent list, and a per-story config UI.

Both use the identical `ctx` object and run in the same sandbox. If you can write
a scenario script, you can write a plugin, and vice-versa.

---

## Table of contents

1. [The turn lifecycle](#the-turn-lifecycle)
2. [The four files](#the-four-files)
3. [How scripts run (the sandbox)](#how-scripts-run-the-sandbox)
4. [The `ctx` object](#the-ctx-object)
   - [Available in every hook](#available-in-every-hook)
   - [`input.js` only](#inputjs-only)
   - [`buildContext.js` only](#buildcontextjs-only)
   - [`output.js` only](#outputjs-only)
5. [Persisting state](#persisting-state)
6. [Calling the model from a script](#calling-the-model-from-a-script)
7. [Stopping a turn](#stopping-a-turn)
8. [Data types](#data-types)
9. [Plugins](#plugins)
10. [Recipes](#recipes)
11. [Gotchas & limits](#gotchas--limits)

---

## The turn lifecycle

A turn runs in this order. Your hooks slot in at three points (▶):

```
player submits input
      │
      ▶  input.js        — transform input, inject context, gate the turn
      │
   default context is assembled
   (system prompt + instructions + essentials + memories
    + triggered story cards + history + kicker)
      │
      ▶  buildContext.js — reshape the exact messages array sent to the model
      │
   model streams the response
      │
      ▶  output.js       — rewrite output, manage story cards, update memories
      │
   response saved, auto-summarizer maybe runs, turn committed
```

Notes:

- **`input.js` only runs when the player submits text.** *Retry* and *Continue*
  skip it (there is no new input), but they still run `buildContext.js` and
  `output.js`.
- Every phase, your **scenario/story script runs first, then each enabled plugin
  in the order they are listed.** They all share the same `ctx`, so a plugin sees
  changes an earlier script made this turn.
- If a script calls [`ctx.stop()`](#stopping-a-turn) or `ctx.cancel()`, no later
  scripts (or plugins) in the turn run.

---

## The four files

Scripts are organised into four plain-JavaScript "files":

| File              | Runs                                   | Purpose |
| ----------------- | -------------------------------------- | ------- |
| `library.js`      | first, before each hook, same scope    | Shared helpers, constants, state. |
| `input.js`        | after the player submits, before the AI| Sanitise/transform input, inject context, gate the turn. |
| `buildContext.js` | after context is assembled, before AI  | Reorder/filter/replace the messages array. |
| `output.js`       | after the AI responds, before saving   | Transform output, manage story cards/memories. |

`library.js` is executed in the **same scope** as each hook, so anything you
declare there is visible to `input.js`, `buildContext.js`, and `output.js`:

```js
// library.js
function rollDice(sides) {
  return Math.floor(Math.random() * sides) + 1;
}
const NARRATOR_TAG = "[System]";
```

```js
// input.js — rollDice and NARRATOR_TAG are in scope here
ctx.inject(`${NARRATOR_TAG} luck roll: ${rollDice(20)}`);
```

### Scenario + story merge rules

A story can override its scenario's scripts. When both exist:

- **`library`** — concatenated: **scenario library first, then story library.**
- **`input` / `buildContext` / `output`** — the **story's version replaces the
  scenario's** if the story's is non-empty; otherwise the scenario's is used.

Plugins bring their own `library`, scoped to that plugin's own hooks only (it is
**not** shared with your scenario/story library).

---

## How scripts run (the sandbox)

Every hook executes as the body of an `async function`, in a **Web Worker
sandbox** isolated from the page. Practical consequences:

- **`await` works** (including top-level `await`) — the hook is async.
- **The only injected binding is `ctx`.** Globals like `window`, `document`,
  `self`, and `globalThis` are shadowed to `undefined`.
- **No network or storage.** `fetch`, `XMLHttpRequest`, `WebSocket`,
  `EventSource`, `indexedDB`, `caches`, `Worker`, `importScripts`, and
  `navigator.sendBeacon` are all disabled. The **only** way to reach the network
  is [`ctx.ai.stream()`](#calling-the-model-from-a-script), which is brokered by
  the host.
- **Standard JS is available** — `Math`, `JSON`, `Date`, `crypto.randomUUID()`,
  `structuredClone`, regexes, etc.
- **Errors are caught and logged** to the debug panel (via `ctx.console`), not
  thrown to the page. A compile or runtime error aborts that hook but the turn
  continues.

### Timeouts

Each hook has two budgets, configured in **Settings → Scripts**:

- **Idle timeout** — max time with no observable activity (logs, AI chunks).
  **Paused while an `ctx.ai` call is streaming,** so slow model calls never trip
  it.
- **Ceiling timeout** — absolute wall-clock limit for the whole hook, AI calls
  included.

Exceeding either aborts the hook with a timeout. For `input.js`/`buildContext.js`
the whole turn is discarded; for `output.js` the already-streamed model response
is kept and only the hook's pending changes are skipped.

---

## The `ctx` object

`ctx` is the single object your hook receives. Read properties to inspect state,
assign to mutable properties to change behaviour, and call methods to enqueue
operations.

### Available in every hook

These are present in `input.js`, `buildContext.js`, and `output.js`.

#### `ctx.state` — read-only snapshot

```ts
ctx.state.messages    // readonly HistoryMessage[]
ctx.state.memories    // readonly Memory[]
ctx.state.storyCards  // readonly StoryCard[]
```

A frozen snapshot of the story. In `input.js` it reflects the state at the start
of the turn; in `buildContext.js` and `output.js` it also reflects mutations
enqueued by **earlier** phases this turn. Edits you enqueue in the *current*
phase are not reflected back into `ctx.state` — use them to read, not to
read-back your own writes.

#### `ctx.essentials` — mutable, sent to the model

The story's "essentials" field (world state, key facts). Injected into the system
message. Assign a new string to change it; the change is delta-tracked (undoable)
and visible to later hooks this turn.

```js
ctx.essentials += "\nThe bridge is now on fire.";
```

#### `ctx.scriptState` — mutable object, private to scripts

A persistent, JSON-serialisable **object** that is **never sent to the model**.
Store any structured state that must survive between turns. Delta-tracked. Mutate
keys in place or assign a whole new object.

```js
ctx.scriptState.turns = (ctx.scriptState.turns ?? 0) + 1;
```

#### `ctx.kvMemory` — persistent key-value store

Survives across turns, persisted with the story. **Not** delta-tracked (does not
participate in undo/redo) — use it for settings and configuration, and use
`ctx.scriptState` for gameplay state you want undoable.

```ts
ctx.kvMemory.get<T>(key)          // T | undefined
ctx.kvMemory.set(key, value)
ctx.kvMemory.delete(key)
ctx.kvMemory.all()                // Record<string, unknown>
```

#### `ctx.config` — read-only resolved config

The non-sensitive resolved configuration for this turn: `model`, `authorNotes`,
`params`, and `prompts`. Read-only — you cannot change params mid-turn.
Connection secrets (`apiKey`, `endpoint`, `providerId`) are **not** exposed;
scripts reach the model only through `ctx.ai`. See [`ScriptConfig`](#scriptconfig).

```js
if (ctx.config.params.contextWindow < 8000) { /* be conservative */ }
```

#### `ctx.currentTurnIds` — ids for this turn

```ts
ctx.currentTurnIds.user       // string | null  (all hooks)
ctx.currentTurnIds.assistant  // string         (output.js only)
```

#### Memory operations

Enqueued as deltas inside the turn's transaction (undoable together with the
turn). Ids/timestamps are assigned by the engine.

```ts
ctx.addMemory({ content: string, messageIds: string[] })
ctx.editMemory(id, "new text")
ctx.editMemory(id, prev => prev + " (revised)")   // function form
ctx.removeMemory(id)
```

#### Story-card operations

Same delta semantics as memories. **Available in every hook** (a card you add in
`input.js` is enqueued before context is built, so it can affect the very same
turn).

```ts
ctx.addStoryCard({
  title: "The Sunken City",
  content: "An ancient ruin beneath the lake...",
  triggers: ["sunken city", "ruins"],
  tags: ["location"],
  enabled: true,
})
ctx.editStoryCard(id, { title, content, triggers, tags, enabled })
ctx.editStoryCard(id, prev => ({ ...prev, content: prev.content + "\nUpdated." }))
ctx.removeStoryCard(id)
```

> Within one hook, edit/delete on the same card id coalesce: a pending delete
> makes later edits to that id no-ops, and repeated edits update the same pending
> edit rather than stacking.

#### `ctx.suppressDefaultSummarizer` — opt out of auto-summary

Set `true` to skip the end-of-turn auto-summarizer for this turn. **Settable from
any hook** — the summarizer is skipped if *any* hook set it.

```js
ctx.suppressDefaultSummarizer = true;
```

#### `ctx.ai` — secondary model calls

See [Calling the model from a script](#calling-the-model-from-a-script).

#### `ctx.console` — debug logging

Writes to the in-app **debug panel**, not the browser console.

```js
ctx.console.log("value:", x);
ctx.console.warn("unexpected");
ctx.console.error("failure");
```

#### `ctx.stop` / `ctx.cancel`

See [Stopping a turn](#stopping-a-turn).

---

### `input.js` only

#### `ctx.input` — the player's text, mutable

```js
// Trim, normalise, or rewrite what the player submitted.
ctx.input = ctx.input.trim();
if (ctx.input.toLowerCase() === "look") {
  ctx.input = "I carefully look around the room.";
}
```

#### `ctx.inject(text)` — add a system message to the request

Queues a **system-role message** that is inserted directly after the default
system prompt, counted in the token budget, and visible (and editable) in
`buildContext.js` via `ctx.messages`.

```js
ctx.inject("[Reminder: the player is poisoned and loses health each turn.]");
```

> `inject` is input-only by design: it is spliced in *after* the input phase.
> In `buildContext.js` you already have the full `ctx.messages` array and can push
> a system message directly; in `output.js` the request is already sent.

---

### `buildContext.js` only

#### `ctx.messages` — the exact request, mutable

The array of messages that will be sent to the model. Each entry is a
[`ContextMessage`](#contextmessage) — `{ id, role, text }` — using `text` to match
`ctx.state.messages`. `id` is the source `HistoryMessage.id`, or `null` for
engine-generated entries (system prompt, injected messages, the kicker). Fully
mutable — reorder, edit, add, or remove entries.

```js
// Drop any empty messages and prepend a hard instruction.
ctx.messages = ctx.messages.filter(m => m.text.trim() !== "");
ctx.messages.unshift({
  id: null,
  role: "system",
  text: "Write in present tense.",
});
```

#### `ctx.estimatedTokens` — read-only budget hint

BPE token count of the current `ctx.messages`, using the model's tokenizer. The
engine recomputes it after your hook, so treat it as a hint for your own
decisions.

```js
if (ctx.estimatedTokens > ctx.config.params.contextWindow - 2000) {
  ctx.messages = ctx.messages.slice(-10); // keep only recent turns
}
```

#### `ctx.activeStoryCards` — read-only

The story cards whose triggers matched the recent context (already injected into
`ctx.messages` by the default builder). To modify cards, use the story-card
operations above.

---

### `output.js` only

#### `ctx.output` — the model's response, mutable

```js
// Strip a trailing marker the model sometimes emits.
ctx.output = ctx.output.replace(/\s*\[END\]\s*$/, "");
```

#### `ctx.rawOutput` — read-only original

The unmodified model response, even after you change `ctx.output`.

#### `ctx.currentTurnIds.assistant`

The id of the assistant message being saved this turn (exists only here, since
the response doesn't exist until output).

---

## Persisting state

Three stores, three lifetimes:

| Store              | Sent to model? | Undoable (delta)? | Lifetime            | Use for |
| ------------------ | -------------- | ----------------- | ------------------- | ------- |
| `ctx.essentials`   | **Yes**        | Yes               | Whole story         | World facts the model should always know. |
| `ctx.scriptState`  | No             | Yes               | Whole story         | Structured gameplay state, an object (undoable). |
| `ctx.kvMemory`     | No             | No                | Whole story         | Settings/config that should ignore undo. |

---

## Calling the model from a script

`ctx.ai.stream(input)` runs a **secondary** model call using the active provider
and resolved config. `input` is either a prompt string or a full messages array.
It returns an async iterable of chunks. Thinking/reasoning is always disabled for
script calls.

```ts
type Chunk =
  | { type: "text";     delta: string }
  | { type: "thinking"; delta: string }   // not emitted for script calls
  | { type: "error";    code: string; message: string };
```

Accumulate the text by iterating:

```js
async function ask(prompt) {
  let out = "";
  for await (const chunk of ctx.ai.stream(prompt)) {
    if (chunk.type === "text") out += chunk.delta;
    else if (chunk.type === "error") throw new Error(chunk.message);
  }
  return out;
}

// Use it in output.js to classify the scene, for example:
const mood = await ask(
  `In one word (calm, tense, or dire), the mood of this text:\n\n${ctx.output}`,
);
ctx.console.log("scene mood:", mood.trim());
```

Messages-array form for more control:

```js
const summary = await (async () => {
  let s = "";
  for await (const c of ctx.ai.stream([
    { role: "system", content: "You summarise concisely." },
    { role: "user", content: ctx.output },
  ])) {
    if (c.type === "text") s += c.delta;
  }
  return s;
})();
```

> Note the field name: `ctx.ai.stream` takes raw LLM messages using **`content`**
> (it maps straight to the provider API), whereas `ctx.messages` and
> `ctx.state.messages` use **`text`**. They're different shapes for different jobs.

> The idle timeout is paused while an AI call streams, but the **ceiling** still
> applies — a runaway secondary call can still time the hook out.

---

## Stopping a turn

Both halt the turn immediately; no later scripts or plugins run. They differ in
what happens to the changes already enqueued this turn:

| Method            | Prior enqueued changes | Model call | Message saved |
| ----------------- | ---------------------- | ---------- | ------------- |
| `ctx.stop(reason?)`   | **Committed**          | Skipped (if not yet made) | No |
| `ctx.cancel(reason?)` | **Discarded (rolled back)** | Skipped | No |

Use `stop()` when you've done meaningful work you want to keep (e.g. updated
memory, injected a note) but want to end the turn without an AI response. Use
`cancel()` to abort the turn entirely as if it never happened.

```js
// input.js — treat a slash-command as a state change, no AI response.
if (ctx.input.startsWith("/rest")) {
  ctx.essentials += "\nThe party rested and recovered.";
  ctx.stop("handled /rest");
}
```

---

## Data types

### `HistoryMessage`

```ts
interface HistoryMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parentId: string | null;
  text: string;
  thinkingBlocks: { id: string; messageId: string; content: string }[];
  createdAt: number;      // unix ms
  editedAt?: number;
  steeringNotes?: string;
}
```

### `Memory`

```ts
interface Memory {
  id: string;
  content: string;        // summary text
  messageIds: string[];   // the messages this memory covers
  createdAt: number;
  editedAt?: number;
}
```

### `StoryCard`

```ts
interface StoryCard {
  id: string;
  title: string;
  content: string;        // injected into context when triggered
  triggers: string[];     // case-insensitive; [] means always include
  tags: string[];         // free-form grouping, e.g. "character"
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}
```

When adding/editing via `ctx.addStoryCard` / `ctx.editStoryCard`, you supply
everything **except** `id`, `createdAt`, `updatedAt` (the engine assigns those).

### `ContextMessage`

The shape of each entry in `ctx.messages`. Uses `text` (like `HistoryMessage`),
plus the id of the source history message (or `null` when the engine generated
the entry).

```ts
interface ContextMessage {
  id: string | null;   // source HistoryMessage.id, or null (system/injected/kicker)
  role: "system" | "user" | "assistant";
  text: string;
}
```

### `ScriptConfig`

What `ctx.config` exposes — the resolved config **minus** the connection secrets
(`apiKey`, `endpoint`, `providerId` are withheld from scripts).

```ts
interface ScriptConfig {
  model: string;
  authorNotes: string;
  params: ModelParams;
  prompts: {
    defaultSystemPrompt: string;
    storyCardGeneratorPrompt: string;
    memoryGeneratorPrompt: string;
    scenarioGeneratorPrompt: string;
  };
}

interface ModelParams {
  contextWindow: number;
  maxOutputTokens: number;
  temperature: number;      // [0, 2]
  topP: number;             // [0, 1]
  frequencyPenalty: number; // [-2, 2]
  presencePenalty: number;  // [-2, 2]
  stop: string[];
  thinkingEnabled: boolean;
}
```

---

## Plugins

A plugin is a scenario-agnostic package of the same hook code, plus a manifest.
Users install it once (globally), then enable it per story and configure it
through an auto-generated UI.

### Manifest

```ts
interface PluginManifest {
  id: string;             // stable unique id, e.g. "com.author.dice-roller"
  name: string;
  version: string;        // informational, e.g. "1.0.0"
  author?: string;
  description?: string;
  permissions: PluginCapability[];   // consent list (see below)
  configSchema?: PluginConfigField[]; // drives the per-story config UI
  defaultConfig?: Record<string, unknown>;
  hooks: Partial<ScriptBundle>;      // only the phases you need
}
```

`hooks` mirrors the four files but every field is optional — provide only the
phases the plugin uses. The plugin's own `hooks.library` is prepended to its
hooks (and is private to the plugin).

### Capabilities / permissions

Declared for user consent at install time:

```ts
type PluginCapability = "ai" | "kvMemory" | "memories" | "storyCards";
```

These are shown to the user so they know what the plugin touches. Enforcement is
informational for now, so declare honestly what your plugin uses. There is no
`network` capability — the sandbox blocks all network access unconditionally, so
it could never be honored; `ctx.ai` is the only outbound path.

### Config schema & `ctx.pluginConfig`

Each `PluginConfigField` renders one control in the story's plugin settings:

```ts
interface PluginConfigField {
  key: string;                                  // read at ctx.pluginConfig[key]
  label: string;
  type: "string" | "number" | "boolean" | "select";
  default?: string | number | boolean;
  options?: string[];                           // for type: "select"
  description?: string;
}
```

Inside the plugin's hooks, the **resolved** config is available (read-only,
frozen) as `ctx.pluginConfig`. For scenario/story scripts (not plugins) it is
`{}`.

**Resolution order** (last wins):

1. `configSchema[].default` values
2. `manifest.defaultConfig`
3. The story's per-plugin `config` overrides (set in the UI)

```js
const sides = Number(ctx.pluginConfig.sides) || 20;
```

### Packaging

Plugins export/import as a `.plugin.zip` bundle (a legacy single-JSON form is
also importable). You author them in the plugin editor; the same `ctx` API and
sandbox rules apply.

### Full example

A complete, working plugin (this is the bundled Dice Roller):

```json
{
  "schemaVersion": 1,
  "kind": "plugin",
  "manifest": {
    "id": "com.example.dice-roller",
    "name": "Dice Roller",
    "version": "1.0.0",
    "author": "example",
    "description": "Rolls a die each turn and injects the result as a system note so the narrator factors luck into the outcome.",
    "permissions": [],
    "configSchema": [
      {
        "key": "sides",
        "label": "Die sides",
        "type": "number",
        "default": 20,
        "description": "Number of faces on the die rolled each turn."
      },
      {
        "key": "announce",
        "label": "Log roll to debug panel",
        "type": "boolean",
        "default": true
      }
    ],
    "defaultConfig": {},
    "hooks": {
      "input": "const sides = Number(ctx.pluginConfig.sides) || 20;\nconst roll = Math.floor(Math.random() * sides) + 1;\nctx.inject(`[Dice: the player rolled a d${sides} and got ${roll}. Subtly factor this luck into the outcome.]`);\nif (ctx.pluginConfig.announce) ctx.console.log(`Dice Roller: ${roll} / ${sides}`);"
    }
  }
}
```

---

## Recipes

### Turn counter (persistent, private)

```js
// input.js — scriptState is a plain object; mutate it directly.
ctx.scriptState.turn = (ctx.scriptState.turn ?? 0) + 1;
ctx.inject(`[This is turn ${ctx.scriptState.turn}.]`);
```

### Auto-create a story card the first time a name appears

```js
// output.js
const name = "Kaelen";
const known = ctx.state.storyCards.some(c => c.title === name);
if (!known && ctx.output.includes(name)) {
  ctx.addStoryCard({
    title: name,
    content: `${name} is a character introduced during the story.`,
    triggers: [name],
    tags: ["character"],
    enabled: true,
  });
}
```

### Keep the request under budget

```js
// buildContext.js
const budget = ctx.config.params.contextWindow - 1500;
while (ctx.estimatedTokens > budget && ctx.messages.length > 3) {
  // drop the oldest non-system message
  const i = ctx.messages.findIndex(m => m.role !== "system");
  if (i === -1) break;
  ctx.messages.splice(i, 1);
}
```

### Summarise into a memory, then suppress the default summarizer

```js
// output.js
let summary = "";
for await (const c of ctx.ai.stream(`Summarise in one sentence:\n\n${ctx.output}`)) {
  if (c.type === "text") summary += c.delta;
}
if (summary.trim()) {
  ctx.addMemory({ content: summary.trim(), messageIds: [ctx.currentTurnIds.assistant] });
  ctx.suppressDefaultSummarizer = true;
}
```

### Slash command handled entirely in-script

```js
// input.js
if (ctx.input.startsWith("/status")) {
  ctx.console.log(`Turn ${ctx.scriptState.turn ?? 0}. Essentials:\n${ctx.essentials}`);
  ctx.cancel("status shown"); // nothing to save, no AI call
}
```

---

## Gotchas & limits

- **`input.js` is skipped on Retry/Continue.** Don't put must-run-every-turn
  bookkeeping there if you rely on retries; `buildContext.js`/`output.js` run in
  those cases.
- **`ctx.state` doesn't reflect your own current-phase writes.** It's a snapshot;
  enqueued memory/card ops become visible to *later* phases, not the one that
  made them.
- **`ctx.inject` only works in `input.js`.** Elsewhere, mutate `ctx.messages`
  (buildContext) directly.
- **Model params are read-only.** `ctx.config` cannot change temperature, model,
  etc. mid-turn.
- **No network except `ctx.ai`.** `fetch` and friends are disabled in the
  sandbox.
- **Watch the ceiling timeout with `ctx.ai`.** Secondary calls pause the idle
  timer but not the absolute ceiling.
- **`kvMemory` is not undoable.** Use `scriptState` for anything that should
  participate in undo/redo.
- **Plugins run after your scenario/story script**, in listed order, sharing the
  same `ctx`. Order matters when two plugins touch the same field.
```

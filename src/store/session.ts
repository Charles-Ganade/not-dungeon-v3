import { createStore, produce, reconcile, StoreSetter, unwrap } from "solid-js/store";
import { createMemo } from "solid-js";
import { saveStory, saveThumbnail, touchStory } from "@/services/db";
import { libraryStore } from "./library";
import type { Story, HistoryMessage, Memory, StoryCard, ScriptBundle } from "@/core/types/stories";
import type { Session, Delta, DeltaTransaction } from "@/core/types/sessions";

interface SessionState {
  story: Story | null;
  session: Session | null;
}

const [state, setState] = createStore<SessionState>({
  story: null,
  session: null,
});

/**
 * The ordered list of messages on the currently active branch,
 * from root to current leaf. Recomputed whenever currentLeafId
 * or the messages array changes.
 */
const activePath = createMemo<HistoryMessage[]>(() => {
  const story = state.story;
  if (!story || story.currentLeafId === null) return [];

  const byId = new Map(story.messages.map((m) => [m.id, m]));
  const path: HistoryMessage[] = [];
  let current = byId.get(story.currentLeafId);

  while (current) {
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return path;
});

/**
 * The memories whose messageIds are all present in the current
 * active path. Irrelevant branch memories are excluded.
 */
const activeMemories = createMemo<Memory[]>(() => {
  const story = state.story;
  if (!story) return [];
  const pathIds = new Set(activePath().map((m) => m.id));
  return story.memories.filter((mem) =>
    mem.messageIds.every((id) => pathIds.has(id))
  );
});

const siblingLeaves = createMemo<HistoryMessage[]>(() => {
  const story = state.story;
  if (!story || !story.currentLeafId) return [];

  const currentLeaf = story.messages.find((m) => m.id === story.currentLeafId);
  if (!currentLeaf) return [];

  return story.messages.filter(
    (m) => m.parentId === currentLeaf.parentId && m.id !== story.currentLeafId
  );
});

let _saveTimer: ReturnType<typeof setTimeout> | null = null;
const SAVE_DEBOUNCE_MS = 1000;

function scheduleSave(): void {
  if (_saveTimer !== null) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    _saveTimer = null;
    if (!state.story) return;
    await saveStory(unwrap(state.story));
    libraryStore.syncStory(state.story);
  }, SAVE_DEBOUNCE_MS);
}

async function open(story: Story): Promise<void> {
  const now = Date.now();
  await touchStory(story.id);
  const activeStory = { ...story, lastPlayedAt: now };
  libraryStore.syncStory(activeStory);

  const session: Session = {
    storyId: activeStory.id,
    activePath: [],
    undoStack: [],
    redoStack: [],
    isGenerating: false,
    pendingTransactionId: null,
  };

  setState(reconcile({ story: activeStory, session }));

  if (activeStory.openingPrompt.trim() && activeStory.messages.length === 0) {
    const openingMessage: HistoryMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: activeStory.openingPrompt,
      parentId: null,
      thinkingBlocks: [],
      createdAt: Date.now(),
    };
    sessionStore.beginTransaction("Opening prompt");
    sessionStore.enqueue({ type: "message:add", message: openingMessage });
    sessionStore.commit();
  }
}

function close(): void {
  if (_saveTimer !== null) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
  setState(reconcile({ story: null, session: null }));
}

function applyDelta(delta: Delta): void {
  setState("story", produce((story) => {
    if (story) {
      switch (delta.type) {
        case "message:add":
          story.messages.push(delta.message);
          story.currentLeafId = delta.message.id;
          break;
        case "message:edit": {
          const msg = story.messages.find((m) => m.id === delta.messageId);
          if (msg) { msg.text = delta.next; msg.editedAt = Date.now(); }
          break;
        }
        case "message:remove":
          story.messages = story.messages.filter((m) => m.id !== delta.message.id);
          if (story.currentLeafId === delta.message.id) {
            story.currentLeafId = delta.message.parentId;
          }
          break;
        case "memory:add":
          story.memories.push(delta.memory);
          break;
        case "memory:edit": {
          const mem = story.memories.find((m) => m.id === delta.memoryId);
          if (mem) { mem.content = delta.next; mem.editedAt = Date.now(); }
          break;
        }
        case "memory:remove":
          story.memories = story.memories.filter((m) => m.id !== delta.memory.id);
          break;
        case "storyCard:add":
          story.storyCards.push(delta.card);
          break;
        case "storyCard:edit": {
          const card = story.storyCards.find((c) => c.id === delta.cardId);
          if (card) Object.assign(card, delta.next, { updatedAt: Date.now() });
          break;
        }
        case "storyCard:remove":
          story.storyCards = story.storyCards.filter((c) => c.id !== delta.card.id);
          break;
        case "essentials:edit":
          story.essentials = delta.next;
          break;
        case "scriptState:edit":
          story.scriptState = delta.next;
          break;
        default:
          delta satisfies never; // errors if a delta type is unhandled
      }
    }
  }));
}

function invertDelta(delta: Delta): Delta {
  switch (delta.type) {
    case "message:add":    return { type: "message:remove", message: delta.message };
    case "message:remove": return { type: "message:add", message: delta.message };
    case "message:edit":   return { type: "message:edit", messageId: delta.messageId, prev: delta.next, next: delta.prev };
    case "memory:add":     return { type: "memory:remove", memory: delta.memory };
    case "memory:remove":  return { type: "memory:add", memory: delta.memory };
    case "memory:edit":    return { type: "memory:edit", memoryId: delta.memoryId, prev: delta.next, next: delta.prev };
    case "storyCard:add":  return { type: "storyCard:remove", card: delta.card };
    case "storyCard:remove":return { type: "storyCard:add", card: delta.card };
    case "storyCard:edit": return { type: "storyCard:edit", cardId: delta.cardId, prev: delta.next, next: delta.prev };
    case "essentials:edit": return { type: "essentials:edit", prev: delta.next, next: delta.prev};
    case "scriptState:edit": return { type: "scriptState:edit", prev: delta.next, next: delta.prev };
    default:
      delta satisfies never; // errors if a delta type is unhandled
      return delta;
  }
}

/**
 * Opens a new pending transaction. The engine calls this when a
 * turn begins. Returns the transaction id.
 */
function beginTransaction(description: string): string {
  const id = crypto.randomUUID();
  setState("session", "pendingTransactionId", id);
  // Stash description for commit
  _pendingDescription = description;
  _pendingDeltas = [];
  return id;
}

let _pendingDescription = "";
let _pendingDeltas: Delta[] = [];

/**
 * Enqueues a delta into the pending transaction and immediately
 * applies it to the story. The engine calls this for each
 * individual mutation during a turn.
 */
function enqueue(delta: Delta): void {
  _pendingDeltas.push(delta);
  applyDelta(delta);
}

/**
 * Commits the pending transaction onto the undo stack and
 * clears the redo stack. Schedules a DB save.
 */
function commit(): void {
  if (!state.session?.pendingTransactionId) return;

  const transaction: DeltaTransaction = {
    id: state.session.pendingTransactionId,
    description: _pendingDescription,
    deltas: _pendingDeltas,
    timestamp: Date.now(),
  };

  setState("session", produce((session) => {
    if (session) {
      session.undoStack.push(transaction);
      session.redoStack = [];
      session.pendingTransactionId = null;
    }
  }));

  _pendingDeltas = [];
  _pendingDescription = "";
  scheduleSave();
}

/**
 * Discards the pending transaction and reverts its applied deltas.
 * Called when a turn errors out mid-way.
 */
function rollback(): void {
  // Reverse-apply all enqueued deltas
  for (const delta of [..._pendingDeltas].reverse()) {
    applyDelta(invertDelta(delta));
  }
  _pendingDeltas = [];
  _pendingDescription = "";
  setState("session", "pendingTransactionId", null);
}

function undo(): void {
  if (!state.session || state.session.undoStack.length === 0) return;

  const transaction = state.session.undoStack.at(-1)!;
  const reversedDeltas = [...transaction.deltas].reverse().map(invertDelta);
  for (const delta of reversedDeltas) applyDelta(delta);

  setState("session", produce((session) => {
    if (session) {
      session.undoStack.pop();
      session.redoStack.push(transaction);
    }
  }));

  scheduleSave();
}

function redo(): void {
  if (!state.session || state.session.redoStack.length === 0) return;

  const transaction = state.session.redoStack.at(-1)!;
  for (const delta of transaction.deltas) applyDelta(delta);

  setState("session", produce((session) => {
    if (session) {
      session.redoStack.pop();
      session.undoStack.push(transaction);
    }
  }));

  scheduleSave();
}

function setGenerating(value: boolean): void {
  setState("session", "isGenerating", value);
}

/**
 * Switches the active branch by setting currentLeafId directly.
 * Used when the user clicks a sibling branch (retry).
 * Not a delta operation — branch selection is not undoable.
 */
function switchBranch(leafId: string): void {
  setState("story", "currentLeafId", leafId);
  scheduleSave();
}

function eraseLastMessage(): void {
  const story = sessionStore.story;
  if (!story || !story.currentLeafId) return;

  const msg = story.messages.find((m) => m.id === story.currentLeafId);
  if (!msg) return;

  sessionStore.beginTransaction("Erase last message");
  sessionStore.enqueue({ type: "message:remove", message: msg });
  sessionStore.commit();
}

/**
 * Edits an existing message in-place without generating a new response.
 * Useful for fixing typos or manually tweaking the AI's response.
 * Because it uses deltas, this action is fully undoable.
 */
export function editMessage(messageId: string, newText: string): void {
  const story = sessionStore.story;
  if (!story) return;

  const msg = story.messages.find((m) => m.id === messageId);
  if (!msg || msg.text === newText) return;

  sessionStore.beginTransaction("Edit message");
  sessionStore.enqueue({
    type: "message:edit",
    messageId,
    prev: msg.text,
    next: newText,
  });
  sessionStore.commit();
}

/**
 * Edits the essentials (world/story details) section of the current story.
 * Changes are tracked as deltas and fully undoable.
 * Used for maintaining important world/character/setting information.
 */
export function editEssentials(newText: string): void {
  const story = sessionStore.story;
  if (!story || story.essentials === newText) return;

  sessionStore.beginTransaction("Edit essentials");
  sessionStore.enqueue({
    type: "essentials:edit",
    prev: story.essentials,
    next: newText,
  });
  sessionStore.commit();
}

/**
 * Edits the script state (persistent JSON data for hooks) of the current story.
 * Changes are tracked as deltas and fully undoable.
 * Used for maintaining script-controlled game state that persists across turns.
 */
export function editScriptState(newText: string): void {
  const story = sessionStore.story;
  if (!story || story.scriptState === newText) return;

  sessionStore.beginTransaction("Edit script state");
  sessionStore.enqueue({
    type: "scriptState:edit",
    prev: story.scriptState,
    next: newText,
  });
  sessionStore.commit();
}

/**
 * Updates story metadata (name, description, authorNotes, instructions) during play.
 * These changes are NOT tracked as deltas (not essential to gameplay).
 * Pass only the properties you want to update.
 */
export function editStoryMetadata(updates: Partial<Pick<Story, "name" | "description" | "authorNotes" | "instructions" | "kvMemory">>): void {
  const story = sessionStore.story;
  if (!story) return;

  const hasChanges = Object.entries(updates).some(
    ([key, value]) => story[key as keyof typeof updates] !== value
  );

  if (!hasChanges) return;

  setState("story", updates);
  scheduleSave();
}

export function editKvMemory(data: Record<string, unknown>) {
  const kv = sessionStore.story?.kvMemory;
  if (!kv) return;

  const hasChanges = Object.entries(data).some(
    ([key, value]) => kv[key as keyof typeof data] !== value
  );

  if (!hasChanges) return;

  setState("story", "kvMemory", data);
  scheduleSave();
}

/**
 * Updates the active story's thumbnail.
 * Saves the new blob to the database to generate an ID, updates the session state,
 * and schedules a background save (which automatically handles garbage collecting the old thumbnail).
 * Pass `null` to clear the current thumbnail.
 */
async function editThumbnail(blob: Blob | null): Promise<void> {
  if (!state.story) return;

  let newThumbnailId: string | undefined = undefined;
  
  if (blob) {
    newThumbnailId = await saveThumbnail(blob);
  }

  setState("story", "thumbnailId", newThumbnailId);
  scheduleSave();
}

export function editScripts(updates: Partial<ScriptBundle>): void {
  const scripts = sessionStore.story?.scripts;
  if (!scripts) return;

  const hasChanges = Object.entries(updates).some(
    ([key, value]) => scripts[key as keyof typeof updates] !== value
  );

  if (!hasChanges) return;

  setState("story", "scripts", updates);
  scheduleSave();
}

function editMemory(memoryId: string, memory: string | ((prev: string) => string)) {
  const memories = activeMemories();
  if (!memories) return;
  const prev = activeMemories().find(m => m.id === memoryId)?.content;
  let next: string;
  if (!prev) return;
  beginTransaction(`editing memory: ${memoryId}`);
  if (typeof memory === "function") {
    next = memory(prev);
  }
  else {
    next = memory;
  }
  enqueue({
    type: "memory:edit",
    prev, next, memoryId
  })
  commit();
}

function addStoryCard(card: StoryCard | StoryCard[]) {
  const storyCards = sessionStore.story?.storyCards;
  if (!storyCards) return;
  beginTransaction("adding story card/s");
  if (Array.isArray(card)) {
    card.forEach(c => {
      enqueue({
        type: "storyCard:add",
        card: c
      });
    })
  }
  else {
    enqueue({
      type: "storyCard:add",
      card
    })
  }
  commit();
}

function editStoryCard(cardId: string, card: StoryCard | ((prev: StoryCard) => StoryCard)) {
  const storyCards = sessionStore.story?.storyCards;
  if (!storyCards) return;

  const index = state.story!.storyCards.findIndex(
    (item) => item.id === cardId,
  );

  if (index === -1) throw new Error(`Story card with id ${cardId} does not exist`);

  const prev = storyCards[index];
  const next = typeof card === "function" ? card(prev) : card;

  beginTransaction(`Editing story card ${cardId}`);
  enqueue({
    type: "storyCard:edit",
    cardId,
    prev,
    next
  })
  commit();
}

function removeStoryCard(cardId: string) {
  const storyCards = sessionStore.story?.storyCards;
  if (!storyCards) return;

  const index = state.story!.storyCards.findIndex(
    (item) => item.id === cardId,
  );

  if (index === -1) throw new Error(`Story card with id ${cardId} does not exist`);

  const card = storyCards[index];

  beginTransaction(`deleting story card ${cardId}`);
  enqueue({
    type: "storyCard:remove",
    card
  });
  commit();
}

export const sessionStore = {
  // Reactive reads
  get story() { return state.story; },
  get session() { return state.session; },
  get activePath() { return activePath(); },
  get activeMemories() { return activeMemories(); },
  get siblingLeaves() { return siblingLeaves(); },
  get isGenerating() { return state.session?.isGenerating ?? false; },
  get canUndo() { return (state.session?.undoStack.length ?? 0) > 0; },
  get canRedo() { return (state.session?.redoStack.length ?? 0) > 0; },

  // Lifecycle
  open, close,

  // Engine API
  beginTransaction, enqueue, commit, rollback, setGenerating,

  // User actions
  undo, redo, switchBranch, eraseLastMessage, editMessage,
  editEssentials, editScriptState, editStoryMetadata, editScripts, editThumbnail,
  addStoryCard, editStoryCard, removeStoryCard,
  editMemory, editKvMemory
};
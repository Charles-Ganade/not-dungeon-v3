import { createStore, produce, reconcile, unwrap } from "solid-js/store";
import { createMemo } from "solid-js";
import { saveStory, touchStory } from "@/services/db";
import { libraryStore } from "./library";
import type { Story, HistoryMessage, Memory, StoryCard } from "@/core/types/stories";
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
  await touchStory(story.id);

  const session: Session = {
    storyId: story.id,
    activePath: [],
    undoStack: [],
    redoStack: [],
    isGenerating: false,
    pendingTransactionId: null,
  };

  setState(reconcile({ story, session }));

  if (story.openingPrompt.trim() && story.messages.length === 0) {
    const openingMessage: HistoryMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: story.openingPrompt,
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

export const sessionStore = {
  // Reactive reads
  get story() { return state.story; },
  get session() { return state.session; },
  get activePath() { return activePath(); },
  get activeMemories() { return activeMemories(); },
  get isGenerating() { return state.session?.isGenerating ?? false; },
  get canUndo() { return (state.session?.undoStack.length ?? 0) > 0; },
  get canRedo() { return (state.session?.redoStack.length ?? 0) > 0; },

  // Lifecycle
  open, close,

  // Engine API
  beginTransaction, enqueue, commit, rollback, setGenerating,

  // User actions
  undo, redo, switchBranch,
};
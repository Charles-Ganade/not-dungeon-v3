import {
  JSX,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  splitProps,
} from "solid-js";
import { EditorState, Compartment } from "@codemirror/state";
import { javascript, typescriptLanguage } from "@codemirror/lang-javascript";
import { CodeEditorProps } from "./CodeEditor.types";
import { EditorView } from "codemirror";
import {
  defaultKeymap,
  historyKeymap,
  history,
  indentWithTab,
} from "@codemirror/commands";
import {
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  keymap as keymapExtension,
} from "@codemirror/view";
import {
  foldGutter,
  indentOnInput,
  bracketMatching,
} from "@codemirror/language";
import {
  closeBrackets,
  autocompletion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import {
  tsFacetWorker,
  tsSyncWorker,
  tsLinterWorker,
  tsAutocompleteWorker,
  tsHoverWorker,
} from "@valtown/codemirror-ts";
import { type WorkerShape } from "@valtown/codemirror-ts/worker";
import * as Comlink from "comlink";
import TsWorkerConstructor from "@/workers/tsWorker?worker";
import { nordExtension, forestExtension } from "./CodeEditor.themes";
import { settingsStore } from "@/store";

export async function createEditorWorker() {
  const innerThread = new TsWorkerConstructor();
  const workerProxy = Comlink.wrap<WorkerShape>(innerThread);
  await workerProxy.initialize();

  return { workerProxy, innerThread };
}

const staticExtensions = [
  highlightSpecialChars(),
  history(),
  foldGutter(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  keymapExtension.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
];

const systemDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");

function hookApiCompletions(
  context: CompletionContext,
): CompletionResult | null {
  const word = context.matchBefore(/\w*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  return {
    from: word.from,
    options: [
      {
        label: "ctx",
        type: "variable",
        info: "The engine context provided to this hook.",
        boost: 99,
      },
    ],

    filter: true,
  };
}

function resolveThemeExtension() {
  const setting = settingsStore.settings.UI.theme;
  const isDark =
    setting === "dark" || (setting === "system" && systemDarkQuery.matches);
  return isDark ? forestExtension : nordExtension;
}

export function CodeEditor(props: CodeEditorProps) {
  const [local, rest] = splitProps(props, [
    "name",
    "value",
    "onChange",
    "sharedLib",
    "onClick",
    "sharedLibPath",
    "ambientTypes",
  ]);

  let editorEl!: HTMLDivElement;
  let view: EditorView | undefined;

  const themeCompartment = new Compartment();

  const [worker, setWorker] = createSignal<WorkerShape | null>(null);
  let threadToKill: Worker | null = null;

  const path = () => local.name.trim() + ".js";

  onMount(async () => {
    const { workerProxy, innerThread } = await createEditorWorker();
    threadToKill = innerThread;
    await workerProxy.updateFile({
      path: path(),
      code: local.value ?? "",
    });

    const extensions = () =>
      [
        staticExtensions,
        javascript({ typescript: true }),
        themeCompartment.of(resolveThemeExtension()),
        tsFacetWorker.of({ worker: workerProxy, path: path() }),
        tsSyncWorker(),
        tsLinterWorker(),
        tsHoverWorker(),
        typescriptLanguage.data.of({
          autocomplete: tsAutocompleteWorker(),
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && local.onChange) {
            local.onChange(update.state.doc.toString());
          }
        }),
        local.ambientTypes?.includes("declare const ctx")
          ? typescriptLanguage.data.of({
              autocomplete: hookApiCompletions,
            })
          : undefined,
      ].filter((v) => v !== undefined);

    const state = EditorState.create({
      doc: local.value ?? "",
      extensions: extensions(),
    });

    view = new EditorView({ state, parent: editorEl });
    setWorker(() => workerProxy);
  });

  createEffect(() => {
    if (!worker() || !view) return;
    const incoming = local.value ?? "";
    const current = view.state.doc.toString();
    if (incoming === current) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: incoming },
    });
  });

  createEffect(() => {
    const w = worker();
    const lib = local.sharedLib;
    if (w === null || lib === undefined) return;
    void w.updateFile({
      path: local.sharedLibPath ?? "lib.js",
      code: lib,
    });
  });

  createEffect(() => {
    const w = worker();
    const types = local.ambientTypes;
    if (w === null || types === undefined) return;

    void w.updateFile({
      path: "env.d.ts",
      code: types,
    });
  });

  createEffect(() => {
    if (!worker() || !view) return;
    view.dispatch({
      effects: themeCompartment.reconfigure(resolveThemeExtension()),
    });
  });

  onMount(() => {
    const onSystemChange = () => {
      if (!view) return;
      if (settingsStore.settings.UI.theme !== "system") return;
      view.dispatch({
        effects: themeCompartment.reconfigure(resolveThemeExtension()),
      });
    };

    systemDarkQuery.addEventListener("change", onSystemChange);
    onCleanup(() =>
      systemDarkQuery.removeEventListener("change", onSystemChange),
    );
  });

  onCleanup(() => {
    view?.destroy();
    threadToKill?.terminate();
  });

  return (
    <div
      {...rest}
      data-editor-name={local.name}
      ref={editorEl}
      onClick={(e) => {
        view?.focus();
        (local.onClick as JSX.EventHandler<HTMLDivElement, MouseEvent>)?.(e);
      }}
    />
  );
}

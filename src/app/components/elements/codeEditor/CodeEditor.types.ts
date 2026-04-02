import { HookContext } from "@/core/types";
import type { JSX } from "solid-js";

export interface CodeEditorProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "onChange" > {
    /**
   * The display / internal name for this editor instance.
   * Also used to derive the virtual TS file path: `${name}.js`
   */
  name: string;
  /**
   * Current content of the editor (controlled).
   */
  value?: string;
  onChange?: (value: string) => void;
  /**
   * Content of the shared library file. Kept live-synced into the TS
   * environment as "lib.js", making its exports visible to all hook
   * editors via autocomplete, hover, and linting.
   *
   * Only needs to be passed to one mounted editor at a time — whichever
   * editor is the library editor, or any hook editor if no lib editor is
   * mounted.
   */
  sharedLib?: string;
  sharedLibPath?: string;
  onClick?: JSX.EventHandler<HTMLDivElement, MouseEvent>;
  /**
   * Raw TypeScript declaration string (e.g., "declare global { const ctx: MyType; }")
   * Synced into the worker as "env.d.ts"
   */
  ambientTypes?: HookContext;
}
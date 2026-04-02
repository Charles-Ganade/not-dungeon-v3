import { CodeEditor, Text } from "@/app/components";
import {
  buildContextHookContext,
  inputHookContext,
  outputHookContext,
} from "@/core/types";
import { useCreateScenario } from "../context";

export function ScriptsTab() {
  const { newScenario, setNewScenario } = useCreateScenario();

  return (
    <div class="tab-content bg-base-200 p-6">
      <div class="tabs tabs-lift">
        <label class="tab">
          <input type="radio" name="scripts-tab" checked />
          <div class="flex items-center gap-2">
            <Text class="text-inherit">input.js</Text>
          </div>
        </label>
        <div class="tab-content bg-base-100 border-base-300 border-t-0 p-4">
          <CodeEditor
            name="input"
            value={newScenario.scripts.input}
            onChange={(v) => {
              setNewScenario("scripts", "input", v);
            }}
            sharedLib={newScenario.scripts.library}
            sharedLibPath="library.js"
            ambientTypes={inputHookContext}
            class="w-full min-h-128 h-full"
          />
        </div>
        <label class="tab">
          <input type="radio" name="scripts-tab" />
          <div class="flex items-center gap-2">
            <Text class="text-inherit">buildContext.js</Text>
          </div>
        </label>
        <div class="tab-content bg-base-100 border-base-300 border-t-0 p-4">
          <CodeEditor
            name="buildContext"
            value={newScenario.scripts.buildContext}
            onChange={(v) => {
              setNewScenario("scripts", "buildContext", v);
            }}
            sharedLib={newScenario.scripts.library}
            sharedLibPath="library.js"
            ambientTypes={buildContextHookContext}
            class="w-full min-h-128"
          />
        </div>

        <label class="tab">
          <input type="radio" name="scripts-tab" />
          <div class="flex items-center gap-2">
            <Text class="text-inherit">output.js</Text>
          </div>
        </label>
        <div class="tab-content bg-base-100 border-base-300 border-t-0 p-4">
          <CodeEditor
            name="output"
            value={newScenario.scripts.output}
            onChange={(v) => {
              setNewScenario("scripts", "output", v);
            }}
            sharedLib={newScenario.scripts.library}
            sharedLibPath="library.js"
            ambientTypes={outputHookContext}
            class="w-full min-h-128"
          />
        </div>

        <label class="tab">
          <input type="radio" name="scripts-tab" />
          <div class="flex items-center gap-2">
            <Text class="text-inherit">library.js</Text>
          </div>
        </label>
        <div class="tab-content bg-base-100 border-base-300 border-t-0 p-4">
          <CodeEditor
            name="library"
            value={newScenario.scripts.library}
            onChange={(v) => {
              setNewScenario("scripts", "library", v);
            }}
            class="w-full min-h-128"
          />
        </div>
      </div>
    </div>
  );
}

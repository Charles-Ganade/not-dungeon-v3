import { sessionStore } from "@/store";
import { CodeEditor, Text } from "@/app/components";
import {
  inputHookContext,
  buildContextHookContext,
  outputHookContext,
} from "@/core/types";

export function ScriptsPanel() {
  return (
    <div class="flex flex-1 flex-col gap-2 p-4 min-h-0">
      <div class="w-full pb-2">
        <Text variant={"h4"} class="leading-none font-bold">
          Scripts
        </Text>
      </div>
      <div class="tabs tabs-lift flex-1 min-h-0">
        <label class="tab">
          <input type="radio" name="scripts-tab" checked />
          <div class="flex items-center gap-2">
            <Text class="text-inherit">input.js</Text>
          </div>
        </label>
        <div class="tab-content bg-base-100 border-base-300 border-t-0 relative">
          <div class="absolute inset-0 p-4">
            <CodeEditor
              name="input"
              value={sessionStore.story?.scripts.input}
              onChange={(input) => {
                sessionStore.editScripts({ input });
              }}
              sharedLib={sessionStore.story?.scripts.library}
              sharedLibPath="library.js"
              ambientTypes={inputHookContext}
              class="h-full w-full"
            />
          </div>
        </div>
        <label class="tab">
          <input type="radio" name="scripts-tab" />
          <div class="flex items-center gap-2">
            <Text class="text-inherit">buildContext.js</Text>
          </div>
        </label>
        <div class="tab-content bg-base-100 border-base-300 border-t-0 relative">
          <div class="absolute inset-0 p-4">
            <CodeEditor
              name="buildContext"
              value={sessionStore.story?.scripts.buildContext}
              onChange={(buildContext) => {
                sessionStore.editScripts({ buildContext });
              }}
              sharedLib={sessionStore.story?.scripts.library}
              sharedLibPath="library.js"
              ambientTypes={buildContextHookContext}
              class="h-full w-full"
            />
          </div>
        </div>
        <label class="tab">
          <input type="radio" name="scripts-tab" />
          <div class="flex items-center gap-2">
            <Text class="text-inherit">output.js</Text>
          </div>
        </label>
        <div class="tab-content bg-base-100 border-base-300 border-t-0 relative">
          <div class="absolute inset-0 p-4">
            <CodeEditor
              name="output"
              value={sessionStore.story?.scripts.output}
              onChange={(output) => {
                sessionStore.editScripts({ output });
              }}
              sharedLib={sessionStore.story?.scripts.library}
              sharedLibPath="library.js"
              ambientTypes={outputHookContext}
              class="h-full w-full"
            />
          </div>
        </div>
        <label class="tab">
          <input type="radio" name="scripts-tab" />
          <div class="flex items-center gap-2">
            <Text class="text-inherit">library.js</Text>
          </div>
        </label>
        <div class="tab-content bg-base-100 border-base-300 border-t-0 relative">
          <div class="absolute inset-0 p-4">
            <CodeEditor
              name="library"
              value={sessionStore.story?.scripts.library}
              onChange={(library) => {
                sessionStore.editScripts({ library });
              }}
              class="h-full w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

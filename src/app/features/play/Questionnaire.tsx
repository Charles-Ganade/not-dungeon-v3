import { Modal, Text } from "@/app/components";
import { TemplateQuestion } from "@/core/templates";
import { createMemo, createSignal, Show } from "solid-js";
// @ts-ignore
import TextareaAutosize from "solid-textarea-autosize";

interface QuestionnaireProps {
  questions: TemplateQuestion[];
  onSubmit: (answers: Record<string, string>) => void;
}

export function Questionnaire(props: QuestionnaireProps) {
  if (props.questions.length === 0) {
    return <></>;
  }
  const [currentIndex, setCurrentIndex] = createSignal(0);
  const [answers, setAnswers] = createSignal<string[]>(
    Array(props.questions.length).fill(""),
  );

  const currentAnswer = createMemo(() => answers()[currentIndex()]);
  const isLast = createMemo(
    () => currentIndex() === props.questions.length - 1,
  );

  const isCurrentAnswered = createMemo(() => currentAnswer().trim() !== "");

  const allAnswered = createMemo(() =>
    answers().every((ans) => ans.trim() !== ""),
  );

  function updateAnswer(value: string) {
    const updated = [...answers()];
    updated[currentIndex()] = value;
    setAnswers(updated);
  }

  function next() {
    if (!isLast()) {
      setCurrentIndex(currentIndex() + 1);
    }
  }

  function prev() {
    if (currentIndex() > 0) {
      setCurrentIndex(currentIndex() - 1);
    }
  }

  const submit = () => {
    const result = Object.fromEntries(
      props.questions.map((q, i) => [q.key, answers()[i]]),
    );
    props.onSubmit(result);
  };
  return (
    <div class="grid place-items-center flex-1">
      <div class="flex flex-col gap-4">
        <Text variant={"h2"}>Question {currentIndex() + 1}</Text>

        <div class="flex flex-col gap-1">
          <Text variant={"h5"}>{props.questions[currentIndex()].prompt}</Text>
          <Text variant={"h4"}>
            <TextareaAutosize
              value={currentAnswer()}
              autoFocus
              // @ts-ignore
              onInput={(e) => updateAnswer(e.target.value)}
              class="textarea textarea-ghost textarea-lg resize-none overflow-y-auto flex-1 max-h-40 w-full min-h-0!"
              placeholder="Answer..."
              // @ts-ignore
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!isLast()) next();
                  else submit();
                }
              }}
              maxRows={5}
            />
          </Text>
        </div>

        <div class="flex gap-2">
          <button onClick={prev} disabled={currentIndex() === 0} class="btn">
            <Text>Previous</Text>
          </button>
          <Show
            when={!isLast()}
            fallback={
              <button
                onClick={submit}
                disabled={!allAnswered()}
                class="btn btn-primary"
              >
                <Text>Show</Text>
              </button>
            }
          >
            <button
              onClick={next}
              disabled={!isCurrentAnswered()}
              class="btn btn-accent"
            >
              <Text>Next</Text>
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}

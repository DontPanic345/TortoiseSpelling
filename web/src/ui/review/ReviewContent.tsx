import { useEffect, useRef } from "preact/hooks";
import type { ReviewCard } from "../../domain/cardPick";
import type { SpellingDiff } from "../../domain/spellingDiff";
import { ktIsBlank } from "../../domain/text";
import { BLANK_PLACEHOLDER } from "../../domain/wordBlank";
import { CloseIcon, VolumeUpIcon } from "../common/icons";
import { TopBar } from "../common/TopBar";
import { TestIds } from "../testIds";
import { blankedExampleOf, current, ending, position, total, type ReviewPhase, type ReviewState } from "./reviewState";

export interface ReviewContentProps {
  state: ReviewState;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onShowAnswer: () => void;
  onQuit: () => void;
  /** Whether there is a voice to speak with; the button is absent otherwise. */
  canSpeak: boolean;
  onSpeak: () => void;
}

export function ReviewContent({ state, onInputChange, onSubmit, onShowAnswer, onQuit, canSpeak, onSpeak }: ReviewContentProps) {
  const answer = useRef<HTMLInputElement>(null);
  const answerArea = useRef<HTMLDivElement>(null);
  const card = current(state);
  const { phase } = state;

  // Re-focus for each word so the keyboard never has to be summoned by hand. The field is
  // never remounted: on iOS only a tap raises the keyboard, so keeping focus on one element
  // is what keeps it up through a session.
  useEffect(() => {
    if (!state.loading && phase.kind !== "correct") answer.current?.focus();
  }, [state.index, phase.kind, state.loading]);

  // The feedback sits below the field, which the keyboard would otherwise cover. Wait a
  // frame so the new feedback has been laid out before measuring what to show.
  useEffect(() => {
    if (phase.kind === "prompting") return;
    const frame = requestAnimationFrame(() => answerArea.current?.scrollIntoView({ block: "nearest" }));
    return () => cancelAnimationFrame(frame);
  }, [state.index, phase.kind]);

  return (
    <main class="screen review">
      <TopBar
        title={state.practiceMode ? "Extra practice" : `${position(state)} / ${total(state)}`}
        navigation={
          <button type="button" class="icon-button" aria-label="End session" onClick={onQuit}>
            <CloseIcon />
          </button>
        }
      />
      {state.loading && <div class="loading" role="progressbar" aria-label="Loading" />}
      {card && !state.loading && (
        <>
          {total(state) > 0 && <LinearProgress value={state.index} max={total(state)} />}
          <Prompt card={card} phase={phase} blanked={blankedExampleOf(state)?.text ?? null} />
          <div class="answer-area" ref={answerArea}>
            <AnswerField
              inputRef={answer}
              value={state.input}
              phase={phase}
              onInputChange={onInputChange}
              onSubmit={onSubmit}
              canSpeak={canSpeak}
              onSpeak={onSpeak}
            />
            <Feedback card={card} phase={phase} onShowAnswer={onShowAnswer} />
          </div>
          {/* No Continue on the last word: the session closes itself a beat later, so the
              button would be gone by the time a thumb reached it. */}
          {!ending(state) && (
            <button
              type="button"
              class="button review-submit"
              data-testid={TestIds.REVIEW_SUBMIT}
              disabled={ktIsBlank(state.input) && phase.kind !== "correct"}
              onClick={onSubmit}
            >
              {submitLabel(phase)}
            </button>
          )}
        </>
      )}
    </main>
  );
}

function submitLabel(phase: ReviewPhase): string {
  if (phase.kind === "correct") return "Continue";
  if (phase.kind === "corrective" && phase.revealed) return "Check retype";
  return "Check";
}

function LinearProgress({ value, max }: { value: number; max: number }) {
  return (
    <div class="linear-progress" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div class="linear-progress-fill" style={{ width: `${(value / max) * 100}%` }} />
    </div>
  );
}

function Prompt({ card, phase, blanked }: { card: ReviewCard; phase: ReviewPhase; blanked: string | null }) {
  const sentence = card.example?.text;
  return (
    <div class="prompt">
      {card.hint !== null && <p class="prompt-hint">{card.hint}</p>}
      <h2 class="prompt-definition">{card.definition}</h2>
      {/* Once answered, show the sentence intact: seeing the word in context is most of the
          value of having an example at all. */}
      {phase.kind === "correct" && sentence !== undefined && !ktIsBlank(sentence) ? (
        <p class="example">{sentence}</p>
      ) : blanked !== null ? (
        <BlankedExample sentence={blanked} />
      ) : (
        <div>
          <p class="blank-line">{BLANK_PLACEHOLDER}</p>
          <p class="blank-caption">type the word</p>
        </div>
      )}
    </div>
  );
}

/**
 * The sentence with each placeholder drawn as a fixed-width underline rather than literal
 * underscores, which read as stray punctuation. Its width never depends on the hidden word,
 * so it can't give the answer away. The placeholder stays as visually hidden text, so
 * screen readers still hear "_____".
 */
function BlankedExample({ sentence }: { sentence: string }) {
  const parts = sentence.split(BLANK_PLACEHOLDER);
  return (
    <p class="example">
      {parts.map((part, i) => (
        <>
          {i > 0 && (
            <span class="blank">
              <span class="sr-only">{BLANK_PLACEHOLDER}</span>
            </span>
          )}
          {part}
        </>
      ))}
    </p>
  );
}

interface AnswerFieldProps {
  inputRef: { current: HTMLInputElement | null };
  value: string;
  phase: ReviewPhase;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  canSpeak: boolean;
  onSpeak: () => void;
}

function AnswerField({ inputRef, value, phase, onInputChange, onSubmit, canSpeak, onSpeak }: AnswerFieldProps) {
  const label =
    phase.kind !== "corrective" ? "Your answer" : phase.revealed ? "Type the correct spelling" : "Try again from memory";
  const state = phase.kind === "correct" ? "correct" : phase.kind === "corrective" ? "wrong" : "idle";
  return (
    <div class={`answer-field ${state}`}>
      <label for="review-answer">{label}</label>
      {/* The single most important configuration in the app: if the keyboard autocorrects a
          misspelling into the right word, or just offers it, the exercise is worthless. A
          text field with these attributes keeps the iPhone's password autofill away. */}
      <div class="answer-input">
        <input
          id="review-answer"
          ref={inputRef}
          class="word"
          type="text"
          value={value}
          readOnly={phase.kind === "correct"}
          aria-invalid={phase.kind === "corrective"}
          autocomplete="off"
          autocorrect="off"
          autocapitalize="none"
          spellcheck={false}
          enterkeyhint="done"
          data-testid={TestIds.REVIEW_ANSWER}
          onInput={(event) => onInputChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSubmit();
            }
          }}
        />
        {/* After the input, in the same parent, so it appearing or going never moves the field.
            Its pointerdown is cancelled so a tap leaves the input focused: blurring it would close
            the iOS keyboard. */}
        {canSpeak && (
          <button
            type="button"
            class="icon-button"
            aria-label="Hear the word"
            data-testid={TestIds.REVIEW_SPEAK}
            onPointerDown={(event) => event.preventDefault()}
            onClick={onSpeak}
          >
            <VolumeUpIcon />
          </button>
        )}
      </div>
    </div>
  );
}

function Feedback({ card, phase, onShowAnswer }: { card: ReviewCard; phase: ReviewPhase; onShowAnswer: () => void }) {
  switch (phase.kind) {
    case "prompting":
      return null;
    case "correct":
      return (
        <div class="feedback correct-feedback">
          <span class="caption">Correct</span>
          <span class="word correct-word" data-testid={TestIds.REVIEW_CORRECT_WORD}>
            {card.form}
          </span>
        </div>
      );
    case "corrective":
      return (
        <div class="feedback wrong-feedback">
          <p class="not-quite">Not quite</p>
          <DiffRow label="You typed" text={phase.attempt} diff={phase.diff} isAttempt />
          {phase.revealed ? (
            <div class="revealed">
              <DiffRow label="Correct" text={card.form} diff={phase.diff} isAttempt={false} />
            </div>
          ) : (
            <button type="button" class="text-button show-answer" onClick={onShowAnswer}>
              Show answer
            </button>
          )}
          {phase.retypeMissed && <p class="retype-missed">Not yet: type it exactly as shown above.</p>}
        </div>
      );
  }
}

/** One side of the comparison, dimming what matched and marking the character where the two words parted. */
function DiffRow({ label, text, diff, isAttempt }: { label: string; text: string; diff: SpellingDiff; isAttempt: boolean }) {
  return (
    <div class={`diff-row ${isAttempt ? "attempt" : "expected"}`}>
      <span class="caption">{label}</span>
      <span class="word diff-text">
        {text.split("").map((character, index) => {
          const diverged = diff.firstDivergence >= 0 && index >= diff.firstDivergence;
          const classes = ["diff-char", diverged ? "diverged" : "", index === diff.firstDivergence ? "first" : ""];
          return <span class={classes.filter(Boolean).join(" ")}>{character}</span>;
        })}
      </span>
    </div>
  );
}

import type { ReviewCard } from "../../domain/cardPick";
import { spellingDiff, type SpellingDiff } from "../../domain/spellingDiff";
import { ktIsBlank, ktTrim, normalizeWord } from "../../domain/text";
import { blankWordIn, type BlankedText } from "../../domain/wordBlank";

/** Where the user is on the current word. */
export type ReviewPhase =
  /** Typing the first attempt. */
  | { kind: "prompting" }
  /** Got it unaided; the word and full sentence are revealed. */
  | { kind: "correct" }
  /**
   * Missed it. The answer stays hidden while the learner has another go from memory;
   * `revealed` once they ask for it or miss again. After that a clean retype is required
   * before moving on, and it is not skippable.
   */
  | { kind: "corrective"; attempt: string; diff: SpellingDiff; revealed: boolean; retypeMissed: boolean };

export interface ReviewState {
  loading: boolean;
  queue: ReviewCard[];
  index: number;
  input: string;
  phase: ReviewPhase;
  finished: boolean;
  practiceMode: boolean;
}

/** What the screen does after a transition, in order. */
export type ReviewEffect =
  | { record: { wordId: number; correctFirstTry: boolean; typed: string } }
  | { autoAdvance: number }
  | { markShown: ReviewCard }
  | { openEdit: number };

export interface ReviewStep {
  state: ReviewState;
  effects: ReviewEffect[];
}

export function initialReviewState(practiceMode: boolean): ReviewState {
  return {
    loading: true,
    queue: [],
    index: 0,
    input: "",
    phase: { kind: "prompting" },
    finished: false,
    practiceMode,
  };
}

export const current = (state: ReviewState): ReviewCard | undefined => state.queue[state.index];

export const total = (state: ReviewState): number => state.queue.length;

export const position = (state: ReviewState): number => Math.min(state.index + 1, total(state));

/**
 * The last word has been answered, so the session is about to close itself. Nothing more
 * can be pressed here: the auto-advance is the end of the session.
 */
export const ending = (state: ReviewState): boolean =>
  state.phase.kind === "correct" && state.index === state.queue.length - 1;

/** The example sentence with the asked form masked, when it can be found in it. */
export function blankedExample(form: string, example: string | null): BlankedText | null {
  if (example === null || ktIsBlank(example)) return null;
  return blankWordIn(example, form);
}

export function blankedExampleOf(state: ReviewState): BlankedText | null {
  const card = current(state);
  return card ? blankedExample(card.form, card.example?.text ?? null) : null;
}

const idle = (state: ReviewState): ReviewStep => ({ state, effects: [] });

/** Rotation: the sentence on screen counts as shown, in practice mode too. */
function markShown(card: ReviewCard | undefined): ReviewEffect[] {
  return card?.example ? [{ markShown: card }] : [];
}

export function loaded(state: ReviewState, queue: ReviewCard[]): ReviewStep {
  return {
    state: { ...state, loading: false, queue, finished: queue.length === 0 },
    effects: markShown(queue[0]),
  };
}

export function inputChanged(state: ReviewState, input: string): ReviewStep {
  return idle({ ...state, input });
}

export function submit(state: ReviewState): ReviewStep {
  const card = current(state);
  if (!card) return idle(state);
  const typed = ktTrim(state.input);
  if (typed === "") return idle(state);

  const { phase } = state;
  switch (phase.kind) {
    case "prompting":
      return gradeFirstAttempt(state, card, typed);
    case "corrective":
      return phase.revealed ? checkRetype(state, phase, card, typed) : gradeSecondAttempt(state, card, typed);
    case "correct":
      return advance(state);
  }
}

function markCorrect(state: ReviewState, card: ReviewCard): ReviewStep {
  return {
    state: { ...state, phase: { kind: "correct" }, input: card.form },
    effects: [{ autoAdvance: state.index }],
  };
}

function gradeFirstAttempt(state: ReviewState, card: ReviewCard, typed: string): ReviewStep {
  const correct = normalizeWord(typed) === card.answer;
  const next = correct
    ? markCorrect(state, card)
    : idle({
        ...state,
        phase: { kind: "corrective", attempt: typed, diff: spellingDiff(card.form, typed), revealed: false, retypeMissed: false },
        input: "",
      });
  // Recorded at the miss, not at the retype: abandoning mid-correction should still count
  // as a lapse rather than leaving the word untouched.
  const record: ReviewEffect[] = state.practiceMode
    ? []
    : [{ record: { wordId: card.word.id, correctFirstTry: correct, typed } }];
  return { state: next.state, effects: [...next.effects, ...record] };
}

/** Already recorded as a miss at the first attempt, so this only decides what shows. */
function gradeSecondAttempt(state: ReviewState, card: ReviewCard, typed: string): ReviewStep {
  if (normalizeWord(typed) === card.answer) return markCorrect(state, card);
  return idle({
    ...state,
    phase: { kind: "corrective", attempt: typed, diff: spellingDiff(card.form, typed), revealed: true, retypeMissed: false },
    input: "",
  });
}

function checkRetype(
  state: ReviewState,
  phase: Extract<ReviewPhase, { kind: "corrective" }>,
  card: ReviewCard,
  typed: string,
): ReviewStep {
  if (normalizeWord(typed) === card.answer) return advance(state);
  return idle({ ...state, phase: { ...phase, retypeMissed: true }, input: "" });
}

export function showAnswer(state: ReviewState): ReviewStep {
  const { phase } = state;
  return idle(phase.kind === "corrective" ? { ...state, phase: { ...phase, revealed: true } } : state);
}

export function advance(state: ReviewState): ReviewStep {
  const index = state.index + 1;
  const finished = index >= state.queue.length;
  return {
    state: { ...state, index, input: "", phase: { kind: "prompting" }, finished },
    effects: finished ? [] : markShown(state.queue[index]),
  };
}

/** The pause after a correct answer is over. Ignored if the user has moved on in the meantime. */
export function autoAdvanceDue(state: ReviewState, forIndex: number): ReviewStep {
  return state.index === forIndex && state.phase.kind === "correct" ? advance(state) : idle(state);
}

/** Edit word, offered only after a miss. */
export function editRequested(state: ReviewState): ReviewStep {
  const card = current(state);
  if (!card || state.phase.kind !== "corrective") return idle(state);
  return { state, effects: [{ openEdit: card.word.id }] };
}

/** A saved edit is being undone and re-read. */
export function editSaving(state: ReviewState): ReviewStep {
  return idle({ ...state, loading: true });
}

/** The edited word is asked again, fresh, from its new content; null means it is gone. */
export function editedCard(state: ReviewState, card: ReviewCard | null): ReviewStep {
  if (card === null) return wordRemoved(state);
  const queue = state.queue.map((c, i) => (i === state.index ? card : c));
  return {
    state: { ...state, queue, loading: false, phase: { kind: "prompting" }, input: "" },
    effects: markShown(card),
  };
}

/** The current word is gone: the next takes its place, and the total drops with it. */
export function wordRemoved(state: ReviewState): ReviewStep {
  const queue = state.queue.filter((_, i) => i !== state.index);
  const finished = state.index >= queue.length;
  return {
    state: { ...state, queue, loading: false, phase: { kind: "prompting" }, input: "", finished },
    effects: finished ? [] : markShown(queue[state.index]),
  };
}

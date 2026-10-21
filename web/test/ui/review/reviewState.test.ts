import { describe, expect, it } from "vitest";
import { spellingDiff } from "../../../src/domain/spellingDiff";
import {
  advance,
  autoAdvanceDue,
  blankedExampleOf,
  editedCard,
  editRequested,
  ending,
  initialReviewState,
  inputChanged,
  loaded,
  showAnswer,
  submit,
  wordRemoved,
  type ReviewState,
} from "../../../src/ui/review/reviewState";
import { testCard } from "../../support/cards";

const rhythm = testCard("rhythm", { example: "The rhythm of the drums was steady.", id: 1 });
const necessary = testCard("necessary", { example: "It is necessary to rest.", id: 2 });
const ran = testCard("run", { example: "He ran the whole way home.", form: "ran", id: 3 });

function start(cards = [rhythm, necessary], practiceMode = false): ReviewState {
  return loaded(initialReviewState(practiceMode), cards).state;
}

function type(state: ReviewState, text: string) {
  return submit(inputChanged(state, text).state);
}

function missed(state = start()): ReviewState {
  return type(state, "rythm").state;
}

describe("loaded", () => {
  it("shows the first card and stamps its example as shown", () => {
    const step = loaded(initialReviewState(false), [rhythm, necessary]);
    expect(step.state).toMatchObject({ loading: false, index: 0, finished: false });
    expect(step.effects).toEqual([{ markShown: rhythm }]);
  });
  it("stamps nothing for a card with no example", () => {
    const bare = testCard("cat");
    expect(loaded(initialReviewState(false), [bare]).effects).toEqual([]);
  });
  it("an empty queue is finished", () => {
    expect(loaded(initialReviewState(false), []).state.finished).toBe(true);
  });
});

describe("submit", () => {
  it("a correct first attempt records a first-try pass and auto-advances", () => {
    const step = type(start(), "Rhythm");
    expect(step.state.phase).toEqual({ kind: "correct" });
    expect(step.state.input).toBe("rhythm");
    expect(step.effects).toEqual([
      { autoAdvance: 0 },
      { record: { wordId: 1, correctFirstTry: true, typed: "Rhythm" } },
    ]);
  });

  it("a miss records a lapse with the trimmed attempt and opens an unrevealed correction", () => {
    const step = type(start(), "  rythm ");
    expect(step.state.phase).toEqual({
      kind: "corrective",
      attempt: "rythm",
      diff: spellingDiff("rhythm", "rythm"),
      revealed: false,
      retypeMissed: false,
    });
    expect(step.state.input).toBe("");
    expect(step.effects).toEqual([{ record: { wordId: 1, correctFirstTry: false, typed: "rythm" } }]);
  });

  it("a correct second attempt records nothing more", () => {
    const step = type(missed(), "rhythm");
    expect(step.state.phase).toEqual({ kind: "correct" });
    expect(step.effects).toEqual([{ autoAdvance: 0 }]);
  });

  it("a wrong second attempt reveals the answer", () => {
    const step = type(missed(), "rhytm");
    expect(step.state.phase).toMatchObject({ kind: "corrective", attempt: "rhytm", revealed: true, retypeMissed: false });
    expect(step.effects).toEqual([]);
  });

  it("a retype miss says so and a retype hit advances", () => {
    const revealed = showAnswer(missed()).state;
    const miss = type(revealed, "rythm");
    expect(miss.state.phase).toMatchObject({ kind: "corrective", revealed: true, retypeMissed: true });
    expect(miss.state.input).toBe("");
    expect(miss.effects).toEqual([]);

    const hit = type(miss.state, "rhythm");
    expect(hit.state).toMatchObject({ index: 1, phase: { kind: "prompting" }, input: "" });
    expect(hit.effects).toEqual([{ markShown: necessary }]);
  });

  it("a blank input does nothing", () => {
    const state = inputChanged(start(), "   ").state;
    expect(submit(state)).toEqual({ state, effects: [] });
  });

  it("submitting a correct answer moves on at once", () => {
    const correct = type(start(), "rhythm").state;
    const step = submit(correct);
    expect(step.state).toMatchObject({ index: 1, phase: { kind: "prompting" } });
  });

  it("the comparison uses the asked form, so typing 'ran' for the form 'ran' is correct", () => {
    const step = type(start([ran]), "ran");
    expect(step.state.phase).toEqual({ kind: "correct" });
    expect(step.effects).toContainEqual({ record: { wordId: 3, correctFirstTry: true, typed: "ran" } });
    expect(type(start([ran]), "run").state.phase.kind).toBe("corrective");
  });
});

describe("showAnswer", () => {
  it("reveals the answer, and only in a correction", () => {
    expect(showAnswer(missed()).state.phase).toMatchObject({ kind: "corrective", revealed: true });
    const prompting = start();
    expect(showAnswer(prompting).state).toBe(prompting);
  });
});

describe("advance and auto-advance", () => {
  it("auto-advance for an old index is ignored", () => {
    const next = advance(type(start(), "rhythm").state).state;
    expect(autoAdvanceDue(next, 0)).toEqual({ state: next, effects: [] });
  });

  it("auto-advance for the current correct word moves on", () => {
    const correct = type(start(), "rhythm").state;
    expect(autoAdvanceDue(correct, 0).state.index).toBe(1);
  });

  it("auto-advance is ignored once the word is no longer correct", () => {
    const state = start();
    expect(autoAdvanceDue(state, 0).state).toBe(state);
  });

  it("advancing past the last card finishes without stamping anything", () => {
    const last = advance(start()).state;
    const step = advance(last);
    expect(step.state.finished).toBe(true);
    expect(step.effects).toEqual([]);
  });

  it("the last word answered correctly is the end of the session", () => {
    const last = advance(start()).state;
    expect(ending(type(last, "necessary").state)).toBe(true);
    expect(ending(advance(start()).state)).toBe(false);
    expect(ending(start())).toBe(false);
  });

  it("a missed last word is not ending until the retype is accepted", () => {
    const last = advance(start()).state;
    expect(ending(showAnswer(type(last, "nesesary").state).state)).toBe(false);
  });
});

describe("practice mode", () => {
  it("never yields a record, but still stamps examples", () => {
    const first = type(start([rhythm, necessary], true), "rhythm");
    expect(first.effects).toEqual([{ autoAdvance: 0 }]);
    const miss = type(start([rhythm, necessary], true), "rythm");
    expect(miss.effects).toEqual([]);
    expect(loaded(initialReviewState(true), [rhythm]).effects).toEqual([{ markShown: rhythm }]);
    expect(advance(start([rhythm, necessary], true)).effects).toEqual([{ markShown: necessary }]);
  });
});

describe("blankedExampleOf", () => {
  it("blanks the asked form", () => {
    expect(blankedExampleOf(start([ran]))?.text).toBe("He _____ the whole way home.");
  });
  it("has nothing to blank without an example", () => {
    expect(blankedExampleOf(start([testCard("ran")]))).toBeNull();
  });
});

describe("Edit word", () => {
  it("opens the editor after a miss, revealed or not", () => {
    const miss = missed();
    expect(editRequested(miss)).toEqual({ state: miss, effects: [{ openEdit: rhythm.word.id }] });
    const revealed = showAnswer(miss).state;
    expect(editRequested(revealed).effects).toEqual([{ openEdit: rhythm.word.id }]);
  });

  it("is idle while prompting and once correct", () => {
    expect(editRequested(start()).effects).toEqual([]);
    expect(editRequested(type(start(), "rhythm").state).effects).toEqual([]);
  });

  it("a saved edit replaces the card and asks it again from the start", () => {
    const edited = testCard("rhythm", { definition: "Beats.", example: "The rhythm held.", id: 1 });
    const step = editedCard({ ...showAnswer(missed()).state, loading: true }, edited);
    expect(step.state).toMatchObject({ queue: [edited, necessary], index: 0, loading: false, input: "", finished: false });
    expect(step.state.phase).toEqual({ kind: "prompting" });
    expect(step.effects).toEqual([{ markShown: edited }]);
  });

  it("a word gone by the save is dropped like a delete", () => {
    const miss = missed();
    expect(editedCard({ ...miss, loading: true }, null)).toEqual(wordRemoved(miss));
  });

  it("a deleted word leaves the session and the next takes its place", () => {
    const step = wordRemoved(missed());
    expect(step.state).toMatchObject({ queue: [necessary], index: 0, input: "", finished: false, loading: false });
    expect(step.state.phase).toEqual({ kind: "prompting" });
    expect(step.effects).toEqual([{ markShown: necessary }]);
  });

  it("deleting the last word finishes the session", () => {
    const onLast = missed(advance(start()).state);
    const step = wordRemoved(onLast);
    expect(step.state).toMatchObject({ queue: [rhythm], index: 1, finished: true });
    expect(step.effects).toEqual([]);
    expect(editedCard(onLast, null).state.finished).toBe(true);
  });
});

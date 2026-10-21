// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/preact";
import { describe, expect, it, onTestFinished } from "vitest";
import { spellingDiff } from "../../../src/domain/spellingDiff";
import { ReviewContent } from "../../../src/ui/review/ReviewContent";
import { initialReviewState, type ReviewPhase, type ReviewState } from "../../../src/ui/review/reviewState";
import { TestIds } from "../../../src/ui/testIds";
import { testCard } from "../../support/cards";

const queue = [
  testCard("rhythm", { definition: "A strong, regular pattern of sound.", example: "The rhythm of the drums was steady." }),
  testCard("necessary", { definition: "Required to be done.", example: "It is necessary to rest." }),
];

const ranQueue = [
  testCard("run", {
    definition: "To move fast on foot.",
    example: "He ran the whole way home.",
    partOfSpeech: "verb",
    form: "ran",
    label: "past tense",
  }),
];

function stateOf(overrides: Partial<ReviewState> = {}): ReviewState {
  return { ...initialReviewState(false), loading: false, queue, ...overrides };
}

function missed(revealed: boolean, retypeMissed = false): ReviewPhase {
  return { kind: "corrective", attempt: "rythm", diff: spellingDiff("rhythm", "rythm"), revealed, retypeMissed };
}

function show(state: ReviewState, canSpeak = false) {
  const calls = { inputs: [] as string[], submits: 0, shown: 0, quits: 0, spoken: 0 };
  const view = render(
    <ReviewContent
      state={state}
      onInputChange={(value) => calls.inputs.push(value)}
      onSubmit={() => calls.submits++}
      onShowAnswer={() => calls.shown++}
      onQuit={() => calls.quits++}
      canSpeak={canSpeak}
      onSpeak={() => calls.spoken++}
    />,
  );
  return { calls, ...view };
}

const answer = () => screen.getByTestId(TestIds.REVIEW_ANSWER) as HTMLInputElement;
const speakButton = () => screen.queryByTestId(TestIds.REVIEW_SPEAK) as HTMLButtonElement | null;
const submitButton = () => screen.getByTestId(TestIds.REVIEW_SUBMIT) as HTMLButtonElement;
const example = (container: Element) => container.querySelector(".example")?.textContent;
const text = (selector: string, container: Element) => container.querySelector(selector)?.textContent;

describe("ReviewContent", () => {
  it("prompting shows the definition and a blanked example", () => {
    const { container } = show(stateOf());
    expect(screen.getByText("1 / 2")).toBeTruthy();
    expect(screen.getByText("A strong, regular pattern of sound.")).toBeTruthy();
    expect(example(container)).toBe("The _____ of the drums was steady.");
    expect(container.textContent).not.toContain("rhythm");
  });

  it("a card for another form shows its label and blanks that form", () => {
    const { container } = show(stateOf({ queue: ranQueue }));
    expect(screen.getByText("verb · past tense")).toBeTruthy();
    expect(example(container)).toBe("He _____ the whole way home.");
  });

  it("a card for another form reveals that form when correct", () => {
    const { container } = show(stateOf({ queue: ranQueue, phase: { kind: "correct" }, input: "ran" }));
    expect(screen.getByTestId(TestIds.REVIEW_CORRECT_WORD).textContent).toBe("ran");
    expect(example(container)).toBe("He ran the whole way home.");
  });

  it("a card with no example asks for the word with a standalone blank", () => {
    show(stateOf({ queue: [testCard("cat")] }));
    expect(screen.getByText("_____")).toBeTruthy();
    expect(screen.getByText("type the word")).toBeTruthy();
  });

  it("check is disabled until something is typed", () => {
    show(stateOf());
    expect(submitButton().disabled).toBe(true);
  });

  it("check is enabled with input", () => {
    show(stateOf({ input: "rhy" }));
    expect(submitButton().disabled).toBe(false);
  });

  it("typing reaches the callback", () => {
    const { calls } = show(stateOf());
    fireEvent.input(answer(), { target: { value: "r" } });
    expect(calls.inputs).toEqual(["r"]);
  });

  it("check calls submit, and so does Enter", () => {
    const { calls } = show(stateOf({ input: "rhythm" }));
    fireEvent.click(submitButton());
    fireEvent.keyDown(answer(), { key: "Enter" });
    expect(calls.submits).toBe(2);
  });

  it("a miss hides the correct spelling and offers Show answer", () => {
    const { calls, container } = show(stateOf({ phase: missed(false) }));
    expect(screen.getByText("Not quite")).toBeTruthy();
    expect(screen.getByText("You typed")).toBeTruthy();
    expect(text(".attempt .diff-text", container)).toBe("rythm");
    expect(screen.queryByText("Correct")).toBeNull();
    expect(screen.getByLabelText("Try again from memory")).toBe(answer());
    fireEvent.click(screen.getByText("Show answer"));
    expect(calls.shown).toBe(1);
  });

  it("the diff marks the first divergence", () => {
    const { container } = show(stateOf({ phase: missed(false) }));
    const marked = [...container.querySelectorAll(".attempt .diff-char")].map((el) => el.className);
    expect(marked).toEqual(["diff-char", "diff-char diverged first", "diff-char diverged", "diff-char diverged", "diff-char diverged"]);
  });

  it("revealed shows the correct spelling and asks for a retype", () => {
    const { container } = show(stateOf({ phase: missed(true), input: "rhythm" }));
    expect(screen.getByText("Correct")).toBeTruthy();
    expect(text(".expected .diff-text", container)).toBe("rhythm");
    expect(screen.queryByText("Show answer")).toBeNull();
    expect(screen.getByLabelText("Type the correct spelling")).toBe(answer());
    expect(submitButton().textContent).toBe("Check retype");
    expect(screen.queryByText("Not yet: type it exactly as shown above.")).toBeNull();
  });

  it("a missed retype says so", () => {
    show(stateOf({ phase: missed(true, true), input: "rythm" }));
    expect(screen.getByText("Not yet: type it exactly as shown above.")).toBeTruthy();
  });

  it("correct reveals the word and the full example", () => {
    const { container } = show(stateOf({ phase: { kind: "correct" }, input: "rhythm" }));
    expect(screen.getByTestId(TestIds.REVIEW_CORRECT_WORD).textContent).toBe("rhythm");
    expect(example(container)).toBe("The rhythm of the drums was steady.");
    expect(submitButton().textContent).toBe("Continue");
    expect(answer().readOnly).toBe(true);
  });

  it("the last correct word has no button", () => {
    show(stateOf({ phase: { kind: "correct" }, input: "necessary", index: 1 }));
    expect(screen.getByTestId(TestIds.REVIEW_CORRECT_WORD)).toBeTruthy();
    expect(screen.queryByTestId(TestIds.REVIEW_SUBMIT)).toBeNull();
  });

  it("practice mode says so", () => {
    show(stateOf({ practiceMode: true }));
    expect(screen.getByText("Extra practice")).toBeTruthy();
    expect(screen.queryByText("1 / 2")).toBeNull();
  });

  it("End session calls quit", () => {
    const { calls } = show(stateOf());
    fireEvent.click(screen.getByLabelText("End session"));
    expect(calls.quits).toBe(1);
  });

  it("loading shows a progress indicator and no field", () => {
    render(
      <ReviewContent
        state={initialReviewState(false)}
        onInputChange={() => {}}
        onSubmit={() => {}}
        onShowAnswer={() => {}}
        onQuit={() => {}}
        canSpeak={false}
        onSpeak={() => {}}
      />,
    );
    expect(screen.getByLabelText("Loading")).toBeTruthy();
    expect(screen.queryByTestId(TestIds.REVIEW_ANSWER)).toBeNull();
  });

  it("the answer field turns off the keyboard's help", () => {
    // jsdom has no `spellcheck` property, which Preact sets as one where a browser has it.
    Object.defineProperty(HTMLElement.prototype, "spellcheck", {
      configurable: true,
      get(this: { _spellcheck?: boolean }) {
        return this._spellcheck;
      },
      set(this: { _spellcheck?: boolean }, value: boolean) {
        this._spellcheck = value;
      },
    });
    onTestFinished(() => void delete (HTMLElement.prototype as { spellcheck?: boolean }).spellcheck);
    show(stateOf());
    const field = answer();
    expect(field.getAttribute("type")).toBe("text");
    expect(field.getAttribute("autocomplete")).toBe("off");
    expect(field.getAttribute("autocorrect")).toBe("off");
    expect(field.getAttribute("autocapitalize")).toBe("none");
    expect(field.spellcheck).toBe(false);
    expect(field.getAttribute("enterkeyhint")).toBe("done");
  });

  it("the field is the same node before and after the word changes", () => {
    const props = { onInputChange: () => {}, onSubmit: () => {}, onShowAnswer: () => {}, onQuit: () => {}, canSpeak: false, onSpeak: () => {} };
    const { rerender } = render(<ReviewContent state={stateOf()} {...props} />);
    const before = answer();
    rerender(<ReviewContent state={stateOf({ phase: { kind: "correct" }, input: "rhythm" })} {...props} />);
    rerender(<ReviewContent state={stateOf({ index: 1 })} {...props} />);
    expect(answer()).toBe(before);
    expect(document.activeElement).toBe(before);
  });

  it("the blank's accessible text is the underscores", () => {
    const { container } = show(stateOf());
    const hidden = container.querySelector(".blank .sr-only");
    expect(hidden?.textContent).toBe("_____");
  });

  describe("the Hear the word button", () => {
    it("is absent when nothing can speak", () => {
      show(stateOf());
      expect(speakButton()).toBeNull();
    });

    it("is labelled for screen readers and sits after the field", () => {
      show(stateOf(), true);
      expect(speakButton()?.getAttribute("aria-label")).toBe("Hear the word");
      expect(speakButton()?.getAttribute("type")).toBe("button");
      expect(answer().nextElementSibling).toBe(speakButton());
    });

    it("appears when readiness changes, with the field the same node", () => {
      const props = { onInputChange: () => {}, onSubmit: () => {}, onShowAnswer: () => {}, onQuit: () => {}, onSpeak: () => {} };
      const { rerender } = render(<ReviewContent state={stateOf()} canSpeak={false} {...props} />);
      const before = answer();
      before.focus();
      rerender(<ReviewContent state={stateOf()} canSpeak {...props} />);
      expect(speakButton()).not.toBeNull();
      expect(answer()).toBe(before);
      rerender(<ReviewContent state={stateOf()} canSpeak={false} {...props} />);
      expect(speakButton()).toBeNull();
      expect(answer()).toBe(before);
      expect(document.activeElement).toBe(before);
    });

    it("is there in every phase", () => {
      const phases: ReviewPhase[] = [{ kind: "prompting" }, missed(false), missed(true), { kind: "correct" }];
      for (const phase of phases) {
        const { unmount } = show(stateOf({ phase }), true);
        expect(speakButton(), phase.kind).not.toBeNull();
        unmount();
      }
    });

    it("a click asks to speak", () => {
      const { calls } = show(stateOf(), true);
      fireEvent.click(speakButton()!);
      expect(calls.spoken).toBe(1);
    });

    it("a pointer tap leaves the input focused", () => {
      show(stateOf(), true);
      answer().focus();
      const down = new Event("pointerdown", { bubbles: true, cancelable: true });
      speakButton()!.dispatchEvent(down);
      expect(down.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(answer());
    });
  });
});

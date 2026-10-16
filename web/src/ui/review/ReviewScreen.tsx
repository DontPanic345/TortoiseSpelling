import { useEffect, useRef, useState } from "preact/hooks";
import { useContainer } from "../container";
import { back, replace } from "../router";
import { ReviewContent } from "./ReviewContent";
import {
  autoAdvanceDue,
  initialReviewState,
  inputChanged,
  loaded,
  showAnswer,
  submit,
  type ReviewEffect,
  type ReviewState,
  type ReviewStep,
} from "./reviewState";

export function ReviewScreen({ practiceMode }: { practiceMode: boolean }) {
  const { repository, autoAdvanceMillis } = useContainer();
  const [state, setState] = useState(() => initialReviewState(practiceMode));
  // Transitions read the latest state and run their effects at once, so a fast double tap
  // sees the first tap's result rather than a stale render.
  const latest = useRef<ReviewState>(state);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const unmounted = useRef(false);

  const run = (effect: ReviewEffect) => {
    if ("record" in effect) {
      const { wordId, correctFirstTry, typed } = effect.record;
      void repository.recordReview(wordId, correctFirstTry, typed);
    } else if ("markShown" in effect) {
      void repository.markShown(effect.markShown);
    } else {
      clearTimeout(timer.current);
      const forIndex = effect.autoAdvance;
      timer.current = setTimeout(() => dispatch((s) => autoAdvanceDue(s, forIndex)), autoAdvanceMillis);
    }
  };

  const dispatch = (transition: (state: ReviewState) => ReviewStep) => {
    if (unmounted.current) return;
    const before = latest.current;
    const step = transition(before);
    latest.current = step.state;
    setState(step.state);
    if (step.state.index !== before.index) clearTimeout(timer.current);
    step.effects.forEach(run);
  };

  useEffect(() => {
    unmounted.current = false;
    void (practiceMode ? repository.practicePool() : repository.buildSession()).then((queue) =>
      dispatch((s) => loaded(s, queue)),
    );
    return () => {
      unmounted.current = true;
      clearTimeout(timer.current);
    };
  }, []);

  const { finished, loading } = state;
  useEffect(() => {
    if (!finished || loading) return;
    if (practiceMode) back({ name: "home" });
    else replace({ name: "completion" });
  }, [finished, loading]);

  return (
    <ReviewContent
      state={state}
      onInputChange={(value) => dispatch((s) => inputChanged(s, value))}
      onSubmit={() => dispatch(submit)}
      onShowAnswer={() => dispatch(showAnswer)}
      onQuit={() => back({ name: "home" })}
    />
  );
}

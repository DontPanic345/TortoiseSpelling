import { useEffect, useRef, useState } from "preact/hooks";
import type { ReviewUndo } from "../../data/repository";
import { AddWordScreen, type EditOutcome } from "../add/AddWordScreen";
import { useContainer } from "../container";
import { back, navigate, replace } from "../router";
import type { SpeechPlatform } from "../speechPlatform";
import { ReviewContent } from "./ReviewContent";
import {
  autoAdvanceDue,
  current,
  editedCard,
  editRequested,
  editSaving,
  initialReviewState,
  inputChanged,
  loaded,
  showAnswer,
  submit,
  wordRemoved,
  type ReviewEffect,
  type ReviewState,
  type ReviewStep,
} from "./reviewState";

/** Whether the voices are ready, re-read when they change (they load after the page does). */
function useSpeechReady(speech: SpeechPlatform): boolean {
  const [ready, setReady] = useState(speech.ready);
  useEffect(() => {
    const update = () => setReady(speech.ready());
    update();
    return speech.onReadyChange(update);
  }, [speech]);
  return ready;
}

/** `editing`: the id of the word whose editor is open on top of the session. */
export function ReviewScreen({ practiceMode, editing }: { practiceMode: boolean; editing?: number }) {
  const { repository, autoAdvanceMillis, platform } = useContainer();
  const canSpeak = useSpeechReady(platform.speech);
  const [state, setState] = useState(() => initialReviewState(practiceMode));
  // Transitions read the latest state and run their effects at once, so a fast double tap
  // sees the first tap's result rather than a stale render.
  const latest = useRef<ReviewState>(state);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const unmounted = useRef(false);
  // Edit word: the editor opens only once the miss is written, so a saved edit can take it back.
  const opening = useRef(false);
  const recorded = useRef<Promise<void>>(Promise.resolve());
  const undo = useRef<ReviewUndo | null>(null);
  const editedWord = useRef<number | null>(null);
  const name = practiceMode ? "practice" : "review";

  const run = (effect: ReviewEffect) => {
    if ("record" in effect) {
      const { wordId, correctFirstTry, typed } = effect.record;
      recorded.current = repository.recordReview(wordId, correctFirstTry, typed).then((u) => {
        undo.current = u;
      });
    } else if ("markShown" in effect) {
      void repository.markShown(effect.markShown);
    } else if ("openEdit" in effect) {
      // A double tap would otherwise push two editor entries.
      if (opening.current) return;
      opening.current = true;
      const id = effect.openEdit;
      editedWord.current = id;
      void recorded.current.then(() => {
        opening.current = false;
        navigate({ name, editing: id });
      });
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
    if (step.state.index !== before.index) {
      clearTimeout(timer.current);
      undo.current = null;
    }
    step.effects.forEach(run);
  };

  useEffect(() => {
    unmounted.current = false;
    // A reload on the editor: the miss it was opened for belonged to a session that is gone.
    if (editing !== undefined) replace({ name });
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
    // closeEdit's history.back() lands later: replacing now would overwrite the editor's
    // entry, and the pop would then remount a fresh session. Wait for it to clear `editing`.
    if (!finished || loading || editing !== undefined) return;
    if (practiceMode) back({ name: "home" });
    else replace({ name: "completion" });
  }, [finished, loading, editing]);

  /** Back changes nothing; a save undoes the miss and asks the word again; a delete drops it. */
  const closeEdit = (outcome: EditOutcome | null) => {
    const wordId = editedWord.current;
    editedWord.current = null;
    if (outcome === null || wordId === null || current(latest.current)?.word.id !== wordId) {
      back({ name });
      return;
    }
    if (outcome === "deleted") {
      dispatch(wordRemoved);
      back({ name });
      return;
    }
    dispatch(editSaving);
    back({ name });
    void (async () => {
      const pending = undo.current;
      if (pending?.wordId === wordId) {
        undo.current = null;
        await repository.undoReview(pending);
      }
      const card = await repository.cardFor(wordId);
      dispatch((s) => editedCard(s, card));
    })();
  };

  if (editing !== undefined) return <AddWordScreen editingId={editing} onClosed={closeEdit} />;

  return (
    <ReviewContent
      state={state}
      onInputChange={(value) => dispatch((s) => inputChanged(s, value))}
      onSubmit={() => dispatch(submit)}
      onShowAnswer={() => dispatch(showAnswer)}
      onQuit={() => back({ name: "home" })}
      canSpeak={canSpeak}
      onSpeak={() => {
        const card = current(state);
        if (card) platform.speech.speak(card.form);
      }}
      onEditWord={() => dispatch(editRequested)}
    />
  );
}

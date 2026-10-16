import { relativeLabel } from "../../domain/days";
import { completionHeadline } from "./completionState";

interface CompletionPanelProps {
  reviewedCount: number;
  streak: number;
  nextDueDay: number | null;
  today: number;
  onPracticeMore?: () => void;
}

/**
 * The "you are finished" state, shared by the end of a session and Home so the two
 * can't drift apart.
 */
export function CompletionPanel({ reviewedCount, streak, nextDueDay, today, onPracticeMore }: CompletionPanelProps) {
  return (
    <div class="completion-panel">
      <div class="completion-emoji" aria-hidden="true">
        🎉
      </div>
      <h2 class="completion-headline">{completionHeadline(nextDueDay, today)}</h2>
      <p class="completion-line">
        {reviewedCount > 0
          ? reviewedCount === 1
            ? "You practised 1 word today."
            : `You practised ${reviewedCount} words today.`
          : "Nothing was due today."}
      </p>
      {streak > 0 && <p class="completion-streak">{streak === 1 ? "🔥 1 day streak" : `🔥 ${streak} day streak`}</p>}
      <p class="completion-next">
        Next review: {nextDueDay === null ? "nothing scheduled yet" : relativeLabel(nextDueDay, today)}
      </p>
      {onPracticeMore && (
        // Deliberately small and quiet: making extra practice prominent would undercut "you are done".
        <button type="button" class="text-button quiet" onClick={onPracticeMore}>
          Practise a few more anyway
        </button>
      )}
    </div>
  );
}

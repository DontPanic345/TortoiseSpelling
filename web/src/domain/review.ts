import type { ReviewLog, Word } from "../data/model";
import { Grade, RESET_BELOW_QUALITY, type Scheduler, sm2Scheduler } from "./srs";
import { ktTrim } from "./text";

/** A word after one review, and the log row that records it. */
export interface Reviewed<W extends Word> {
  word: W;
  log: Omit<ReviewLog, "id">;
}

/**
 * Apply one review to `word`. A first-try answer is `Grade.FIRST_TRY`; anything else is
 * `Grade.AFTER_RETYPE`, which takes SM-2's lapse branch. Generic so a `StoredWord` keeps
 * its content.
 */
export function reviewed<W extends Word>(
  word: W,
  correctFirstTry: boolean,
  typedAnswer: string,
  today: number,
  now: number,
  fuzz: (today: number, intervalDays: number) => number,
  scheduler: Scheduler = sm2Scheduler,
): Reviewed<W> {
  const quality = correctFirstTry ? Grade.FIRST_TRY : Grade.AFTER_RETYPE;
  const next = scheduler.next(
    { repetitions: word.repetitions, easeFactor: word.easeFactor, intervalDays: word.intervalDays },
    quality,
  );
  return {
    word: {
      ...word,
      repetitions: next.repetitions,
      easeFactor: next.easeFactor,
      intervalDays: next.intervalDays,
      dueOn: fuzz(today, next.intervalDays),
      lapses: word.lapses + (quality < RESET_BELOW_QUALITY ? 1 : 0),
      lastReviewedAt: now,
      firstReviewedOn: word.firstReviewedOn ?? today,
      isNew: false,
    },
    log: {
      wordId: word.id,
      reviewedAt: now,
      reviewedOn: today,
      grade: quality,
      correct: correctFirstTry,
      typedAnswer: ktTrim(typedAnswer),
    },
  };
}

/**
 * `current` with its scheduling put back to `before`'s, to take one review back. Content
 * and everything else (`id`, `text`, `normalizedText`, `createdAt`, `suspended`, a
 * `StoredWord`'s `content`) come from `current`, so an edit saved since is kept.
 */
export function undone<W extends Word>(current: W, before: Word): W {
  return {
    ...current,
    repetitions: before.repetitions,
    easeFactor: before.easeFactor,
    intervalDays: before.intervalDays,
    dueOn: before.dueOn,
    lapses: before.lapses,
    lastReviewedAt: before.lastReviewedAt,
    firstReviewedOn: before.firstReviewedOn,
    isNew: before.isNew,
  };
}

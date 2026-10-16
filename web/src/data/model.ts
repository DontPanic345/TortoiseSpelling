import type { WordContent } from "../domain/wordContent";

/**
 * A word the user is learning to spell, plus its SM-2 scheduling state. Teaching content
 * lives beside it (see `StoredWord`); only the scheduling is here.
 *
 * `dueOn` and `firstReviewedOn` are epoch days, not millis; every `...At` is millis.
 */
export interface Word {
  id: number;
  text: string;
  normalizedText: string;
  createdAt: number;
  repetitions: number;
  easeFactor: number;
  intervalDays: number;
  dueOn: number;
  lapses: number;
  lastReviewedAt: number | null;
  firstReviewedOn: number | null;
  isNew: boolean;
  suspended: boolean;
}

/** One row per word per review session. `reviewedOn` is an epoch day, `reviewedAt` millis. */
export interface ReviewLog {
  id: number;
  wordId: number;
  reviewedAt: number;
  reviewedOn: number;
  grade: number;
  correct: boolean;
  typedAnswer: string;
}

/** A word as the web app stores it: the scheduling row and its teaching tree together. */
export interface StoredWord extends Word {
  content: WordContent;
}

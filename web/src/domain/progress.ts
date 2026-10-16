import type { Word } from "../data/model";

/**
 * A word counts as known once its interval reaches three weeks. It's a display threshold
 * only; scheduling doesn't look at it.
 */
export const KNOWN_INTERVAL_DAYS = 21;

/** How far along the word list is, for Home's progress bar. Suspended words are left out. */
export interface WordProgress {
  new: number;
  learning: number;
  known: number;
  total: number;
}

export type LearningStage = "NEW" | "LEARNING" | "KNOWN";

/** null for a suspended word: it isn't counted at any stage. */
export function learningStage(word: Word): LearningStage | null {
  if (word.suspended) return null;
  if (word.isNew) return "NEW";
  if (word.intervalDays >= KNOWN_INTERVAL_DAYS) return "KNOWN";
  return "LEARNING";
}

export function wordProgress(words: readonly Word[]): WordProgress {
  const stages = words.map(learningStage);
  const count = (stage: LearningStage) => stages.filter((s) => s === stage).length;
  const progress = { new: count("NEW"), learning: count("LEARNING"), known: count("KNOWN") };
  return { ...progress, total: progress.new + progress.learning + progress.known };
}

/**
 * The word list's filter chips. DUE overlaps LEARNING and KNOWN (a due word can be
 * either), which is fine because the chips are single-select rather than a partition.
 */
export type WordFilter = "ALL" | "DUE" | "NEW" | "LEARNING" | "KNOWN" | "SUSPENDED";

export const WORD_FILTERS: readonly WordFilter[] = ["ALL", "DUE", "NEW", "LEARNING", "KNOWN", "SUSPENDED"];

export const WORD_FILTER_LABELS: Readonly<Record<WordFilter, string>> = {
  ALL: "All",
  DUE: "Due",
  NEW: "New",
  LEARNING: "Learning",
  KNOWN: "Known",
  SUSPENDED: "Suspended",
};

export function matches(filter: WordFilter, word: Word, today: number): boolean {
  switch (filter) {
    case "ALL":
      return true;
    case "DUE":
      return !word.suspended && !word.isNew && word.dueOn <= today;
    case "NEW":
      return learningStage(word) === "NEW";
    case "LEARNING":
      return learningStage(word) === "LEARNING";
    case "KNOWN":
      return learningStage(word) === "KNOWN";
    case "SUSPENDED":
      return word.suspended;
  }
}

/** Each filter's count over the whole list, for the chip labels. Ignores search. */
export function wordFilterCounts(words: readonly Word[], today: number): Record<WordFilter, number> {
  const counts = {} as Record<WordFilter, number>;
  for (const filter of WORD_FILTERS) {
    counts[filter] = words.filter((w) => matches(filter, w, today)).length;
  }
  return counts;
}

export type DayMark =
  /** At least one review. */
  | "PRACTICED"
  /** Nothing was due, which bridges the streak. */
  | "NOTHING_DUE"
  /** Words were due and none were reviewed. */
  | "MISSED"
  /** Today, not practised yet. Still in progress, so not a miss. */
  | "PENDING"
  /** Before the first word was added, so there was nothing to miss. */
  | "BEFORE_START";

export interface MarkedDay {
  day: number;
  mark: DayMark;
}

/**
 * The `count` days ending today, oldest first, for Home's week strip. Uses the same
 * inputs as `currentStreak`, so the strip and the streak can't disagree.
 */
export function recentDays(
  today: number,
  studyDays: ReadonlySet<number>,
  satisfiedDays: ReadonlySet<number>,
  firstDay: number | null,
  count = 7,
): MarkedDay[] {
  const days: MarkedDay[] = [];
  for (let day = today - count + 1; day <= today; day++) {
    let mark: DayMark;
    if (studyDays.has(day)) mark = "PRACTICED";
    else if (satisfiedDays.has(day)) mark = "NOTHING_DUE";
    else if (day === today) mark = "PENDING";
    else if (firstDay === null || day < firstDay) mark = "BEFORE_START";
    else mark = "MISSED";
    days.push({ day, mark });
  }
  return days;
}

/** Home's greeting for an hour of the day, 0-23. */
export function greeting(hour: number): string {
  if (hour >= 5 && hour <= 11) return "Good morning";
  if (hour >= 12 && hour <= 17) return "Good afternoon";
  return "Good evening";
}

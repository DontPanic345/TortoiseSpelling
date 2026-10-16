import type { Word } from "../data/model";
import { mathRandom, shuffled, type Random } from "./random";

// The DAO's queries, as pure functions over every word.

/** Words already in rotation and due on or before `today`, soonest first. */
export function dueWords(words: readonly Word[], today: number): Word[] {
  return words
    .filter((w) => !w.suspended && !w.isNew && w.dueOn <= today)
    .sort((a, b) => a.dueOn - b.dueOn);
}

export function dueCount(words: readonly Word[], today: number): number {
  return dueWords(words, today).length;
}

/** Unsuspended new words, oldest first. */
export function newWords(words: readonly Word[], limit: number): Word[] {
  return words
    .filter((w) => !w.suspended && w.isNew)
    .sort((a, b) => a.createdAt - b.createdAt || a.id - b.id)
    .slice(0, Math.max(limit, 0));
}

export function availableNewCount(words: readonly Word[]): number {
  return words.filter((w) => !w.suspended && w.isNew).length;
}

/** How many words were introduced (first ever reviewed) on `day`. */
export function introducedOn(words: readonly Word[], day: number): number {
  return words.filter((w) => w.firstReviewedOn === day).length;
}

/** Soonest upcoming due day among scheduled words, or null if there are none. */
export function nextDueDay(words: readonly Word[]): number | null {
  const days = words.filter((w) => !w.suspended && !w.isNew).map((w) => w.dueOn);
  return days.length === 0 ? null : Math.min(...days);
}

/** Random pool for free practice, which never touches scheduling. */
export function randomWords(words: readonly Word[], limit: number, random: Random = mathRandom): Word[] {
  return shuffled(
    words.filter((w) => !w.suspended),
    random,
  ).slice(0, Math.max(limit, 0));
}

/** When the oldest word was added (millis), or null with no words. */
export function firstCreatedAt(words: readonly Word[]): number | null {
  return words.length === 0 ? null : Math.min(...words.map((w) => w.createdAt));
}

/** Distinct days with at least one review, most recent first. */
export function recentStudyDays(logs: readonly { reviewedOn: number }[], limit: number): number[] {
  const days = [...new Set(logs.map((l) => l.reviewedOn))];
  return days.sort((a, b) => b - a).slice(0, Math.max(limit, 0));
}

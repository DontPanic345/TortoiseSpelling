import { mathRandom, nextInt, type Random } from "./random";

/** SM-2 working state for one word. */
export interface SrsState {
  repetitions: number;
  easeFactor: number;
  intervalDays: number;
}

/** Kept behind an interface so FSRS can replace SM-2 later. */
export interface Scheduler {
  next(prev: SrsState, quality: number): SrsState;
}

/** Intervals stop growing here; a spelling this cold is worth re-checking yearly. */
export const MAX_INTERVAL_DAYS = 365;

/** SM-2 treats any quality below this as a lapse: the word comes back tomorrow. */
export const RESET_BELOW_QUALITY = 3;

/** Starting state for a word that has never been reviewed. */
export const NEW_WORD_STATE: SrsState = { repetitions: 0, easeFactor: 2.5, intervalDays: 0 };

/**
 * SM-2 quality values as this app uses them. Only FIRST_TRY avoids the lapse branch;
 * AFTER_RETYPE is deliberately 2, not 3, so a word the user could not produce unaided
 * comes back tomorrow.
 */
export const Grade = {
  /** Correct on the first attempt. */
  FIRST_TRY: 5,
  /** Wrong, then retyped correctly after being shown the answer. */
  AFTER_RETYPE: 2,
  /** Wrong and gave up. Reserved: the retype is currently mandatory. */
  GAVE_UP: 0,
} as const;

export const sm2Scheduler: Scheduler = {
  next(prev, quality) {
    // The ease factor moves on every review, including lapses.
    const ease = Math.max(
      prev.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
      1.3,
    );

    if (quality < RESET_BELOW_QUALITY) {
      return { repetitions: 0, easeFactor: ease, intervalDays: 1 };
    }

    const repetitions = prev.repetitions + 1;
    let interval: number;
    switch (repetitions) {
      case 1:
        interval = 1;
        break;
      case 2:
        interval = 6;
        break;
      default:
        interval = Math.max(Math.round(prev.intervalDays * ease), 1);
    }
    return { repetitions, easeFactor: ease, intervalDays: Math.min(interval, MAX_INTERVAL_DAYS) };
  },
};

/**
 * The gaps, in days, between the reviews of a word spelled right first time at every review,
 * up to `MAX_INTERVAL_DAYS`, after which it comes back yearly. Home's info dialog shows
 * these, so the copy can't drift from the scheduler. Unfuzzed.
 */
export function allCorrectIntervals(scheduler: Scheduler = sm2Scheduler): number[] {
  const intervals: number[] = [];
  let state = NEW_WORD_STATE;
  while (state.intervalDays < MAX_INTERVAL_DAYS) {
    state = scheduler.next(state, Grade.FIRST_TRY);
    intervals.push(state.intervalDays);
  }
  return intervals;
}

/**
 * Due day for `intervalDays` from `today`, with a little spread so words added on the same
 * day don't stay clumped on the same due dates. Short intervals are left alone.
 */
export function fuzzedDueDay(today: number, intervalDays: number, random: Random = mathRandom): number {
  let spread: number;
  if (intervalDays <= 2) {
    spread = 0;
  } else if (intervalDays <= 7) {
    spread = 1;
  } else {
    spread = Math.max(Math.round(intervalDays * 0.05), 1);
  }
  const offset = spread === 0 ? 0 : nextInt(random, -spread, spread + 1);
  const interval = Math.min(Math.max(intervalDays + offset, 1), MAX_INTERVAL_DAYS);
  return today + interval;
}

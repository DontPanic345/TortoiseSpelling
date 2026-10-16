import type { Word } from "../data/model";
import { mathRandom, shuffled, type Random } from "./random";

/**
 * Spread `fresh` words through `due` rather than appending them: all-new-last makes the
 * tail of a session disproportionately hard, when attention is lowest.
 */
export function interleaveSession(due: readonly Word[], fresh: readonly Word[], random: Random = mathRandom): Word[] {
  if (fresh.length === 0) {
    return shuffled(due, random);
  }
  const queue = shuffled(due, random);
  shuffled(fresh, random).forEach((word, index) => {
    const position = Math.floor(((index + 1) * (queue.length + 1)) / (fresh.length + 1));
    queue.splice(Math.min(Math.max(position, 0), queue.length), 0, word);
  });
  return queue;
}

/**
 * How many new words may still be introduced today. Counts words introduced today, not
 * words reviewed today, so a heavy review day can't consume the allowance.
 */
export function remainingNewToday(newWordsPerDay: number, introducedToday: number): number {
  return Math.max(newWordsPerDay - introducedToday, 0);
}

/** A source of numbers in [0, 1), like `Math.random`. Tests pass a seeded one. */
export type Random = () => number;

export const mathRandom: Random = () => Math.random();

/** An integer in [from, until). */
export function nextInt(random: Random, from: number, until: number): number {
  return from + Math.floor(random() * (until - from));
}

/** A shuffled copy (Fisher-Yates). */
export function shuffled<T>(list: readonly T[], random: Random): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = nextInt(random, 0, i + 1);
    const held = copy[i] as T;
    copy[i] = copy[j] as T;
    copy[j] = held;
  }
  return copy;
}

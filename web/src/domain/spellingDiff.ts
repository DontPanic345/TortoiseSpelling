/**
 * Where a wrong attempt first went off the rails.
 *
 * `firstDivergence` is the index of the first differing character (UTF-16 unit), or the
 * length of the shorter string when one is a prefix of the other. It is -1 when the two
 * match.
 */
export interface SpellingDiff {
  expected: string;
  actual: string;
  firstDivergence: number;
  matches: boolean;
  /** Characters of the attempt that were still on track. */
  correctPrefixLength: number;
}

// Kotlin's lowercaseChar is the one-unit simple mapping; JavaScript's toLowerCase is the
// full one, which differs only for U+0130, whose Kotlin lowercase is "i".
function lower(unit: string): string {
  return unit === "\u0130" ? "i" : unit.toLowerCase();
}

function equalsIgnoreCase(a: string, b: string): boolean {
  return a === b || lower(a) === lower(b);
}

export function spellingDiff(expected: string, actual: string): SpellingDiff {
  const shared = Math.min(expected.length, actual.length);
  let index = 0;
  while (index < shared && equalsIgnoreCase(expected.charAt(index), actual.charAt(index))) {
    index++;
  }
  let firstDivergence: number;
  if (index < shared) firstDivergence = index;
  else if (expected.length !== actual.length) firstDivergence = shared;
  else firstDivergence = -1;
  const matches = firstDivergence < 0;
  return {
    expected,
    actual,
    firstDivergence,
    matches,
    correctPrefixLength: matches ? actual.length : firstDivergence,
  };
}

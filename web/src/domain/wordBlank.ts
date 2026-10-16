import { ktIsBlank } from "./text";

/** Result of hiding a target word inside a longer piece of text. */
export interface BlankedText {
  text: string;
  didBlank: boolean;
}

/**
 * The visual placeholder for a blanked word. Fixed regardless of the word's length:
 * sizing it to match would tell the user how many letters to guess.
 */
export const BLANK_PLACEHOLDER = "_____";

function escapeRegex(word: string): string {
  return word.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

// Letter/digit lookarounds rather than \b, so hyphens and apostrophes at the edges still
// count as boundaries.
function wholeWordRegex(word: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(word)}(?![\\p{L}\\p{N}])`, "giu");
}

/**
 * Replace every whole-word occurrence of `word` in `sentence` with blanks. `didBlank` is
 * false when the word does not appear.
 */
export function blankWordIn(sentence: string, word: string): BlankedText {
  if (ktIsBlank(sentence) || ktIsBlank(word)) {
    return { text: sentence, didBlank: false };
  }
  let matched = false;
  const replaced = sentence.replace(wholeWordRegex(word), () => {
    matched = true;
    return BLANK_PLACEHOLDER;
  });
  return { text: replaced, didBlank: matched };
}

/**
 * Defensive scrub of a definition that would give the answer away; the lookup prompt asks
 * for a gloss without the word, but it is cheap to enforce here too.
 */
export function hideWordInDefinition(definition: string, word: string): string {
  return blankWordIn(definition, word).text;
}

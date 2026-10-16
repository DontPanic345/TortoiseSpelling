import type { Word } from "../data/model";
import { type Random, mathRandom, nextInt } from "./random";
import { ktTrim, normalizeWord } from "./text";
import type { WordContent } from "./wordContent";

/** An example sentence and where it sits: definition `d`, form `f`, example `e`. */
export interface CardExample {
  text: string;
  shownAt: number | null;
  d: number;
  f: number;
  e: number;
}

/** What one review asks: a definition, the `form` to spell, and a sentence to blank it from. */
export interface ReviewCard {
  word: Word;
  definition: string;
  partOfSpeech: string | null;
  form: string;
  label: string | null;
  example: CardExample | null;
  answer: string;
  hint: string | null;
}

/** "verb · past tense", or null with neither. Blank parts count as absent. */
function hintOf(partOfSpeech: string | null, label: string | null): string | null {
  const hint = [partOfSpeech, label]
    .flatMap((part) => (part === null ? [] : [ktTrim(part)]))
    .filter((part) => part !== "")
    .join(" · ");
  return hint === "" ? null : hint;
}

export function reviewCard(
  word: Word,
  definition: string,
  partOfSpeech: string | null,
  form: string,
  label: string | null,
  example: CardExample | null,
): ReviewCard {
  return {
    word,
    definition,
    partOfSpeech,
    form,
    label,
    example,
    answer: normalizeWord(form),
    hint: hintOf(partOfSpeech, label),
  };
}

const orNull = (text: string): string | null => (text === "" ? null : text);

/**
 * The card for `content`: the example shown longest ago across every definition and form
 * (never shown first, `random` among ties), asking for that example's form. A word with no
 * examples asks for its base form with no sentence; one with no content at all asks for
 * its own text.
 */
export function pickCard(word: Word, content: WordContent, random: Random = mathRandom): ReviewCard {
  const candidates = content.definitions.flatMap((definition, d) =>
    definition.forms.flatMap((form, f) =>
      form.examples.map((example, e) =>
        reviewCard(word, definition.text, orNull(definition.partOfSpeech), form.text, orNull(form.label), {
          text: example.text,
          shownAt: example.shownAt,
          d,
          f,
          e,
        }),
      ),
    ),
  );
  if (candidates.length > 0) {
    const shownAt = (card: ReviewCard) => card.example?.shownAt ?? Number.NEGATIVE_INFINITY;
    const oldest = Math.min(...candidates.map(shownAt));
    const oldestOnes = candidates.filter((card) => shownAt(card) === oldest);
    return oldestOnes[nextInt(random, 0, oldestOnes.length)] as ReviewCard;
  }
  const definition = content.definitions[0];
  const form = definition?.forms[0];
  return reviewCard(
    word,
    definition?.text ?? "",
    definition ? orNull(definition.partOfSpeech) : null,
    form?.text ?? word.text,
    form ? orNull(form.label) : null,
    null,
  );
}

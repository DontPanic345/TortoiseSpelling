import type { Word } from "../../src/data/model";
import { reviewCard, type ReviewCard } from "../../src/domain/cardPick";

export function testWord(text: string, id = 1): Word {
  return {
    id,
    text,
    normalizedText: text.toLowerCase(),
    createdAt: 0,
    repetitions: 0,
    easeFactor: 2.5,
    intervalDays: 0,
    dueOn: 0,
    lapses: 0,
    lastReviewedAt: null,
    firstReviewedOn: null,
    isNew: true,
    suspended: false,
  };
}

interface CardOptions {
  definition?: string;
  example?: string;
  partOfSpeech?: string | null;
  form?: string;
  label?: string | null;
  id?: number;
}

/** A review card for `text`, as Android's `testCard`: the asked form defaults to the word itself. */
export function testCard(text: string, options: CardOptions = {}): ReviewCard {
  const { definition = `A definition of ${text}.`, example = "", partOfSpeech = null, form = text, label = null, id = 1 } = options;
  return reviewCard(
    testWord(text, id),
    definition,
    partOfSpeech,
    form,
    label,
    example === "" ? null : { text: example, shownAt: null, d: 0, f: 0, e: 0 },
  );
}

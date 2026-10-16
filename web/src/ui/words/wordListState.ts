import type { StoredWord, Word } from "../../data/model";
import { relativeLabel } from "../../domain/days";
import { WORD_FILTER_LABELS, matches, type WordFilter } from "../../domain/progress";
import { ktIsBlank, normalizeWord } from "../../domain/text";
import { searchTerms } from "../../domain/wordContent";

export interface WordRow {
  word: Word;
  status: string;
  definition: string;
}

/** Short human-readable scheduling state for the list. */
export function statusLabel(word: Word, today: number): string {
  if (word.suspended) return "suspended";
  if (word.isNew) return "new";
  if (word.dueOn <= today) return "due today";
  return relativeLabel(word.dueOn, today);
}

/** The rows matching [filter] and a query that is a substring of the root or of any form's spelling. */
export function filterRows(words: readonly StoredWord[], query: string, filter: WordFilter, today: number): WordRow[] {
  const needle = normalizeWord(query);
  return words
    .filter((w) => needle === "" || [...searchTerms(w.content, w.text)].some((term) => term.includes(needle)))
    .filter((w) => matches(filter, w, today))
    .map((w) => ({
      word: w,
      status: statusLabel(w, today),
      definition: w.content.definitions[0]?.text ?? "",
    }));
}

/** The empty state's body when the query and filter together match nothing. */
export function noMatchesBody(query: string, filter: WordFilter): string {
  const filterPhrase = filter === "ALL" ? null : `${WORD_FILTER_LABELS[filter].toLowerCase()} words`;
  if (filterPhrase === null) return `Nothing in your list matches “${query}”.`;
  if (ktIsBlank(query)) return `No ${filterPhrase}.`;
  return `No ${filterPhrase} match “${query}”.`;
}

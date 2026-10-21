import type { StoredWord, Word } from "../../data/model";
import { formWarnings } from "../../domain/formWarnings";
import { relativeLabel } from "../../domain/days";
import { WORD_FILTER_LABELS, matches, wordFilterCounts, type WordFilter } from "../../domain/progress";
import { ktIsBlank, normalizeWord } from "../../domain/text";
import { searchTerms } from "../../domain/wordContent";

export interface WordRow {
  word: Word;
  status: string;
  definition: string;
  checkForms: boolean;
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
      checkForms: formWarnings(w.text, w.content).length > 0,
    }));
}

/** The empty state's body when the query and filter together match nothing. */
export function noMatchesBody(query: string, filter: WordFilter): string {
  const filterPhrase = filter === "ALL" ? null : `${WORD_FILTER_LABELS[filter].toLowerCase()} words`;
  if (filterPhrase === null) return `Nothing in your list matches “${query}”.`;
  if (ktIsBlank(query)) return `No ${filterPhrase}.`;
  return `No ${filterPhrase} match “${query}”.`;
}

export interface WordListUiState {
  query: string;
  filter: WordFilter;
  filterCounts: Partial<Record<WordFilter, number>>;
  rows: WordRow[];
  totalCount: number;
  loading: boolean;
}

export const initialWordListState: WordListUiState = {
  query: "",
  filter: "ALL",
  filterCounts: {},
  rows: [],
  totalCount: 0,
  loading: true,
};

/** True when the query and filter together, not the filter alone, narrow the list. */
export function isFiltering(state: WordListUiState): boolean {
  return !ktIsBlank(state.query) || state.filter !== "ALL";
}

/** The loaded state for every word, a query and a filter. */
export function buildWordList(words: readonly StoredWord[], query: string, filter: WordFilter, today: number): WordListUiState {
  return {
    query,
    filter,
    filterCounts: wordFilterCounts(words, today),
    rows: filterRows(words, query, filter, today),
    totalCount: words.length,
    loading: false,
  };
}

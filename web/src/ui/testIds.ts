/**
 * The e2e suite's test ids, as `data-testid`. The values are `TestTags.kt`'s, checked
 * against it by `test/ui/testIds.test.ts`; the one extra is the web's backup nudge.
 */
export const TestIds = {
  HOME_PRACTICE_COUNT: "home_practice_count",
  HOME_ADD_WORD: "home_add_word",
  HOME_WEEK: "home_week",
  HOME_PROGRESS: "home_progress",
  HOME_BACKUP_NUDGE: "home_backup_nudge",

  ADD_WORD_TEXT: "add_word_text",
  ADD_WORD_DEFINITION: "add_word_definition",
  ADD_WORD_EXAMPLE: "add_word_example",
  ADD_WORD_PART_OF_SPEECH: "add_word_part_of_speech",
  ADD_WORD_SAVE: "add_word_save",
  ADD_WORD_COPY_PROMPT: "add_word_copy_prompt",
  ADD_WORD_PASTE: "add_word_paste",
  ADD_WORD_PASTE_TEXT: "add_word_paste_text",
  ADD_WORD_PASTE_USE: "add_word_paste_use",
  ADD_WORD_ADD_DEFINITION: "add_word_add_definition",

  WORD_LIST_SEARCH: "word_list_search",
  WORD_FILTER_ROW: "word_filter_row",

  SETTINGS_NEW_WORDS_VALUE: "settings_new_words_value",
  SETTINGS_NEW_WORDS_DECREASE: "settings_new_words_decrease",
  SETTINGS_NEW_WORDS_INCREASE: "settings_new_words_increase",

  REVIEW_ANSWER: "review_answer",
  REVIEW_SUBMIT: "review_submit",
  REVIEW_CORRECT_WORD: "review_correct_word",
} as const;

/** The tree editor's fields by position (definition, form, example). */
export const addWordDefinition = (d: number) => `add_word_definition_${d}`;
export const addWordAddForm = (d: number) => `add_word_add_form_${d}`;
export const addWordFormText = (d: number, f: number) => `add_word_form_text_${d}_${f}`;
export const addWordFormLabel = (d: number, f: number) => `add_word_form_label_${d}_${f}`;
export const addWordAddExample = (d: number, f: number) => `add_word_add_example_${d}_${f}`;
export const addWordExample = (d: number, f: number, e: number) => `add_word_example_${d}_${f}_${e}`;

/** One id per filter chip, e.g. "word_filter_due". */
export const wordFilter = (name: string) => `word_filter_${name}`;

/** Scopes a row's per-row buttons. */
export const wordRow = (normalizedText: string) => `word_row_${normalizedText}`;

/** The status badge's label. */
export const wordRowStatus = (normalizedText: string) => `word_row_status_${normalizedText}`;

import { ktIsBlank } from "../../domain/text";
import {
  apply,
  blankContent,
  isComplete,
  preparedFor,
  type ContentEdit,
  type DefinitionDraft,
  type FormDraft,
  type WordContent,
} from "../../domain/wordContent";
import { parsePastedLookup, type PastedLookup } from "../../domain/pastedLookup";

/** The paste dialog's text and what `parsePastedLookup` made of it; `result` is null while the text is blank. */
export interface PasteDraft {
  text: string;
  result: PastedLookup | null;
}

export interface AddWordState {
  editingId: number | null;
  text: string;
  content: WordContent;
  paste: PasteDraft | null;
  message: string | null;
  addedThisSession: number;
  totalWords: number;
}

export function newAddWordState(editingId: number | null = null): AddWordState {
  return {
    editingId,
    text: "",
    content: blankContent(),
    paste: null,
    message: null,
    addedThisSession: 0,
    totalWords: 0,
  };
}

export function canSave(text: string, content: WordContent): boolean {
  return !ktIsBlank(text) && isComplete(content);
}

/** The state after the user accepts a pasted answer: its spelling and content replace the editor's. */
export function applying(state: AddWordState, answer: Extract<PastedLookup, { kind: "valid" }>): AddWordState {
  return {
    ...state,
    text: answer.word,
    content: answer.content,
    paste: null,
    message: answer.renames ? `Corrected spelling to “${answer.word}”.` : state.message,
  };
}

export const isEditing = (state: AddWordState): boolean => state.editingId !== null;

export const canCopyPrompt = (state: AddWordState): boolean => !ktIsBlank(state.text);

/**
 * Content the editor can type into: the prepared tree (so a word with no definition or
 * base form still has a first definition and base form) with a blank example to fill when
 * the base form has none.
 */
export function editableContent(content: WordContent, word: string): WordContent {
  const prepared = preparedFor(content, word);
  const [first, ...rest] = prepared.definitions as [DefinitionDraft, ...DefinitionDraft[]];
  const [base, ...otherForms] = first.forms as [FormDraft, ...FormDraft[]];
  if (base.examples.length > 0) return prepared;
  const withExample = { ...base, examples: [{ text: "", shownAt: null }] };
  return { definitions: [{ ...first, forms: [withExample, ...otherForms] }, ...rest] };
}

/** The state once an edited word has loaded. */
export function loadedForEdit(state: AddWordState, word: string, content: WordContent): AddWordState {
  return { ...state, text: word, content: editableContent(content, word) };
}

export const textChanged = (state: AddWordState, text: string): AddWordState => ({ ...state, text });

export const edited = (state: AddWordState, edit: ContentEdit): AddWordState => ({
  ...state,
  content: apply(state.content, edit),
});

export const messageConsumed = (state: AddWordState): AddWordState => ({ ...state, message: null });

export const openPaste = (state: AddWordState): AddWordState => ({ ...state, paste: { text: "", result: null } });

export const dismissPaste = (state: AddWordState): AddWordState => ({ ...state, paste: null });

/** The dialog's text changed: the answer is parsed against the word as typed. */
export function pasteTextChanged(state: AddWordState, text: string): AddWordState {
  return { ...state, paste: { text, result: ktIsBlank(text) ? null : parsePastedLookup(text, state.text) } };
}

/** Accepts the pasted answer; anything but a valid one changes nothing. */
export function usePaste(state: AddWordState): AddWordState {
  const result = state.paste?.result;
  return result?.kind === "valid" ? applying(state, result) : state;
}

/** After a word is added the form clears, and the burst counter and total carry forward. */
export function afterAdd(state: AddWordState, total: number): AddWordState {
  return {
    ...newAddWordState(),
    addedThisSession: state.addedThisSession + 1,
    totalWords: total,
    message: `Added ✓ (${total} total)`,
  };
}

export const withMessage = (state: AddWordState, message: string): AddWordState => ({ ...state, message });

export const duplicateMessage = (existingText: string): string => `“${existingText}” is already in your list.`;

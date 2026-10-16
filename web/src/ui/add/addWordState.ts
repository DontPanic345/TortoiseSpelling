import { ktIsBlank } from "../../domain/text";
import { blankContent, isComplete, type WordContent } from "../../domain/wordContent";
import type { PastedLookup } from "../../domain/pastedLookup";

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

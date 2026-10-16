import type { PastedLookup } from "../../src/domain/pastedLookup";
import { apply, type ContentEdit, type WordContent } from "../../src/domain/wordContent";
import { newAddWordState, type AddWordState } from "../../src/ui/add/addWordState";
import { blankContent } from "../../src/domain/wordContent";

/** The add screen's states, twinning Android's `Fixtures.add*`. */
const applyAll = (content: WordContent, edits: ContentEdit[]) => edits.reduce(apply, content);

export const addNew = (): AddWordState => newAddWordState();

/** "run" with a "ran" form (past tense) whose example contains it. */
export function addRun(): AddWordState {
  return {
    ...addNew(),
    text: "run",
    content: applyAll(blankContent(), [
      { edit: "DefinitionText", definition: 0, value: "To move fast on foot." },
      { edit: "PartOfSpeech", definition: 0, value: "verb" },
      { edit: "ExampleText", definition: 0, form: 0, example: 0, value: "They run every day." },
      { edit: "AddForm", definition: 0 },
      { edit: "FormText", definition: 0, form: 1, value: "ran" },
      { edit: "FormLabel", definition: 0, form: 1, value: "past tense" },
      { edit: "ExampleText", definition: 0, form: 1, example: 0, value: "He ran the whole way home." },
    ]),
  };
}

export function addRunWithTwoDefinitions(): AddWordState {
  const state = addRun();
  return {
    ...state,
    content: applyAll(state.content, [
      { edit: "AddDefinition" },
      { edit: "DefinitionText", definition: 1, value: "A stretch of success or a sequence." },
      { edit: "PartOfSpeech", definition: 1, value: "noun" },
    ]),
  };
}

/** The paste dialog open on an answer that failed validation. */
export function addPasteInvalid(): AddWordState {
  const result: PastedLookup = {
    kind: "invalid",
    message: "That isn't the JSON the prompt asks for. Copy the chat's whole answer and paste it again.",
  };
  return { ...addNew(), text: "run", paste: { text: "Sure! Here you go", result } };
}

/** The paste dialog open on a valid answer for `answer`, typed as `typed`. */
export function addPasteValid(typed = "run", answer = "run"): AddWordState {
  const result: PastedLookup = {
    kind: "valid",
    word: answer,
    content: addRun().content,
    renames: typed.toLowerCase() !== answer.toLowerCase(),
  };
  return { ...addNew(), text: typed, paste: { text: `{"word": "${answer}"}`, result } };
}

export function addRunWithExampleMissingTheForm(): AddWordState {
  const state = addRun();
  return {
    ...state,
    content: apply(state.content, {
      edit: "ExampleText",
      definition: 0,
      form: 1,
      example: 0,
      value: "He sprinted the whole way home.",
    }),
  };
}

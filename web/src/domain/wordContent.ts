import { ktTrim, normalizeWord } from "./text";
import { blankWordIn, hideWordInDefinition } from "./wordBlank";

/**
 * A word's teaching content as the editor edits it, the backup stores it and a pasted
 * lookup fills it.
 *
 * `definitions[0].forms[0]` is the base form: the word's own spelling, which saving
 * always sets to the word's text. A blank `partOfSpeech` or `label` means none.
 */
export interface WordContent {
  definitions: DefinitionDraft[];
}

export interface DefinitionDraft {
  text: string;
  partOfSpeech: string;
  forms: FormDraft[];
}

export interface FormDraft {
  text: string;
  label: string;
  examples: ExampleDraft[];
}

export interface ExampleDraft {
  text: string;
  shownAt: number | null;
}

/** What a new word starts as: one blank definition, the base form, one blank example. */
export function blankContent(): WordContent {
  return {
    definitions: [
      {
        text: "",
        partOfSpeech: "",
        forms: [{ text: "", label: "", examples: [{ text: "", shownAt: null }] }],
      },
    ],
  };
}

/** One definition, the base form and, when `example` isn't blank, one example. */
export function simpleContent(
  word: string,
  definition: string,
  partOfSpeech: string | null,
  example: string,
): WordContent {
  return {
    definitions: [
      {
        text: definition,
        partOfSpeech: partOfSpeech ?? "",
        forms: [
          {
            text: word,
            label: "",
            examples: ktTrim(example) === "" ? [] : [{ text: example, shownAt: null }],
          },
        ],
      },
    ],
  };
}

const isBase = (definition: number, form: number) => definition === 0 && form === 0;

/** Trims every field and drops what is empty, keeping the base form and first definition. */
function pruned(content: WordContent): WordContent {
  const definitions = content.definitions.map((definition, d) => {
    const forms = definition.forms.flatMap((form, f) => {
      const examples = form.examples
        .map((example) => ({ ...example, text: ktTrim(example.text) }))
        .filter((example) => example.text !== "");
      const trimmed: FormDraft = {
        ...form,
        text: ktTrim(form.text),
        label: ktTrim(form.label),
        examples,
      };
      return !isBase(d, f) && trimmed.text === "" && examples.length === 0 ? [] : [trimmed];
    });
    return {
      ...definition,
      text: ktTrim(definition.text),
      partOfSpeech: ktTrim(definition.partOfSpeech),
      forms,
    };
  });
  return {
    definitions: definitions.filter(
      (definition, d) => d === 0 || definition.text !== "" || definition.forms.length > 0,
    ),
  };
}

/**
 * What saving stores for `word`: trimmed, without empty examples, forms and later
 * definitions, with the base form set to the word and every form's spelling blanked out
 * of every definition (so "practise" can't give away "practice").
 */
export function preparedFor(content: WordContent, word: string): WordContent {
  const spelling = ktTrim(word);
  let definitions = pruned(content).definitions;
  if (definitions.length === 0) definitions = [{ text: "", partOfSpeech: "", forms: [] }];
  definitions = definitions.map((definition, d) => {
    if (d !== 0) return definition;
    const forms =
      definition.forms.length === 0 ? [{ text: spelling, label: "", examples: [] }] : definition.forms;
    const [first, ...rest] = forms as [FormDraft, ...FormDraft[]];
    return { ...definition, forms: [{ ...first, text: spelling }, ...rest] };
  });
  const spellings = [
    ...new Set(definitions.flatMap((definition) => definition.forms.map((form) => form.text)).filter((t) => t !== "")),
  ];
  return {
    definitions: definitions.map((definition) => ({
      ...definition,
      text: spellings.reduce((text, form) => hideWordInDefinition(text, form), definition.text),
    })),
  };
}

/** Whether every definition and every form past the base form has its text. */
export function isComplete(content: WordContent): boolean {
  const definitions = pruned(content).definitions;
  return (
    definitions.length > 0 &&
    definitions.every((definition) => definition.text !== "") &&
    definitions.every((definition, d) =>
      definition.forms.every((form, f) => isBase(d, f) || form.text !== ""),
    )
  );
}

/** One editor action. Indices are positions: definition, then form, then example. */
export type ContentEdit =
  | { edit: "DefinitionText"; definition: number; value: string }
  | { edit: "PartOfSpeech"; definition: number; value: string }
  | { edit: "FormText"; definition: number; form: number; value: string }
  | { edit: "FormLabel"; definition: number; form: number; value: string }
  | { edit: "ExampleText"; definition: number; form: number; example: number; value: string }
  | { edit: "AddDefinition" }
  | { edit: "RemoveDefinition"; definition: number }
  | { edit: "AddForm"; definition: number }
  | { edit: "RemoveForm"; definition: number; form: number }
  | { edit: "AddExample"; definition: number; form: number }
  | { edit: "RemoveExample"; definition: number; form: number; example: number };

function changeAt<T>(list: T[], index: number, change: (item: T) => T): T[] {
  return list.map((item, i) => (i === index ? change(item) : item));
}

function without<T>(list: T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}

function changeDefinition(
  content: WordContent,
  d: number,
  change: (definition: DefinitionDraft) => DefinitionDraft,
): WordContent {
  return { definitions: changeAt(content.definitions, d, change) };
}

function changeForm(
  content: WordContent,
  d: number,
  f: number,
  change: (form: FormDraft) => FormDraft,
): WordContent {
  return changeDefinition(content, d, (definition) => ({
    ...definition,
    forms: changeAt(definition.forms, f, change),
  }));
}

const blankForm = (): FormDraft => ({ text: "", label: "", examples: [{ text: "", shownAt: null }] });

/** The content after `edit`. Removing the first definition or the base form does nothing. */
export function apply(content: WordContent, edit: ContentEdit): WordContent {
  switch (edit.edit) {
    case "DefinitionText":
      return changeDefinition(content, edit.definition, (d) => ({ ...d, text: edit.value }));
    case "PartOfSpeech":
      return changeDefinition(content, edit.definition, (d) => ({ ...d, partOfSpeech: edit.value }));
    case "FormText":
      return changeForm(content, edit.definition, edit.form, (f) => ({ ...f, text: edit.value }));
    case "FormLabel":
      return changeForm(content, edit.definition, edit.form, (f) => ({ ...f, label: edit.value }));
    case "ExampleText":
      return changeForm(content, edit.definition, edit.form, (f) => ({
        ...f,
        examples: changeAt(f.examples, edit.example, (e) => ({ ...e, text: edit.value })),
      }));
    case "AddDefinition":
      return {
        definitions: [...content.definitions, { text: "", partOfSpeech: "", forms: [blankForm()] }],
      };
    case "RemoveDefinition":
      return edit.definition === 0 ? content : { definitions: without(content.definitions, edit.definition) };
    case "AddForm":
      return changeDefinition(content, edit.definition, (d) => ({ ...d, forms: [...d.forms, blankForm()] }));
    case "RemoveForm":
      return isBase(edit.definition, edit.form)
        ? content
        : changeDefinition(content, edit.definition, (d) => ({ ...d, forms: without(d.forms, edit.form) }));
    case "AddExample":
      return changeForm(content, edit.definition, edit.form, (f) => ({
        ...f,
        examples: [...f.examples, { text: "", shownAt: null }],
      }));
    case "RemoveExample":
      return changeForm(content, edit.definition, edit.form, (f) => ({
        ...f,
        examples: without(f.examples, edit.example),
      }));
  }
}

/** The normalized root and every normalized form spelling: what the word list searches. */
export function searchTerms(content: WordContent, word: string): Set<string> {
  const spellings = [word, ...content.definitions.flatMap((definition) => definition.forms.map((f) => f.text))];
  return new Set(spellings.map(normalizeWord).filter((term) => term !== ""));
}

/** True when `example` has text but `formText` can't be blanked out of it. */
export function exampleMissesForm(example: string, formText: string): boolean {
  return ktTrim(example) !== "" && !blankWordIn(example, formText).didBlank;
}

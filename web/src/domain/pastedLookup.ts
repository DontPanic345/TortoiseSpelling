import { ktIsBlank, ktTrim, normalizeWord } from "./text";
import {
  type DefinitionDraft,
  type FormDraft,
  type WordContent,
  exampleMissesForm,
} from "./wordContent";

export type PastedLookup =
  | { kind: "valid"; word: string; content: WordContent; renames: boolean }
  | { kind: "invalid"; message: string };

/** `FORMS` is per definition and `EXAMPLES` per form; `WORD` also limits a form's text. */
export const PASTE_LIMITS = {
  TEXT: 20_000,
  DEFINITIONS: 8,
  FORMS: 12,
  EXAMPLES: 6,
  WORD: 60,
  DEFINITION: 300,
  PART_OF_SPEECH: 30,
  LABEL: 40,
  EXAMPLE: 300,
} as const;

const TOO_LONG = "That's too long to be one word's answer.";
const NOT_JSON = "That isn't the JSON the prompt asks for. Copy the chat's whole answer and paste it again.";
const PROMPT_PASTED = "That's the prompt, not the chat's answer. Paste the chat's reply instead.";
const OVER_LIMIT = "That answer is longer than a word needs. Ask the chat for a shorter one.";

// kotlinx reads a raw control character (a newline, say) inside a string; JSON.parse
// refuses one. Escaping them first makes the two accept the same answers.
function escapeControlCharacters(json: string): string {
  let out = "";
  let inString = false;
  for (let i = 0; i < json.length; i++) {
    const c = json.charAt(i);
    if (!inString) {
      inString = c === '"';
      out += c;
    } else if (c === "\\") {
      out += c + json.charAt(++i);
    } else if (c === '"') {
      inString = false;
      out += c;
    } else if (c < " ") {
      out += "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0");
    } else {
      out += c;
    }
  }
  return out;
}

// Chat apps that render markdown can copy a reply with a backslash before its brackets,
// underscores and the like (\[ \] \_ \* \# \`). JSON has no such escape, so each one is
// the chat's markdown, not the answer's; \\ and the real escapes are left alone.
function unescapeMarkdown(json: string): string {
  let out = "";
  for (let i = 0; i < json.length; i++) {
    const c = json.charAt(i);
    if (c !== "\\") {
      out += c;
      continue;
    }
    const next = json.charAt(++i);
    out += "[]_*#`".includes(next) && next !== "" ? next : c + next;
  }
  return out;
}

class Rejected extends Error {}

function reject(message: string): never {
  throw new Rejected(message);
}

type Json = unknown;

const isObject = (value: Json): value is Record<string, Json> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The trimmed string, or "" when the value is missing or isn't a JSON string. */
function string(value: Json): string {
  return typeof value === "string" ? ktTrim(value) : "";
}

function items(value: Json): Json[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Validates a chat AI's reply to `lookupPrompt` and turns it into content. The JSON is
 * located (first `{` to last `}`), never repaired beyond removing markdown backslashes; the first failure is the result.
 */
export function parsePastedLookup(text: string, typedWord: string): PastedLookup {
  try {
    return parseOrReject(text, typedWord);
  } catch (error) {
    if (error instanceof Rejected) return { kind: "invalid", message: error.message };
    throw error;
  }
}

function parseOrReject(text: string, typedWord: string): PastedLookup {
  if (text.length > PASTE_LIMITS.TEXT) reject(TOO_LONG);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) reject(NOT_JSON);
  let root: Json;
  try {
    root = JSON.parse(escapeControlCharacters(unescapeMarkdown(text.substring(start, end + 1))));
  } catch {
    root = null;
  }
  if (!isObject(root)) reject(NOT_JSON);

  const word = string(root.word);
  if (word === "") reject('The answer has no "word".');
  if ([...word].every((c) => c === "." || c === "…")) reject(PROMPT_PASTED);
  const rawDefinitions = Array.isArray(root.definitions) && root.definitions.length > 0 ? root.definitions : null;
  if (rawDefinitions === null) reject("The answer has no definitions.");

  let tooLong = rawDefinitions.length > PASTE_LIMITS.DEFINITIONS || word.length > PASTE_LIMITS.WORD;
  const definitions = rawDefinitions.map((element: Json, index: number): DefinitionDraft => {
    const n = index + 1;
    const definition = isObject(element) ? element : null;
    const definitionText = string(definition?.text);
    if (definitionText === "") reject(`Definition ${n} has no text.`);
    const rawForms = items(definition?.forms);
    if (rawForms.length === 0) reject(`Definition ${n} has no forms.`);
    const partOfSpeech = string(definition?.partOfSpeech);
    tooLong =
      tooLong ||
      rawForms.length > PASTE_LIMITS.FORMS ||
      definitionText.length > PASTE_LIMITS.DEFINITION ||
      partOfSpeech.length > PASTE_LIMITS.PART_OF_SPEECH;
    const forms = rawForms.map((rawForm): FormDraft => {
      const form = isObject(rawForm) ? rawForm : null;
      const formText = string(form?.text);
      if (formText === "") reject(`A form in definition ${n} has no text.`);
      const examples = items(form?.examples)
        .map(string)
        .filter((example) => example !== "");
      if (examples.length === 0) reject(`“${formText}” has no example sentence.`);
      const missing = examples.find((example) => exampleMissesForm(example, formText));
      if (missing !== undefined) reject(`“${missing}” doesn't contain “${formText}”.`);
      const label = string(form?.label);
      tooLong =
        tooLong ||
        formText.length > PASTE_LIMITS.WORD ||
        label.length > PASTE_LIMITS.LABEL ||
        examples.length > PASTE_LIMITS.EXAMPLES ||
        examples.some((example) => example.length > PASTE_LIMITS.EXAMPLE);
      return { text: formText, label, examples: examples.map((example) => ({ text: example, shownAt: null })) };
    });
    return { text: definitionText, partOfSpeech, forms };
  });
  if (tooLong) reject(OVER_LIMIT);

  return {
    kind: "valid",
    word,
    content: withBaseForm({ definitions }, word),
    renames: !ktIsBlank(typedWord) && normalizeWord(word) !== normalizeWord(typedWord),
  };
}

/** Moves the first form spelled `word` to the front of the first definition, or adds one. */
function withBaseForm(content: WordContent, word: string): WordContent {
  const first = content.definitions[0] as DefinitionDraft;
  const at = first.forms.findIndex((form) => normalizeWord(form.text) === normalizeWord(word));
  const forms =
    at < 0
      ? [{ text: word, label: "", examples: [] }, ...first.forms]
      : [first.forms[at] as FormDraft, ...first.forms.filter((_, i) => i !== at)];
  return { definitions: [{ ...first, forms }, ...content.definitions.slice(1)] };
}

const count = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

/** "2 definitions, 4 forms, 4 example sentences", singular for 1. */
export function summary(content: WordContent): string {
  const forms = content.definitions.flatMap((definition) => definition.forms);
  return [
    count(content.definitions.length, "definition", "definitions"),
    count(forms.length, "form", "forms"),
    count(forms.reduce((sum, form) => sum + form.examples.length, 0), "example sentence", "example sentences"),
  ].join(", ");
}

/** True when every definition, part of speech, form, label and example is blank. */
export function isBlank(content: WordContent): boolean {
  return content.definitions.every(
    (definition) =>
      ktIsBlank(definition.text) &&
      ktIsBlank(definition.partOfSpeech) &&
      definition.forms.every(
        (form) =>
          ktIsBlank(form.text) && ktIsBlank(form.label) && form.examples.every((example) => ktIsBlank(example.text)),
      ),
  );
}

import { ktTrim } from "./text";

/**
 * The prompt Copy prompt puts on the clipboard, for any chat AI. It is the contract with
 * `parsePastedLookup` and the Android app, so its wording changes deliberately.
 */
export function lookupPrompt(word: string): string {
  const trimmed = ktTrim(word);
  return `I'm learning to spell "${trimmed}". Write flashcard content for it.

Reply with only a JSON object, no other text, in exactly this shape:

{"word": "...", "definitions": [{"text": "...", "partOfSpeech": "...", "forms": [{"text": "...", "label": "...", "examples": ["..."]}]}]}

Rules:
- "word": "${trimmed}", spelled correctly. If it's misspelled, fix it. Otherwise keep it exactly as given, including British or American spelling.
- "definitions": the word's main meanings, most common first, usually one to three. Each "text" is a short dictionary-style definition, under 25 words, that doesn't use the word or any form of it.
- "partOfSpeech": noun, verb, adjective and so on.
- "forms": the common forms of the word for that meaning, such as plurals and verb tenses. The first form of the first definition is the word itself. "label" says which form it is, such as "plural" or "past tense".
- "examples": one or two natural sentences for each form. Each one must contain that form's "text" exactly, letter for letter, as a whole word.
- Use plain, everyday language that a learner would know, in the definitions and the example sentences.
- About a dozen forms and sentences in total is plenty.
`;
}

import { ktHasWhitespace, ktTrim } from "./text";
import type { WordContent } from "./wordContent";

/** A form that probably isn't a real form of its word: where it is and what to tell the user. */
export interface FormWarning {
  definition: number;
  form: number;
  message: string;
}

/**
 * The suspect forms in `content`, in content order (definition, then form); empty for a
 * clean word. The base form (definition 0, form 0) is never flagged: saving sets it to `word`.
 */
export function formWarnings(word: string, content: WordContent): FormWarning[] {
  // A phrase root ("ice cream") may have spaced forms ("ice creams").
  if (ktHasWhitespace(ktTrim(word))) return [];
  const warnings: FormWarning[] = [];
  content.definitions.forEach((definition, d) => {
    definition.forms.forEach((form, f) => {
      if (d === 0 && f === 0) return;
      const text = ktTrim(form.text);
      if (ktHasWhitespace(text)) {
        warnings.push({
          definition: d,
          form: f,
          message: `“${text}” is more than one word. Spelling review asks for one word.`,
        });
      }
    });
  });
  return warnings;
}

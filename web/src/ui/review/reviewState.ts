import { blankWordIn, type BlankedText } from "../../domain/wordBlank";
import { ktIsBlank } from "../../domain/text";

/** The example sentence with the asked form masked, when it can be found in it. */
export function blankedExample(form: string, example: string | null): BlankedText | null {
  if (example === null || ktIsBlank(example)) return null;
  return blankWordIn(example, form);
}

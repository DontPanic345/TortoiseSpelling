// Kotlin's whitespace is Char.isWhitespace: Unicode space, line and paragraph separators
// plus \t \n \v \f \r and U+001C-U+001F. JavaScript's trim() differs (it strips the BOM
// and keeps U+001F), so the port trims by Kotlin's rule.
const KT_WHITESPACE = "[\\p{Zs}\\p{Zl}\\p{Zp}\\t\\n\\v\\f\\r\\u001C-\\u001F]";
const LEADING = new RegExp(`^${KT_WHITESPACE}+`, "u");
const TRAILING = new RegExp(`${KT_WHITESPACE}+$`, "u");
const ALL_WHITESPACE = new RegExp(`^${KT_WHITESPACE}*$`, "u");

/** Kotlin's `String.trim()`. */
export function ktTrim(raw: string): string {
  return raw.replace(LEADING, "").replace(TRAILING, "");
}

/** Kotlin's `String.isBlank()`. */
export function ktIsBlank(raw: string): boolean {
  return ALL_WHITESPACE.test(raw);
}

const HAS_WHITESPACE = new RegExp(KT_WHITESPACE, "u");

/** Whether `raw` holds a character Kotlin's `Char.isWhitespace` accepts. */
export function ktHasWhitespace(raw: string): boolean {
  return HAS_WHITESPACE.test(raw);
}

// Java's \s: space, \t \n \v \f \r only, so a non-breaking space is not collapsed.
const JAVA_WHITESPACE_RUN = /[ \t\n\v\f\r]+/g;

/** Lowercased, trimmed, internal-whitespace-collapsed form used for comparison. */
export function normalizeWord(raw: string): string {
  return ktTrim(raw).toLowerCase().replace(JAVA_WHITESPACE_RUN, " ");
}

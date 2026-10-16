/** Rebuilds a word row's test id from the word, as the app does: lowercased, trimmed, whitespace collapsed. */
export const normalizeWord = (raw: string): string => raw.trim().toLowerCase().replace(/\s+/g, " ");

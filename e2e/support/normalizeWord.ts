/**
 * Mirrors com.falloon.tortoisespelling.data.normalizeWord: lowercased, trimmed,
 * internal-whitespace-collapsed. Used to rebuild a word's row test tag
 * (TestTags.wordRow / wordRowStatus) from the word text a step is given.
 */
export const normalizeWord = (raw: string): string => raw.trim().toLowerCase().replace(/\s+/g, ' ');

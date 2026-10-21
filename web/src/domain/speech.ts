export const SPEECH_RATE = 0.8;

/** A tag's language and region, lower-cased; the region is null when it has none. */
function languageAndRegion(tag: string): [string, string | null] {
  const parts = tag.toLowerCase().replaceAll("_", "-").split("-");
  const region = parts.slice(1).find((part) => /^([a-z]{2}|[0-9]{3})$/.test(part));
  return [parts[0] ?? "", region ?? null];
}

/**
 * The voice to speak with: its index in `voices` (the tags of the on-device voices, in the
 * caller's order), or null when none will do. An index, because an engine often has several
 * voices with one tag. Only language and region count: Android 14 puts `-u-…` extensions on the
 * device locale.
 */
export function chooseVoice(voices: string[], deviceLocales: string[]): number | null {
  const tags = voices.map(languageAndRegion);
  for (const locale of deviceLocales) {
    const [language, region] = languageAndRegion(locale);
    if (language !== "en" || region === null) continue;
    const index = tags.findIndex(([l, r]) => l === language && r === region);
    if (index >= 0) return index;
  }
  const english = tags.findIndex(([language]) => language === "en");
  return english >= 0 ? english : null;
}

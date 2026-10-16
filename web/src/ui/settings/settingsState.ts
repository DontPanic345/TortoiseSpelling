/** What Settings says after an import: how many words came in and how many were already there. */
export function importMessage(added: number, skipped: number): string {
  const words = `Imported ${added} word${added === 1 ? "" : "s"}`;
  return skipped > 0 ? `${words}, skipped ${skipped} already in your list.` : `${words}.`;
}

export const SOURCE_CODE_URL = "https://github.com/DontPanic345/TortoiseSpelling";
export const PRIVACY_POLICY_URL = `${SOURCE_CODE_URL}/blob/main/PRIVACY.md`;
export const NEW_WORDS_MIN = 1;
export const NEW_WORDS_MAX = 100;

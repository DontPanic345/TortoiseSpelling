/** What Settings says after an import: how many words came in and how many were already there. */
export function importMessage(added: number, skipped: number): string {
  const words = `Imported ${added} word${added === 1 ? "" : "s"}`;
  return skipped > 0 ? `${words}, skipped ${skipped} already in your list.` : `${words}.`;
}

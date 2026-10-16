/** "See you tomorrow" only when there is something for tomorrow. */
export function completionHeadline(nextDueDay: number | null, today: number): string {
  return nextDueDay === today + 1 ? "All done — see you tomorrow" : "All done for today";
}

export type PushKind = "reminder" | "test";

export interface ReminderText {
  title: string;
  body: string;
}

/** `ReminderWorker`'s copy: a reminder when anything is ready, "working" when nothing is. */
export function reminderNotification(total: number): ReminderText {
  if (total <= 0) return { title: "Reminders are working", body: "Nothing is due right now." };
  return { title: "Time to practise spelling", body: total === 1 ? "1 word ready" : `${total} words ready` };
}

/** An unreadable payload counts as a reminder. */
export function pushKind(data: { json(): unknown } | null): PushKind {
  try {
    const parsed = data?.json() as { kind?: unknown } | null | undefined;
    return parsed?.kind === "test" ? "test" : "reminder";
  } catch {
    return "reminder";
  }
}

import type { PushSupport } from "../../push/pushPlatform";

/** What Settings says after an import: how many words came in and how many were already there. */
export function importMessage(added: number, skipped: number): string {
  const words = `Imported ${added} word${added === 1 ? "" : "s"}`;
  return skipped > 0 ? `${words}, skipped ${skipped} already in your list.` : `${words}.`;
}

export const SOURCE_CODE_URL = "https://github.com/DontPanic345/TortoiseSpelling";
export const PRIVACY_POLICY_URL = `${SOURCE_CODE_URL}/blob/main/PRIVACY.md`;
export const NEW_WORDS_MIN = 1;
export const NEW_WORDS_MAX = 100;

/** What the Daily reminder section shows. `on` is the effective state: enabled and permission granted. */
export interface ReminderUi {
  on: boolean;
  support: PushSupport;
  hour: number;
  minute: number;
}

export const REMINDER_HELP: Record<PushSupport, string> = {
  supported:
    "Reminders come through your browser's push service, so they arrive when this device is online, within a few minutes of the time you set.",
  "needs-install":
    "On iPhone and iPad, reminders work once Tortoise Spelling is installed: tap Share, then Add to Home Screen, and open it from there.",
  unsupported: "This browser can't show reminders. Home still shows what's due today.",
};

/** "08:05", the value of a time input. */
export function timeValue(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** The hour and minute of a time input's value, or null while it is empty or incomplete. */
export function parseTime(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
}

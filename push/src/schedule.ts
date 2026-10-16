export interface Reminder {
  timeZone: string;
  hour: number;
  minute: number;
}

export interface Subscription extends Reminder {
  endpoint: string;
  p256dh: string;
  auth: string;
  dueDay: number | null;
  lastSentDay: number | null;
  lastTestAt: number | null;
  updatedAt: number;
}

const MILLIS_PER_DAY = 86_400_000;

const formats = new Map<string, Intl.DateTimeFormat>();

function localParts(millis: number, timeZone: string): Map<string, number> {
  let format = formats.get(timeZone);
  if (format === undefined) {
    format = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    });
    formats.set(timeZone, format);
  }
  const parts = new Map<string, number>();
  for (const p of format.formatToParts(millis)) parts.set(p.type, Number(p.value));
  return parts;
}

/** The epoch day a timestamp falls on, on [timeZone]'s wall clock. */
export function localDay(millis: number, timeZone: string): number {
  const p = localParts(millis, timeZone);
  return Date.UTC(p.get("year")!, p.get("month")! - 1, p.get("day")!) / MILLIS_PER_DAY;
}

/** The minute of the day (0-1439) a timestamp falls on, on [timeZone]'s wall clock. */
export function localMinute(millis: number, timeZone: string): number {
  const p = localParts(millis, timeZone);
  return p.get("hour")! * 60 + p.get("minute")!;
}

/**
 * Whether a reminder is owed now: the device said words are due from `dueDay`, the local
 * day has reached it and the reminder time has passed, and none went out today.
 */
export function shouldSend(
  row: Reminder & { dueDay: number | null; lastSentDay: number | null },
  now: number,
): boolean {
  if (row.dueDay === null) return false;
  const day = localDay(now, row.timeZone);
  if (day < row.dueDay) return false;
  if (localMinute(now, row.timeZone) < row.hour * 60 + row.minute) return false;
  return row.lastSentDay === null || row.lastSentDay < day;
}

/**
 * The `lastSentDay` to store when a device registers. Registering at or after today's
 * reminder time counts today as sent, so opening the app at 10:00 doesn't trigger an
 * 08:00 reminder.
 */
export function sentDayOnRegister(previous: number | null, reg: Reminder, now: number): number | null {
  if (localMinute(now, reg.timeZone) < reg.hour * 60 + reg.minute) return previous;
  const today = localDay(now, reg.timeZone);
  return previous === null ? today : Math.max(previous, today);
}

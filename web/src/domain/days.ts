import type { Clock } from "./clock";

const MILLIS_PER_DAY = 86_400_000;

const dateFormats = new Map<string, Intl.DateTimeFormat>();
const hourFormats = new Map<string, Intl.DateTimeFormat>();

function formatter(
  cache: Map<string, Intl.DateTimeFormat>,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  let format = cache.get(timeZone);
  if (format === undefined) {
    format = new Intl.DateTimeFormat("en-US", { timeZone, ...options });
    cache.set(timeZone, format);
  }
  return format;
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  const found = parts.find((p) => p.type === type);
  return Number(found?.value);
}

/**
 * The local day a millisecond timestamp falls on in [timeZone], as an epoch day
 * (`LocalDate.toEpochDay()`). Days roll over at local midnight.
 */
export function dayOf(millis: number, timeZone: string): number {
  const parts = formatter(dateFormats, timeZone, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(millis);
  return Date.UTC(part(parts, "year"), part(parts, "month") - 1, part(parts, "day")) / MILLIS_PER_DAY;
}

export function today(clock: Clock): number {
  return dayOf(clock.millis(), clock.timeZone());
}

/** The clock's local hour of the day, 0-23. */
export function hourOf(clock: Clock): number {
  const parts = formatter(hourFormats, clock.timeZone(), {
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(clock.millis());
  return part(parts, "hour");
}

/** "today", "tomorrow", "in 5 days", "3 days ago". */
export function relativeLabel(day: number, today: number): string {
  const delta = day - today;
  if (delta === 0) return "today";
  if (delta === 1) return "tomorrow";
  if (delta === -1) return "yesterday";
  if (delta >= 2) return `in ${delta} days`;
  return `${-delta} days ago`;
}

/**
 * Number of study days in the unbroken run ending today.
 *
 * `studyDays` is the set of days with at least one review, and `satisfiedDays` are days
 * that had nothing due, which bridge a gap rather than breaking it. Today is still in
 * progress, so not having studied yet does not break the run either.
 */
export function currentStreak(
  studyDays: ReadonlySet<number>,
  today: number,
  satisfiedDays: ReadonlySet<number> = new Set(),
): number {
  if (studyDays.size === 0) {
    return 0;
  }
  let cursor = studyDays.has(today) ? today : today - 1;
  let streak = 0;
  for (;;) {
    if (studyDays.has(cursor)) {
      streak++;
    } else if (!satisfiedDays.has(cursor)) {
      return streak;
    }
    cursor--;
  }
}

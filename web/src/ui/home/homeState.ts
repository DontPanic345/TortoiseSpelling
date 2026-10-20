import type { Repository, TodayPlan } from "../../data/repository";
import type { Clock } from "../../domain/clock";
import { today as todayOf, hourOf } from "../../domain/days";
import { greeting, type MarkedDay, type WordProgress } from "../../domain/progress";
import { allCorrectIntervals } from "../../domain/srs";
import type { AppContainer } from "../container";
import type { Platform } from "../platform";

/** Home's state, as `HomeUiState`. */
export interface HomeUiState {
  loading: boolean;
  plan: TodayPlan;
  streak: number;
  reviewedToday: number;
  totalWords: number;
  nextDueDay: number | null;
  week: MarkedDay[];
  progress: WordProgress;
  greeting: string;
  dateLabel: string;
  today: number;
  /** Web-only: storage isn't persistent and nothing was exported lately. */
  showBackupNudge: boolean;
  /** Web-only: offer the daily reminder, as Android asks for the notification permission once there is a word. */
  showReminderCard: boolean;
}

export const initialHomeState: HomeUiState = {
  loading: true,
  plan: { dueCount: 0, newCount: 0 },
  streak: 0,
  reviewedToday: 0,
  totalWords: 0,
  nextDueDay: null,
  week: [],
  progress: { new: 0, learning: 0, known: 0, total: 0 },
  greeting: "",
  dateLabel: "",
  today: 0,
  showBackupNudge: false,
  showReminderCard: false,
};

export const planTotal = (plan: TodayPlan): number => plan.dueCount + plan.newCount;
export const hasWords = (state: HomeUiState): boolean => state.totalWords > 0;
/** Nothing left today, but there is a list to come back to. */
export const allDone = (state: HomeUiState): boolean => hasWords(state) && planTotal(state.plan) === 0;

const THIRTY_DAYS_MILLIS = 30 * 86_400_000;

/** The nudge shows while storage can be cleared and no export is less than 30 days old. */
export function shouldNudgeBackup(
  totalWords: number,
  persisted: boolean,
  lastExportedAt: number | null,
  now: number,
): boolean {
  if (totalWords === 0 || persisted) return false;
  return lastExportedAt === null || now - lastExportedAt >= THIRTY_DAYS_MILLIS;
}

/** "Monday 14 September": Android's fixed "EEEE d MMMM" order, whatever the locale. */
export function dateLabel(day: number, locale?: string): string {
  const parts = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).formatToParts(day * 86_400_000);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("weekday")} ${part("day")} ${part("month")}`;
}

export async function loadHome(
  repository: Repository,
  clock: Clock,
  platform: Platform,
  reminders: AppContainer["reminders"] = null,
): Promise<HomeUiState> {
  const plan = await repository.todayPlan();
  const totalWords = await repository.wordCount();

  await repository.settleQuietDays();
  // A day with nothing due must bridge the streak rather than break it.
  if (totalWords > 0 && planTotal(plan) === 0) await repository.markTodaySatisfied();

  const today = todayOf(clock);
  const { lastExportedAt, reminderEnabled } = await repository.settings();
  // Browsers only show the permission prompt from a tap, so a card asks first.
  const showReminderCard =
    totalWords > 0 &&
    reminders !== null &&
    reminderEnabled &&
    reminders.push.support() === "supported" &&
    (await reminders.push.permission()) === "default";
  return {
    loading: false,
    plan,
    streak: await repository.currentStreak(),
    reviewedToday: await repository.reviewedToday(),
    totalWords,
    nextDueDay: await repository.nextDueDay(),
    week: await repository.lastWeek(),
    progress: await repository.progress(),
    greeting: greeting(hourOf(clock)),
    dateLabel: dateLabel(today),
    today,
    showBackupNudge: shouldNudgeBackup(totalWords, await platform.storagePersisted(), lastExportedAt, clock.millis()),
    showReminderCard,
  };
}

/** The info dialog's copy, as `howItWorksParagraphs`; the gaps come from the scheduler. */
export function howItWorksParagraphs(): string[] {
  const gaps = allCorrectIntervals()
    .slice(0, -1)
    .map((days) => (days === 1 ? "1 day" : `${days} days`));
  return [
    "Each day you get the words that are due, plus a few new ones (choose how many in " +
      "Settings). Spell each one from its definition and an example.",
    "Spaced repetition brings a word back just before you'd forget it. Each time you " +
      "spell it right first try, the gap before you see it again grows.",
    `Right first try every time, a word comes back after ${gaps[0]}, then ` +
      `${gaps.slice(1).join(", ")}, and then once a year.`,
    "Get it wrong, even if you then retype it correctly, and it comes back tomorrow and " +
      "climbs again from the start, a little more slowly than before.",
    "Longer gaps move a day or so either way, so words added together don't all come " +
      "due at once. A word counts as known once its gap reaches three weeks.",
  ];
}

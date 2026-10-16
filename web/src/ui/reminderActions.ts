import { PushApiError } from "../push/pushApi";
import type { Permission } from "../push/pushPlatform";
import type { AppContainer } from "./container";

type WithReminders = Pick<AppContainer, "repository"> & { reminders: NonNullable<AppContainer["reminders"]> };

export const SERVER_UNREACHABLE = "Couldn't reach the reminder server.";
export const SYNC_FAILED = "Couldn't reach the reminder server. It will try again next time the app opens.";
export const PERMISSION_BLOCKED =
  "Notifications are blocked for Tortoise Spelling. Allow them in this browser's settings for this site.";
export const TEST_QUEUED = "Test reminder queued.";
export const TURN_ON_FIRST = "Turn on the daily reminder first.";

/**
 * Turns the reminder on. When the browser hasn't been asked yet the request is the first call,
 * made before any `await`: Safari only shows its prompt from inside the tap. A refusal, or a
 * prompt the user closes, turns reminders off, as a refusal does on Android. Returns what to
 * tell the user, or null.
 */
export async function turnOnReminder({ repository, reminders }: WithReminders, permission: Permission): Promise<string | null> {
  const answer = permission === "default" ? await reminders.push.requestPermission() : permission;
  if (answer !== "granted") {
    await repository.setReminderEnabled(false);
    return answer === "denied" ? PERMISSION_BLOCKED : null;
  }
  await repository.setReminderEnabled(true);
  return (await reminders.sync.sync()) === "ok" ? null : SYNC_FAILED;
}

export async function turnOffReminder({ repository, reminders }: WithReminders): Promise<string | null> {
  await repository.setReminderEnabled(false);
  return (await reminders.sync.sync()) === "ok" ? null : SYNC_FAILED;
}

export async function changeReminderTime(
  { repository, reminders }: WithReminders,
  hour: number,
  minute: number,
): Promise<string | null> {
  await repository.setReminderTime(hour, minute);
  return (await reminders.sync.sync()) === "ok" ? null : SYNC_FAILED;
}

/** Asks the server to push a test now. A 404 means it lost this browser's row, so it registers again and retries once. */
export async function sendTestReminder({ repository, reminders }: WithReminders, on: boolean): Promise<string> {
  if (!on) return TURN_ON_FIRST;
  const { api, sync } = reminders;
  const attempt = async () => {
    const registration = (await repository.settings()).pushRegistration;
    if (!registration) throw new PushApiError(0);
    await api.test(registration.endpoint);
  };
  try {
    if ((await sync.sync()) === "offline") return SERVER_UNREACHABLE;
    try {
      await attempt();
    } catch (error) {
      if (!(error instanceof PushApiError) || error.status !== 404) throw error;
      if ((await sync.sync({ force: true })) === "offline") return SERVER_UNREACHABLE;
      await attempt();
    }
    return TEST_QUEUED;
  } catch {
    return SERVER_UNREACHABLE;
  }
}

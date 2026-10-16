import type { Repository } from "../data/repository";
import { reminderNotification, type PushKind, type ReminderText } from "./notification";

/** What the worker's event handlers need, so tests can stand in for the browser. */
export interface WorkerDeps {
  repository(): Promise<Repository>;
  /** The reminder sync; rejects are ignored. */
  sync(): Promise<unknown>;
  show(text: ReminderText): Promise<void>;
  /** The open windows of this app. */
  windows(): Promise<readonly { focus(): Promise<unknown> }[]>;
  openWindow(url: string): Promise<unknown>;
}

/**
 * Every push shows a notification: Safari revokes a subscription after pushes that show
 * nothing. The device counts the plan, so the server never learns a number. A reminder that
 * finds nothing due marks the day satisfied, as `ReminderWorker` does, and is followed by a
 * sync, which corrects a stale due day and unregisters if reminders have since been turned off.
 */
export async function handlePush(kind: PushKind, deps: WorkerDeps): Promise<void> {
  let repository: Repository | null = null;
  let total = 0;
  try {
    repository = await deps.repository();
    const plan = await repository.todayPlan();
    total = plan.dueCount + plan.newCount;
  } catch {
    // The text then says nothing is due, which is all the device can honestly claim.
  }
  await deps.show(reminderNotification(total));

  if (kind !== "reminder") return;
  try {
    if (repository && total === 0 && (await repository.settings()).reminderEnabled) {
      await repository.markTodaySatisfied();
    }
  } catch {
    // Opening the app settles the day.
  }
  try {
    await deps.sync();
  } catch {
    // The next sync retries.
  }
}

/** Brings an open window forward; only a fresh launch starts a session, as on Android. */
export async function handleClick(deps: WorkerDeps): Promise<void> {
  const [open] = await deps.windows();
  if (open) await open.focus();
  else await deps.openWindow("./#/review");
}

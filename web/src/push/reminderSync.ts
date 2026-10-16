import type { Repository } from "../data/repository";
import type { Clock } from "../domain/clock";
import type { PushApi, Registration } from "./pushApi";
import type { PushPlatform, PushSubscriptionInfo } from "./pushPlatform";

export type SyncResult = "ok" | "offline";

export interface ReminderSync {
  /** `force` registers even when nothing changed. */
  sync(options?: { force?: boolean }): Promise<SyncResult>;
}

export interface ReminderSyncOptions {
  repository: Repository;
  clock: Clock;
  push: PushPlatform;
  api: PushApi;
}

const DAY_MILLIS = 86_400_000;

/**
 * Keeps the reminder server's row for this browser equal to the settings and the words: what
 * time, which time zone and the first day anything is due. The page and the service worker
 * both run it. A failure leaves the stored state alone, so the next call retries.
 */
export function createReminderSync({ repository, clock, push, api }: ReminderSyncOptions): ReminderSync {
  let running: Promise<SyncResult> | null = null;
  let again: { force: boolean } | null = null;

  async function ignoringFailure(work: Promise<unknown>): Promise<void> {
    try {
      await work;
    } catch {
      // The server drops a row nobody updates, and a push service reports a gone subscription.
    }
  }

  async function once(force: boolean): Promise<SyncResult> {
    try {
      const settings = await repository.settings();
      const stored = settings.pushRegistration;
      const active =
        settings.reminderEnabled && push.support() === "supported" && (await push.permission()) === "granted";

      if (!active) {
        if (stored) {
          await ignoringFailure(api.unregister(stored.endpoint));
          await push.unsubscribe();
          await repository.setPushRegistration(null);
        }
        return "ok";
      }

      let subscription = await push.subscription();
      let publicKey = stored?.publicKey ?? "";
      if (!stored || !subscription || clock.millis() - stored.sentAt >= DAY_MILLIS) {
        publicKey = await api.publicKey();
        if (subscription && publicKey !== stored?.publicKey) {
          await push.unsubscribe();
          subscription = null;
        }
        subscription ??= await push.subscribe(publicKey);
      }

      const registration = describe(subscription, {
        timeZone: clock.timeZone(),
        hour: settings.reminderHour,
        minute: settings.reminderMinute,
        dueDay: await repository.reminderDay(),
      });
      const sent = JSON.stringify(registration);
      const now = clock.millis();
      if (!force && stored && stored.sent === sent && now - stored.sentAt < DAY_MILLIS) return "ok";

      if (stored && stored.endpoint !== subscription.endpoint) await ignoringFailure(api.unregister(stored.endpoint));
      await api.register(registration);
      await repository.setPushRegistration({ endpoint: subscription.endpoint, publicKey, sent, sentAt: now });
      return "ok";
    } catch {
      return "offline";
    }
  }

  function describe(subscription: PushSubscriptionInfo, rest: Omit<Registration, "endpoint" | "keys">): Registration {
    return {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      ...rest,
    };
  }

  return {
    sync({ force = false } = {}) {
      if (running) {
        again = { force: (again?.force ?? false) || force };
        return running;
      }
      const started = (async () => {
        try {
          let result = await once(force);
          while (again) {
            const next: { force: boolean } = again;
            again = null;
            result = await once(next.force);
          }
          return result;
        } finally {
          running = null;
        }
      })();
      running = started;
      return started;
    },
  };
}

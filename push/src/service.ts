import { localDay, sentDayOnRegister, shouldSend } from "./schedule";
import type { Subscription } from "./schedule";
import type { Registration } from "./validate";
import type { PushSender } from "./webpush";

export const MAX_SUBSCRIPTIONS = 5000;
export const MAX_PER_TICK = 20;
export const IN_FLIGHT = 6;
export const TEST_INTERVAL_MILLIS = 30_000;
export const STALE_AFTER_MILLIS = 180 * 86_400_000;

/** What the Durable Object keeps its subscriptions in. */
export interface Rows {
  all(): Subscription[];
  get(endpoint: string): Subscription | null;
  countOthers(endpoint: string): number;
  upsert(row: Subscription): void;
  setSentDay(endpoint: string, day: number): void;
  setTestAt(endpoint: string, at: number): void;
  delete(endpoint: string): void;
  deleteUpdatedBefore(millis: number): void;
}

export type RegisterResult = "ok" | "full";
export type TestResult = "sent" | "unknown" | "rate" | "refused";
export interface TickResult {
  sent: number;
  removed: number;
  retried: number;
}

/** What the API calls; the Durable Object's RPC methods. */
export interface SubscriptionService {
  register(reg: Registration, now: number): Promise<RegisterResult>;
  remove(endpoint: string): Promise<void>;
  test(endpoint: string, now: number): Promise<TestResult>;
  tick(now: number): Promise<TickResult>;
}

type Outcome = "sent" | "gone" | "retry";

/**
 * 200-202 delivered. 404 and 410 mean the subscription is gone; 400 means we sent
 * something it can't take, 403 that it was signed with a key we no longer use. Anything
 * else (429, 5xx, a network error) may pass, so the row stays.
 */
function outcomeOf(status: number): Outcome {
  if (status >= 200 && status <= 202) return "sent";
  if (status === 400 || status === 403 || status === 404 || status === 410) return "gone";
  return "retry";
}

export function createService(rows: Rows, senderFor: (now: number) => PushSender): SubscriptionService {
  async function mapLimited<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let next = 0;
    const worker = async () => {
      while (next < items.length) {
        const at = next++;
        results[at] = await run(items[at]!);
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
  }

  return {
    async register(reg, now) {
      const existing = rows.get(reg.endpoint);
      if (existing === null && rows.countOthers(reg.endpoint) >= MAX_SUBSCRIPTIONS) return "full";
      rows.upsert({
        endpoint: reg.endpoint,
        p256dh: reg.keys.p256dh,
        auth: reg.keys.auth,
        timeZone: reg.timeZone,
        hour: reg.hour,
        minute: reg.minute,
        dueDay: reg.dueDay,
        lastSentDay: sentDayOnRegister(existing?.lastSentDay ?? null, reg, now),
        lastTestAt: existing?.lastTestAt ?? null,
        updatedAt: now,
      });
      return "ok";
    },

    async remove(endpoint) {
      rows.delete(endpoint);
    },

    async test(endpoint, now) {
      const row = rows.get(endpoint);
      if (row === null) return "unknown";
      if (row.lastTestAt !== null && now - row.lastTestAt < TEST_INTERVAL_MILLIS) return "rate";
      rows.setTestAt(endpoint, now);
      const outcome = outcomeOf(await senderFor(now)(row, "test"));
      if (outcome === "gone") rows.delete(endpoint);
      return outcome === "sent" ? "sent" : "refused";
    },

    async tick(now) {
      rows.deleteUpdatedBefore(now - STALE_AFTER_MILLIS);
      const owed = rows
        .all()
        .filter((row) => shouldSend(row, now))
        .sort((a, b) => (a.lastSentDay ?? -Infinity) - (b.lastSentDay ?? -Infinity))
        .slice(0, MAX_PER_TICK);
      const result: TickResult = { sent: 0, removed: 0, retried: 0 };
      if (owed.length === 0) return result;
      const send = senderFor(now);
      await mapLimited(owed, IN_FLIGHT, async (row) => {
        const outcome = outcomeOf(await send(row, "reminder"));
        if (outcome === "sent") {
          rows.setSentDay(row.endpoint, localDay(now, row.timeZone));
          result.sent++;
        } else if (outcome === "gone") {
          rows.delete(row.endpoint);
          result.removed++;
        } else {
          result.retried++;
        }
      });
      return result;
    },
  };
}

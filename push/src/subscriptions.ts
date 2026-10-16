import { DurableObject } from "cloudflare:workers";
import { createService } from "./service";
import type { RegisterResult, Rows, SubscriptionService, TestResult, TickResult } from "./service";
import type { Subscription } from "./schedule";
import type { Registration } from "./validate";
import { createSender } from "./webpush";
import type { Env } from "./env";

const COLUMNS = "endpoint, p256dh, auth, time_zone, hour, minute, due_day, last_sent_day, last_test_at, updated_at";

function toSubscription(row: Record<string, SqlStorageValue>): Subscription {
  return {
    endpoint: row.endpoint as string,
    p256dh: row.p256dh as string,
    auth: row.auth as string,
    timeZone: row.time_zone as string,
    hour: row.hour as number,
    minute: row.minute as number,
    dueDay: row.due_day as number | null,
    lastSentDay: row.last_sent_day as number | null,
    lastTestAt: row.last_test_at as number | null,
    updatedAt: row.updated_at as number,
  };
}

function sqlRows(sql: SqlStorage): Rows {
  return {
    all: () => sql.exec(`SELECT ${COLUMNS} FROM subscriptions`).toArray().map(toSubscription),
    get(endpoint) {
      const found = sql.exec(`SELECT ${COLUMNS} FROM subscriptions WHERE endpoint = ?`, endpoint).toArray();
      return found[0] === undefined ? null : toSubscription(found[0]);
    },
    countOthers: (endpoint) =>
      sql.exec("SELECT COUNT(*) AS n FROM subscriptions WHERE endpoint <> ?", endpoint).one().n as number,
    upsert(row) {
      sql.exec(
        `INSERT INTO subscriptions (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (endpoint) DO UPDATE SET
           p256dh = excluded.p256dh, auth = excluded.auth, time_zone = excluded.time_zone,
           hour = excluded.hour, minute = excluded.minute, due_day = excluded.due_day,
           last_sent_day = excluded.last_sent_day, updated_at = excluded.updated_at`,
        row.endpoint,
        row.p256dh,
        row.auth,
        row.timeZone,
        row.hour,
        row.minute,
        row.dueDay,
        row.lastSentDay,
        row.lastTestAt,
        row.updatedAt,
      );
    },
    setSentDay: (endpoint, day) =>
      void sql.exec("UPDATE subscriptions SET last_sent_day = ? WHERE endpoint = ?", day, endpoint),
    setTestAt: (endpoint, at) =>
      void sql.exec("UPDATE subscriptions SET last_test_at = ? WHERE endpoint = ?", at, endpoint),
    delete: (endpoint) => void sql.exec("DELETE FROM subscriptions WHERE endpoint = ?", endpoint),
    deleteUpdatedBefore: (millis) => void sql.exec("DELETE FROM subscriptions WHERE updated_at < ?", millis),
  };
}

/**
 * The one Durable Object that holds every subscription. The table is never dropped:
 * losing it loses every user's reminder, so a schema change adds to it.
 */
export class Subscriptions extends DurableObject<Env> implements SubscriptionService {
  private readonly service: SubscriptionService;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        endpoint      TEXT PRIMARY KEY,
        p256dh        TEXT NOT NULL,
        auth          TEXT NOT NULL,
        time_zone     TEXT NOT NULL,
        hour          INTEGER NOT NULL,
        minute        INTEGER NOT NULL,
        due_day       INTEGER,
        last_sent_day INTEGER,
        last_test_at  INTEGER,
        updated_at    INTEGER NOT NULL
      )`);
    this.service = createService(sqlRows(ctx.storage.sql), (now) =>
      createSender(env.VAPID_PRIVATE_JWK ?? "", env.VAPID_SUBJECT, now),
    );
  }

  register(reg: Registration, now: number): Promise<RegisterResult> {
    return this.service.register(reg, now);
  }

  remove(endpoint: string): Promise<void> {
    return this.service.remove(endpoint);
  }

  test(endpoint: string, now: number): Promise<TestResult> {
    return this.service.test(endpoint, now);
  }

  tick(now: number): Promise<TickResult> {
    return this.service.tick(now);
  }
}

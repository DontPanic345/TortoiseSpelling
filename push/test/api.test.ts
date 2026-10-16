import { beforeEach, describe, expect, it } from "vitest";
import fixture from "./fixtures/registration.json";
import { handleRequest } from "../src/api";
import type { ApiEnv } from "../src/api";
import { MAX_PER_TICK, MAX_SUBSCRIPTIONS, STALE_AFTER_MILLIS, createService } from "../src/service";
import type { Rows, SubscriptionService } from "../src/service";
import { localDay } from "../src/schedule";
import type { Subscription } from "../src/schedule";
import { parsePrivateJwk, publicKeyOf } from "../src/webpush";
import type { PushKind } from "../src/webpush";
import { encodeBase64Url } from "../src/base64url";
import { newVapidKey } from "./support";

const NOW = Date.parse("2026-06-30T09:00:00Z");
const TODAY = localDay(NOW, "UTC");
const ORIGIN = "https://dontpanic345.github.io";

class MemoryRows implements Rows {
  readonly rows = new Map<string, Subscription>();
  all = () => [...this.rows.values()];
  get = (endpoint: string) => this.rows.get(endpoint) ?? null;
  countOthers = (endpoint: string) => this.rows.size - (this.rows.has(endpoint) ? 1 : 0);
  upsert = (row: Subscription) => void this.rows.set(row.endpoint, row);
  setSentDay = (endpoint: string, day: number) => void (this.rows.get(endpoint)!.lastSentDay = day);
  setTestAt = (endpoint: string, at: number) => void (this.rows.get(endpoint)!.lastTestAt = at);
  delete = (endpoint: string) => void this.rows.delete(endpoint);
  deleteUpdatedBefore = (millis: number) => {
    for (const row of this.all()) if (row.updatedAt < millis) this.rows.delete(row.endpoint);
  };
}

let rows: MemoryRows;
let sent: { endpoint: string; kind: PushKind }[];
let status: (endpoint: string, kind: PushKind) => number;
let service: SubscriptionService;
let env: ApiEnv;

beforeEach(() => {
  rows = new MemoryRows();
  sent = [];
  status = () => 201;
  service = createService(rows, () => async (row, kind) => {
    sent.push({ endpoint: row.endpoint, kind });
    return status(row.endpoint, kind);
  });
  env = { ALLOWED_ORIGINS: `${ORIGIN},http://localhost:5173` };
});

function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}, at = NOW) {
  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = typeof body === "string" ? body : JSON.stringify(body);
  return handleRequest(new Request(`https://push.example${path}`, init), env, service, at);
}

function registration(n: number, changes: Record<string, unknown> = {}) {
  return { ...fixture, endpoint: `https://fcm.googleapis.com/fcm/send/${n}`, ...changes };
}

describe("CORS", () => {
  it("answers an allowed origin with that origin", async () => {
    const response = await call("GET", "/key", undefined, { Origin: ORIGIN });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  it("gives a foreign origin no CORS headers, errors included", async () => {
    for (const path of ["/key", "/nowhere"]) {
      const response = await call("GET", path, undefined, { Origin: "https://evil.example" });
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    }
  });

  it("answers the preflight for an allowed origin", async () => {
    const response = await call("OPTIONS", "/subscription", undefined, { Origin: "http://localhost:5173" });
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, PUT, POST, DELETE");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
  });

  it("answers a foreign preflight without allowing anything", async () => {
    const response = await call("OPTIONS", "/subscription", undefined, { Origin: "https://evil.example" });
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("Access-Control-Allow-Methods")).toBeNull();
  });
});

describe("GET /key", () => {
  it("is 503 until the secret is set", async () => {
    expect((await call("GET", "/key")).status).toBe(503);
    env.VAPID_PRIVATE_JWK = "not json";
    expect((await call("GET", "/key")).status).toBe(503);
  });

  it("returns the public key of the secret", async () => {
    const jwk = JSON.stringify(await newVapidKey());
    env.VAPID_PRIVATE_JWK = jwk;
    const response = await call("GET", "/key");
    expect(response.status).toBe(200);
    const { publicKey } = (await response.json()) as { publicKey: string };
    expect(publicKey).toBe(encodeBase64Url(publicKeyOf(parsePrivateJwk(jwk))));
  });
});

describe("routes and bodies", () => {
  it("is 404 for anything else", async () => {
    expect((await call("GET", "/")).status).toBe(404);
    expect((await call("GET", "/subscription")).status).toBe(404);
    expect((await call("POST", "/subscription", registration(1))).status).toBe(404);
    expect((await call("PUT", "/test", { endpoint: registration(1).endpoint })).status).toBe(404);
  });

  it("is 413 over 4 KiB and 400 for invalid JSON or an invalid body", async () => {
    expect((await call("PUT", "/subscription", { ...registration(1), padding: "x".repeat(4096) })).status).toBe(413);
    expect((await call("PUT", "/subscription", "{")).status).toBe(400);
    expect((await call("PUT", "/subscription", registration(1, { hour: 24 }))).status).toBe(400);
    expect((await call("DELETE", "/subscription", { endpoint: "https://example.com" })).status).toBe(400);
    expect((await call("POST", "/test", {})).status).toBe(400);
  });

  it("is 413 when Content-Length says so before the body is read", async () => {
    const response = await call("PUT", "/subscription", "{}", { "Content-Length": "5000" });
    expect(response.status).toBe(413);
  });
});

describe("registering and testing", () => {
  it("stores a registration, and a test then reaches the push service", async () => {
    expect((await call("PUT", "/subscription", registration(1))).status).toBe(204);
    expect(rows.get(registration(1).endpoint)).toMatchObject({
      timeZone: "Pacific/Auckland",
      hour: 8,
      minute: 0,
      dueDay: 20743,
    });
    expect((await call("POST", "/test", { endpoint: registration(1).endpoint })).status).toBe(204);
    expect(sent).toEqual([{ endpoint: registration(1).endpoint, kind: "test" }]);
  });

  it("stores nothing but the subscription's own fields", async () => {
    await call("PUT", "/subscription", { ...registration(1), words: ["secret"], count: 7 });
    expect(Object.keys(rows.get(registration(1).endpoint)!).sort()).toEqual(
      [
        "auth", "dueDay", "endpoint", "hour", "lastSentDay", "lastTestAt", "minute", "p256dh", "timeZone", "updatedAt",
      ].sort(),
    );
  });

  it("updates the same endpoint in place and keeps its last test", async () => {
    await call("PUT", "/subscription", registration(1));
    await call("POST", "/test", { endpoint: registration(1).endpoint });
    await call("PUT", "/subscription", registration(1, { hour: 9, dueDay: null }), {}, NOW + 1000);
    expect(rows.rows.size).toBe(1);
    expect(rows.get(registration(1).endpoint)).toMatchObject({ hour: 9, dueDay: null, lastTestAt: NOW });
  });

  it("marks today sent when registering after the reminder time, and not before", async () => {
    await call("PUT", "/subscription", registration(1, { timeZone: "UTC", hour: 8 }));
    await call("PUT", "/subscription", registration(2, { timeZone: "UTC", hour: 10 }));
    expect(rows.get(registration(1).endpoint)!.lastSentDay).toBe(TODAY);
    expect(rows.get(registration(2).endpoint)!.lastSentDay).toBeNull();
  });

  it("is 404 for an unknown endpoint", async () => {
    expect((await call("POST", "/test", { endpoint: registration(9).endpoint })).status).toBe(404);
  });

  it("limits tests to one every 30 seconds", async () => {
    await call("PUT", "/subscription", registration(1));
    const test = (at: number) => call("POST", "/test", { endpoint: registration(1).endpoint }, {}, at);
    expect((await test(NOW)).status).toBe(204);
    expect((await test(NOW + 29_999)).status).toBe(429);
    expect((await test(NOW + 30_000)).status).toBe(204);
    expect(sent).toHaveLength(2);
  });

  it("is 502 when the push service refuses, and deletes a gone subscription", async () => {
    await call("PUT", "/subscription", registration(1));
    await call("PUT", "/subscription", registration(2));
    status = (endpoint) => (endpoint === registration(1).endpoint ? 503 : 410);
    expect((await call("POST", "/test", { endpoint: registration(1).endpoint })).status).toBe(502);
    expect((await call("POST", "/test", { endpoint: registration(2).endpoint })).status).toBe(502);
    expect(rows.get(registration(1).endpoint)).not.toBeNull();
    expect(rows.get(registration(2).endpoint)).toBeNull();
  });

  it("deletes with 204 whether or not the entry existed", async () => {
    await call("PUT", "/subscription", registration(1));
    expect((await call("DELETE", "/subscription", { endpoint: registration(1).endpoint })).status).toBe(204);
    expect(rows.rows.size).toBe(0);
    expect((await call("DELETE", "/subscription", { endpoint: registration(1).endpoint })).status).toBe(204);
  });

  it("accepts local endpoints only with ALLOW_LOCAL_PUSH", async () => {
    const local = { ...fixture, endpoint: "http://127.0.0.1:9999/push" };
    expect((await call("PUT", "/subscription", local)).status).toBe(400);
    env.ALLOW_LOCAL_PUSH = "true";
    expect((await call("PUT", "/subscription", local)).status).toBe(204);
  });
});

function row(endpoint: string): Subscription {
  return {
    endpoint,
    p256dh: fixture.keys.p256dh,
    auth: fixture.keys.auth,
    timeZone: "UTC",
    hour: 8,
    minute: 0,
    dueDay: null,
    lastSentDay: null,
    lastTestAt: null,
    updatedAt: NOW,
  };
}

describe("the 5,000-row cap", () => {
  it("refuses a new endpoint but still updates an existing one", async () => {
    for (let n = 0; n < MAX_SUBSCRIPTIONS; n++) rows.upsert(row(`https://fcm.googleapis.com/${n}`));
    expect((await call("PUT", "/subscription", registration(MAX_SUBSCRIPTIONS))).status).toBe(503);
    expect(rows.rows.size).toBe(MAX_SUBSCRIPTIONS);
    expect((await call("PUT", "/subscription", { ...registration(0), endpoint: "https://fcm.googleapis.com/0" })).status).toBe(204);
    expect(rows.rows.size).toBe(MAX_SUBSCRIPTIONS);
  });
});

describe("tick", () => {
  function owed(n: number, changes: Partial<Subscription> = {}): Subscription {
    return {
      ...row(`https://fcm.googleapis.com/fcm/send/${n}`),
      dueDay: TODAY,
      lastSentDay: TODAY - 1,
      ...changes,
    };
  }

  it("sends a reminder and records the day", async () => {
    rows.upsert(owed(1));
    expect(await service.tick(NOW)).toEqual({ sent: 1, removed: 0, retried: 0 });
    expect(sent).toEqual([{ endpoint: owed(1).endpoint, kind: "reminder" }]);
    expect(rows.get(owed(1).endpoint)!.lastSentDay).toBe(TODAY);
  });

  it("sends nothing more the same day", async () => {
    rows.upsert(owed(1));
    await service.tick(NOW);
    await service.tick(NOW + 300_000);
    expect(sent).toHaveLength(1);
  });

  it("skips rows that aren't owed", async () => {
    rows.upsert(owed(1, { dueDay: TODAY + 1 }));
    rows.upsert(owed(2, { dueDay: null }));
    rows.upsert(owed(3, { hour: 10 }));
    rows.upsert(owed(4, { lastSentDay: TODAY }));
    expect(await service.tick(NOW)).toEqual({ sent: 0, removed: 0, retried: 0 });
    expect(sent).toEqual([]);
  });

  it("deletes a row the push service says is gone, malformed or signed with another key", async () => {
    for (const code of [404, 410, 400, 403]) {
      const row = owed(code);
      rows.upsert(row);
      status = () => code;
      expect(await service.tick(NOW)).toEqual({ sent: 0, removed: 1, retried: 0 });
      expect(rows.get(row.endpoint)).toBeNull();
    }
  });

  it("keeps a row for the next tick when the push service is busy or unreachable", async () => {
    for (const code of [429, 500, 503, 0]) {
      const row = owed(code);
      rows.upsert(row);
      status = () => code;
      expect(await service.tick(NOW)).toEqual({ sent: 0, removed: 0, retried: 1 });
      expect(rows.get(row.endpoint)!.lastSentDay).toBe(TODAY - 1);
      rows.delete(row.endpoint);
    }
  });

  it("treats 200 and 202 as delivered", async () => {
    for (const code of [200, 202]) {
      rows.upsert(owed(code));
      status = () => code;
    }
    expect((await service.tick(NOW)).sent).toBe(2);
  });

  it("sends at most 20 a tick, oldest last-sent day first, and the rest on the next", async () => {
    for (let n = 0; n < 25; n++) rows.upsert(owed(n, { lastSentDay: n < 5 ? null : TODAY - 1 }));
    expect((await service.tick(NOW)).sent).toBe(MAX_PER_TICK);
    const first = new Set(sent.map((s) => s.endpoint));
    for (let n = 0; n < 5; n++) expect(first.has(owed(n).endpoint)).toBe(true);
    expect((await service.tick(NOW + 300_000)).sent).toBe(5);
    expect(new Set(sent.map((s) => s.endpoint)).size).toBe(25);
  });

  it("never has more than 6 pushes in flight", async () => {
    let inFlight = 0;
    let peak = 0;
    service = createService(rows, () => async () => {
      peak = Math.max(peak, ++inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return 201;
    });
    for (let n = 0; n < 20; n++) rows.upsert(owed(n));
    await service.tick(NOW);
    expect(peak).toBe(6);
  });

  it("deletes entries not updated for 180 days", async () => {
    rows.upsert(owed(1, { updatedAt: NOW - STALE_AFTER_MILLIS - 1 }));
    rows.upsert(owed(2, { updatedAt: NOW - STALE_AFTER_MILLIS }));
    await service.tick(NOW);
    expect(rows.get(owed(1).endpoint)).toBeNull();
    expect(rows.get(owed(2).endpoint)).not.toBeNull();
    expect(sent.map((s) => s.endpoint)).toEqual([owed(2).endpoint]);
  });
});

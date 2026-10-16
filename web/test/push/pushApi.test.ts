import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createPushApi, PushApiError, type Registration } from "../../src/push/pushApi";

const ORIGIN = "https://push.example";

interface Call {
  url: string;
  init: RequestInit;
}

function fakeFetch(status = 204, json: unknown = null) {
  const calls: Call[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(json === null ? null : JSON.stringify(json), { status });
  }) as unknown as typeof fetch;
  return { calls, fetcher };
}

const registration: Registration = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc",
  keys: { p256dh: "p", auth: "a" },
  timeZone: "UTC",
  hour: 8,
  minute: 0,
  dueDay: 20_514,
};

describe("createPushApi", () => {
  it("reads the public key with a GET", async () => {
    const { calls, fetcher } = fakeFetch(200, { publicKey: "BKey" });
    expect(await createPushApi(ORIGIN, fetcher).publicKey()).toBe("BKey");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${ORIGIN}/key`);
    expect(calls[0]?.init).toMatchObject({ method: "GET", keepalive: true });
  });

  it("registers with a PUT of the JSON body", async () => {
    const { calls, fetcher } = fakeFetch();
    await createPushApi(ORIGIN, fetcher).register(registration);
    expect(calls[0]?.url).toBe(`${ORIGIN}/subscription`);
    expect(calls[0]?.init).toMatchObject({
      method: "PUT",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registration),
    });
  });

  it("unregisters with a DELETE of the endpoint alone", async () => {
    const { calls, fetcher } = fakeFetch();
    await createPushApi(ORIGIN, fetcher).unregister(registration.endpoint);
    expect(calls[0]?.url).toBe(`${ORIGIN}/subscription`);
    expect(calls[0]?.init.method).toBe("DELETE");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ endpoint: registration.endpoint });
  });

  it("asks for a test with a POST of the endpoint alone", async () => {
    const { calls, fetcher } = fakeFetch();
    await createPushApi(ORIGIN, fetcher).test(registration.endpoint);
    expect(calls[0]?.url).toBe(`${ORIGIN}/test`);
    expect(calls[0]?.init.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ endpoint: registration.endpoint });
  });

  it("throws the status on a non-2xx answer", async () => {
    const { fetcher } = fakeFetch(404);
    const error = await createPushApi(ORIGIN, fetcher).test("x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PushApiError);
    expect((error as PushApiError).status).toBe(404);
  });

  it("lets a network error through", async () => {
    const fetcher = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    await expect(createPushApi(ORIGIN, fetcher).publicKey()).rejects.toThrow(TypeError);
  });

  it("sends the shape the server's own fixture has", () => {
    const fixture = JSON.parse(
      readFileSync(new URL("../../../push/test/fixtures/registration.json", import.meta.url), "utf8"),
    ) as Registration;
    expect(Object.keys(registration).sort()).toEqual(Object.keys(fixture).sort());
    expect(Object.keys(registration.keys).sort()).toEqual(Object.keys(fixture.keys).sort());
    for (const key of Object.keys(registration) as (keyof Registration)[]) {
      expect(typeof registration[key]).toBe(typeof fixture[key]);
    }
  });
});

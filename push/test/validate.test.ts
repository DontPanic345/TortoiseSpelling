import { describe, expect, it } from "vitest";
import fixture from "./fixtures/registration.json";
import { parseEndpoint, parseEndpointBody, parseRegistration } from "../src/validate";

function registration(changes: Record<string, unknown> = {}): unknown {
  return { ...fixture, ...changes };
}

function invalid(raw: unknown, allowLocal = false): string {
  const parsed = parseRegistration(raw, allowLocal);
  if (parsed.ok) throw new Error("expected the registration to be rejected");
  return parsed.error;
}

describe("parseRegistration", () => {
  it("accepts the shared fixture", () => {
    const parsed = parseRegistration(fixture, false);
    expect(parsed).toEqual({ ok: true, value: fixture });
  });

  it("ignores unknown fields and never keeps them", () => {
    const parsed = parseRegistration(registration({ words: ["secret"], keys: { ...fixture.keys, extra: 1 } }), false);
    expect(parsed).toEqual({ ok: true, value: fixture });
  });

  it("accepts a null dueDay and the limits of hour and minute", () => {
    expect(parseRegistration(registration({ dueDay: null, hour: 0, minute: 0 }), false).ok).toBe(true);
    expect(parseRegistration(registration({ hour: 23, minute: 59 }), false).ok).toBe(true);
  });

  it("rejects hours and minutes out of range or not whole", () => {
    for (const hour of [-1, 24, 1.5, "8", null]) expect(invalid(registration({ hour }))).toMatch(/hour/);
    for (const minute of [-1, 60, 0.5, "0", null]) expect(invalid(registration({ minute }))).toMatch(/minute/);
  });

  it("rejects a dueDay that isn't an integer or null", () => {
    for (const dueDay of [1.5, "20000", undefined, Number.NaN]) {
      expect(invalid(registration({ dueDay }))).toMatch(/dueDay/);
    }
  });

  it("rejects a time zone the runtime doesn't know, or one that is too long", () => {
    expect(invalid(registration({ timeZone: "Mars/Olympus" }))).toMatch(/timeZone/);
    expect(invalid(registration({ timeZone: "" }))).toMatch(/timeZone/);
    expect(invalid(registration({ timeZone: "A".repeat(65) }))).toMatch(/timeZone/);
    expect(invalid(registration({ timeZone: 5 }))).toMatch(/timeZone/);
    expect(parseRegistration(registration({ timeZone: "UTC" }), false).ok).toBe(true);
  });

  it("rejects keys of the wrong length, prefix or alphabet", () => {
    const point = fixture.keys.p256dh;
    expect(invalid(registration({ keys: { ...fixture.keys, p256dh: point.slice(0, -4) } }))).toMatch(/p256dh/);
    expect(invalid(registration({ keys: { ...fixture.keys, p256dh: "A" + point.slice(1) } }))).toMatch(/p256dh/);
    expect(invalid(registration({ keys: { ...fixture.keys, p256dh: point + "=" } }))).toMatch(/p256dh/);
    expect(invalid(registration({ keys: { ...fixture.keys, auth: "BTBZMqHH6r4Tts7J_aSI" } }))).toMatch(/auth/);
    expect(invalid(registration({ keys: { ...fixture.keys, auth: "BTBZMqHH6r4Tts7J/aSIgg" } }))).toMatch(/auth/);
    expect(invalid(registration({ keys: null }))).toMatch(/keys/);
  });

  it("rejects a body that isn't an object", () => {
    for (const raw of [null, "x", 5, [fixture]]) expect(invalid(raw)).toMatch(/object/);
  });
});

describe("parseEndpoint", () => {
  it("accepts each push service", () => {
    for (const endpoint of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/abc",
      "https://api.push.apple.com/3/device/abc",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ]) {
      expect(parseEndpoint(endpoint, false)).toBe(endpoint);
    }
  });

  it("rejects other hosts, look-alikes and other schemes", () => {
    for (const endpoint of [
      "https://example.com/push",
      "https://fcm.googleapis.com.evil.example/x",
      "https://evilfcm.googleapis.com/x",
      "https://notpush.apple.com.example/x",
      "https://evil.example/.notify.windows.com",
      "https://user:pass@fcm.googleapis.com/x",
      "http://fcm.googleapis.com/x",
      "ftp://fcm.googleapis.com/x",
      "not a url",
      "",
    ]) {
      expect(parseEndpoint(endpoint, false)).toBeNull();
    }
  });

  it("rejects an endpoint over 1,024 characters", () => {
    const long = "https://fcm.googleapis.com/" + "a".repeat(1024);
    expect(parseEndpoint(long, false)).toBeNull();
    expect(parseEndpoint(long.slice(0, 1024), false)).not.toBeNull();
  });

  it("rejects a value that isn't a string", () => {
    for (const raw of [null, undefined, 5, {}]) expect(parseEndpoint(raw, false)).toBeNull();
  });

  it("accepts http on localhost only when local push is allowed", () => {
    for (const endpoint of ["http://localhost:9000/push", "http://127.0.0.1:9000/push"]) {
      expect(parseEndpoint(endpoint, false)).toBeNull();
      expect(parseEndpoint(endpoint, true)).toBe(endpoint);
    }
    expect(parseEndpoint("http://example.com/push", true)).toBeNull();
    expect(parseEndpoint("http://localhost.evil.example/push", true)).toBeNull();
  });
});

describe("parseEndpointBody", () => {
  it("reads the endpoint", () => {
    expect(parseEndpointBody({ endpoint: fixture.endpoint }, false)).toEqual({ ok: true, value: fixture.endpoint });
  });

  it("rejects a missing or foreign endpoint", () => {
    expect(parseEndpointBody({}, false).ok).toBe(false);
    expect(parseEndpointBody(null, false).ok).toBe(false);
    expect(parseEndpointBody({ endpoint: "https://example.com/" }, false).ok).toBe(false);
  });
});

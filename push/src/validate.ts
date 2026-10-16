import { decodeBase64Url } from "./base64url";

export interface Registration {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  timeZone: string;
  hour: number;
  minute: number;
  dueDay: number | null;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
  ".push.apple.com",
  ".notify.windows.com",
];

const MAX_ENDPOINT = 1024;
const MAX_TIME_ZONE = 64;

function isPushHost(host: string): boolean {
  return PUSH_HOSTS.some((h) => (h.startsWith(".") ? host.endsWith(h) : host === h));
}

/** The endpoint when it is a push service's `https:` URL (or a local one, if allowed). */
export function parseEndpoint(raw: unknown, allowLocal: boolean): string | null {
  if (typeof raw !== "string" || raw.length > MAX_ENDPOINT) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.username !== "" || url.password !== "") return null;
  if (url.protocol === "https:") return isPushHost(url.hostname) ? raw : null;
  if (allowLocal && url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
    return raw;
  }
  return null;
}

function validTimeZone(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_TIME_ZONE) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: raw });
    return true;
  } catch {
    return false;
  }
}

function integerIn(raw: unknown, min: number, max: number): raw is number {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= min && raw <= max;
}

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}

export function parseRegistration(raw: unknown, allowLocal: boolean): Parsed<Registration> {
  if (!isRecord(raw)) return { ok: false, error: "The body must be an object." };
  const endpoint = parseEndpoint(raw.endpoint, allowLocal);
  if (endpoint === null) return { ok: false, error: "The endpoint isn't a push service address." };
  const keys = raw.keys;
  if (!isRecord(keys)) return { ok: false, error: "keys is missing." };
  const p256dh = typeof keys.p256dh === "string" ? decodeBase64Url(keys.p256dh) : null;
  if (p256dh === null || p256dh.length !== 65 || p256dh[0] !== 0x04) {
    return { ok: false, error: "keys.p256dh isn't an uncompressed P-256 point." };
  }
  const auth = typeof keys.auth === "string" ? decodeBase64Url(keys.auth) : null;
  if (auth === null || auth.length !== 16) return { ok: false, error: "keys.auth isn't 16 bytes." };
  if (!validTimeZone(raw.timeZone)) return { ok: false, error: "timeZone isn't a time zone." };
  if (!integerIn(raw.hour, 0, 23)) return { ok: false, error: "hour must be 0 to 23." };
  if (!integerIn(raw.minute, 0, 59)) return { ok: false, error: "minute must be 0 to 59." };
  const dueDay = raw.dueDay;
  if (dueDay !== null && !integerIn(dueDay, -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)) {
    return { ok: false, error: "dueDay must be an epoch day or null." };
  }
  return {
    ok: true,
    value: {
      endpoint,
      keys: { p256dh: keys.p256dh as string, auth: keys.auth as string },
      timeZone: raw.timeZone,
      hour: raw.hour,
      minute: raw.minute,
      dueDay,
    },
  };
}

/** The endpoint of a `{ endpoint }` body. */
export function parseEndpointBody(raw: unknown, allowLocal: boolean): Parsed<string> {
  const endpoint = isRecord(raw) ? parseEndpoint(raw.endpoint, allowLocal) : null;
  return endpoint === null
    ? { ok: false, error: "The endpoint isn't a push service address." }
    : { ok: true, value: endpoint };
}

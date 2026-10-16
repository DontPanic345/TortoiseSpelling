// Runs the Worker under `wrangler dev` (workerd, with a real Durable Object) against a fake
// push service that decrypts what it receives, and checks the whole path: registration,
// the scheduled tick, the timing rules, the test push and the clean-up of gone subscriptions.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import assert from "node:assert/strict";

const pushDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORKER = "http://127.0.0.1:8787";
const MILLIS_PER_DAY = 86_400_000;

const b64 = (bytes) => Buffer.from(bytes).toString("base64url");
const unb64 = (text) => new Uint8Array(Buffer.from(text, "base64url"));
const subtle = globalThis.crypto.subtle;

// --- the fake push service ------------------------------------------------------------

const received = [];
let goneNext = new Set();

function startPushService() {
  const server = createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      received.push({ path: req.url, headers: req.headers, body: new Uint8Array(Buffer.concat(chunks)) });
      res.writeHead(goneNext.has(req.url) ? 410 : 201).end();
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

// A user agent: the keys a browser would make for a subscription.
async function newSubscription(origin, name) {
  const pair = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  return {
    endpoint: `${origin}/${name}`,
    privateKey: pair.privateKey,
    p256dh: b64(await subtle.exportKey("raw", pair.publicKey)),
    auth: b64(crypto.getRandomValues(new Uint8Array(16))),
  };
}

const concat = (...parts) => Buffer.concat(parts.map((p) => Buffer.from(p)));

async function hkdf(salt, ikm, info, length) {
  const key = await subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}

// RFC 8291 section 3.4, from the receiver's side.
async function decrypt(subscription, body) {
  const salt = body.slice(0, 16);
  assert.equal(new DataView(body.buffer, body.byteOffset).getUint32(16), 4096, "record size");
  const idLength = body[20];
  const asPublic = body.slice(21, 21 + idLength);
  const record = body.slice(21 + idLength);
  const asKey = await subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await subtle.deriveBits({ name: "ECDH", public: asKey }, subscription.privateKey, 256));
  const ikm = await hkdf(
    unb64(subscription.auth),
    ecdh,
    concat("WebPush: info\0", unb64(subscription.p256dh), asPublic),
    32,
  );
  const cek = await hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0"), 12);
  const key = await subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const padded = new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, record));
  assert.equal(padded.at(-1), 0x02, "padding delimiter");
  return JSON.parse(Buffer.from(padded.slice(0, -1)).toString());
}

async function verifyVapid(header, origin, publicKey) {
  const match = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(header ?? "");
  assert.ok(match, `Authorization header: ${header}`);
  const [, head, claims, signature, k] = match;
  assert.equal(k, publicKey, "VAPID k is the Worker's public key");
  const key = await subtle.importKey("raw", unb64(k), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const valid = await subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    unb64(signature),
    Buffer.from(`${head}.${claims}`),
  );
  assert.ok(valid, "the VAPID signature verifies");
  const payload = JSON.parse(Buffer.from(unb64(claims)).toString());
  assert.equal(payload.aud, origin);
  assert.equal(payload.sub, "https://github.com/DontPanic345/TortoiseSpelling");
  const nowSeconds = Date.now() / 1000;
  assert.ok(payload.exp > nowSeconds && payload.exp <= nowSeconds + 12 * 3600 + 5, "exp is within 12 hours");
}

// --- the Worker -----------------------------------------------------------------------

async function generateVapidKey() {
  const pair = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const { kty, crv, d, x, y } = await subtle.exportKey("jwk", pair.privateKey);
  return JSON.stringify({ kty, crv, d, x, y });
}

// The key goes in a temporary .dev.vars (git-ignored), removed when the run ends.
async function startWorker(stateDir) {
  const vars = join(pushDir, ".dev.vars");
  writeFileSync(vars, `VAPID_PRIVATE_JWK='${await generateVapidKey()}'\n`);
  const child = spawn(
    "npx",
    ["wrangler", "dev", "--local", "--test-scheduled", "--port", "8787", "--var", "ALLOW_LOCAL_PUSH:true", "--persist-to", stateDir],
    { cwd: pushDir, stdio: ["ignore", "pipe", "pipe"], detached: true },
  );
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));
  return { child, vars, output: () => output };
}

function stopWorker(worker) {
  try {
    process.kill(-worker.child.pid, "SIGTERM");
  } catch {
    // already gone
  }
  rmSync(worker.vars, { force: true });
}

async function waitForWorker(worker) {
  for (let i = 0; i < 120; i++) {
    try {
      const response = await fetch(`${WORKER}/key`);
      if (response.ok) return (await response.json()).publicKey;
    } catch {
      // not listening yet
    }
    await sleep(500);
  }
  throw new Error(`wrangler dev didn't start:\n${worker.output()}`);
}

async function api(method, path, body) {
  const response = await fetch(`${WORKER}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  await response.arrayBuffer();
  return response.status;
}

// wrangler dev's test route for the cron trigger: `/__scheduled`, or `/cdn-cgi/handler/scheduled`
// where a newer wrangler replaces it. The tick runs on the real clock.
async function runScheduled() {
  let response = await fetch(`${WORKER}/__scheduled`);
  if (response.status === 404) response = await fetch(`${WORKER}/cdn-cgi/handler/scheduled`);
  assert.equal(response.status, 200, "the scheduled test route");
  await response.text();
  await sleep(1500);
}

// --- the checks -----------------------------------------------------------------------

function wallClock(zone, millis = Date.now()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(millis)
      .map((p) => [p.type, Number(p.value)]),
  );
  return {
    day: Date.UTC(parts.year, parts.month - 1, parts.day) / MILLIS_PER_DAY,
    minute: parts.hour * 60 + parts.minute,
  };
}

function registration(subscription, zone, minuteOfDay, dueDay) {
  return {
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    timeZone: zone,
    hour: Math.floor(minuteOfDay / 60),
    minute: minuteOfDay % 60,
    dueDay,
  };
}

async function check(worker, origin) {
  const publicKey = await waitForWorker(worker);
  assert.equal(unb64(publicKey).length, 65, "GET /key is an uncompressed P-256 point");
  console.log("ok: GET /key");

  // UTC unless it is within a few minutes of midnight, when the next minute would be
  // tomorrow; then a zone twelve hours ahead, where it is midday.
  const utcMinute = wallClock("UTC").minute;
  const zone = utcMinute >= 1436 || utcMinute <= 2 ? "Etc/GMT-12" : "UTC";

  // Registering at the reminder time counts today as sent, so the tick sends nothing.
  const early = await newSubscription(origin, "early");
  let now = wallClock(zone);
  assert.equal(await api("PUT", "/subscription", registration(early, zone, now.minute, now.day)), 204);
  await runScheduled();
  assert.equal(received.length, 0, "registering after the reminder time sends nothing");
  console.log("ok: registering after the reminder time waits until tomorrow");

  // Registering a minute before the reminder time doesn't mark today sent.
  const reminded = await newSubscription(origin, "reminded");
  now = wallClock(zone);
  const reminderMinute = now.minute + 1;
  assert.equal(await api("PUT", "/subscription", registration(reminded, zone, reminderMinute, now.day)), 204);
  await runScheduled();
  assert.equal(received.length, 0, "no reminder before its time");
  while (wallClock(zone).minute < reminderMinute) await sleep(1000);

  await runScheduled();
  assert.equal(received.length, 1, "one reminder at the reminder time");
  const [push] = received;
  assert.equal(push.path, "/reminded");
  assert.equal(push.headers["content-encoding"], "aes128gcm");
  assert.equal(push.headers.ttl, "43200");
  assert.equal(push.headers.topic, "reminder");
  await verifyVapid(push.headers.authorization, origin, publicKey);
  assert.deepEqual(await decrypt(reminded, push.body), { kind: "reminder" });
  console.log("ok: the reminder arrives, signed and encrypted");

  await runScheduled();
  assert.equal(received.length, 1, "no second reminder the same day");
  console.log("ok: once a day");

  assert.equal(await api("POST", "/test", { endpoint: reminded.endpoint }), 204);
  assert.equal(received.length, 2);
  assert.equal(received[1].headers.ttl, "600");
  assert.deepEqual(await decrypt(reminded, received[1].body), { kind: "test" });
  assert.equal(await api("POST", "/test", { endpoint: reminded.endpoint }), 429, "tests are rate limited");
  console.log("ok: POST /test");

  const gone = await newSubscription(origin, "gone");
  assert.equal(await api("PUT", "/subscription", registration(gone, zone, 0, null)), 204);
  goneNext = new Set(["/gone"]);
  assert.equal(await api("POST", "/test", { endpoint: gone.endpoint }), 502, "a 410 is a refusal");
  assert.equal(await api("POST", "/test", { endpoint: gone.endpoint }), 404, "and removes the entry");
  console.log("ok: a gone subscription is removed");

  assert.equal(await api("DELETE", "/subscription", { endpoint: reminded.endpoint }), 204);
  assert.equal(await api("POST", "/test", { endpoint: reminded.endpoint }), 404);
  assert.equal(await api("DELETE", "/subscription", { endpoint: reminded.endpoint }), 204);
  console.log("ok: DELETE /subscription");
}

const stateDir = mkdtempSync(join(tmpdir(), "tortoise-push-"));
const service = await startPushService();
const origin = `http://127.0.0.1:${service.address().port}`;
const worker = await startWorker(stateDir);
let failed = false;
try {
  await check(worker, origin);
} catch (error) {
  failed = true;
  console.error(error);
  console.error("--- wrangler output ---\n" + worker.output());
} finally {
  stopWorker(worker);
  service.close();
  rmSync(stateDir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);

# Piece: web-push

The web app's daily reminder: a notification at the time the user picks, on days when
words are due, delivered by Web Push from a small scheduled job on a free tier. Also
`PRIVACY.md`'s account of what that job stores. Source: `docs/testing-and-web-plan.md`
("Points that don't map one to one", "Installing and notifications on iPhone", "Suggested
order" item 5), and the decision on web reminders in `GOALS.md`.

Builds on `web-ui` and `shared-specs` as specified: `web/` with Preact, the `Platform`
seam (`browserPlatform.ts` is the only code that touches `navigator`), the router and its
`#/review` deep link, web-core's repository and `settings` store, the precache plugin and
service worker, the CSP in `build/csp.ts`, `pages.yml`, the Playwright smoke suite, the
`--mode e2e` build with `window.__tortoiseSpellingSeed`, `specs/` with
`notifications.feature` tagged `@android`, and `web/steps/`. The Android app doesn't
change.

## What it delivers

- **A daily reminder on the web**, with Android's rules: on by default once the user
  allows notifications, at 08:00 unless they pick another time, only on days with words
  to practise (due words or new words still to introduce), and "Time to practise
  spelling" / "N words ready" as its text. Tapping it opens today's session on a fresh
  launch, and only brings the app forward if it is already open. Settings has Android's
  "Daily reminder" section: the switch, the time and "Send a test notification".
- **A push server, `push/`**: a Cloudflare Worker with a Cron Trigger every 5 minutes
  and one SQLite-backed Durable Object holding the subscriptions. It stores push
  subscriptions, each with its time zone, reminder time, next due day and last sent day,
  and nothing else: never a word, a count or an answer.
- **Streak parity.** Android's reminder worker marks a quiet day (nothing due) as
  satisfied even when the app isn't opened. The web marks those days the next time it
  opens, from data that can't have changed while it was closed.
- **`PRIVACY.md`** says what the server stores, where, for how long, and how it is
  deleted, in the same commit that points the web app at the server.

Goals it leans on:

1. **Nothing lost.** The server holds no words, so losing it loses nothing but reminders.
   The web's new settings are new keys in web-core's `settings` store, so there is no
   `DB_VERSION` bump.
2. **Reminder.** This is the piece. Android's reminder code and behaviour don't change.
   The web's rules are Android's (`CLAUDE.md`, "Daily reminder"), re-expressed for a
   server: "send only on days the app has said words are due", with the count worked out
   on the device when the push arrives.
3. **No API key.** The only new request is to the push server, which the CSP allows by
   name. No AI API is involved.
4. **Scheduling per root word.** Nothing here writes SM-2 state. The server learns one
   day number, computed from web-core's queries.
5. **Two apps that behave the same.** Android's copy, defaults and effective-switch rule;
   the first `notifications.feature` scenario runs on both platforms; the satisfied-day
   backfill keeps the streak equal.
6. **Free to run.** Cloudflare's Workers Free plan has no billing, and a free-plan limit
   reached means failed requests, not charges. It needs a Cloudflare account, which only
   Alan can create, so the deploy step is a blocker for this piece only (build-4).
7. **Simple.** No runtime dependencies on either side: VAPID and the payload encryption
   are Web Crypto, about 100 lines with the RFC's own test vector. No Workbox, no
   `web-push` package, no database service to provision.

### Settled here (the docs and decisions leave these open)

- **Cloudflare Workers, Free plan, with a Cron Trigger and a Durable Object.** GitHub
  Actions' `schedule` could send pushes, but a static site can't hand it a subscription
  without a credential in the browser, so any choice needs an HTTP endpoint and an
  account. Cloudflare's free plan covers this with room to spare (100,000 requests a
  day; 5 Cron Triggers; SQLite-backed Durable Objects with 5 million rows read and
  100,000 written a day), it is the most established of the free serverless hosts, and
  it never bills a free account. Vercel's free cron runs once a day, which can't hit a
  user's chosen minute. A SQLite Durable Object needs no database id in the config,
  unlike D1 or KV, so a deploy from CI creates everything it needs.
- **Every 5 minutes.** `crons = ["*/5 * * * *"]`, 288 runs a day. A reminder arrives up to
  5 minutes after its time, which matches Android's "within a few minutes is fine for a
  habit nudge" (`ReminderScheduler`). A missed run catches up on the next one the same
  day.
- **The server decides only *whether* to send; the device writes the text.** The push
  carries `{"kind":"reminder"}` or `{"kind":"test"}`, encrypted (RFC 8291, `aes128gcm`).
  The service worker opens the word database, takes `todayPlan()`, and shows Android's
  text for the count. An empty push would avoid the encryption, but Safari's handling of
  payload-less pushes isn't documented, and the kind tells a test from a reminder as
  Android's `KEY_TEST_RUN` does.
- **Every push shows a notification.** Safari revokes a subscription after pushes that
  show nothing, and Chrome shows its own "updated in the background" message. When a push
  finds nothing due (the server's day was stale because the last sync failed), it shows
  Android's test text, "Reminders are working" / "Nothing is due right now.", which is
  true, and for a reminder push also marks today satisfied, as Android's worker does.
- **The device tells the server one day: `reminderDay`.** The first day, from today, on
  which `todayPlan()` would be non-empty if nothing changed: today if today's plan has
  anything; otherwise tomorrow if any unsuspended new word is left (the allowance
  resets); otherwise `nextDueDay()`; otherwise `null` (nothing will ever be due, so no
  push). The server sends on every day from then on, once a day, until the device sends
  a later day. Overdue days keep reminding, as on Android.
- **The time zone travels with the subscription.** The device sends its IANA zone
  (`clock.timeZone()`), hour and minute, and the server works out local days with `Intl`.
  A reminder set at 02:30 still fires on a daylight-saving day that skips 02:30, at
  03:00.
- **Registering after today's reminder time waits until tomorrow.** When a sync arrives
  at or after the reminder time, the server records today as already sent. That is
  `millisUntilNext`'s "always strictly in the future", and it means opening the app at
  10:00 doesn't trigger an 08:00 reminder.
- **The VAPID key pair lives only in the Worker.** The private key is a Worker secret,
  created by the deploy workflow on its first run and never printed; the app fetches the
  public key from `GET /key` before subscribing. Nothing key-shaped is committed. The
  app re-registers at least once a day and checks the key when it does, so rotating the
  key (deleting the secret), or losing the server's table, costs each user one
  re-subscribe on their next day's sync.
- **Consent on the web is a Home card, not a system prompt on load.** Browsers only
  allow the permission prompt from a tap, and Safari only lets an installed web app use
  push. Where Android asks once Home has a word, the web shows a card with "Turn on" and
  "Not now" under the same condition. "Turn on" asks the browser. A refusal, or "Not
  now", turns reminders off, as a refusal does on Android.
- **The Settings switch shows the effective state**: enabled and permission granted
  (Android's rule). With no push support it is off and disabled, with a line saying why.
  Android's battery help text and "Open app settings" stay Android-only.
- **Reminders stay hidden until the server exists.** `web/src/push/server.ts` exports
  `PUSH_SERVER`, empty until build-4 sets it. While it is empty, `container.reminders`
  is `null`, so Settings has no "Daily reminder" section, Home no card, and the CSP no
  new origin, and builds 1 to 3 can ship to Pages safely.
- **The service worker becomes TypeScript.** It needs the repository to count the
  plan, so web-ui's `sw-template.js` becomes `src/sw/sw.ts`, bundled into a single
  classic-script `sw.js` by a nested `vite build` in library mode (IIFE). Module service
  workers aren't safe on Safari 16.4.
- **The server keeps no logs** (`observability.enabled = false`), and deletes a
  subscription when reminders are turned off, when a push service says it is gone, or
  when it hasn't been updated for 180 days.
- **No version bump.** The piece is web-only (the decision on releases). One
  `CHANGELOG.md` line goes under `[Unreleased]` and ships with the next Android
  release's notes, as web-ui's did.

## Design

### The push server (`push/`)

```text
push/
  package.json          scripts: typecheck, test, smoke, deploy; devDeps wrangler,
                        typescript, vitest, @cloudflare/workers-types
  tsconfig.json
  wrangler.toml
  src/
    index.ts            fetch (routes, CORS) and scheduled handlers; exports Subscriptions
    subscriptions.ts    the Durable Object: SQL, register, remove, test, tick
    schedule.ts         localDay, shouldSend, sentDayOnRegister: pure
    validate.ts         parseRegistration, parseEndpoint, PUSH_HOSTS: pure
    webpush.ts          vapidAuthorization, encryptPayload, sendPush
    base64url.ts
  scripts/
    vapid.mjs           prints a new P-256 private JWK on stdout
    smoke.mjs           wrangler dev + a fake push service that decrypts what it gets
  test/                 schedule, validate, webpush (RFC 8291 vector), api (fake store)
  README.md
```

`package.json` pins `~` current stable versions at build time, as web-core did. No runtime
dependencies.

**`wrangler.toml`**:

```toml
name = "tortoisespelling-push"
main = "src/index.ts"
compatibility_date = "<the build day>"
workers_dev = true

[observability]
enabled = false

[triggers]
crons = ["*/5 * * * *"]

[[durable_objects.bindings]]
name = "SUBSCRIPTIONS"
class_name = "Subscriptions"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["Subscriptions"]

[vars]
ALLOWED_ORIGINS = "https://dontpanic345.github.io,http://localhost:4173,http://localhost:5173"
VAPID_SUBJECT = "https://github.com/DontPanic345/TortoiseSpelling"
```

Secrets: `VAPID_PRIVATE_JWK` (the JWK from `scripts/vapid.mjs`, with `d`, `x` and `y`).
`ALLOW_LOCAL_PUSH = "true"` is set only by the smoke script (`wrangler dev --var`).

**HTTP API.** JSON in and out, request bodies at most 4 KiB (413 otherwise). CORS:
an `Origin` in `ALLOWED_ORIGINS` gets `Access-Control-Allow-Origin` with that origin,
`Vary: Origin`, and on `OPTIONS` the methods `GET, PUT, POST, DELETE` and header
`Content-Type`. Any other origin gets no CORS headers (the browser then blocks it).

| Request | Body | Response |
|---|---|---|
| `GET /key` | | `{ "publicKey": "<base64url, 65-byte uncompressed point>" }`, or 503 when the secret isn't set yet |
| `PUT /subscription` | `{ endpoint, keys: { p256dh, auth }, timeZone, hour, minute, dueDay }` | 204. 400 for an invalid body. 503 when the table already holds 5,000 other endpoints. |
| `DELETE /subscription` | `{ endpoint }` | 204, whether or not it existed |
| `POST /test` | `{ endpoint }` | 204 once the push service accepted it; 404 for an unknown endpoint; 429 within 30 s of the last test; 502 when the push service refused (and a gone subscription is deleted) |
| anything else | | 404 |

**Validation (`validate.ts`)**, all pure and tested:

- `endpoint`: a string of at most 1,024 characters that parses as an `https:` URL whose
  host is in `PUSH_HOSTS` or ends with one of its `.`-prefixed suffixes:
  `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `web.push.apple.com`,
  `.push.apple.com`, `.notify.windows.com`. With `ALLOW_LOCAL_PUSH`, `http://localhost:*`
  and `http://127.0.0.1:*` are accepted too.
- `keys.p256dh`: base64url that decodes to 65 bytes starting `0x04`; `keys.auth`: 16 bytes.
- `timeZone`: at most 64 characters, accepted by `new Intl.DateTimeFormat("en", {
  timeZone })` without a `RangeError`.
- `hour` an integer 0–23, `minute` 0–59, `dueDay` an integer (epoch day) or `null`.
- Unknown fields are ignored and never stored.

**Storage (`subscriptions.ts`).** One Durable Object instance,
`env.SUBSCRIPTIONS.idFromName("all")`, called through Durable Object RPC. Its constructor
runs:

```sql
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
)
```

A schema change later is a new `CREATE`/`ALTER` guarded by `PRAGMA user_version`, never a
drop: losing the table loses every user's reminder.

- `register(reg, now)`: an upsert of every field, `updated_at = now`, and
  `last_sent_day = sentDayOnRegister(existing?.last_sent_day, reg, now)`.
- `remove(endpoint)`, `test(endpoint, now)`.
- `tick(now)`: deletes rows with `updated_at` older than 180 days; selects every row;
  keeps those where `shouldSend(row, now)`, oldest `last_sent_day` first, at most
  `MAX_PER_TICK = 20`; sends each `{"kind":"reminder"}` with at most 6 in flight; and
  per result: 201/202/200 → `last_sent_day = localDay(now, row.time_zone)`; 404, 410,
  400 or 403 → delete the row (gone, malformed, or signed with a key that has since
  changed); anything else (429, 5xx, a network error) → leave it, so the next tick
  retries. The rest wait for the next tick. Twenty pushes a tick is 5,760 a day, inside
  the free plan's 50 subrequests per invocation and its CPU limit (each push costs one
  ECDH and one AES-GCM; one VAPID signature is made per push-service origin per tick).

**Timing (`schedule.ts`)**, pure:

- `localDay(millis, timeZone)` and `localMinute(millis, timeZone)`: the epoch day and
  the minute of the day on that zone's wall clock, from `Intl.DateTimeFormat("en-CA",
  { timeZone, year, month, day, hour, minute, hourCycle: "h23" }).formatToParts`.
- `shouldSend(row, now)`: `due_day !== null`, `localDay >= due_day`, `localMinute >=
  hour * 60 + minute`, and `last_sent_day` is null or before `localDay`.
- `sentDayOnRegister(previous, reg, now)`: if `localMinute(now) >= reg.hour * 60 +
  reg.minute`, the larger of `previous` and today's local day; otherwise `previous`.

**Web Push (`webpush.ts`)**, Web Crypto only:

- `vapidAuthorization(jwk, audience, nowSeconds, subject)`: an ES256 JWT with `aud` (the
  endpoint's origin), `exp` (now + 12 h) and `sub`, giving the header `vapid t=<jwt>,
  k=<public key>`. `tick` caches one per audience.
- `encryptPayload(plaintext, p256dh, auth, { salt, senderKeys } = random)`: RFC 8291's
  `aes128gcm` body (RFC 8188 header with a 4096 record size and the sender's public key,
  one record, padding delimiter `0x02`). The optional arguments make the RFC 8291
  Appendix A example a test.
- `sendPush(row, payload, { ttl, auth })`: `POST` to the endpoint with `TTL` (43,200 for
  a reminder, 600 for a test), `Urgency: normal`, `Topic: reminder`, `Content-Encoding:
  aes128gcm` and the encrypted body. Returns the status, or 0 on a network error.

**`index.ts`**: `fetch` routes to the Durable Object; `scheduled` calls
`stub.tick(controller.scheduledTime)` inside `ctx.waitUntil`.

### The web app

**Config.** `web/src/push/server.ts`: `export const PUSH_SERVER = "";` (an origin, no
trailing slash). `vite.config.ts` resolves the build's server as
`process.env.PUSH_SERVER_OVERRIDE ?? PUSH_SERVER` (the override is for the smoke build
only) and passes it to the app as `__PUSH_SERVER__` and to `build/csp.ts`, which builds
`connect-src 'self'` plus that origin when it isn't empty; its test checks both cases.

**Container.** `AppContainer` gains `reminders: { push: PushPlatform; api: PushApi;
sync: ReminderSync } | null`. `main.tsx` builds it from `platform.push` and
`createPushApi(__PUSH_SERVER__, fetch)` when `__PUSH_SERVER__` isn't empty, and `null`
otherwise. Screens show reminder UI only when it isn't `null`. The e2e build passes
fakes (see "Shared specs").

**Settings store.** New keys in web-core's `settings` store, no `DB_VERSION` bump.
`repository.settings()` gains:

| Field | Default | Setter |
|---|---|---|
| `reminderEnabled: boolean` | `true` | `setReminderEnabled(on)` |
| `reminderHour`, `reminderMinute` | 8, 0 | `setReminderTime(h, m)`, clamped like `SettingsStore` |
| `pushRegistration: { endpoint: string; publicKey: string; sent: string; sentAt: number } \| null` | `null` | `setPushRegistration(r)`; doesn't notify subscribers, so a sync can't wake itself |
| `quietCheckedThrough: number \| null` | `null` | written by `settleQuietDays()` |

`sent` is the exact JSON of the last body the server accepted and `sentAt` when, so an
unchanged state sends nothing for a day. `publicKey` is the server key the subscription
was made with.

**Repository additions** (`web/src/data/repository.ts`):

- `reminderDay(): Promise<number | null>`, the rule above, from `todayPlan()`,
  `availableNewCount` and `nextDueDay()`.
- `settleQuietDays()`: with `T = today`, for each day `d` from
  `max(quietCheckedThrough + 1, T - 400)` to `T - 1` (none on the first run, when it is
  `null`), marks `d` satisfied if the plan for `d` from the stored words is empty:
  `dueCount(words, d) + min(max(0, newWordsPerDay - introducedOn(words, d)),
  availableNewCount(words)) === 0`. Then sets `quietCheckedThrough = T - 1`. One
  transaction. Nothing changes while the app is closed, so the stored words are the words
  as they stood on those days, as long as it runs before anything can write a word:
  `main.tsx` awaits it after opening the database and before rendering, so a
  notification's `#/review` launch can't review an overdue word first and make the day
  it was skipped look quiet. `homeState.ts`'s `loadHome` also calls it, before
  `markTodaySatisfied()`, for an app left open across midnight. When
  `quietCheckedThrough` is already `T - 1` it writes nothing, and it never notifies
  subscribers (Home calls it on every refresh, so a notifying write would loop). Days
  are marked only while `reminderEnabled` is on, since Android's worker marks them only
  when the reminder is on; with it off, the check just advances. Satisfied days only
  bridge a streak (`currentStreak`), so a day marked with no words does no harm, as on
  Android.

**Push platform (`web/src/push/pushPlatform.ts`)**, the push half of the platform, in
both the page and the service worker:

```ts
export type PushSupport = "supported" | "needs-install" | "unsupported";
export type Permission = "granted" | "denied" | "default";
export interface PushSubscriptionInfo { endpoint: string; p256dh: string; auth: string }
export interface PushPlatform {
  support(): PushSupport;
  permission(): Promise<Permission>;
  requestPermission(): Promise<Permission>;   // page only; call first thing in a tap
  subscription(): Promise<PushSubscriptionInfo | null>;
  subscribe(publicKey: string): Promise<PushSubscriptionInfo>;
  unsubscribe(): Promise<void>;
}
```

- `browserPlatform.ts` implements it for the page as `platform.push` (so `navigator`
  stays in that one file): `"supported"` when `PushManager`, `Notification` and service
  workers exist; `"needs-install"` when `installState()` is `"ios"` (Safari exposes push
  only to installed apps); otherwise `"unsupported"`. `subscribe` waits for
  `navigator.serviceWorker.ready` and calls `pushManager.subscribe({ userVisibleOnly:
  true, applicationServerKey })`.
- `src/sw/swPushPlatform.ts` implements it in the worker through `self.registration`,
  with `permission()` from `pushManager.permissionState({ userVisibleOnly: true })`.
- `fakePlatform` gains a fake `push` that records calls and returns what a test sets.

**Server client (`web/src/push/pushApi.ts`)**: `createPushApi(origin, fetch)` with
`publicKey()`, `register(body)`, `unregister(endpoint)` and `test(endpoint)`, each a
`fetch` with `keepalive: true` that throws `PushApiError(status)` on a non-2xx. The body
type `Registration` matches the server's, and `push/test/fixtures/registration.json` is
read by a test on each side so the two can't drift.

**Sync (`web/src/push/reminderSync.ts`)**: `createReminderSync({ repository, clock, push,
api })` returns `{ sync(): Promise<SyncResult> }`, used by the page and the service
worker. One `sync`:

1. When reminders are off, permission isn't `"granted"` or support isn't
   `"supported"`: if a registration is stored, `api.unregister` it (ignoring failures),
   `push.unsubscribe()`, and clear it. Done.
2. Otherwise take `push.subscription()`, or subscribe with `api.publicKey()`. When
   nothing is stored or `sentAt` is a day old or more, fetch `api.publicKey()`; if it
   differs from the stored `publicKey`, `unsubscribe()` and subscribe with the new key.
   If a stored registration has another endpoint, unregister the old one.
3. Build `{ endpoint, keys, timeZone: clock.timeZone(), hour, minute, dueDay:
   reminderDay() }`. If its JSON equals the stored `sent` and `sentAt` is less than a
   day old, stop. Otherwise `register` it and store `{ endpoint, publicKey, sent, sentAt:
   clock.millis() }`. The daily re-register restores a row the server deleted (a push
   service's refusal, 180 days unused, a lost table) and keeps an active user's row
   from ageing out.
4. A failure leaves the stored state alone, so the next sync retries, and returns
   `"offline"`.

`sync({ force: true })` skips step 3's "unchanged" check. Calls never overlap: a `sync`
during a `sync` sets a flag and runs once more after it (forced if either asked).
`main.tsx` starts it when `container.reminders` isn't `null`: on load, on every
`repository.subscribe` notification, and on `visibilitychange` to visible. Settings and
Home await it when the user acts.

**Service worker (`web/src/sw/`).** `sw.ts` keeps web-ui's precache, activate and fetch
behaviour unchanged, and adds:

- `push`: `event.waitUntil(showReminder(...))`. It opens the database, builds a
  repository with `deviceClock`, reads `todayPlan()`, and shows
  `reminderNotification(kind, total)` with `tag: "reminder"` and `icon:
  "./icons/icon-192.png"`. It also marks today satisfied for a `reminder` with nothing
  due. An unreadable payload counts as a `reminder`. After showing it, the same
  `waitUntil` runs a `reminderSync.sync()` (as `pushsubscriptionchange` does) for a
  `reminder`. A push still has to show something when reminders are off (the
  unregister failed offline, say), and that sync then unregisters; a stale `dueDay`,
  which is what made a push find nothing due, is corrected after one wrong push even if
  the app isn't opened.
- `reminderNotification` (pure, in `src/sw/notification.ts`): a total above 0 gives
  "Time to practise spelling" with "1 word ready" or "N words ready"; 0 gives "Reminders
  are working" with "Nothing is due right now.". That is `ReminderWorker`'s copy.
- `notificationclick`: close it; if a window client of this scope exists, `focus()` it
  and do nothing else (Android honours the deep link only on a fresh launch); otherwise
  `clients.openWindow("./#/review")`, which starts a session.
- `pushsubscriptionchange`: `event.waitUntil(reminderSync.sync())` with
  `swPushPlatform` and `createPushApi(__PUSH_SERVER__, fetch)` (skipped when it is empty), so a browser that rotates the subscription keeps reminding without
  the app being opened.

**The service worker build.** web-ui's `serviceWorkerSource(template, files)` becomes
`precacheManifest(files) → { files: string[]; version: string }` with the same rules
(`./` first, no `sw.js` and no source maps; the version is the first 12 hex digits of a
SHA-256 over sorted names and contents). The `precache()` plugin, in `generateBundle`,
computes it, then calls Vite's `build()` with `configFile: false`, `build.lib: { entry:
"src/sw/sw.ts", formats: ["iife"], name: "tortoiseSpellingSw" }`, `write: false`, the
same target, and `define: { __PRECACHE__, __VERSION__, __PUSH_SERVER__ }`, and emits the output as `sw.js`.
`web/tsconfig.sw.json` type-checks `src/sw/` with `lib: ["ES2022", "WebWorker"]`; the
main `tsconfig.json` excludes `src/sw/`. `typecheck` runs both. Code that both use
(`domain/`, `data/`, `push/`) must not touch DOM-only globals, which the second
type-check enforces.

**Settings: the "Daily reminder" section**, above Practice, only when `container.reminders`
isn't `null`. Android's copy where Android has the control:

- The title "Daily reminder".
- The switch "Remind me daily" (`settings_reminder_switch`), checked when
  `reminderEnabled` and permission is `"granted"`, and disabled unless support is
  `"supported"`. Turning it on calls `push.requestPermission()` first thing in the
  handler when permission is `"default"`. Granted: `setReminderEnabled(true)`, then
  sync. Any other answer, or already `"denied"`: `setReminderEnabled(false)`. When the
  permission is `"denied"` the snackbar also says "Notifications are blocked for
  Tortoise Spelling. Allow them in this browser's settings for this site." (web-only: a
  page can't open the browser's settings, so there's no action). A prompt the user
  closes, or one the browser hides, leaves the permission `"default"`: reminders go off
  silently, as a first refusal does on Android, and the switch can ask again. Turning it off: `setReminderEnabled(false)`, then sync, which unregisters.
- The time: a label "Reminder time" and `<input type="time">` with the test id
  `settings_reminder_time_button` (Android's tag value, so the specs share it), showing
  `HH:MM`, disabled while the switch is off. A change calls `setReminderTime`.
- "Send a test notification" (a text button). It syncs, then `api.test(endpoint)`:
  "Test reminder queued." (Android's) on success. A 404 means the server has lost the
  row (a push service refused it, or the table was lost), so it runs `sync({ force:
  true })`, which registers even when the body is unchanged, and tries the test once
  more. Web-only failures: when not effectively
  on, "Turn on the daily reminder first."; when the server can't be reached or refuses,
  "Couldn't reach the reminder server.".
- One help line, by support (web-only):
  - `"supported"`: "Reminders come through your browser's push service, so they arrive
    when this device is online, within a few minutes of the time you set."
  - `"needs-install"`: "On iPhone and iPad, reminders work once Tortoise Spelling is
    installed: tap Share, then Add to Home Screen, and open it from there."
  - `"unsupported"`: "This browser can't show reminders. Home still shows what's due
    today."
- A sync that fails after a change shows "Couldn't reach the reminder server. It will
  try again next time the app opens." (web-only).

**Home: the reminder card** (web-only), above the week card, when there are words,
`container.reminders` isn't `null`, `reminderEnabled`, permission is `"default"` and support is
`"supported"`. Test id `home_reminder_card`, text "Get a reminder each day when words are
due?", buttons "Turn on" (`home_reminder_turn_on`) and "Not now"
(`home_reminder_not_now`). "Turn on" behaves as the Settings switch does; "Not now" sets
`reminderEnabled` false. Either way the card goes, and Settings can turn reminders on
later.

**Test ids.** `testIds.ts` gains `settings_reminder_switch` and
`settings_reminder_time_button` (they leave `testIds.test.ts`'s Android-only list, which
keeps the cloud backup switch) and the web-only `home_reminder_card`,
`home_reminder_turn_on` and `home_reminder_not_now`.

### Shared specs

`notifications.feature` loses its feature-level `@android`. The first scenario ("A fresh
install asks for notification permission once there is a word") becomes shared: its
steps read the same on the web. The other three get `@android`, each with a comment:

- refusing: "# Android only: a web page can't open the browser's notification settings,
  and the second refusal is Android's system behaviour."
- tapping the reminder: "# Android only: Playwright can't receive a real push or tap a
  system notification."
- `@slow`: "# Android only: it kills the app's process and waits for WorkManager."

`check-specs.mjs` keeps passing (the comment rule, `@slow` with `@android`).

The e2e build's container always gets `reminders` built from a fake push platform and
a fake API (moved from `web/test/support/` to a module the e2e entry can import), whatever
`PUSH_SERVER` holds, since no browser under Playwright can subscribe to a real push
service; the fakes make no requests. The fake platform reports `"supported"`, starts at
`"default"`, and after a request `permission()` returns the answer given, as a browser
does. The seed module adds `window.__tortoiseSpellingPush = { answer(permission) }`,
which sets what the next permission request returns (`"granted"` by default) and stands
in for the browser's prompt. Web steps in `web/steps/notifications.steps.ts`:

| Step | Web |
|---|---|
| `the app is freshly installed` | Nothing: each scenario has a fresh browser context. |
| `I am asked to allow notifications` | `home_reminder_card` is visible. |
| `I am not asked to allow notifications` | `home_reminder_card` isn't there. |
| `I allow notifications` | `answer("granted")`, then Turn on. |
| `the daily reminder is {word}` (in `settings.steps.ts`) | `settings_reminder_switch` is or isn't checked. |

### Smoke tests

`web/smoke/push.spec.ts`, Chromium only (`test.skip` for WebKit, which can't deliver a
push over CDP), and skipped when `SMOKE_URL` is set. `playwright.config.ts`'s `webServer` builds the smoke build with
`PUSH_SERVER_OVERRIDE=http://127.0.0.1:9`: a closed port, so the section shows, the CSP
allows it, and every request to it fails. The tests run with the `notifications`
permission granted:

- Seed a word through the UI, wait for the service worker, then
  `ServiceWorker.deliverPushMessage` over CDP with `{"kind":"reminder"}`.
  `registration.getNotifications()` then holds "Time to practise spelling" / "1 word
  ready".
- The same push with no words gives "Reminders are working" / "Nothing is due right
  now.".
- Settings shows the "Daily reminder" section, and with no server to reach, turning on
  the switch says "Couldn't reach the reminder server. It will try again next time the
  app opens." with no console error other than that failed request (the fixture allows
  only that one).

If CDP's push delivery doesn't show notifications in headless Chromium, the log says so,
the two push cases are dropped, and the service worker's handler is covered by its unit
tests alone.

### Deploy (`.github/workflows/push.yml`)

- Triggers: `push` to `main` with `paths: [push/**, .github/workflows/push.yml]`, and
  `workflow_dispatch`. `concurrency: { group: push-deploy, cancel-in-progress: false }`.
- `check`: Node 22 with the npm cache on `push/package-lock.json`; `npm ci`,
  `typecheck`, `test`, `smoke` in `push/`.
- `deploy`, `needs: check`, with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from
  secrets:
  - if either is empty, print `::notice::Cloudflare secrets aren't set; skipping the
    push server deploy.` and stop green;
  - `npx wrangler deploy`;
  - if `npx wrangler secret list` has no `VAPID_PRIVATE_JWK`, `node scripts/vapid.mjs |
    npx wrangler secret put VAPID_PRIVATE_JWK` (the key goes through the pipe only);
  - `curl -fsS "$URL/key"` returns a `publicKey`, where `$URL` is read from the deploy
    output and printed.
- A header comment: the push server deploys on every change to `push/`, with no version;
  the Durable Object's data survives deploys; never delete the `v1` migration.

`ci.yml` gains a `push` job (`npm ci`, `typecheck`, `test`, `smoke` in `push/`) and
`.github/dependabot.yml` a `/push` npm entry.

### Docs

- **`PRIVACY.md`**, in build-4's commit that sets `PUSH_SERVER`:
  - The opening paragraph and "The developer has no server" are corrected: the web
    app's reminder uses a small server, which never receives words.
  - "The web app" gains "Daily reminder on the web": when you turn it on, your browser
    creates a push subscription (an address at your browser maker's push service:
    Apple, Google, Mozilla or Microsoft, plus two keys that encrypt messages to it), and
    the app sends it to the reminder server on Cloudflare with your time zone, your
    reminder time and the next day words are due. The server stores those and the last
    day it sent a reminder, never your words, their number, your answers or your
    progress. Each message is encrypted and says only "reminder" or "test"; your device
    writes the notification text. Turning the reminder off deletes the entry; so does
    the push service reporting it gone, or 180 days without an update. The server keeps
    no logs; Cloudflare sees your IP address as any host does (link to Cloudflare's
    privacy policy), and the push service delivers the message under its own policy.
  - "Notifications" covers both apps: Android's is scheduled on the phone, the web's
    comes from the server above.
- **`CLAUDE.md`**:
  - Commands: `cd push && npm test`, `npm run smoke`, `npx wrangler dev`.
  - The layers table: "Push server unit and smoke tests | `push/test/`, `push/scripts/
    smoke.mjs` | Node, and workerd via `wrangler dev`".
  - The CI bullet gets the `push` job; the Release section gets `push.yml`.
  - A "Web reminder" section: the server, what it stores and why nothing else; the
    5-minute cron and `shouldSend`; `reminderDay` and `sentDayOnRegister`; the device
    composes the text; every push shows a notification; the key pair lives in the
    Worker; `PUSH_SERVER` and the CSP; the SQLite table is never dropped.
- **`README.md`**: the web app section's "what's missing" line goes; a sentence on the
  reminder (iPhone needs it installed first).
- **`CHANGELOG.md`**, `[Unreleased]` → `### Added`: "**Daily reminder in the web app**:
  turn it on from Home or Settings to get a notification on days with words to practise.
  On iPhone and iPad, install the app to the Home Screen first."
- **`web/README.md`**: the push files, the e2e fakes, and the hand check gains: turn on
  the reminder from Home in the installed app, allow it, "Send a test notification"
  arrives, a reminder arrives at the set time with the right count, tapping it opens a
  session, and turning it off stops them.
- **`push/README.md`**: what it is, the API, the commands, the deploy, the one-time
  Cloudflare setup, and how to rotate the key.
- **`docs/testing-and-web-plan.md`**: "Reminder needs a server" and the push server open
  question say what was built; the **(unverified)** mark on free tiers goes.

## Build steps

Each step follows `CLAUDE.md`'s Workflow and `PROTOCOL.md`. None changes the APK, so
there is no Gradle run unless noted and no Appium run; the phone is used only in build-4.
"Passing" means every command exits 0. Abbreviations:

- `<push>`: `cd push && npm ci && npm run typecheck && npm test && npm run smoke`
- `<web>`: `cd web && npm ci && npm run typecheck && npm test && npm run build`
- `<smoke>`, `<ci>`: as in `web-ui`.
- `<specs>`: `cd web && npm run check-steps && npm run specs`, and `node
  scripts/check-specs.mjs`.

### build-1: the push server (Sonnet, high)

Everything under "The push server", the `push` job in `ci.yml`, and the Dependabot entry.
No deploy. High effort: the encryption and the timing rule are where a quiet mistake
means reminders never arrive.

Tests (Vitest, Node):

- `webpush.test.ts`: `encryptPayload` with RFC 8291 Appendix A's keys, salt and
  plaintext gives the RFC's body byte for byte; a `vapidAuthorization` JWT verifies with
  the public key through `crypto.subtle.verify`, with the right `aud`, `exp` and `sub`.
- `schedule.test.ts`: `localDay`/`localMinute` in `Pacific/Auckland` and
  `America/Los_Angeles` either side of midnight and across both daylight-saving changes;
  `shouldSend` for not yet due, due before the time, due at the time, overdue, already
  sent today, `null` day; `sentDayOnRegister` before, at and after the time.
- `validate.test.ts`: each field's bounds, a non-push host, `http:` without
  `ALLOW_LOCAL_PUSH`, a bad zone, `fixtures/registration.json` accepted.
- `api.test.ts`, the fetch handler over a fake store and a fake `sendPush`: CORS for an
  allowed and a foreign origin, `OPTIONS`, 413, 404 routes, register then test, test
  rate limit, the 5,000-row cap, and `tick`'s result handling (sent, gone, retried, the
  20-per-tick cap).

`scripts/smoke.mjs` starts `wrangler dev --local --test-scheduled --port 8787 --var
ALLOW_LOCAL_PUSH:true`, with a fresh `VAPID_PRIVATE_JWK` in a temporary `.dev.vars`, and
a fake push service on a local port that records requests. The scheduled route is `wrangler dev`'s test route for the installed version
(`/__scheduled`, or `/cdn-cgi/handler/scheduled` where that replaces it), and the tick
uses the real clock. It checks `GET /key`; a `PUT` with a subscription whose keys the
script holds, due today, at a time already passed in `UTC`, then a scheduled run
(expects no push: `sentDayOnRegister`); a second `PUT` of the same subscription in UTC
(or an `Etc/GMT±N` zone if UTC is within two minutes of midnight) at the next minute,
so registering doesn't mark it sent; a wait until that minute has passed (at most about
a minute); then a scheduled run: one push arrives, its VAPID JWT verifies, and
decrypting it gives `{"kind":"reminder"}`; another scheduled run sends nothing; `POST /test` sends `{"kind":"test"}`; the fake service answering 410 to the next
test removes the row (the following test is 404); `DELETE` is 204. It stops `wrangler`
whatever happens.

Acceptance:

```bash
<push>
cd push && npx wrangler deploy --dry-run --outdir dist   # bundles with the DO and the cron
```

- Temporarily drop the `last_sent_day < localDay` check: `schedule.test.ts` and the
  smoke's repeated scheduled run fail. Temporarily flip one byte of the RFC salt: the
  vector test fails. Revert both.
- `<ci>`: the `push` job is green.

### build-2: the web side of the reminder (Sonnet, high)

The settings fields, `reminderDay`, `settleQuietDays` and its call in `loadHome`;
`PushPlatform` in `browserPlatform.ts`, `swPushPlatform.ts` and `fakePlatform`;
`pushApi.ts`; `reminderSync.ts` and its start in `main.tsx`; `server.ts` (empty) and the
CSP change; the service worker in TypeScript with its build change, and the push,
click and subscription-change handlers. No screen changes yet. High effort: the
service worker build changes how every user gets the app, and the sync is the reminder's
single source of truth.

Tests (Vitest):

- `repository` tests: the settings defaults and clamps; `reminderDay` equals, for random
  word sets from `seeded`, the first day `d` in `[today, today + 400]` on which
  `todayPlan()` is non-empty with `testClock` moved to `d` and nothing written (or
  `null`), including suspended words, used-up allowances and no words;
  `settleQuietDays` marks a quiet gap of three days and stops at the first due day, does
  nothing on its first run, marks nothing (but advances) with `reminderEnabled` off,
  writes nothing and notifies no subscriber on a second call the same day, and the
  streak across the gap carries on (the streak journey from web-core, with the app
  "closed" for the gap). A journey test shows a skipped due day stays unmarked when the
  app opens straight at `#/review` and the word is reviewed before Home loads.
- `reminderSync.test.ts` with a fake push platform and a fake API: off → unregisters and
  unsubscribes once; on and granted → subscribes and registers the expected body; an
  unchanged state sends nothing; a new reminder time or a review that moves
  `reminderDay` sends again; the same state a day later sends again; a changed server key
  resubscribes; a changed endpoint unregisters the old one; a failure retries on the next
  call; overlapping calls run at most twice; `force` registers an unchanged body.
- `pushApi.test.ts`: the request shapes, and the body equals
  `push/test/fixtures/registration.json`'s shape.
- `precache.test.ts`, adjusted for `precacheManifest`.
- `sw/notification.test.ts`: the three texts. `sw/handlers.test.ts` with
  `fake-indexeddb`: a push with one word due shows "1 word ready"; with nothing due
  shows "Reminders are working" and marks today satisfied for a reminder but not for a
  test; a reminder push with reminders off still shows a notification and then
  unregisters through the fake API; a click with a window client focuses it, and without one opens `./#/review`.
- `csp.test.ts`: the policy with and without `PUSH_SERVER`.

Acceptance:

```bash
<web>
<smoke>                                           # offline.spec.ts still passes
grep -c "__PRECACHE__\|__VERSION__\|^import " web/dist/sw.js   # prints 0
```

- Temporarily make `reminderDay` skip the new-word rule: the `reminderDay` test fails.
  Temporarily let `sync` send an unchanged body: `reminderSync.test.ts` fails. Revert.
- `<ci>`, including the Pages deploy (users get the new service worker).

### build-3: Settings, Home and the shared scenario (Sonnet, high)

The "Daily reminder" section, the Home card, the test ids, the e2e fakes and
`__tortoiseSpellingPush`, `notifications.feature`'s tags, the web steps, and
`push.spec.ts`. High effort: the permission flow has to be right on Safari, where the
request must run inside the tap, and nobody can try it on an iPhone in the loop.

Tests:

- `SettingsContent.test.tsx`: the section is absent with an empty server and present
  above Practice otherwise; the switch's effective state for each permission; disabled
  and the help line for each support value; the time field's value and disabled state;
  turning on with `"default"` calls `requestPermission` before anything async (the fake
  records the call order), and a refusal turns reminders off with the blocked message;
  the test button's three messages, and a 404 that forces a re-register and succeeds on
  the retry; a dismissed prompt (`"default"`) turns reminders off with no snackbar.
- `HomeContent.test.tsx`: the card under its rule only (no words, permission decided,
  reminders off, no support, empty server); Turn on and Not now.
- `testIds.test.ts` with the new lists.
- `push.spec.ts` (Smoke tests above).

Acceptance:

```bash
<web>
<smoke>
<specs>
cd e2e && npm run check-steps -- --all && npm run typecheck
```

- The specs run lists "A fresh install asks for notification permission once there is a
  word" in both projects, and none of the other three notification scenarios.
- Temporarily put an `await` before `requestPermission` in the switch handler: the
  call-order test fails. Revert.
- `<ci>`.

### build-4: deploy, point the app at the server, and the docs (Sonnet, medium)

`push.yml`, then the deploy, then `PUSH_SERVER` and every doc under "Docs" in one commit.

1. Commit `push.yml` and push. Read the `deploy` job's log (`gh run view --log`). If it
   printed the "secrets aren't set" notice, follow `PROTOCOL.md`'s Blockers with
   `"blocker": "The web reminder needs a free Cloudflare account. Please sign up at
   dash.cloudflare.com, open Workers & Pages once so the account gets a workers.dev
   subdomain, create an API token from the 'Edit Cloudflare Workers' template, and add
   the token and your account id as the repo secrets CLOUDFLARE_API_TOKEN and
   CLOUDFLARE_ACCOUNT_ID. Reply when they're in."`. Stop there. When unblocked, run
   `gh workflow run push.yml` and carry on.
2. From the green run's log, take the Worker's URL. Check it from here: `curl -fsS
   <url>/key` has a `publicKey`, and `curl -sI -X OPTIONS -H "Origin:
   https://dontpanic345.github.io" <url>/subscription` has the
   `Access-Control-Allow-Origin` header.
3. Set `PUSH_SERVER` to that origin. Write the docs. Commit and push together, and watch
   `pages.yml` deploy.
4. On the phone, with `adb` only: open the live site's Settings in Chrome (`adb shell am
   start -a android.intent.action.VIEW -d "https://dontpanic345.github.io/TortoiseSpelling/#/settings"
   com.android.chrome`), and with `uiautomator dump` and `input tap` turn on "Remind me
   daily", allow Chrome's prompt, and tap "Send a test notification". `adb shell dumpsys
   notification --noredact | grep -c "Reminders are working"` is at least 1. Then turn
   the reminder off. If Chrome's first-run or sign-in screens can't be got past in a few
   tries, say so in the log and leave it to the hand check.

Acceptance:

```bash
<push>
<web>
grep -c "$(sed -n 's/.*PUSH_SERVER = "\(.*\)".*/\1/p' web/src/push/server.ts)" web/dist/index.html   # the CSP allows the server
grep -n "Unreleased" -A10 CHANGELOG.md          # the web reminder line is there
```

- Steps 2 and 4 above; `<ci>`, with `push.yml` and `pages.yml` green.

### review (Sonnet, high)

Review the whole piece against this spec and `GOALS.md`, independently. In particular:

- the server stores exactly the columns above, nothing in a request or a log carries a
  word, and `PRIVACY.md` matches the table;
- `shouldSend`, `sentDayOnRegister` and `reminderDay` match the rules, and together give
  Android's behaviour: no reminder on a day with nothing to practise, one a day while
  words are overdue, none before the time, catch-up after a missed tick;
- every push shows a notification, with `ReminderWorker`'s copy;
- the permission request runs before any `await` in both handlers;
- `settleQuietDays` can't mark a day that had something to practise, runs before the
  first render, and never notifies;
- the CSP allows exactly `'self'` and `PUSH_SERVER`;
- nothing in `web/src` outside `browserPlatform.ts` and `src/sw/` touches `navigator`
  or `self.registration`;
- Android's reminder code, `notifications.feature`'s Android steps and `CLAUDE.md`'s
  "Daily reminder" are unchanged;
- no war-story comments.

Run the full checks: `<push>`, `<web>`, `<smoke>`, `<specs>`, the live `curl` checks from
build-4, `./gradlew testDebugUnitTest lintDebug`, `node --test 'scripts/*.test.mjs'`,
`cd e2e && npm run check-steps -- --all && npm run typecheck`, and `<ci>` for the final
commit (every job green, and both deploys). The log says whether the phone's Chrome
check passed and that the iPhone hand check is still Alan's. No version bump: the piece
is web-only.

High effort: a reminder that silently never arrives is the failure this app most has to
avoid, and real delivery can't be tested in the loop.

## What later pieces rely on

No piece depends on `web-push`. For any later change:

- the push server's table is only ever added to, under `PRAGMA user_version`;
- a new origin in the web app goes into the CSP deliberately, as `PUSH_SERVER` did;
- a change to the session rules (`todayPlan`, the new-word allowance) re-checks
  `reminderDay` and `settleQuietDays`, whose tests compare against `todayPlan()` and so
  fail if they drift.

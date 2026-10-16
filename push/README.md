# Push server

The web app's daily reminder, sent by Web Push. A Cloudflare Worker with a Cron Trigger
every 5 minutes and one SQLite-backed Durable Object. It stores push subscriptions, each
with its time zone, reminder time, next due day and last sent day, and nothing else: never
a word, a count or an answer. The device writes the notification text; the push only says
`{"kind":"reminder"}` or `{"kind":"test"}`.

No runtime dependencies: the VAPID signature (RFC 8292) and the payload encryption
(RFC 8291, `aes128gcm`) are Web Crypto.

## API

JSON in and out, bodies at most 4 KiB. Only the origins in `ALLOWED_ORIGINS` get CORS
headers.

| Request | Body | Response |
|---|---|---|
| `GET /key` | | `{ "publicKey": "<base64url, 65-byte point>" }`; 503 until the secret is set |
| `PUT /subscription` | `{ endpoint, keys: { p256dh, auth }, timeZone, hour, minute, dueDay }` | 204; 400 invalid; 503 when 5,000 other endpoints are stored |
| `DELETE /subscription` | `{ endpoint }` | 204, whether or not it existed |
| `POST /test` | `{ endpoint }` | 204; 404 unknown; 429 within 30 s of the last test; 502 when the push service refused |

Endpoints must be `https:` URLs on a push service (`fcm.googleapis.com`,
`updates.push.services.mozilla.com`, `web.push.apple.com`, `*.push.apple.com`,
`*.notify.windows.com`).

## How a reminder is decided

`dueDay` is the first day, from the device's today, on which it would have something to
practise. Every 5 minutes the cron sends to each subscription whose local day has reached
`dueDay`, whose local time has reached the reminder time and which hasn't been sent to
today, at most 20 per run. Registering at or after today's reminder time counts today as
sent. A subscription is deleted when the push service says it is gone (404, 410, 400, 403),
when the device deletes it, or when it hasn't been updated for 180 days. The Worker keeps
no logs.

## Commands

```bash
npm ci
npm run typecheck
npm test                                   # Vitest, including the RFC 8291 test vector
npm run smoke                              # wrangler dev (workerd) and a fake, decrypting push service
npx wrangler deploy --dry-run --outdir dist
npx wrangler dev                           # needs VAPID_PRIVATE_JWK in .dev.vars
node scripts/vapid.mjs                     # a new VAPID private JWK on stdout
```

`smoke` needs port 8787 and takes about 30 seconds: it waits for a reminder minute to pass.

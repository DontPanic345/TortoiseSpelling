# Privacy policy

Tortoise Spelling has no accounts, no ads, no analytics and no tracking. Your word list
stays on your phone. The app has no Internet permission, so it can't send anything
anywhere itself. Your words leave your phone only when you choose: when you paste a prompt
into a chat app, export a backup, or turn on Google backup. The web app is covered in
[its own section](#the-web-app); its daily reminder uses a small server, which never
receives your words.

## What the app keeps, and where

Everything is stored in the app's private storage on your device:

- your words, their definitions, word forms and example sentences;
- when each word is next due, and a log of your reviews (what you typed and whether it
  was right);
- your settings: the reminder time, new words per day, and the days that count towards
  your streak.

The Android app has no server, and the developer never receives any of it. (The web app's reminder server is described [below](#daily-reminder-on-the-web); it never receives words.)

## What leaves your device

**Word lookup.** **Copy prompt** only copies text to your clipboard. What you paste into
a chat app is between you and that service; the app never sees it or the answer until you
paste the answer back into the app.

If you saved an Anthropic API key in an earlier version, the app deletes it the first time
it runs after the update.

**Android's own backup.** Off by default. **Back up to Google account** in Settings →
Backup opts in to Android including your words, their scheduling and your other settings
in your device's backup to your Google account, so they can be restored after a factory
reset or on a new phone; it's between you and Google, the developer never sees it. Moving to a new phone directly (Android's
own device-to-device transfer, over USB or Wi-Fi, with no Google server involved) always
carries your words and settings across, whether or not this switch is on.

**Backups you export.** **Export** in Settings writes your words and progress to a file
wherever you choose.

**Hearing a word.** The speaker button on the review screen has your device say the word
with a voice installed on it. The apps never use a network voice, so the word isn't sent
anywhere.

## Notifications

On Android, the daily reminder is scheduled on your phone and posted by your phone. There's
no push service or server involved. The web app's reminder comes from a server, as
described [below](#daily-reminder-on-the-web).

## Permissions

| Permission | Why |
|---|---|
| Notifications | The daily reminder. You can turn it off in Settings. |

## The web app

The web app keeps the same things as the Android app, in the browser's storage for the
site on that device (IndexedDB), plus a cached copy of the app (a service worker). Clearing
the site's data deletes them.

Apart from the reminder below, nothing is sent anywhere. The pages are served by GitHub Pages, so loading or updating the
app is a request to GitHub, which sees your IP address as any website host does (GitHub's
privacy statement covers it). The app makes no other requests, and its Content Security
Policy stops it contacting any other site except the reminder server, and only once you turn
the reminder on.

Copy prompt only writes to the clipboard, and the app never reads the clipboard. There are
no cookies and no analytics.

### Daily reminder on the web

When you turn the reminder on, your browser creates a push subscription (an address at your
browser maker's push service: Apple, Google, Mozilla or Microsoft, plus two keys that
encrypt messages to it), and the app sends it to the reminder server, a Cloudflare Worker,
with your time zone, your reminder time and the next day words are due. The server stores
those, the last day it sent a reminder, when you last asked for a test notification and
when the entry was last updated, never your words, their number, your answers or your
progress. Each message is encrypted and says only "reminder" or "test"; your device
writes the notification text. Turning the reminder off deletes the entry; so does the push
service reporting it gone, or 180 days without an update. The server keeps no logs.
Cloudflare sees your IP address as any host does
([Cloudflare's privacy policy](https://www.cloudflare.com/privacypolicy/)), and the push
service delivers the message under its own policy.

## Children

The app doesn't collect personal information from anyone, children included.

## Changes

Any change to this policy is made in this file, so its
[history on GitHub](https://github.com/DontPanic345/TortoiseSpelling/commits/main/PRIVACY.md)
shows what changed and when.

## Contact

Questions or concerns: open an issue at
<https://github.com/DontPanic345/TortoiseSpelling/issues>.

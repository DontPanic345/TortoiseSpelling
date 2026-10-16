# Privacy policy

Tortoise Spelling has no accounts, no ads, no analytics and no tracking. Your word list
stays on your phone. The app has no Internet permission, so it can't send anything
anywhere itself. Your words leave your phone only when you choose: when you paste a prompt
into a chat app, export a backup, or turn on Google backup. The web app is covered in
[its own section](#the-web-app).

## What the app keeps, and where

Everything is stored in the app's private storage on your device:

- your words, their definitions, word forms and example sentences;
- when each word is next due, and a log of your reviews (what you typed and whether it
  was right);
- your settings: the reminder time, new words per day, and the days that count towards
  your streak.

The developer has no server and never receives any of it.

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

## Notifications

The daily reminder is scheduled on your phone and posted by your phone. There's no
push service or server involved.

## Permissions

| Permission | Why |
|---|---|
| Notifications | The daily reminder. You can turn it off in Settings. |

## The web app

The web app keeps the same things as the Android app, in the browser's storage for the
site on that device (IndexedDB), plus a cached copy of the app (a service worker). Clearing
the site's data deletes them.

Nothing is sent anywhere. The pages are served by GitHub Pages, so loading or updating the
app is a request to GitHub, which sees your IP address as any website host does (GitHub's
privacy statement covers it). The app makes no other requests, and its Content Security
Policy stops it contacting any other site.

Copy prompt only writes to the clipboard, and the app never reads the clipboard. There are
no cookies and no analytics.

## Children

The app doesn't collect personal information from anyone, children included.

## Changes

Any change to this policy is made in this file, so its
[history on GitHub](https://github.com/DontPanic345/TortoiseSpelling/commits/main/PRIVACY.md)
shows what changed and when.

## Contact

Questions or concerns: open an issue at
<https://github.com/DontPanic345/TortoiseSpelling/issues>.

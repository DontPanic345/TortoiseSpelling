# Privacy policy

Tortoise Spelling has no accounts, no ads, no analytics and no tracking. Your word list
stays on your phone. Nothing leaves it except what you choose to paste into a chat app,
and "Keep this card fresh" if you add your own Anthropic API key.

## What the app keeps, and where

Everything is stored in the app's private storage on your device:

- your words, their definitions, word forms and example sentences;
- when each word is next due, and a log of your reviews (what you typed and whether it
  was right);
- your settings: the reminder time, new words per day, and the days that count towards
  your streak;
- your Anthropic API key, if you enter one. It's encrypted with a key held in Android's
  Keystore, which never leaves the device.

The developer has no server and never receives any of it.

## What leaves your device

**Word lookup.** **Copy prompt** only copies text to your clipboard. What you paste into
a chat app is between you and that service; the app never sees it or the answer until you
paste the answer back into the app.

**Keep this card fresh, only if you use it.** With your own Anthropic API key and the
option switched on for a word, the app sends the word with its current definition and
example to Anthropic's API (`api.anthropic.com`), with your API key. **Test key** sends
the word "Hi". The app also asks the API which models are available, so it can pick the
cheapest one. Nothing else from your word list is sent.
These requests go straight from your phone to Anthropic under your own account, so
[Anthropic's privacy policy](https://www.anthropic.com/legal/privacy) covers them. The
developer can't see them.

**Android's own backup.** Off by default. **Back up to Google account** in Settings →
Backup opts in to Android including your words, their scheduling and your other settings
in your device's backup to your Google account, so they can be restored after a factory
reset or on a new phone; it's between you and Google, the developer never sees it. Your
API key never comes back this way, because its encryption key stays behind on the old
device, so you'd enter it again. Moving to a new phone directly (Android's own
device-to-device transfer, over USB or Wi-Fi, with no Google server involved) always
carries your words and settings across, whether or not this switch is on.

**Backups you export.** **Export** in Settings writes your words and progress to a file
wherever you choose. It doesn't include your API key.

## Notifications

The daily reminder is scheduled on your phone and posted by your phone. There's no
push service or server involved.

## Permissions

| Permission | Why |
|---|---|
| Internet | Keep this card fresh, with your own Anthropic key. |
| Notifications | The daily reminder. You can turn it off in Settings. |

## Children

The app doesn't collect personal information from anyone, children included.

## Changes

Any change to this policy is made in this file, so its
[history on GitHub](https://github.com/DontPanic345/TortoiseSpelling/commits/main/PRIVACY.md)
shows what changed and when.

## Contact

Questions or concerns: open an issue at
<https://github.com/DontPanic345/TortoiseSpelling/issues>.

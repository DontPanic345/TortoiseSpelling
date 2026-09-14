# Privacy policy

Tortoise Spelling has no accounts, no ads, no analytics and no tracking. Your word list
stays on your phone. The only time anything leaves it is when you ask Claude to look up
a word, using your own Anthropic API key.

## What the app keeps, and where

Everything is stored in the app's private storage on your device:

- your words, their definitions and example sentences;
- when each word is next due, and a log of your reviews (what you typed and whether it
  was right);
- your settings: the reminder time, new words per day, and the days that count towards
  your streak;
- your Anthropic API key, if you enter one. It's encrypted with a key held in Android's
  Keystore, which never leaves the device.

The developer has no server and never receives any of it.

## What leaves your device

**Word lookup, only if you use it.** When you tap **Look up with Claude**, the app sends
the word you typed to Anthropic's API (`api.anthropic.com`), with your API key. **Test
key** sends the word "Hi". The app also asks the API which models are available, so
it can pick the cheapest one. Nothing else from your word list is sent.
These requests go straight from your phone to Anthropic under your own account, so
[Anthropic's privacy policy](https://www.anthropic.com/legal/privacy) covers them. The
developer can't see them.

**Android's own backup.** If backup is turned on for your device, Android may include
the app's data in your backup to your Google account. The app takes no part in this;
it's between you and Google. Your API key can't be read after a restore, because its
encryption key stays behind on the old device, so you'd enter it again.

**Backups you export.** **Export** in Settings writes your words and progress to a file
wherever you choose. It doesn't include your API key.

## Notifications

The daily reminder is scheduled on your phone and posted by your phone. There's no
push service or server involved.

## Permissions

| Permission | Why |
|---|---|
| Internet | Word lookup with Claude. The rest of the app works offline. |
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

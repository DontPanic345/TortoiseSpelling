# Spike: Jogging in the cloud with a real phone

Can a claude.ai cloud session build the APK and run the e2e suite on the spare phone at
home? If it can, Jogging moves from Task Scheduler to a Cloud Routine running four times a
day, and the PC no longer has to be awake.

## Alan's setup

1. **Phone.** Enable Developer options and USB debugging. Set *Stay awake* on, keep it on
   charge and on home Wi-Fi, and turn off automatic system updates so it doesn't reboot
   overnight. Use a phone with no data you care about: every scenario wipes the app.
2. **Fixed ADB port.** Plug the phone into this PC and run `adb tcpip 5555`. This lasts
   until the phone reboots; after a reboot, repeat it.
3. **Tailscale.** Install Tailscale on the phone and sign in. In the admin console,
   create a reusable, ephemeral auth key tagged `tag:jogging`, and an ACL letting that
   tag reach the phone on port 5555.
4. **ADB key.** Copy this PC's `~/.android/adbkey` and `adbkey.pub` into the routine's
   secrets so every cloud session presents a key the phone already trusts (it trusted
   this PC's key in step 2).
5. **Routine secrets:** `TAILSCALE_AUTHKEY`, `PHONE_ADDR` (the phone's Tailscale IP),
   `ADB_KEY`, `ADB_KEY_PUB`.

Then ask Claude, in an interactive session, to run the spike prompt below as a one-off
cloud routine with those secrets.

## Spike prompt

> In a fresh clone of TortoiseSpelling, find out whether this cloud environment can run
> the repo's checks against a real phone. Try, in order, and stop at the first failure:
> 1. Install JDK 17 and the Android command-line tools, then `./gradlew assembleDebug
>    testDebugUnitTest lintDebug`.
> 2. Start Tailscale in userspace mode with `TAILSCALE_AUTHKEY`, write `ADB_KEY` and
>    `ADB_KEY_PUB` to `~/.android/`, and `adb connect $PHONE_ADDR:5555`. `adb devices`
>    must show the phone as `device`.
> 3. `npm ci` in `e2e/`, then `npm run e2e -- --spec features/add_word.feature`.
> 4. `python` usage check: does `usage.py --json` work here, by either route?
>
> Write `jogging/spike-result.md` with each step's outcome, its wall time, and the exact
> commands that worked, then commit and push.

## Success

All four steps pass, and the setup steps and the time they take fit inside one session.
Then `jog.mjs` gets a cloud mode that runs the setup first, and the scheduled task is
replaced by a Cloud Routine pinned to the crew's model.

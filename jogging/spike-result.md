# Spike result (2026-10-12)

**Verdict: the cloud session can build, test and reach the phone over Tailscale + adb. The e2e step failed because the phone's screen was locked (keyguard "Bouncer"), not because of the link.**

## Environment variables
- Names visible **in the session**: ADB_KEY, ADB_KEY_PUB, TAILSCALE_AUTHKEY, PHONE_ADDR were all set.
- Not visible to the environment's setup script (per the note in `cloud-setup.sh`); the script is designed to exit 0 there and be re-run from the session. I did not observe the setup-script run itself, only that the variables were present in the session.
- Values were never printed or written.

## Steps

| # | Step | Result | Wall time |
|---|------|--------|-----------|
| 0 | `bash jogging/cloud-setup.sh` | PASS, exit 0; `adb devices` showed `127.0.0.1:15555 device` | 24 s |
| 1 | JDK 17 + Android SDK + `./gradlew assembleDebug testDebugUnitTest lintDebug` | PASS, no 429s | JDK 9 s, SDK 19 s, Gradle 331 s |
| 2 | Phone link | PASS: `getprop ro.product.model` = `SM-S911U1` (Galaxy S23), tailnet shows `galaxy-s23` | 2 s |
| 3 | E2E `features/add_word.feature` | **FAIL** at first step | `npm ci` 20 s, e2e 380 s |
| 4 | `usage.py --json` | Not reached (stopped at step 3); checked anyway, see below | - |

### Step 3 detail
The APK installed on the phone and Appium drove it (session created), but `Given I have no words yet`
failed: `"No words yet"` not displayed. Cause: `dumpsys window` shows `mCurrentFocus=Window{... Bouncer}`,
`isKeyguardShowing=true`, so the phone is on the lock screen. Fix on the phone: set the screen lock to None
(Settings > Lock screen > None) and keep *Stay awake* on. The unlock cannot be done from here without a PIN.
The e2e run also took ~6 min before failing, mostly Appium/UiAutomator2 startup and the retry timeouts; a
passing run will need a longer budget than the 30 s steps imply.

### Step 4 (informational)
`usage.py` is not in the repo; `jog.mjs` expects `$CLAUDE_CONFIG_DIR/skills/usage-check/usage.py`.
In this session `CLAUDE_CONFIG_DIR` is unset, there is no `usage-check` skill, no `usage.py` anywhere on disk,
and no `~/.claude/.credentials.json`. So neither route works as-is: the script would have to be shipped
(into the repo or an env secret) and given Claude credentials.

## Commands that worked
```bash
bash jogging/cloud-setup.sh
apt-get install -y openjdk-17-jdk-headless
# Android cmdline tools (commandlinetools-linux-11076708_latest.zip) unpacked to /opt/android-sdk/cmdline-tools/latest
yes | sdkmanager --sdk_root=/opt/android-sdk --licenses
sdkmanager --sdk_root=/opt/android-sdk "platforms;android-37.0" "build-tools;36.0.0" "platform-tools"
echo "sdk.dir=/opt/android-sdk" > local.properties          # git-ignored
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ANDROID_HOME=/opt/android-sdk
./gradlew assembleDebug testDebugUnitTest lintDebug
tailscale --socket=/tmp/ts.sock status; adb devices
timeout 30 adb -s 127.0.0.1:15555 shell getprop ro.product.model
cd e2e && npm ci
ANDROID_SERIAL=127.0.0.1:15555 npm run e2e -- --spec features/add_word.feature   # fails: phone locked
```

## Notes
- The JDK/SDK install (~30 s) and Gradle (~5.5 min) are not in `cloud-setup.sh`; add them if the routine should be self-contained. Total session time here was roughly 20 min.
- Tailscale keys are not ephemeral: the tailnet already lists `jogging-cloud`, `-1`, `-2`, `-3`, `-4` (the earlier ones offline). Each run adds a node; make the auth key ephemeral or remove stale nodes.

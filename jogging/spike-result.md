# Cloud spike result (2026-10-12)

Stopped at step 3 (E2E); step 4 not run, as instructed ("stop at first failure").

## Environment variables
- Visible to this **session**: ADB_KEY, ADB_KEY_PUB, TAILSCALE_AUTHKEY, PHONE_ADDR (all four set).
- Not visible to the environment's **setup script** (per the note in `cloud-setup.sh`; the script's own `env` step exits 0 early in that case). Not re-verified in this run, since the setup script's output isn't available to the session.

## Results
| Step | Outcome | Wall time |
|---|---|---|
| 0. `bash jogging/cloud-setup.sh` | PASS, exit 0. Tailscale up (userspace), socat bridge, `adb connect` ok, `127.0.0.1:15555 device` | ~30 s |
| 1. Build/test/lint | PASS. `assembleDebug testDebugUnitTest lintDebug` BUILD SUCCESSFUL on the first attempt (no 429). JDK 17 + cmdline-tools install took ~1 min on top | 6m 4s Gradle (~6m 6s incl. 429-retry loop) |
| 2. Phone link | PASS. Phone `galaxy-s23` active via relay "syd"; `adb devices` shows `device`; model `SM-S911U1`, answered in 0.7 s | <1 s |
| 3. E2E `add_word.feature` | **FAIL**. Appium session creation failed: `adb install -r --no-incremental .../appium-uiautomator2-server-v10.6.6.apk` timed out after 20000 ms (default `uiautomator2ServerInstallTimeout`), twice (~2 min) | 3m 48s (npm ci fast) |
| 4. `usage.py --json` | Not run | - |

## Commands that worked
```bash
bash jogging/cloud-setup.sh
apt-get install -y openjdk-17-jdk-headless
# Android cmdline-tools into /opt/android-sdk/cmdline-tools/latest
# (https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip)
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ANDROID_HOME=/opt/android-sdk
yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses
$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "platforms;android-37.0" "build-tools;36.0.0" "platform-tools"
./gradlew assembleDebug testDebugUnitTest lintDebug --console=plain
tailscale --socket=/tmp/ts.sock status
adb devices
timeout 30 adb -s 127.0.0.1:15555 shell getprop ro.product.model
cd e2e && npm ci
```

## Failing command
```bash
cd e2e && ANDROID_SERIAL=127.0.0.1:15555 npm run e2e -- --spec features/add_word.feature
```

## Notes on the E2E failure (hypotheses, not verified)
- A ~5 MB APK push through tailscale userspace nc + socat may be too slow for the 20 s limit.
- Or the phone is showing an on-device install confirmation (Samsung/"Install via USB" prompt) that nobody can tap.
- Next to try: set `appium:uiautomator2ServerInstallTimeout` (and `adbExecTimeout`) higher in `e2e/wdio.conf.ts`, and time a plain `adb install` of the same APK; check the phone for an install prompt.

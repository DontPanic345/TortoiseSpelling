# Cloud spike result (2026-10-12)

Verdict: the cloud session reaches the real phone (Galaxy S23, `SM-S911U1`) and builds the app. The E2E run failed at Appium session creation (step 3), so step 4 was not attempted.

## Environment variables

| Name | Visible in this session |
|---|---|
| ADB_KEY | set |
| ADB_KEY_PUB | set |
| TAILSCALE_AUTHKEY | set |
| PHONE_ADDR | set |

I could not confirm whether the environment's setup script saw them. The runner reports only the exit code and left no `SKIPPED` output. `cloud-setup.sh` assumes they were not visible there and exits 0 so the session still starts. Values are never printed.

## Steps

| Step | Result | Wall time |
|---|---|---|
| 0. `bash jogging/cloud-setup.sh` | exit 0. `adb connect 127.0.0.1:15555` worked and the phone showed as `device`. | 28 s |
| 1. Build and test | `./gradlew assembleDebug testDebugUnitTest lintDebug` gave BUILD SUCCESSFUL on the first try, with no 429s. | 340 s for Gradle; about 30 s to install JDK 17 and the SDK |
| 2. Phone link | `tailscale status` listed `galaxy-s23` as idle. `adb devices` showed `127.0.0.1:15555 device`. `getprop ro.product.model` returned `SM-S911U1`. | 2 s |
| 3. E2E `add_word.feature` | **FAILED**: `npm ci` took 21 s. Then `WebDriverError: Request timed out` on `POST /session` (wdio `connectionRetryTimeout`, 3 min, two attempts). | 6 min 5 s |
| 4. `usage.py --json` | Not attempted (stopped at the step 3 failure). | n/a |

## Step 3 diagnosis (`e2e/logs/wdio-appium.log`)

- Appium did reach the phone and installed `app-debug.apk`, but that install alone took **163 s** over Tailscale and the socat bridge.
- The UiAutomator2 server install and instrumentation start came after that. The server's `/status` on :8200 gave `socket hang up`.
- The 180 s `connectionRetryTimeout` in wdio expired before the session came up. The Appium defaults and the `appium:*Timeout` caps in `wdio.conf.ts` are not the limit; the wdio request timeout is.
- Likely fix: raise `connectionRetryTimeout` in `e2e/wdio.conf.ts` to about 600 s. Then re-run once, since the Appium helper APKs are now on the phone and should not need reinstalling. I did not try this because the task says to stop at the first failure.
- If the install stays slow, consider `appium:noReset`, or skipping `enforceAppInstall`, so the debug APK isn't pushed every run.

## Commands that worked

```bash
bash jogging/cloud-setup.sh      # phone appears at 127.0.0.1:15555

# JDK 17 and the Android SDK
apt-get install -y openjdk-17-jdk-headless
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ANDROID_HOME=/opt/android-sdk
mkdir -p $ANDROID_HOME/cmdline-tools
# unzip commandlinetools-linux-11076708_latest.zip (dl.google.com/android/repository) into cmdline-tools/latest
yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses
$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "platforms;android-37.0" "build-tools;36.0.0" "platform-tools"
echo "sdk.dir=$ANDROID_HOME" > local.properties   # gitignored
export PATH=$JAVA_HOME/bin:$PATH
./gradlew assembleDebug testDebugUnitTest lintDebug

tailscale --socket=/tmp/ts.sock status
adb devices
timeout 30 adb -s 127.0.0.1:15555 shell getprop ro.product.model

cd e2e && npm ci
ANDROID_SERIAL=127.0.0.1:15555 npm run e2e -- --spec features/add_word.feature   # failed, see above
```

The image's default JDK is 21; JDK 17 is not preinstalled. `ANDROID_HOME` is unset by default.

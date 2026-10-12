# Cloud spike result (2026-10-12)

Stopped at step 3, the first failure. Step 4 was not attempted.

## Environment variables
- Set in this session: `ADB_KEY`, `ADB_KEY_PUB`, `TAILSCALE_AUTHKEY`, `PHONE_ADDR` (names only; values not recorded).
- The environment's setup script did not see them. `cloud-setup.sh` is built for that case: it exits 0 when they are missing, and you re-run it from the session, which worked.

## Results
| Step | Outcome | Wall time |
|---|---|---|
| 0 Setup (`bash jogging/cloud-setup.sh`) | PASS, exit 0. Tailscale up, phone bridged, `adb connect 127.0.0.1:5555` connected | ~26 s |
| 1 Build and test | PASS on the 3rd attempt, after two 429s (below) | ~1m24s for the passing run (first two attempts failed after 42 s and 1m32s) |
| 2 Phone link | PASS. `tailscale status` shows `galaxy-s23` active (relay syd). `adb devices` shows `127.0.0.1:5555 device` | seconds |
| 3 E2E (`add_word.feature`) | FAIL. Appium could not create a session. | `npm ci` 18 s, e2e 4m40s |
| 4 Usage check (`usage.py --json`) | NOT ATTEMPTED | n/a |

## Step 1 notes
- This container had no JDK 17 and no Android SDK; JDK 21 was the only JDK. The `sdkmanager` run needed a manual install.
- Commands that worked:
  ```
  apt-get install -y openjdk-17-jdk-headless
  curl -fsSLo c.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
  # unzip to /opt/android-sdk/cmdline-tools/latest
  yes | sdkmanager --licenses
  sdkmanager "platforms;android-37.0" "platforms;android-36" "build-tools;36.0.0" "platform-tools"
  echo "sdk.dir=/opt/android-sdk" > local.properties    # gitignored
  export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ANDROID_HOME=/opt/android-sdk
  ./gradlew assembleDebug testDebugUnitTest lintDebug
  ```
- `compileSdk` is 37, but sdkmanager has no `platforms;android-37`; the id is `android-37.0`.
- repo.maven.apache.org answered 429 (Too Many Requests) through the proxy on the first two cold-cache runs, for different artifacts. Plain `curl` to the same host returned 200. The third run reused the cache and passed. Expect the first build in a fresh container to need re-runs, or a pre-warmed Gradle cache.

## Step 3 failure
- `ANDROID_SERIAL=127.0.0.1:5555 npm run e2e -- --spec features/add_word.feature` failed with: `Error getting device API level ... adb -s 127.0.0.1:5555 shell getprop ro.build.version.sdk timed out after 20000ms`.
- Afterwards `adb -s 127.0.0.1:5555 shell getprop ...` hung for 30 s, while `adb devices` still listed it as `device`. The adb transport was connected but shell traffic stalled.
- `adb devices` also lists a second device, `emulator-5554`. It is the same phone model (SM-S911U1). adb auto-detects the socat listener on port 5555 as an emulator (ports 5554/5555 pair). `adb -s emulator-5554 shell echo hi` worked immediately, with `rc=0`.
- Not tried, because the task says to stop at the first failure: re-running e2e with `ANDROID_SERIAL=emulator-5554`. The two serials are probably competing connections over the single socat/Tailscale hop. To avoid the clash, try `adb disconnect 127.0.0.1:5555`, or bridge on a port other than 5555 and 5554 (e.g. 5565), and re-run.
- `/tmp/socat.log` is empty. The tailscaled log shows only netcheck noise (UDP blocked, so the connection relays over DERP "syd"). That adds latency and may contribute to the shell timeouts.

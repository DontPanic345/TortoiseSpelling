# Spike result: Jogging in the cloud with a real phone

Run: 2026-10-12, cloud routine session. **Outcome: failed at step 2 (phone link). Steps 3 and 4 not attempted.**

## Environment variables
- Visible to this session: `ADB_KEY`, `ADB_KEY_PUB`, `TAILSCALE_AUTHKEY`, `PHONE_ADDR` were all set.
- Visible to the environment's setup script: no. `cloud-setup.sh` is written to skip (exit 0) when they are
  missing there, so it had to be re-run from the session (step 0). Values were never printed.

## Steps
| Step | Result | Wall time |
|---|---|---|
| 0. `bash jogging/cloud-setup.sh` | Exit 0. Keys written, adb, socat and Tailscale installed, node joined the tailnet as `jogging-cloud`, socat bridge up. But `adb connect` printed `failed to connect to 127.0.0.1:15555` and the script still exited 0 (`timeout ... adb connect` returns 0 on a refused connection), so the script's `die 41` never fires. `adb devices` showed `offline`. | 38 s |
| 1. Build and test | **Pass.** JDK 17 and the SDK were missing. `apt-get install openjdk-17-jdk-headless` (default was JDK 21); command-line tools downloaded and unzipped; `sdkmanager "platforms;android-37.0" "build-tools;36.0.0" "platform-tools"`. First Gradle try succeeded, no 429s. | JDK+SDK ~35 s, Gradle 7 m 1 s (422 s) |
| 2. Phone link | **Fail.** `tailscale status` lists the phone (`galaxy-s23`) as `offline, last seen 52m ago`. `adb devices` shows `127.0.0.1:15555 offline`; `adb shell getprop ro.product.model` returns `adb: device offline`. `/tmp/socat.log`: `Dial(<phone>, 5555): 502 Bad Gateway, dial failure: operation timed out`. `/tmp/tailscaled.log`: `derp-5 does not know about peer`, UDP blocked (DERP over HTTPS only). | ~1 min |
| 3. E2E | Not run (stopped at step 2). | - |
| 4. `usage.py --json` | Not run (stopped at step 2). | - |

## Commands that worked
```bash
bash jogging/cloud-setup.sh        # exits 0 but the phone stays offline, see above
apt-get install -y openjdk-17-jdk-headless
curl -fsSLo clt.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip clt.zip && mkdir -p /opt/android/cmdline-tools && mv cmdline-tools /opt/android/cmdline-tools/latest
yes | sdkmanager --licenses
sdkmanager "platforms;android-37.0" "build-tools;36.0.0" "platform-tools"
echo "sdk.dir=/opt/android" > local.properties       # gitignored
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ANDROID_HOME=/opt/android
./gradlew assembleDebug testDebugUnitTest lintDebug
```

## Findings
1. The cloud side works: tailnet join, adb, JDK/SDK install and the full Gradle build are fine (~8 min total).
2. The phone was unreachable: Tailscale on the phone had gone to sleep or lost Wi-Fi about 52 minutes before the run.
   Check that it is on charge, awake, on home Wi-Fi, and that Tailscale is not battery-restricted, then re-run.
   It is not yet known whether `adb tcpip 5555` is still active on the phone (it resets on reboot).
3. `cloud-setup.sh` should check that `adb devices` reports `device` after connecting, and exit 41 if it doesn't.
4. The default image has JDK 21 and no Android SDK, so the setup script should install JDK 17 and the SDK too.

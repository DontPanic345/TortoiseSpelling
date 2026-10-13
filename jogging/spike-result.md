# Spike result (2026-10-13)

**Verdict: stopped at step 2.** The cloud session reaches the phone over Tailscale, but the phone
refuses connections on port 5555, so ADB never comes up. Steps 3 and 4 were not run.

Env vars (names only): `ADB_KEY`, `ADB_KEY_PUB`, `TAILSCALE_AUTHKEY` and `PHONE_ADDR` were all
visible to this session. Whether the environment's setup script saw them is not known: it did not
run here, and `jogging/cloud-setup.sh` ran from this session, not from the setup script.

| Step | Result | Wall time |
|---|---|---|
| 0. `bash jogging/cloud-setup.sh` | exit 0, but its last line shows `failed to connect to 127.0.0.1:15555` and `adb devices` lists the phone as `offline`. The script reports success even when the connect fails. | 37 s |
| 1. Build and test | PASS: `BUILD SUCCESSFUL in 6m 34s` (55 tasks) | JDK 17 install 9 s, Android SDK 24 s, Gradle 395 s |
| 2. Phone link | FAIL | n/a |
| 3. E2E | not run | n/a |
| 4. `usage.py --json` | not run | n/a |

## Step 2 detail
- `tailscale --socket=/tmp/ts.sock status`: the phone (`galaxy-s23`) is **active**, relayed via Sydney DERP, so the tailnet link works.
- `/tmp/socat.log`, repeated on every retry: `Dial("<phone tailscale ip>", 5555): unexpected HTTP response: 502 Bad Gateway, dial failure: connect tcp <ip>:5555: connection was refused`.
- `adb devices` shows `127.0.0.1:15555 offline`, and `adb shell getprop` answers `device offline`.
- Cause: nothing is listening on the phone's port 5555. `adb tcpip 5555` lasts only until the phone reboots, so this is most likely a reboot since the last `adb tcpip 5555`. A Tailscale ACL block would give a timeout, not a refusal.
- Fix: plug the phone into the PC and run `adb tcpip 5555` again. A permanent fix needs wireless debugging or a boot-time script on the phone.

## Commands that worked
```bash
bash jogging/cloud-setup.sh                      # Tailscale, socat bridge and keys: OK (adb connect failed, see above)
apt-get install -y openjdk-17-jdk-headless unzip
# Android cmdline-tools (commandlinetools-linux-11076708_latest.zip from dl.google.com) -> /opt/android-sdk/cmdline-tools/latest
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ANDROID_HOME=/opt/android-sdk
yes | sdkmanager --licenses
sdkmanager "platforms;android-37.0" "build-tools;36.0.0" "platform-tools"
echo "sdk.dir=/opt/android-sdk" > local.properties
./gradlew assembleDebug testDebugUnitTest lintDebug --console=plain   # no 429s
```
The SDK downloads worked through the session's proxy.

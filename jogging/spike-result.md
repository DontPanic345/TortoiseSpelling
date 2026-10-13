# Cloud → real phone spike: result

Run in a fresh clone, in a scheduled cloud session (2026-10-13). Steps 0–3 passed. Step 4 could not be done: `usage.py` is not available here.

**Environment variables:** all four (`ADB_KEY`, `ADB_KEY_PUB`, `TAILSCALE_AUTHKEY`, `PHONE_ADDR`) were set and visible to this session. Whether the environment's setup script saw them can't be observed from here; `cloud-setup.sh` says it does not (it runs the gradle-mirror step and exits 0), so the session runs it itself. Values were never printed.

| Step | Result | Wall time |
|---|---|---|
| 0. `bash jogging/cloud-setup.sh` | PASS, exit 0. Tailscale up, socat bridge, `adb connect 127.0.0.1:15555` → `device` | 37 s |
| 1. Toolchain + `./gradlew assembleDebug testDebugUnitTest lintDebug` | PASS first try (no 429s) | JDK 17 + cmdline-tools ~22 s, SDK packages ~24 s, Gradle 9 m 44 s (585 s) |
| 2. Phone link | PASS. `galaxy-s23` (100.67.202.7) on the tailnet, `adb devices` → `device`, model `SM-S911U1` | 2 s |
| 3. E2E `add_word.feature` | PASS, 7 steps passing | `npm ci` 40 s; e2e 436 s (Appium session 1 m 18 s of that) |
| 4. `usage.py --json` | NOT POSSIBLE here. No `usage.py` and no `usage-check` skill exist in the repo, `~/.claude/skills` or anywhere on the filesystem. `jog.mjs` expects `$CLAUDE_CONFIG_DIR/skills/usage-check/usage.py` (and `CLAUDE_CONFIG_DIR` is unset here). It lives on the user's machine, not in a cloud clone. | – |

Total for steps 0–3: about 18 minutes.

Notes:
- An earlier run failed step 3 at `typeInto` ("Field did not show the typed text"). It was a Galaxy S23 quirk, fixed in 2f1393d: an element handle there keeps the text it had when found, so `typeInto` now looks the field up again on each poll.
- The e2e run is slow mostly because every Appium call crosses Tailscale userspace networking plus socat.
- Step 4: `jogging/usage.py` is now in the repo, as Hurdles does with `tools/usage.py`.

## Locked, unplugged phone
Rerun of `add_word.feature` with the phone unplugged and the screen locked (`mWakefulness=Dozing` beforehand): PASS, 7 steps, 269 s. adb over the Tailscale link stayed up, and the test woke the screen itself (`Awake` afterwards). Neither a locked screen nor being unplugged blocks the e2e run.

## Commands that worked
```bash
bash jogging/cloud-setup.sh
apt-get install -y openjdk-17-jdk-headless
curl -fsSLo cl.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
# unzip to /opt/android-sdk/cmdline-tools/latest
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ANDROID_HOME=/opt/android-sdk
yes | sdkmanager --licenses
sdkmanager "platforms;android-37.0" platform-tools "build-tools;36.0.0"
echo "sdk.dir=$ANDROID_HOME" > local.properties   # gitignored
./gradlew assembleDebug testDebugUnitTest lintDebug --console=plain
tailscale --socket=/tmp/ts.sock status; adb devices
timeout 30 adb -s 127.0.0.1:15555 shell getprop ro.product.model
cd e2e && npm ci && ANDROID_SERIAL=127.0.0.1:15555 npm run e2e -- --spec features/add_word.feature
```

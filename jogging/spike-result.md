# Cloud → real phone spike: result

Run in a fresh clone, in a scheduled cloud session. Stopped at step 3 (first failure), so step 4 was not run.

**Environment variables:** all four (`ADB_KEY`, `ADB_KEY_PUB`, `TAILSCALE_AUTHKEY`, `PHONE_ADDR`) were visible to this session. Whether the environment's setup script saw them could not be observed from here (the script's own comment says it does not; it only runs the gradle-mirror step and exits 0). Values were never printed.

| Step | Result | Wall time |
|---|---|---|
| 0. `bash jogging/cloud-setup.sh` | PASS, exit 0. Tailscale up, socat bridge, `adb connect 127.0.0.1:15555` → `device` | 29 s |
| 1. Toolchain + `./gradlew assembleDebug testDebugUnitTest lintDebug` | PASS first try (no 429s) | ~13 s SDK + JDK/cmdline-tools install ~30 s; Gradle 6 min |
| 2. Phone link | PASS. `galaxy-s23` (100.67.202.7) on tailnet, model `SM-S911U1` | 2 s |
| 3. E2E `add_word.feature` | **FAIL** — device reached, APK installed, session started; step 2 failed | `npm ci` 21 s; e2e 415 s |
| 4. `usage.py --json` | NOT RUN (stopped at step 3) | – |

## Step 3 failure
Scenario "Adding a word by hand": `Given I have no words yet` passed (seeding via `SeedWordsActivity` works), then
`When I add the word "necessary" defined as "needed or required"` failed in `e2e/support/actions.ts:28`
(`typeInto`): `Field did not show the typed text before continuing`. So `setValue` did not produce text whose
length matches the input. The phone's IME is Samsung Honeyboard (`com.samsung.android.honeyboard`);
this was first suspected to be the keyboard, but see the retry below: it is not. The run took ~7 min mostly due to the wait timeouts, so the link is slow-ish but works.

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
cd e2e && ANDROID_SERIAL=127.0.0.1:15555 npm ci && ANDROID_SERIAL=127.0.0.1:15555 npm run e2e -- --spec features/add_word.feature
```

## Retry with a different keyboard
Switched the phone's IME from Samsung Honeyboard to Appium's `io.appium.settings/.EmptyIME` (the only other
non-voice IME installed; no Gboard) and re-ran the same spec: same failure at the same step (254 s).
The e2e config already runs the session with an invisible keyboard (`appium:hideKeyboard`), so the keyboard was
never the cause. Honeyboard was restored afterwards. Remaining suspects: Compose's set-text action not reflecting
via `getText()` on this device/Android version, or the add-word field's tag/element not being the focused text node.
Next step would be to dump the UI hierarchy (`adb exec-out uiautomator dump`) on the Add Word screen.

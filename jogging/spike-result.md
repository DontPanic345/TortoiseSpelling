# Cloud spike result (2026-10-12)

Stopped at **step 1** (first failure). Steps 2-4 were not run.

## Environment variables
- Visible to this **session**: ADB_KEY, ADB_KEY_PUB, TAILSCALE_AUTHKEY, PHONE_ADDR (all set; values never printed).
- Not visible to the environment's **setup script** (that is why `cloud-setup.sh` has its "SKIPPED ... run from the session" path); they only appear in the session, so setup has to be run from the session.

## Step 0: setup - PASS (24 s)
`bash jogging/cloud-setup.sh` exited 0. Tailscale came up in userspace mode, socat bridged the phone, and
`adb devices` listed `127.0.0.1:15555  device`.
Note: the script bridges on **15555**, not 5555 (commit 2c14889), so use `127.0.0.1:15555` in later steps and in the task prompt.

## Step 1: build and test - FAIL
- JDK 17 and the Android command-line tools were missing. The image has JDK 21 and no SDK. Installing them worked (about 60 s):
  - `apt-get install -y openjdk-17-jdk-headless`
  - download `commandlinetools-linux-11076708_latest.zip` from dl.google.com into `/opt/android/cmdline-tools/latest`, then `yes | sdkmanager --licenses`
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ANDROID_HOME=/opt/android ./gradlew assembleDebug testDebugUnitTest lintDebug`
  failed during configuration after 47 s, and again on one retry after 5 s.
- Cause: **Maven Central (repo.maven.apache.org) returns HTTP 429 Too Many Requests** through the agent proxy, on every request
  (the same for plain `curl`). Google Maven (dl.google.com/dl/android/maven2) returns 200. Gradle cannot resolve the buildscript
  dependencies (kotlinx-coroutines, jimfs, annotations, ...: 49 failures).
- Not a TLS or truststore problem; the proxy status shows no relay failures.
- Possible fixes: allow or un-throttle repo.maven.apache.org in the environment's network policy, or point Gradle at a mirror
  (for example a pre-warmed `~/.gradle` cache, or a mirror repo in `settings.gradle`).

## Steps 2-4: not run
Step 2 would likely pass: the phone link was already up at the end of step 0.

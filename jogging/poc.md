# Jogging PoC

## Runner check

Run on 2026-10-16 from the GitHub Actions runner, in order. Times are wall-clock from the shell.

| # | Command | Result | Time |
|---|---|---|---|
| 1 | `adb devices` | one device, `emulator-5554` | <1 s |
| 1 | `adb shell getprop ro.build.version.release` | `14` (Android 14) | <1 s |
| 2 | `./gradlew testDebugUnitTest --tests '*DaysTest'` | BUILD SUCCESSFUL | 32 s |
| 3 | `./gradlew assembleDebug` | BUILD SUCCESSFUL, `app-debug.apk` produced | 68 s |
| 4 | `npm run e2e -- --spec features/settings.feature` (from `e2e/`) | 6 passing, 1 spec file passed | 28 s |

Total for the four commands: about 2 min 8 s.

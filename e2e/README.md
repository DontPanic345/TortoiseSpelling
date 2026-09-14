# 🧪 End-to-end tests

Behaviour-driven tests for Tortoise Spelling: Gherkin features in [`features/`](features/),
run against the real APK on an Android emulator by **WebdriverIO + Cucumber**, driving
the app through **Appium's UiAutomator2** driver.

Why not Playwright: its Android support only automates Chrome and WebViews, and this is
a native Jetpack Compose app. Appium is the closest equivalent that can tap Compose
widgets, answer the system permission dialog and read notifications.

> ⚠️ **Never point this at a phone with real data.** Every scenario wipes the app's data,
> and some scenarios uninstall it.

## Setup

Requirements: Node 20.19+ or 22.12+, the Android SDK with an emulator (developed against
API 37; API 33+ needed for the notification-permission scenarios), and a JDK. `ANDROID_HOME`
and `JAVA_HOME` default to Android Studio's install locations; set them to override.

```bash
npm install
```

Build the APK under test from the repo root (rebuild after any app change — each feature
file reinstalls whatever build is there):

```bash
./gradlew assembleDebug
```

Start an emulator (Android Studio's Device Manager, or `emulator -avd <name>`) so that
`adb devices` lists exactly one device.

## Running

| Command | What it does |
|---|---|
| `npm run e2e` | Every scenario not tagged `@todo`, `@live-api` or `@slow` |
| `npm run e2e -- --spec features/add_word.feature` | One feature file |
| `npm run e2e -- --cucumberOpts.tags="@network"` | Scenarios matching a tag expression |
| `npm run e2e:slow` | The multi-minute `@slow` scenarios |
| `npm run check-steps` | Device-free check that every step of the default run is defined (~1 s) |
| `npm run check-steps -- --all` | The same over every scenario, `@todo` included |
| `npm run typecheck` | TypeScript check |

To test a release (R8-minified) build instead, sign one with the debug key and point `APK`
at it; R8 bugs only show up there:

```bash
RELEASE_KEYSTORE_PATH=~/.android/debug.keystore RELEASE_KEYSTORE_PASSWORD=android RELEASE_KEY_ALIAS=androiddebugkey RELEASE_KEY_PASSWORD=android ./gradlew assembleRelease
```

```bash
APK=../app/build/outputs/apk/release/app-release.apk npm run e2e
```

### Tags

| Tag | Meaning |
|---|---|
| `@todo` | Steps not implemented yet; excluded until they are |
| `@live-api` | Types a real Anthropic key into the app's Settings. For a human to run, with `TORTOISESPELLING_ANTHROPIC_KEY` set |
| `@slow` | Waits minutes for something real, e.g. a scheduled reminder |
| `@network` | Needs internet (uses only a deliberately fake key) |

## How it's put together

| Path | Holds |
|---|---|
| `features/` | One `.feature` per area of behaviour |
| `step-definitions/` | Steps, grouped by the screen or area they drive |
| `support/app.ts` | App lifecycle: `resetApp()` per scenario, `freshInstall()` for first-run behaviour |
| `support/hooks.ts` | Before: reset. After a failure: page source and screenshot into `logs/` |
| `support/screens/` | One object per screen: its elements and the actions on it |
| `support/selectors.ts` | `byText`, `byDescription`, `byTestId`, `scrollToText` (all UiSelector) |
| `support/testIds.ts` | Mirror of the app's [`TestTags.kt`](../app/src/main/java/com/falloon/tortoisespelling/ui/TestTags.kt) |
| `scripts/checkSteps.ts` | The `check-steps` dry run |

Each feature file gets a fresh Appium session with the APK reinstalled. Each scenario
starts with the app's data wiped, notifications pre-allowed, and the app on Home.

### Finding elements

Prefer visible text (`byText`), so steps stay close to what the user sees. When text is
ambiguous or changes, add a Compose `testTag`: the app sets `testTagsAsResourceId`, so the
tag reaches UiAutomator as the node's resource-id, verbatim. Tags live in `TestTags.kt`
and are mirrored in `support/testIds.ts`; change both together.

### Gotchas learned the hard way

- **Don't add `appium:noReset`.** The driver lets it override `enforceAppInstall`, and an
  older build already on the device silently becomes the one under test.
- **Don't call `driver.hideKeyboard()`.** It falls back to pressing BACK, which leaves the
  screen. The session runs with `appium:hideKeyboard` (an invisible keyboard) instead, so
  nothing can cover a button and a plain `click()` is enough.
- **A Compose button's label is a separate, always-enabled `TextView`.** Clicking the text
  works, but to check enabled/disabled, tag the button itself.
- **An empty text field's text is `''`.** The label is its own `TextView` node.
- **Dialogs and dropdown menus are separate windows.** Text lookups work there, but test
  tags only become resource-ids if the dialog's content sets `testTagsAsResourceId` too.
- **Killing the app for a background test:** use `am kill` via `mobile: shell`, never
  `terminateApp` — that force-stops the app, which also cancels its scheduled reminders.
- **Failures:** read `logs/<scenario>.xml` (the screen as text); the `.png` beside it is for
  humans. The Appium server log is `logs/wdio-appium.log`.
- **`clearValue()` and `setValue()` both return before Compose's recomposition catches up.**
  Typing immediately after `clearValue()` can land on the stale value (renaming "rhythm" to
  "necessary" this way once produced "rhythmnecessary"), and clicking a button whose enabled
  state derives from the field (e.g. Save) immediately after `setValue()` can click while it
  is still disabled from the pre-edit state. `support/actions.ts`'s `typeInto()` waits for
  the field to read back empty, then waits for it to read back the typed length, closing both
  races. Length, not exact text: a masked field (`PasswordVisualTransformation`, e.g. the
  Settings API key) reports a run of bullet characters, never the literal string.
- **Click the row, not the word.** A small text node's tap bounds can be stale for a moment
  after a list appears; the whole row (tagged, e.g. `TestTags.wordRow(normalizedText)`) is a
  much safer target, and lets per-row icons be scoped independently of it
  (`byTestIdWithDescendantDescription`).
- **`home.goBack()` needs to tolerate a cold start.** Right after a fresh app (re)launch,
  Home's title may not have rendered yet; an instant `isDisplayed()` check can send Back
  before it does, potentially exiting the app entirely. Poll with `waitForDisplayed({timeout})`
  per attempt, and fall back to `driver.activateApp(APP_ID)` if repeated Back presses still
  don't reveal Home (recovers from having backed out to the launcher).
- **`mobile: shell` with `command: 'sh', args: ['-c', '...']` does not reliably expand a glob**
  on this emulator: a standalone script confirmed `rm -f /sdcard/Download/e2e-* || true` sent
  that way deletes nothing, silently, while the identical pattern sent as `command: 'rm', args:
  ['-f', '/sdcard/Download/e2e-*']` (no inner shell) does. Skip the `sh -c` wrapper; the
  device's own implicit remote shell still expands the glob, and `-f` already makes a
  no-match a no-op rather than an error, so no `|| true` is needed either.
- **A raw filesystem delete doesn't update MediaStore.** `rm` on a file it indexed (e.g.
  anything under Downloads) leaves a ghost entry in DocumentsUI's listing; left unscanned,
  the Storage Access Framework then avoids that illusory name clash by saving the next export
  as `e2e-backup (2).json` instead of the exact name asked for. Media-scan after deleting, not
  only after pushing a file.
- **DocumentsUI's picker can occasionally treat a tap on a file as a multi-select** instead of
  opening it directly — the row turns "selected" and an action bar with a `Select` button
  appears instead of the picker closing. Tapping `Select` completes the same pick; check for
  it after the tap rather than assuming the picker always closes on the first click.
- **Typed text is logged unless redacted.** The Appium server log records every
  `setValue`, once as text and again split into single characters.
  [`appium-log-filters.json`](appium-log-filters.json) (wired in via `logFilters` in
  `wdio.conf.ts`) redacts Anthropic keys and every per-character copy; the `@live-api` step
  also passes `{ mask: true }` to keep the key out of WebdriverIO's own logs. Keep both if
  you touch that step, and never put a real secret in a step's text: step text is printed.
- **Never press Back while a system dialog is in front.** UiAutomator only sees the front
  window, so the notification-permission prompt (which opens over Home) makes Home's title
  look absent, and a "Back until Home" loop dismisses the prompt, which Android records as
  a *refusal*. It looks exactly like "the dialog never appeared": `dumpsys` shows
  `granted=false`, and the failure comes and goes with the race between Home rendering and
  the prompt opening. `home.goBack()` checks `driver.getCurrentPackage()` for the permission
  controller and stops there. A clean reinstall does reset the permission (no `USER_SET`
  flag), so `freshInstall()` needs no extra revoke.
- **After an `adb reboot`, Appium's own helper apps can come up crashed** (`io.appium.settings`,
  `io.appium.uiautomator2.server`, `io.appium.uiautomator2.server.test`), failing the next
  session with `Appium Settings app is not running` or `instrumentation process is not
  running`. `adb uninstall` all three; Appium reinstalls fresh copies on the next session.

## Writing scenarios

- Write in the user's voice, about behaviour ("I am told…", "Home shows…"), not widgets.
- **Given** arranges and waits until it is true; **When** acts and does not assert; **Then**
  asserts. `I have added the word …` (Given) waits for the save to succeed; `I add the word …`
  (When) leaves the outcome to the Then steps.
- Reuse existing steps before adding new ones: `npm run check-steps -- --all` prints a
  snippet for anything undefined.
- Keep scenarios independent; never rely on another scenario's leftovers.

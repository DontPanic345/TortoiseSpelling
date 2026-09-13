# 🧪 End-to-end tests

Behaviour-driven tests for TortoiseSpelling: Gherkin features in [`features/`](features/),
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

## Writing scenarios

- Write in the user's voice, about behaviour ("I am told…", "Home shows…"), not widgets.
- **Given** arranges and waits until it is true; **When** acts and does not assert; **Then**
  asserts. `I have added the word …` (Given) waits for the save to succeed; `I add the word …`
  (When) leaves the outcome to the Then steps.
- Reuse existing steps before adding new ones: `npm run check-steps -- --all` prints a
  snippet for anything undefined.
- Keep scenarios independent; never rely on another scenario's leftovers.

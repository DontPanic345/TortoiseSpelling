# Handoff: implement and run the remaining e2e scenarios

**Delete this file when the work is done**; fold anything durable into [`README.md`](README.md).

Read [`README.md`](README.md) first; it explains the harness, the commands, and the gotchas.
Then read the one fully implemented example: [`features/add_word.feature`](features/add_word.feature),
[`step-definitions/`](step-definitions/) and [`support/`](support/). Match its patterns.

## Goal

Every scenario in `features/` is written, but only `add_word.feature` has step
definitions. For every other feature:

1. Implement the missing step definitions (`npm run check-steps -- --all` lists them, with
   snippets; there were 188 undefined steps at handoff).
2. Remove the `@todo` tag once its scenarios pass. Move the tag from the feature to the
   individual scenarios still left if you finish a feature partially.
3. Run it on the emulator until it passes reliably.

Then run everything (see **Final run** below) and report.

## Rules

1. **Don't change app behaviour.** The only app changes allowed are test tags: add
   constants to `TestTags.kt`, mirror them in `support/testIds.ts`, add `Modifier.testTag(...)`
   (and `Modifier.semantics { testTagsAsResourceId = true }` inside dialog/popup content
   where needed). Rebuild with `./gradlew assembleDebug` from the repo root after any app change.
2. **A failing scenario may be a real app bug.** Don't bend the scenario or the steps to
   hide it, and don't fix the app. Leave that scenario tagged `@todo @bug`, and report it
   with evidence: steps, expected vs actual, the relevant lines of `logs/<scenario>.xml`.
   Change a feature's wording only if it is wrong about intended behaviour, and report
   each change with the reason.
3. **The API key.** A valid Anthropic key is in the gitignored `apikey` file at the repo
   root. Never print it, `cat` it, `Read` it, or copy it anywhere; only pass it through an
   environment variable as shown in **Final run**. **Never run `@live-api` scenarios**:
   they type the key into the app's Settings field. Implement their steps and confirm them
   with `npm run check-steps -- --all` only. The user runs those themselves.
4. **No screenshots in your context.** Don't `Read` the `.png` files in `logs/`; use the
   `.xml` page source (grep it for `text=`, `resource-id=`, `content-desc=`, `enabled=`,
   `checked=`).
5. **Don't commit, push, or tag.** Leave everything in the working tree for review.
6. **Code style** (from the user's global preferences): `const` arrow functions (no
   `function` declarations), braces on every `if`, no nested ternaries, `interface` for
   object shapes and `type` for aliases/unions, full descriptive names (no `el`, `btn`,
   `ctx`), no `eslint-disable` comments, `~` (tilde) version ranges in `package.json`. Kotlin
   follows the surrounding code.
7. Keep scenarios independent, and keep steps in the user's voice. Given arranges and waits
   until it is true; When acts without asserting; Then asserts.

## Environment

- Windows. Use Git Bash or PowerShell. `python3` is broken; use `python`. In Git Bash, prefix
  `adb shell` commands that contain device paths with `MSYS_NO_PATHCONV=1`.
- adb: `$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe`. The emulator is AVD
  `Medium_Phone` (API 37), usually already running as `emulator-5554`. If `adb devices` is
  empty, start it in the background, then wait for `adb shell getprop sys.boot_completed` to
  print `1`:

  ```bash
  "$LOCALAPPDATA/Android/Sdk/emulator/emulator.exe" -avd Medium_Phone -no-snapshot-save -no-boot-anim -no-audio
  ```

- Gradle needs `JAVA_HOME`; if it's unset, use `C:\Program Files\Android\Android Studio\jbr`.
- Run a single feature while iterating: `npm run e2e -- --spec features/<name>.feature`.

## Suggested order

Easiest first; later features reuse earlier steps.

1. `settings.feature`
2. `word_list.feature`
3. `review.feature`
4. `completion.feature`
5. `daily_allowance.feature`
6. `notifications.feature` (without `@slow`)
7. `backup.feature`
8. `claude_lookup.feature`: implement only, never run
9. The `@slow` scenario: run once

## Hints for the non-obvious steps

Everything below was observed on the API 37 emulator, but verify it against a page source
before relying on it.

**Shared state within a scenario.** Steps like `I spell the current word correctly` and
`I have practised today's words correctly` need to know which word is on screen.
Keep a scenario-scoped record of the words added (word → definition), cleared in the
Before hook, e.g. `support/scenarioState.ts`, and have the add-word steps record into it.
The review screen shows the definition, so map it back to the word. Data-table steps get
their rows from `dataTable.hashes()`.

**Navigation.** Home's overflow button has content-desc `More`. Its menu items read `Add word`,
`All words`, `Settings`; the menu is a popup window, so find items by text. `I open Settings`
and `I open the word list` should work from any screen: `home.goBack()` first.

**Review session.**
- Home's button reads `Start`.
- The session title is `1 / 2`, or `Extra practice` in practice mode.
- The close icon's content-desc is `End session`.
- The answer field's label changes between `Your answer` and `Type the correct spelling`,
  and the submit button's text between `Check`, `Check retype` and `Continue`. Tag both
  (e.g. `review_answer`, `review_submit`).
- **Timing:** after a correct answer the session auto-advances after ~1.1 s. `I spell it`
  must not wait after submitting, and the Then steps that follow must be quick. If that's
  flaky, capture `driver.getPageSource()` once right after submitting and assert against that.
- `the session moves on by itself to the finish line`: wait, without tapping anything,
  for `All done — see you tomorrow`.
- On a miss, the diff shows the labels `You typed` and `Correct`, and each word as one text
  node (`neccessary`, `necessary`).

**Word list.**
- Title: `All words (N)`. The search field's label is `Search`.
- Each row shows the word, its definition, and a status chip: `new`, `due today`,
  `tomorrow`, `in N days` or `suspended`.
- Per-row icons have identical content-descs on every row (`Suspend word`, `Resume word`,
  `Delete word`), so scope to the row. Suggested: a tag per row from a function like
  `TestTags.wordRow(normalizedText)` = `word_row_<text>`, then
  `resourceId("word_row_rhythm").childSelector(new UiSelector().description("Suspend word"))`.
- The delete dialog's buttons are `Delete` and `Cancel`.
- Tapping a row opens the edit screen: title `Edit word`, button `Save changes`.

**Settings.**
- The screen scrolls; use `scrollToText`.
- The stepper's buttons read `−` (U+2212, not a hyphen) and `+`. Tag them and the value text.
- Tag the reminder switch (read its `checked` attribute) and the `Reminder time: HH:MM`
  button (for its enabled state).
- The time picker is a native dialog. Tap content-desc `Switch to text input mode for the
  time input.`, then set resource-ids `android:id/input_hour` and `android:id/input_minute`,
  then tap `OK`.
- `Test key` with no key saved says `Enter a key first.`

**Permission dialog** (system UI).
- Allow: resource-id `com.android.permissioncontroller:id/permission_allow_button`.
- Deny, first time: `…:id/permission_deny_button`.
- Deny, second time: `…:id/permission_deny_and_dont_ask_again_button`.
- `I refuse notifications` must handle both deny buttons. `resourceIdMatches(".*:id/permission_deny.*")`
  covers both.
- `I am not asked to allow notifications`: give the dialog a couple of seconds to appear,
  then assert that `Allow TortoiseSpelling to send you notifications?` is absent.
- `the app is freshly installed`: `freshInstall()` in `support/app.ts`.
- `Android's notification settings for TortoiseSpelling are shown`: the page shows `All
  TortoiseSpelling notifications`, and the activity is `…AppNotificationSettingsActivity`.

**Notifications.**
- Open the shade with `driver.openNotifications()`, find the title by text, and tap it or
  close the shade with `driver.back()`.
- The test notification with nothing due reads `Reminders are working` / `Nothing is due right now.`
- With a word due, it reads `Time to practice spelling` / `1 word ready`.
- Check that stale notifications from an earlier scenario can't satisfy a later one. If
  clearing app data doesn't cancel them, clear them in the Before hook.
- Rotation: `driver.setOrientation('LANDSCAPE')`. Restore `PORTRAIT` in an After hook so a
  failure can't leak into the next scenario.

**The `@slow` reminder scenario.**
- Set the reminder to device time + 2 minutes; get the device time with
  `mobile: getDeviceTime`.
- Press Home (`mobile: pressKey` with keycode 3), then run `am kill com.falloon.tortoisespelling`
  via `mobile: shell`. **Not** `terminateApp`: that force-stops the app, which cancels the
  scheduled reminder and makes the test meaningless.
- Poll the shade for up to 4 minutes. A long step needs its own timeout:
  `Then('…', { timeout: 300_000 }, async () => …)`.

**Backup.**
- Put files on the device with `driver.pushFile('/sdcard/Download/<name>', base64)`.
- A pushed file may not show in the picker until it is media-scanned. Try
  `content call --uri content://media --method scan_volume --arg external_primary` via
  `mobile: shell`, and verify.
- Clean up with `rm -f /sdcard/Download/e2e-* /sdcard/Download/tortoisespelling-backup*`.
- The picker is Android's DocumentsUI:
  - Export shows an editable file name and a `SAVE` button (upper case).
  - Import shows the Downloads root with file names; an existing name gets ` (1)` appended.
- The backup JSON format is in `app/src/main/java/com/falloon/tortoisespelling/data/Backup.kt`
  (`version`, `exportedAt`, and `words[]`, where each word requires `text`, `definition`, `dueOn`).

**Claude lookup (`@live-api`).**
- `my Anthropic API key is saved in Settings` reads `process.env.TORTOISESPELLING_ANTHROPIC_KEY`,
  and fails with a clear message if it's unset.
- The lookup button is `testIds.addWordLookUp`.
- A corrected spelling shows `Corrected spelling to “receive”.`

## Final run

From the repo root:

1. All unit tests, then the live Claude integration tests. `--rerun` matters: Gradle doesn't
   see env-var changes, so without it the 6 live tests can stay silently skipped. Confirm
   from `app/build/test-results/testDebugUnitTest/*ClaudeIntegrationTest.xml` that they ran
   (`tests="6" skipped="0" failures="0"`).

   ```bash
   ./gradlew.bat testDebugUnitTest
   ```

   ```bash
   TORTOISESPELLING_ANTHROPIC_KEY="$(tr -d '\r\n' < apikey)" ./gradlew.bat :app:testDebugUnitTest --tests '*ClaudeIntegrationTest' --rerun
   ```

2. `./gradlew.bat assembleDebug`. Then, in `e2e/`: `npm run typecheck`, `npm run check-steps`,
   and `npm run check-steps -- --all` (expect 0 undefined, `@live-api` steps included).
3. `npm run e2e`, **twice**, to catch flakiness. Any scenario that fails only sometimes
   needs fixing (usually a missing wait), not a retry.
4. `npm run e2e:slow`, once.
5. Delete this file, and fold any durable learnings into `README.md`.

## Report back with

- The scenarios implemented, with the pass counts from both full runs and the slow run.
- The unit and integration test results (counts).
- Any app bugs found (rule 2), with evidence.
- Any feature wording you changed, and why.
- Every app-side change (tags added, and where).
- Anything flaky or left undone, and why.

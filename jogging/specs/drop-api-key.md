# Piece: drop-api-key

Remove the Claude client, "Keep this card fresh" (`CardRefresher`), the Anthropic API key
setting and its encryption, the `autoRefresh`/`refreshedOn` columns, the `@live-api`
scenarios, and every doc line about them. Sources: `docs/todo.md` (the "Drop the API key
feature" item lists the parts) and `docs/copy-prompt-lookup.md` (the lookup that replaces
it).

Builds on `copy-prompt` as specified, and through it on `word-forms`, `test-ui-layers`
and `test-data-layer`. This spec assumes:

- schema version 3 (`definitions`, `word_forms`, `example_sentences`; `words` rebuilt
  without `definition`, `example` and `partOfSpeech`), `DATABASE_VERSION`,
  `ALL_MIGRATIONS` and `MigrationTest` with its Room-path test;
- `CardRefresher` appending an example through `WordRepository.addExample`, with
  `markRefreshAttempted` and the DAO's `markRefreshed` and `nextExampleIndex`;
- `AppContainer(context, clock, fuzz, openDatabase, settingsFile)`, and
  `SettingsStore(context, fileName)`;
- the add/edit screen with Copy prompt and Paste answer, no Look up, and the "Keep this
  card fresh" toggle reading `hasApiKey`;
- Settings' key section titled "Keep cards fresh", and `claude_lookup.feature` holding
  only the key test;
- the component, integration, accessibility and screenshot layers, and `npm run
  e2e:release`.

## What it delivers

- **No API key anywhere.** No Settings section for a key, no Test key, no encrypted
  secret, no `ClaudeClient`, no OkHttp. A key saved by an earlier version is deleted
  the first time the new version starts.
- **No "Keep this card fresh".** The add/edit tick box goes, and so does the background
  refresh when a session starts. Freshness comes from rotating banked examples
  (`word-forms`); new examples come from another copy-prompt round on the edit screen.
- **No Internet permission.** Nothing in the app uses the network, so the manifest stops
  asking for it. That's the strongest form of goal 3 a user can check.
- **Schema version 4** drops `autoRefresh` and `refreshedOn` from `words` with the
  table rebuild `MIGRATION_2_3` uses, and the same migration tests.
- **Backups** stop writing the two fields, and files that have them still import.
- **Docs** say all of this: `CLAUDE.md`, `README.md`, `PRIVACY.md`, `CHANGELOG.md`,
  `e2e/README.md`, the design docs and `docs/todo.md`.

Goals it leans on:

1. **Nothing lost.** Version 4 is a real `Migration` with the two `word-forms` style
   tests, one through Room's own open path, because the rebuild drops `words` and a
   cascade would take `review_log` and all three content tables with it. Backups read
   both ways across the change.
2. **Reminder.** Untouched. `notify/` and the reminder's `SettingsStore` keys don't change.
3. **No API key.** This piece finishes it: nothing calls an AI API, no key is stored,
   and the app can't reach the network.
4. **Scheduling per root word.** `recordReview`, `Sm2Scheduler`, `Grade`, `SessionBuilder`
   and the session queries keep their behaviour. `recordReview` keeps re-reading the row
   (only its comment changes); the two dropped columns were never scheduling state.
5. **Two apps.** The web app never gets a key, a refresher or the two columns, and the
   backup JSON it shares loses two keys it would otherwise have to carry.
7. **Simple.** Two dependencies (`okhttp`, the test-only `org.json`), one permission, an
   encryption class and a background coroutine scope go.

### Settled here (the docs and decisions leave these open)

- **A saved key is deleted, not just ignored.** `SettingsStore` removes the old `apiKey`
  preference and the Keystore entry that encrypted it, once, on first start. Left in
  place, the ciphertext would ride along in every Google backup and device transfer for
  no purpose, and `PRIVACY.md` couldn't say the key is gone.
- **The Internet permission goes.** After this piece nothing opens a socket: links open
  in the browser by intent, Copy prompt uses the clipboard, and the reminder is local.
  If a library merges `INTERNET` back into the release manifest, the step records which
  and keeps it rather than stripping it with `tools:node="remove"`.
- **Backups drop the two fields** rather than keeping them as ignored keys. The format
  stays version 1: `BackupJson` already has `ignoreUnknownKeys`, so a file from 0.3.0 or
  any `word-forms`/`copy-prompt` build still reads here, and a file written here reads
  in those builds with `autoRefresh` false and `refreshedOn` null, which is exactly
  "off".
- **Words that had auto refresh on** simply lose it. The `CHANGELOG.md` line says so.
  Nothing else about them changes.
- **`recordReview` keeps its re-read.** With the refresher gone, nothing writes a word
  row during a session, but the re-read costs one query and guards any future writer.
  Goal 4 favours leaving it. Its comment no longer names the refresher.
- **Settings splits into `SettingsScreen` and `SettingsContent`**, as `test-ui-layers`
  asked of the piece that rewrites Settings, with component, accessibility and
  screenshot coverage. The add screen is already split (`copy-prompt`).
- **The e2e log filters go.** `appium-log-filters.json` and `wdio.conf.ts`'s
  `logFilters` exist to keep the key out of the Appium log; no step types a secret now.
  The README keeps the rule that a real secret never goes in step text.

## Design

### What is deleted

| File | Notes |
|---|---|
| `data/remote/ClaudeClient.kt` | With `LookupResult`, `StaleCard`, `KeyTestResult`, `LookupModel`, `lookupRequest`, `parseLookup`. The `data/remote/` package goes. |
| `data/CardRefresher.kt` | |
| `domain/CardRefresh.kt` | `cardsNeedingRefresh`. |
| `data/SecretCipher.kt` | Its alias string moves to `SettingsStore`'s cleanup (below). |
| `app/src/test/.../data/remote/` | `ClaudeIntegrationTest`, `LookupModelTest`, `LookupParseTest`, `LookupRequestTest`. |
| `app/src/test/.../domain/CardRefreshTest.kt` | |
| `e2e/features/claude_lookup.feature`, `e2e/step-definitions/claude_lookup.steps.ts` | `I choose {string}` and `I open Settings` stay: other features use them. |
| `e2e/appium-log-filters.json` | And `logFilters` in `wdio.conf.ts`. |

### App code

**`di/AppContainer.kt`** loses `claude`, `cardRefresher` and `appScope` (its only user was
the refresher). The class KDoc stays. Constructor parameters are unchanged.

**`data/SettingsStore.kt`**:

- `Settings` loses `apiKey` and `hasApiKey`; `SettingsStore` loses `setApiKey` and
  `KEY_API`. The class KDoc becomes one line: preferences, stored plainly, since none is
  a secret.
- An `init` block, after the file is opened and before `read()`, calls
  `forgetLegacyApiKey()`:

  ```kotlin
  /** Earlier versions stored an encrypted Anthropic API key. Remove it and its Keystore key. */
  private fun forgetLegacyApiKey() {
      if (!prefs.contains(LEGACY_KEY_API)) return
      prefs.edit { remove(LEGACY_KEY_API) }
      runCatching {
          KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.deleteEntry(LEGACY_KEYSTORE_ALIAS)
      }
  }
  ```

  with `LEGACY_KEY_API = "apiKey"` and `LEGACY_KEYSTORE_ALIAS =
  "tortoisespelling.settings.v1"` in the companion. `runCatching` because a missing or
  broken Keystore must not stop the app opening; the preference is already gone by
  then. `prefs.edit` (apply) matches the rest of the store.

**`data/Word.kt`**: in build-1 nothing; in build-3 the "card upkeep" block (`autoRefresh`,
`refreshedOn` and their KDoc) goes.

**`data/TortoiseSpellingDao.kt`** loses `markRefreshed` and `nextExampleIndex`.

**`data/WordRepository.kt`**:

- `addWord(text, content)` and the flat `addWord(text, definition, example,
  partOfSpeech)` lose `autoRefresh`.
- `markRefreshAttempted` and `addExample` go, with the `// --- card refresh ---` header.
- `recordReview`'s comment becomes: "Re-read rather than trusting the session's snapshot,
  which was taken when the session opened: @Update writes every column." The code is
  unchanged.

**`ui/review/ReviewViewModel.kt`** loses the `cardRefresher` parameter and its
`refreshInBackground` call; the factory stops passing `container.cardRefresher` and
keeps everything else.

**`ui/add/`**:

- `AddWordUiState` loses `autoRefresh` and `hasApiKey`.
- `AddWordViewModel` loses `onAutoRefreshChange` and the `SettingsStore` parameter
  (nothing else reads it once `copy-prompt` removed the lookup; if something does, keep
  it and say why in the log). Save and load stop passing and reading `autoRefresh`.
- `AddWordContent` loses `AutoRefreshToggle`, its KDoc and the `onAutoRefreshChange`
  callback. Nothing replaces it: Save follows the last example's "Add example" and the
  "Add definition" button as before.

**`ui/home/HomeScreen.kt`**, the empty state's body text becomes: "Add a word you keep
misspelling. Any chat AI, such as Claude or ChatGPT, can write its definitions and
example sentences for you, or you can type them yourself."

**`domain/WordBlank.kt`** KDoc: "Claude is asked …" / "Claude is instructed …" become
"The lookup prompt asks …" / "The lookup prompt tells the chat AI …". No code change.

**`ui/TestTags.kt`** loses `SETTINGS_API_KEY`.

**`app/src/main/AndroidManifest.xml`** loses `<uses-permission
android:name="android.permission.INTERNET" />`.

**Gradle**: `app/build.gradle.kts` loses `implementation(libs.okhttp)`,
`testImplementation(libs.json)` and its comment; the R8 comment's dependency list drops
OkHttp. `gradle/libs.versions.toml` loses the `okhttp` and `json` versions and
libraries. `SeedWordsActivity` keeps using `org.json`: that's Android's bundled copy,
not the test dependency.

### Settings

`SettingsUiState` loses `testingKey`. `SettingsViewModel` loses `ClaudeClient`,
`setApiKey` and `testKey`; the factory stops passing `container.claude`.

`SettingsScreen.kt` splits, the convention `test-ui-layers` set:

- `SettingsScreen(onBack)` keeps the ViewModel, the message effect, the
  notification-permission state and launcher, the `ON_RESUME` re-read, the
  `remindersOn` computation and the two document launchers, and renders
  `SettingsContent`.
- `SettingsContent(state: SettingsUiState, remindersOn: Boolean, snackbarHost:
  SnackbarHostState, onBack, onReminderToggle: (Boolean) -> Unit, onPickTime: (Int, Int)
  -> Unit, onSendTest, onNewWordsPerDayChange: (Int) -> Unit, onExport, onImport,
  onCloudBackupChange: (Boolean) -> Unit)` holds the `Scaffold` and every section. The
  toggle's Android 13 permission branch stays in `SettingsScreen`'s `onReminderToggle`
  lambda. `ReminderSection`'s time picker and "Open app settings" keep using
  `LocalContext` inside the content; `AboutSection` keeps `LocalUriHandler`.

Sections, top to bottom: Daily reminder, Practice, Backup, About.
`ClaudeLookupSection` and `ApiKeyHelp` go, with the `Visibility`/`VisibilityOff`,
`PasswordVisualTransformation`, `KeyboardType` and `CircularProgressIndicator` imports
they alone used. Backup's switch help text becomes: "Includes your words and settings in
your phone's Google backup, so they come back after a reset or on a new phone. This is
separate from Export." About is unchanged.

### Schema version 4

`Word` loses `autoRefresh` and `refreshedOn`. `DATABASE_VERSION = 4`; `ALL_MIGRATIONS`
gains `MIGRATION_3_4`; commit the generated `app/schemas/.../4.json`.

`MIGRATION_3_4` in `TortoiseSpellingDatabase.kt`, KDoc of two lines ("Drops
`autoRefresh` and `refreshedOn` with the card refresh. Rebuilds `words` as
`MIGRATION_2_3` does."), copying its statements from `4.json`:

1. `CREATE TABLE _new_words (…)` from `4.json`'s `words` statement with the table name
   swapped.
2. `INSERT INTO _new_words (id, text, normalizedText, createdAt, repetitions,
   easeFactor, intervalDays, dueOn, lapses, lastReviewedAt, firstReviewedOn, isNew,
   suspended) SELECT` the same columns `FROM words`. Name the columns from `4.json`; the
   list above is what `word-forms` leaves and is a check, not a substitute.
3. `DROP TABLE words`, `ALTER TABLE _new_words RENAME TO words`.
4. Recreate the `words` indices with the names and SQL in `4.json`
   (`normalizedText` unique, `dueOn`, `firstReviewedOn`).

Foreign keys are off during migrations (Room turns them on in `onOpen`), so the drop
doesn't cascade into `review_log` or `definitions`; the Room-path test proves it, as for
`MIGRATION_2_3`. If that test loses a row, the fallback `word-forms` gave applies:
don't ship the rebuild, keep the two columns as unread fields, and record it here.

If `word-forms` recorded its own fallback (the old `definition`, `example` and
`partOfSpeech` columns still on `words`), this rebuild drops those three as well, and
the tests below check that too. Either way the version 4 `words` table is the one
`4.json` describes.

### Backup format

`data/Backup.kt`, still `CURRENT_VERSION = 1`:

- `BackupWord` loses `autoRefresh` and `refreshedOn`; `toBackup()` and `toImport()`
  stop mapping them.
- The comment that sat on those two fields moves to the `definitions` field (or the
  class KDoc, wherever `word-forms` put the format note) and says: fields are added with
  defaults and removed outright, `ignoreUnknownKeys` lets every build read every other
  build's files, so the version stays 1.

### e2e

Build-1, with the app change (tags and suite change together):

- Delete `claude_lookup.feature` and `claude_lookup.steps.ts`.
- `support/screens/settings.ts` loses `apiKeyField`; `open`'s KDoc says it checks the
  reminder switch because Daily reminder is the first section (drop "rather than the API
  key field").
- `support/testIds.ts` loses `settingsApiKey`.

Build-4:

- `support/config.ts`: `DEFAULT_TAGS` loses only `and not @live-api` (keep the rest,
  such as `test-ui-layers`' `and not @release-smoke`), and the KDoc drops the
  `@live-api` sentence.
- `wdio.conf.ts`: the `logFilters` arg and its comment go; delete
  `appium-log-filters.json`.
- `support/actions.ts`: `typeInto`'s KDoc drops the masked-field sentence. The length
  check stays: it's what works on the S23, and changing it is out of scope.
- `features/add_word.feature` narrative: "with or without a chat AI".
- `e2e/README.md`: the `npm run e2e` row lists `@todo` and `@slow` (and
  `@release-smoke`, if present); the `@live-api` tag row goes; the `typeInto` gotcha
  drops the masked-field example; the "Typed text is logged unless redacted" gotcha
  becomes one line: the Appium log records every typed value, so never type or put a
  real secret in a step.

### Docs

- `CLAUDE.md`:
  - The opening paragraph: "…a daily reminder, and word lookup by copying a prompt into
    any chat AI."
  - The test layer table loses the "Live-API integration test" row; the "Live API
    tests" bullet goes.
  - Wiring: `AppContainer` builds the Room database, `SettingsStore` and
    `WordRepository` (and the clock and fuzz `test-ui-layers` added).
  - "Lookup": drop the sentence that `ClaudeClient` stays for keeping cards fresh;
    end with "Nothing in the app calls an AI API, and the manifest has no Internet
    permission."
  - "Keeping cards fresh" goes, with its `lookupRequest`/`StaleCard` lines.
  - "Secrets and data safety" becomes "Data safety". The API key bullet becomes: no
    setting is a secret; `SettingsStore` deletes the encrypted key and Keystore entry an
    earlier version left. The Room bullet: version 2 added `autoRefresh` and
    `refreshedOn`, version 4 dropped them with the same rebuild as version 3. The backup
    bullet: files from versions with those fields still import, the keys ignored.
  - `ui/<screen>/` in Layers: Settings joins the screens with an `XContent`.
- `README.md`: the "Your words" bullet keeps the copy-prompt wording `copy-prompt` gave
  it; the lookup section's closing line about an Anthropic key goes; any other "Keep
  this card fresh" or API key line goes. "Everything works offline with no account and
  no API key." stays.
- `PRIVACY.md`:
  - Opening: "…Your word list stays on your phone. The app has no Internet permission,
    so it can't send anything anywhere. The only thing that leaves is what you choose to
    paste into a chat app yourself."
  - "What the app keeps" loses the API key bullet.
  - "What leaves your device": the "Keep this card fresh" paragraph and its Test key and
    model-discovery sentences go; the word lookup paragraph `copy-prompt` wrote stays.
    One sentence: "If you saved an Anthropic API key in an earlier version, the app
    deletes it when it updates."
  - "Android's own backup" loses the two API key sentences; "Backups you export" loses
    "It doesn't include your API key."
  - Permissions: the Internet row goes, leaving Notifications.
- `CHANGELOG.md`, under `[Unreleased]`, `### Removed`:
  - "**Keep this card fresh** and the Anthropic API key in Settings. Words that had it
    on keep everything else. Copy prompt and the rotating example sentences cover what
    it did, with no key."
  - "The Internet permission. The app no longer connects to anything, and an API key
    saved by an earlier version is deleted when you update."
- `docs/testing-and-web-plan.md`: drop the `ClaudeIntegrationTest` sentence, `@live-api`
  from layer 6, the "OkHttp to the Messages API" and `SecretCipher` rows of the porting
  table, and the "Claude lookup from a browser" risk. Leave the rest.
- `docs/copy-prompt-lookup.md`'s "As built" gains: "`drop-api-key` then removed the API
  key, auto refresh and the Internet permission." `docs/word-forms.md`'s note that the
  refresh appends an example until `drop-api-key` gains "(since removed)".
- `docs/todo.md`: tick the "Drop the API key feature" item.
- `.github/workflows/ci.yml`: the header's `ClaudeIntegrationTest` sentence goes.
- `.gitignore`: the `apikey` line goes.

## Build steps

Each step follows `CLAUDE.md`'s Workflow and `PROTOCOL.md`. "Passing" means every command
exits 0. Connected runs and e2e go to the phone `ANDROID_SERIAL` names (rerun
`bash jogging/cloud-setup.sh` if `adb devices` doesn't list it). Abbreviations, as in
`word-forms`:

- `<layer X>`: `./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.package=io.github.dontpanic345.tortoisespelling.X`
- `<e2e F…>`: `cd e2e && npm run e2e -- --spec features/F.feature …`, one `--spec` per
  file.
- `<aapt2>`: `"$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)/aapt2"`

### build-1: remove the client, the refresher, the toggle and the key (Sonnet, high)

Everything under "What is deleted" except the log filters, and everything under "App
code" except `Word.kt`, plus the Settings changes **without** the split (the key section,
`testingKey`, `testKey`, `setApiKey`, the Backup help text), and build-1's part of
"e2e". `Word` keeps its two columns for now: nothing writes them but their defaults.
High effort: deletions across every layer, and each test layer must still compile and
mean what it did.

Tests:

- `SettingsStoreTest` (`data` layer, new): on a test-only file name, write `apiKey` =
  `"v1:abc"` and `newWordsPerDay` = 7 straight into the `SharedPreferences`, and create
  the `tortoisespelling.settings.v1` AES key in `AndroidKeyStore` with a
  `KeyGenerator` (as the deleted `SecretCipher` did). Construct `SettingsStore(context,
  name)`: the file no longer contains `apiKey`, `current().newWordsPerDay` is 7, and the
  Keystore no longer `containsAlias` the alias. A second test: with no `apiKey` in the
  file, construction changes nothing in it. Delete the file and alias in `@After`.
- `WordRepositoryTest`: the stale-snapshot test drops `markRefreshAttempted`. It now
  takes a snapshot, suspends the word through `setSuspended` on a fresh read, then calls
  `recordReview(snapshot, …)`: the row is still suspended and has the new scheduling and
  one log. `addExample` tests go.
- `TortoiseSpellingDaoTest`: the `markRefreshed` and `nextExampleIndex` tests go.
- `AddWordUiStateTest`, `AddWordContentTest`, and the add screen's accessibility and
  screenshot fixtures: drop `autoRefresh`, `hasApiKey` and the toggle; keep every other
  case. Re-record the add-screen references (the toggle is gone) and Home's empty-state
  reference if one exists (its text changed); nothing else may differ.
- Anything else that constructed `Settings(apiKey = …)`, `ReviewViewModel` with a
  refresher or `AddWordViewModel` with a store follows the new signatures.

Acceptance:

```bash
./gradlew assembleDebug testDebugUnitTest lintDebug assembleDebugAndroidTest
grep -rnE "ClaudeClient|CardRefresher|cardsNeedingRefresh|SecretCipher|LookupResult|KeyTestResult|StaleCard|hasApiKey|setApiKey|testKey|testingKey|onAutoRefreshChange|SETTINGS_API_KEY|settingsApiKey|okhttp|libs\.json" \
  app/src app/build.gradle.kts gradle/libs.versions.toml e2e/support e2e/step-definitions e2e/features   # no matches
grep -rn "apiKey\|tortoisespelling.settings.v1" app/src   # only SettingsStore's legacy constants and SettingsStoreTest
<aapt2> dump permissions app/build/outputs/apk/debug/app-debug.apk   # no android.permission.INTERNET
<layer data>
<layer component>
<layer integration>
<layer accessibility>
./gradlew updateDebugScreenshotTest && ./gradlew validateDebugScreenshotTest   # look at the changed references
cd e2e && npm run check-steps -- --all && npm run typecheck
<e2e add_word settings review>
```

- If the debug APK still lists `INTERNET`, find the library in
  `app/build/outputs/logs/manifest-merger-debug-report.txt`. A debug-only library is
  fine; note it in the log, and the review checks the release APK. A release library is
  recorded here and keeps its permission.
- Temporarily remove the `forgetLegacyApiKey()` call: `SettingsStoreTest` fails. Revert.

### build-2: Settings content split (Sonnet, medium)

The `SettingsScreen`/`SettingsContent` split under "Settings". A pure move: no text,
layout or behaviour change beyond build-1's.

Tests:

- `SettingsContentTest` (`component` layer):
  - The section titles appear in order: Daily reminder, Practice, Backup, About; there
    is no node with text containing "API key", "Anthropic" or "Test key".
  - The reminder switch (`SETTINGS_REMINDER_SWITCH`) is on for `remindersOn = true` and
    off for false, and clicking it calls `onReminderToggle` with the opposite value; the
    time button is disabled while off.
  - The stepper's + and − call `onNewWordsPerDayChange` with value ± 1, and are disabled
    at 100 and 1.
  - Export and Import call their callbacks, and are disabled while `state.busy`.
  - The cloud backup switch calls `onCloudBackupChange`.
- Accessibility and screenshot states, light and dark: the defaults (reminders on, 10 new
  words, cloud backup off), and reminders off.

Acceptance:

```bash
./gradlew assembleDebug testDebugUnitTest lintDebug assembleDebugAndroidTest
<layer component>
<layer accessibility>
./gradlew updateDebugScreenshotTest && ./gradlew validateDebugScreenshotTest   # look at the new references
<e2e settings notifications>   # notifications uses Settings' test button and the permission flow
```

- Temporarily drop `enabled = !busy` from Export: `SettingsContentTest` fails. Revert.

### build-3: schema version 4 and the backup fields (Sonnet, high)

`Word.kt`'s two columns, `MIGRATION_3_4`, `4.json`, `DATABASE_VERSION`, `ALL_MIGRATIONS`,
and "Backup format". High effort: the migration is the one place this piece can lose
data.

Tests:

- `MigrationTest` (`data` layer), with one helper that inserts the version 3 rows with
  `ContentValues`: a reviewed word with every scheduling column off its default,
  `autoRefresh` 1 and `refreshedOn` set; a new word; "Café", suspended; for each word a
  definition, a base form, and for two of them an example (one with `shownAt` set); a
  second definition with a labelled form on the reviewed word; three `review_log` rows.
  - *3→4 drops the refresh columns and keeps everything else.*
    `runMigrationsAndValidate(name, 4, true, MIGRATION_3_4)`. Every kept `words` column
    of every row is unchanged; `PRAGMA table_info(words)` has neither `autoRefresh` nor
    `refreshedOn`; the three content tables and `review_log` are row-for-row unchanged;
    `PRAGMA foreign_key_check` is empty.
  - *Room migrates a version 3 database without losing a review or a sentence.* The same
    rows, close, open the file with `Room.databaseBuilder(…).addMigrations(*ALL_MIGRATIONS)`.
    Three words, three logs, and the content counts unchanged (count queries);
    `contentById` gives each word its tree in order, `shownAt` kept.
  - The existing tests that open through Room at `DATABASE_VERSION` now expect `Word`s
    without the two fields. The chain test from version 1 needs no change and must pass.
- `BackupTest`:
  - An encoded file has no `autoRefresh` or `refreshedOn` key.
  - A 0.3.0-style flat file with `"autoRefresh": true, "refreshedOn": 20000` still
    imports (the existing fixture, if it has them; otherwise add one).
  - A file written now decodes with a stand-in serializer of the `copy-prompt`-era
    `BackupWord` (this one plus the two fields): `autoRefresh` false, `refreshedOn`
    null. That's what an older build sees.

Acceptance:

```bash
./gradlew assembleDebug testDebugUnitTest lintDebug assembleDebugAndroidTest
git status --short app/schemas         # only the new 4.json
grep -rn "autoRefresh\|refreshedOn" app/src/main   # only MIGRATION_1_2, MIGRATION_3_4 and their KDocs
<layer data>                           # every test, including the two new migration tests
<layer integration>                    # SchedulingJourneyTest and RotationJourneyTest unchanged and passing
<e2e backup word_list review>
```

- Temporarily leave `lapses` out of the `_new_words` copy: the 3→4 test fails.
  Temporarily add `DELETE FROM review_log WHERE id = 1` at the end of the migration: the
  Room-path test fails. Temporarily add `DELETE FROM definitions WHERE id = 1`: the
  Room-path test fails. Revert all three.

### build-4: e2e cleanup, docs and changelog (Sonnet, medium)

Build-4's part of "e2e", and everything under "Docs".

Acceptance:

```bash
cd e2e && npm run check-steps && npm run check-steps -- --all && npm run typecheck
<e2e settings add_word>   # a default-tags run still selects and passes them
./gradlew testDebugUnitTest lintDebug
git grep -n -i -E "anthropic|ClaudeClient|CardRefresher|autoRefresh|refreshedOn|api key|apiKey|live-api|okhttp|SecretCipher|keep this card fresh|logFilters" \
  -- . ':!CHANGELOG.md' ':!jogging' ':!app/schemas'
grep -n "Unreleased" -A12 CHANGELOG.md   # the two Removed lines are there
```

- The `git grep` matches only: `MIGRATION_1_2`/`MIGRATION_3_4` and their tests,
  `BackupTest`'s old-file fixtures, `SettingsStore`'s legacy key cleanup and its test,
  the `PRIVACY.md` sentence about deleting an old key, "no API key" lines that say the
  app needs none (`README.md`), and history in `docs/word-forms.md` and
  `docs/copy-prompt-lookup.md`. Anything else is a doc or code line this piece missed.

### review (Sonnet, high)

Review the whole piece against this spec and `GOALS.md`, independently. In particular:
nothing in `app/src` opens a network connection (`grep -rnE "URL\(|HttpURLConnection|Socket|okhttp|ktor"`)
and the release APK has no `INTERNET` permission; `MIGRATION_3_4` matches `4.json`
statement for statement and copies every kept column; each migration test fails under
build-3's mutations; `recordReview`, `Sm2Scheduler`, `SessionBuilder` and the session
queries are unchanged apart from the comment (`git diff` them against the piece's first
commit); the legacy key cleanup runs once and can't crash start-up; `BackupTest` proves both
directions (a 0.3.0-style file imports here, and the stand-in serializer reads a file
written here as an older build would); `PRIVACY.md` says what the code does; no war-story comments. High effort: this is the
last Android piece before the web port copies it, and goal 1 can still fail in the
migration.

Run the full checks: unit, lint, all four instrumented layers, screenshot validation, the
whole e2e suite (`cd e2e && npm run e2e`), and the release smoke on a signed release
build (`npm run e2e:release`, with the debug-keystore variables `CLAUDE.md` gives), then
`<aapt2> dump permissions app/build/outputs/apk/release/app-release.apk` (no `INTERNET`).
Then finish with `node scripts/bump-version.mjs minor`, commit and push, and watch the
release run to the end.

## What later pieces rely on

- **`web-core`**: ports `Word` without `autoRefresh`/`refreshedOn`, and the backup JSON
  without those keys; its parser ignores them (and any other unknown key) so 0.3.0
  files import. There's no `cardsNeedingRefresh`, `ClaudeClient` or API key to port, and
  `Settings` is `newWordsPerDay`, the reminder fields and `cloudBackupEnabled`
  (Android-only). The porting table in `docs/testing-and-web-plan.md` no longer lists
  OkHttp or `SecretCipher`.
- **`web-ui`**: Settings has Daily reminder, Practice, Backup (export and import; the
  Google backup switch is Android-only) and About, as `SettingsContentTest` lists. The
  add/edit screen has no auto-refresh toggle. Home's empty-state text is the one above.
- **`shared-specs`**: `claude_lookup.feature` is gone and `@live-api` no longer exists,
  so the layer and platform tags don't need it. `settings.feature` stays a shared
  scenario only where the web app has the setting.
- **`web-push`**: `PRIVACY.md` now says the Android app sends nothing anywhere. The web
  push piece adds what the web app sends (push subscriptions and due dates) as a
  separate, web-only section before push ships.

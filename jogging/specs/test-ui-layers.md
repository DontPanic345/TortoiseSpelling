# Piece: test-ui-layers

An injectable clock and interval fuzz, the component and integration test layers, and the
specialised layer: accessibility checks, screenshot tests and a release-build (R8) smoke
run. Source: `docs/testing-and-web-plan.md`, layers 3, 4 and 6, and the "Fuzz" note under
"Points that don't map one to one".

Builds on `test-data-layer` as specified: the androidTest runner and dependencies,
`testWord` in `app/src/androidTest/.../data/TestWords.kt`, one package per layer selected
with the runner's `package` argument, and the `data` CI job on an API 26 emulator.

## What it delivers

- **Time and fuzz are inputs.** Every "today" and "now" the app's word logic reads comes
  from one `java.time.Clock` held by `AppContainer`, and the repository's due-day fuzz is
  a constructor parameter. Tests can then set the date, move it forward a day, and know
  exactly which day a word comes back.
- **Stateless screen content.** Review, Home and the word list split into a stateful
  `XScreen` (ViewModel, effects, navigation) and a stateless `XContent` (state in,
  callbacks out), so a screen can be rendered alone from a hand-built state.
- **Component layer** (`…tortoisespelling.component`): each `XContent` and
  `CompletionPanel` alone with fake state, on an emulator.
- **Integration layer** (`…tortoisespelling.integration`): the app's real navigation,
  ViewModels and repository over an in-memory database, with a test clock. "Answer
  correctly twice, and the word is due again in 6 days."
- **Specialised layer:**
  - accessibility checks (`…tortoisespelling.accessibility`) over the same screens, using
    Compose's built-in Accessibility Test Framework integration;
  - screenshot tests of the same screens, light and dark, rendered on the JVM;
  - a release smoke run: one e2e journey against an R8-minified release APK, which
    `release.yml` runs before it publishes.
- A CI job per layer.

Goals it leans on: 1 (the R8 smoke covers backup export and import on the build users
actually install; the integration tests pin the scheduling a user's progress depends
on), 2 (the reminder is untouched: `ReminderScheduler`, `ReminderWorker` and
`millisUntilNext` keep reading the real time, and the release smoke checks a test
notification arrives on the release build), 4 (scheduling is unchanged; the tests prove
it end to end), 5 (stateless content and a seedable clock are what the web app will
mirror, and the plan's injectable fuzz is what makes the ported golden tests
deterministic), 6 (all CI on GitHub's free runners; the repo is public), 7 (testing
pyramid, Compose's own test APIs, one new Gradle plugin).

Not changed by this piece: the e2e scenarios already in `e2e/features/`. They become the
shared Gherkin specs in `shared-specs` (goal 5), so none is moved down a layer or deleted,
even where the integration layer now covers the same rule.

**Release.** The clock and content refactors aren't user-visible. If the accessibility
checks force app fixes (build-4), those are user-visible fixes: each gets a
`CHANGELOG.md` line under `### Fixed` and the review step ends with
`node scripts/bump-version.mjs patch`. If nothing user-visible changed, no bump.

## Design

### The clock

`domain/Days.kt`:

- `fun today(clock: Clock): Long = LocalDate.now(clock).toEpochDay()`. No default: the
  compiler then finds every call site.
- `object DeviceClock : Clock()` in the same file: `instant()` is `Instant.now()`,
  `getZone()` is `ZoneId.systemDefault()` read on every call, and `withZone(zone)` is
  `Clock.system(zone)`. One comment line: `Clock.systemDefaultZone()` fixes the zone when
  it's created, and a user who changes time zone while the process lives must get the
  new zone's midnight, as `LocalDate.now()` gives today.
- `relativeLabel(day, today)` and `currentStreak(studyDays, today, satisfiedDays)` lose
  their `today = today()` defaults, as does `statusLabel(word, today)` in
  `ui/words/WordListViewModel.kt`. Unit tests already pass `today` explicitly.

`data/WordRepository.kt`:

```kotlin
class WordRepository(
    private val dao: TortoiseSpellingDao,
    private val settings: SettingsStore,
    private val clock: Clock = DeviceClock,
    private val fuzz: (today: Long, intervalDays: Int) -> Long = ::fuzzedDueDay,
    private val scheduler: Scheduler = Sm2Scheduler,
)
```

- Every `Days.today()` becomes `Days.today(clock)`, `System.currentTimeMillis()` becomes
  `clock.millis()`, `addWord` passes `createdAt = clock.millis()`, and `lastWeek` passes
  `clock.zone` to `Days.dayOf`.
- `recordReview` calls `fuzz(today, next.intervalDays)` instead of `fuzzedDueDay(...)`.
- `::fuzzedDueDay` adapts to the two-argument type through its defaulted `random`. If
  the compiler won't adapt it, write the default as a lambda.
- Session interleaving stays random: integration tests that need two words in one
  session find each word by its definition rather than relying on order.

`data/SettingsStore.kt`: `class SettingsStore(context: Context, fileName: String = FILE)`,
so integration tests get preferences of their own. The backup agent keeps reading `FILE`.

`di/AppContainer.kt`:

```kotlin
class AppContainer(
    context: Context,
    val clock: Clock = DeviceClock,
    fuzz: (today: Long, intervalDays: Int) -> Long = ::fuzzedDueDay,
    openDatabase: () -> TortoiseSpellingDatabase = { TortoiseSpellingDatabase.build(context) },
    settingsFile: String = SettingsStore.FILE,
)
```

`database` is `lazy(openDatabase)`, `settings` is built with `settingsFile`, the
repository gets `clock` and `fuzz`, and `CardRefresher` gets `clock` too (it reads
today twice; `drop-api-key` deletes it later). `TortoiseSpellingApp` still calls
`AppContainer(this)`.

ViewModels:

- `HomeViewModel(repository, clock)`: `greeting(LocalTime.now(clock).hour)`,
  `LocalDate.now(clock).format(...)`, and a new `HomeUiState.today: Long` set from
  `Days.today(clock)`.
- `CompletionPanel` takes `today: Long` as a parameter instead of reading it. Home passes
  `state.today`, `CompletionScreen` passes its `HomeViewModel` state's `today`.
- `WordListViewModel(repository, clock)`: `Days.today(clock)` everywhere, `filtered`
  without a defaulted `today`.
- Factories pass `container.clock`.

Left reading the real time, on purpose: the reminder (`ReminderScheduler`,
`ReminderWorker`, `millisUntilNext`), `Backup.kt`'s `exportedAt` and the default
`createdAt` of a backed-up word, and `Word.createdAt`'s default (fixtures use it; the
repository always passes one).

Check, after build-1:

```bash
grep -rnE 'Days\.today\(\)|LocalDate\.now\(\)|LocalTime\.now\(\)|System\.currentTimeMillis\(\)|systemDefaultZone' app/src/main
```

prints only `Word.kt`'s and `Backup.kt`'s `currentTimeMillis` defaults.
(`millisUntilNext` uses `LocalDateTime.now()`, which the pattern doesn't match.)

### Reaching the container from a test

`ui/Nav.kt`:

```kotlin
val LocalAppContainer = staticCompositionLocalOf<AppContainer?> { null }

@Composable
fun rememberAppContainer(): AppContainer =
    LocalAppContainer.current
        ?: (LocalContext.current.applicationContext as TortoiseSpellingApp).container
```

The app never provides it, so production behaviour is unchanged. Integration tests
provide a container of their own around the real `NavHost`.

`MainActivity.kt`: `TortoiseSpellingNavHost` becomes `internal`, so integration tests can
render the app's real navigation graph inside their own activity.

### Stateless screen content

For **Review**, **Home** and the **word list**. Each keeps its public `XScreen` signature
(`MainActivity` doesn't change) and gains an `XContent` in the same file:

| Screen keeps | `XContent(state, …)` gets |
|---|---|
| `ReviewScreen`: the ViewModel and the `onFinished` effect | `ReviewContent(state: ReviewUiState, onInputChange, onSubmit, onShowAnswer, onQuit)`: the `Scaffold` and everything in it, the focus requester and the bring-into-view effects. The title reads `state.practiceMode` (the ViewModel already sets it) instead of the screen's parameter |
| `HomeScreen`: the ViewModel, `LifecycleEventEffect(ON_RESUME)`, `RequestNotificationPermissionIfNeeded` | `HomeContent(state: HomeUiState, onStartReview, onPracticeMore, onAddWord, onOpenWords, onOpenSettings)`: the menu's open state and everything visible |
| `WordListScreen`: the ViewModel | `WordListContent(state: WordListUiState, onBack, onEdit, onQueryChange, onFilterChange, onToggleSuspended: (Word) -> Unit, onDelete: (Word) -> Unit)`: the pending-delete dialog's state and the dialog |

A pure move: no behaviour, text or layout change. `CompletionPanel` is already
stateless. Add, Settings and Completion stay as they are: `copy-prompt` and
`drop-api-key` rewrite Add and Settings, and split them when they do (see "What later
pieces rely on"). `CLAUDE.md`'s Architecture "Layers" bullet for `ui/<screen>/` gains the
convention: screens with component tests have an `XContent` that takes state and
callbacks and touches no ViewModel.

### Gradle

`gradle/libs.versions.toml` (versions from the Compose BOM unless stated):

- `androidx-compose-ui-test-junit4` (`androidx.compose.ui:ui-test-junit4`)
- `androidx-compose-ui-test-manifest` (`androidx.compose.ui:ui-test-manifest`)
- `androidx-compose-ui-test-junit4-accessibility`
  (`androidx.compose.ui:ui-test-junit4-accessibility`, Compose 1.8+, which the BOM
  already exceeds)
- `screenshot-validation-api` (`com.android.tools.screenshot:screenshot-validation-api`)
  and plugin `screenshot = { id = "com.android.compose.screenshot", version = … }`,
  latest release (0.0.1-alpha16 or later; AGP 9 support arrived in alpha12).

`app/build.gradle.kts`:

- `androidTestImplementation(platform(libs.androidx.compose.bom))`, `ui-test-junit4`,
  `ui-test-junit4-accessibility`; `debugImplementation(ui-test-manifest)`, which supplies
  the empty `ComponentActivity` that `createComposeRule` hosts content in.
- The screenshot plugin, `experimentalProperties["android.experimental.enableScreenshotTest"] = true`
  in `android {}`, `android.experimental.enableScreenshotTest=true` in
  `gradle.properties`, and `screenshotTestImplementation` of the validation API and
  `ui-tooling`. The root `build.gradle.kts` gets the plugin with `apply false`.
- `testOptions { screenshotTests { imageDifferenceThreshold = … } }`: start at `0f`; see
  build-5 for when to raise it.

The screenshot plugin is Google's and renders through Layoutlib on the JVM: no
Robolectric, and no device. AGP 9.5 folds it into AGP's test suites; if Dependabot's
AGP bump to 9.5+ breaks the plugin, that PR moves to the test-suite form the
[migration table](https://developer.android.com/studio/preview/compose-screenshot-testing-with-testsuites)
describes.

### Component tests

`app/src/androidTest/java/io/github/dontpanic345/tortoisespelling/component/`, JUnit 4,
`createComposeRule()`, content wrapped in `TortoiseSpellingTheme(darkTheme = false)`.
Callbacks record what they were called with. Words come from `testWord`. Assert through
visible text where it's unique and through `TestTags` otherwise; a tag added for a
component test joins `TestTags.kt` only (component tests don't go through Appium, so
`e2e/support/testIds.ts` mirrors only tags the e2e suite uses).

**`ReviewContentTest`**, for a two-word queue unless stated:

- Prompting: the title reads "1 / 2"; the definition shows; the example shows with the
  word blanked, and the word itself appears nowhere; Check (`REVIEW_SUBMIT`) is disabled
  with blank input and enabled with some; typing reaches `onInputChange`; Check calls
  `onSubmit`.
- Missed, not revealed: "Not quite", "You typed" and the attempt show; the correct
  spelling doesn't; the field's label reads "Try again from memory"; "Show answer" calls
  `onShowAnswer`.
- Missed and revealed: the correct spelling shows beside the attempt; the button reads
  "Check retype". With `retypeMissed`, "Not yet: type it exactly as shown above." shows.
- Correct: `REVIEW_CORRECT_WORD` holds the word, the full example shows, the button
  reads "Continue". On the last word (`ending`), there is no button.
- Practice mode: the title reads "Extra practice".
- "End session" calls `onQuit`.

**`HomeContentTest`**:

- Loading: neither the first-run panel nor a Today card shows.
- No words: "No words yet" and "Add your first word"; the add-word button
  (`HOME_ADD_WORD`) calls `onAddWord`.
- Words due: the count and "words to practise today" (singular for 1), "N of them are
  new", "Reviewed today: N"; Start calls `onStartReview`.
- All done: the completion panel replaces the Today card; "Practise a few more anyway"
  calls `onPracticeMore`.
- The week card's streak reads "🔥 1 day in a row" and "🔥 3 days in a row".
- The More menu's Settings and All words call their callbacks.

**`WordListContentTest`**:

- No words: "No words yet", and no filter row (`WORD_FILTER_ROW` absent).
- A query matching nothing: "No matches" and `noMatchesBody`'s text.
- Rows: the title reads "All words (3)"; each row's status (`wordRowStatus`) shows its
  label; tapping a row calls `onEdit` with its id.
- Delete: the row's delete icon opens "Delete “rhythm”?"; Delete calls `onDelete` with
  that word, Cancel calls nothing.

**`CompletionPanelTest`**: "You practised 1 word today." / "…3 words…" / "Nothing was
due today."; no streak line at 0; the headline is "All done — see you tomorrow" only
when the next due day is tomorrow; "Next review: nothing scheduled yet" and "Next
review: in 5 days".

### Integration tests

`app/src/androidTest/java/io/github/dontpanic345/tortoisespelling/integration/`.

**`TestClock.kt`**: a mutable `Clock` in UTC, starting at a fixed Monday, 09:00
(2026-03-02), with `advanceDays(n)`.

**`AppHarness.kt`**: a JUnit rule (or a helper the tests call from `@Before`/`@After`)
that:

- builds `AppContainer(context, clock = testClock, fuzz = { today, days -> today + days },
  openDatabase = { Room.inMemoryDatabaseBuilder(context, TortoiseSpellingDatabase::class.java).build() },
  settingsFile = "integration-test-settings")`;
- deletes that preferences file before and after each test, and sets
  `reminderEnabled = false` so Home never raises the notification permission prompt
  over the test;
- closes the database after each test;
- offers `launch()`, which renders the real graph:
  `CompositionLocalProvider(LocalAppContainer provides container) { TortoiseSpellingTheme { TortoiseSpellingNavHost(startInReview = false, onReviewLaunchHandled = {}) } }`
  in `createAndroidComposeRule<ComponentActivity>()`. Tests seed first and call
  `launch()` after: Home loads its state once on creation, so words added after the
  content is set wouldn't show until the next resume;
- offers `nextDay()`: `activityRule.scenario.moveToState(CREATED)`, `advanceDays(1)`,
  `moveToState(RESUMED)`. That's the user coming back tomorrow: Home's `ON_RESUME`
  refresh is what picks up the new day, as on a phone;
- offers `spell(word)`: types into `REVIEW_ANSWER` and presses `REVIEW_SUBMIT`.

The review's auto-advance and the repository's writes run on real dispatchers, so tests
wait with `composeRule.waitUntil(timeoutMillis = 5_000) { … }` (on a node appearing, or
on the DAO under `runBlocking`), never with sleeps.

Tests (one class per journey; each seeds through `container.repository.addWord`, or the
DAO with `testWord` where a word needs a history):

- **`SchedulingJourneyTest`**, *a word answered correctly twice is due again in 6
  days*: add "necessary" on day D. Home shows 1 to practise; Start; spell it; the
  completion screen says "All done — see you tomorrow" and "Next review: tomorrow"; the
  row has repetitions 1 and `dueOn` D+1. Done, then `nextDay()`: Home shows 1 to
  practise; spell it again; "Next review: in 6 days"; `dueOn` is D+1+6 and there are two
  log rows, both correct. All words lists it as "in 6 days".
- **`LapseJourneyTest`**, *a miss comes back tomorrow, even when the session is
  abandoned*: seed a word reviewed twice (repetitions 2, interval 6) due on day D.
  Start, spell it wrong, see "Not quite", then "End session". The row has repetitions 0,
  lapses 1 and `dueOn` D+1; one log row with `correct = false` and the typed answer;
  Home says "You practised 1 word today." `nextDay()`: Home shows 1 to practise.
- **`PracticeJourneyTest`**, *extra practice leaves the schedule alone*: finish today's
  one-word session, choose "Practise a few more anyway", see "Extra practice", spell the
  word. Back on Home, the row equals its state before practice and the log count is
  unchanged.
- **`AllowanceJourneyTest`**, *new words are introduced a few a day*: set new words per
  day to 2 through `container.settings`, add three words. Home shows 2 to practise,
  "2 of them are new". Review both (find each by its definition).
  `nextDay()`: 3 to practise, "1 of them is new".
- **`StreakJourneyTest`**, *a quiet day bridges the streak*: review on day D and D+1
  (the word is then due on D+7). `nextDay()` to D+2: Home shows all done and
  "🔥 2 days in a row". `nextDay()` to D+3: still "🔥 2 days in a row", because D+2 was
  recorded as satisfied. (Without Home recording satisfied days the second check reads
  0, which build-3's mutation check confirms.)

If a test exposes an app bug, fix the cause, not the test, with a `CHANGELOG.md` line.

### Accessibility checks

`app/src/androidTest/java/io/github/dontpanic345/tortoisespelling/accessibility/ScreenAccessibilityTest.kt`:
`createAndroidComposeRule<ComponentActivity>()` with `enableAccessibilityChecks()` in
`@Before`. One test per state, each rendering an `XContent` (or `CompletionPanel`) from
the same fixture states the component tests use and calling
`onRoot().tryPerformAccessibilityChecks()`:

- Review: prompting, missed and revealed, correct.
- Home: no words, words due, all done.
- Word list: with rows, empty.
- Each of those in both light and dark theme (parameterised, or two tests a state):
  contrast is where dark themes go wrong.

The component and accessibility tests share one `Fixtures.kt` of states in
`…tortoisespelling.component`. The screenshot source set can't see androidTest, so it
keeps its own copy; they're a handful of literals.

Every failure is fixed in the app: a missing `contentDescription`, a touch target under
48 dp, low contrast. Where a design choice and a check disagree (the deliberately quiet
"Practise a few more anyway" button, for instance), keep the intent and meet the check:
it may stay small and muted, but it must reach the contrast and target minimums. A check
is suppressed only through the validator's result matcher, with a one-line reason, and
only for a false positive. Each fix gets a `CHANGELOG.md` line under `### Fixed`.

### Screenshot tests

`app/src/screenshotTest/kotlin/io/github/dontpanic345/tortoisespelling/screenshot/`:
`@PreviewTest`-annotated `@Preview` functions for the same states as the accessibility
checks, each in light and dark (`uiMode = UI_MODE_NIGHT_YES` with
`TortoiseSpellingTheme(darkTheme = true)`), at the default phone size. Fixed dates and
words only: nothing reads the clock (the content composables take `today` from state).

- `./gradlew updateDebugScreenshotTest` writes the references to
  `app/src/screenshotTestDebug/reference/`, which are committed.
- `./gradlew validateDebugScreenshotTest` compares, and fails on a difference; its
  report is under `app/build/reports/screenshotTest/`.
- A deliberate UI change re-runs `update` and commits the new references in the same
  commit, after looking at them.

References are recorded wherever build-5 runs and validated on Linux in CI. Jogging runs
in the cloud, on Linux, so the two should match exactly; Layoutlib bundles its own fonts.
A later `update` run on Windows (Alan's PC) can differ by a few pixels in font rendering,
so CI's Linux rendering is authoritative. If CI fails on a reference that's visually the
same, raise `imageDifferenceThreshold` to the smallest value that passes (no higher than
`0.01f`, 1%). If that isn't enough, CI is the reference platform: download the CI run's
rendered images (`gh run download`), commit them as the references, and say in
`CLAUDE.md` that local validation on Windows may then fail and isn't authoritative.
Record which happened in this spec.

### Release smoke run

The CLAUDE.md warning: anything reflective can work in debug and break under R8. The
risky paths are Room, kotlinx-serialization (backup), WorkManager (it instantiates
`ReminderWorker` by name) and Compose navigation.

**`e2e/features/release_smoke.feature`**, tagged `@release-smoke`, one scenario in the
user's voice that seeds nothing (the release build has no `SeedWordsActivity`) and uses
only existing steps:

```gherkin
@release-smoke
Feature: The release build works end to end
  As a learner installing the published APK
  I want the build that R8 has shrunk to behave like the one that was tested
  So that a release can't lose my words or my reminder

  Scenario: Add a word, get reminded, review it, and back the list up
    Given I have no words yet
    And Downloads has no Tortoise Spelling test files
    When I add the word "necessary" defined as "needed or required"
    Then I am told "Added ✓ (1 total)"
    When I go back to Home
    And I open Settings
    And I choose "Send a test notification"
    Then a notification "Time to practise spelling" arrives saying "1 word ready"
    When I go back to Home
    And I start today's session
    And I spell it "necessary"
    Then I am told the correct word "necessary"
    And the session moves on by itself to the finish line
    When I choose "Done"
    And I open Settings
    And I export a backup to Downloads as "e2e-backup.json"
    Then I am told "Backup saved."
    Given Downloads has a backup "e2e-two-words.json" containing "rhythm" and "necessary"
    When I import "e2e-two-words.json" from Downloads
    Then I am told "Imported 1 word, skipped 1 already in your list."
```

Adjust step wording to the existing step definitions where they differ (the build step
checks with `check-steps -- --all`); add no new step unless one is unavoidable.

- `e2e/support/config.ts`: `DEFAULT_TAGS` gains `and not @release-smoke`. The scenario
  duplicates journeys the default run already covers on the debug build.
- `e2e/package.json`: `"e2e:release": "wdio run ./wdio.conf.ts --cucumberOpts.tags=@release-smoke"`.
- `e2e/README.md`: the release section uses `npm run e2e:release`; the tag table gains
  `@release-smoke`.

**`.github/workflows/release-smoke.yml`**, `on: workflow_call` and `workflow_dispatch`:

- One job, "Release build smoke test (emulator)", `timeout-minutes: 60`.
- Checkout, `setup-java` (temurin 17, gradle cache) and `setup-node` (22, npm cache on
  `e2e/package-lock.json`), as in `ci.yml`; enable KVM as the `data` job does.
- Sign with a throwaway key generated in the job, never the release secrets:
  `keytool -genkeypair -keystore "$RUNNER_TEMP/smoke.keystore" -storepass android -keypass android -alias smoke -keyalg RSA -keysize 2048 -validity 1 -dname CN=smoke`,
  then `./gradlew assembleRelease` with the four `RELEASE_*` variables pointing at it.
  Same commit and same R8 configuration as the published APK, different signature.
- `npm ci` in `e2e/`.
- `reactivecircus/android-emulator-runner` at **API 34**, `x86_64`,
  `target: google_apis`, `disable-animations: true`, `working-directory: e2e`, script
  `npm run e2e:release`, with `APK` set to the release APK's absolute path. API 33+ is
  needed for the notification permission the scenario's reset grants.
- On failure, upload `logs/` (the e2e failure artefacts and the Appium log).

`release.yml`: a `smoke` job (`needs: check`, same `if`, `uses:
./.github/workflows/release-smoke.yml`), and `build-and-release` needs `[check, test,
smoke]`. Its header comment gains one line: a release also waits for the release-build
smoke run.

Locally: build a release APK signed with the debug key (the command in `e2e/README.md`)
and run `APK=../app/build/outputs/apk/release/app-release.apk npm run e2e:release`.

### CI

`ci.yml`:

- `test-data-layer`'s `data` job becomes a matrix job, `instrumented`, named
  `${{ matrix.layer }} tests (emulator)`, with `strategy.fail-fast: false` and
  `matrix.layer: [data, component, integration, accessibility]`. Every step is the
  `data` job's, with `package=io.github.dontpanic345.tortoisespelling.${{ matrix.layer }}`
  and artefacts named per layer, and `api-level` from the matrix (`include:` entries).
  API 26, the oldest Compose runtime a user has, for `data`, `component` and
  `integration`. API 34 for `accessibility`: the checks are about colours, sizes and
  labels, which don't vary with the API level, and the Compose accessibility checks may
  not run on old APIs at all; a check that silently does nothing would pass.
- A `screenshots` job, "Screenshot tests": checkout, `setup-java`,
  `./gradlew validateDebugScreenshotTest`, and on failure upload
  `app/build/reports/screenshotTest/` and `app/build/outputs/screenshotTest-results/`.
- The header comment lists what runs: unit, lint, the four instrumented layers on an
  emulator, screenshots, scripts and the e2e checks; the Appium suite still doesn't run
  here, and its release smoke runs from `release.yml`.

### Docs

Each build step updates the docs its change makes true:

- `CLAUDE.md`:
  - Commands: one line per instrumented layer (`component`, `integration`,
    `accessibility`, beside `data`), `updateDebugScreenshotTest`,
    `validateDebugScreenshotTest`, and `npm run e2e:release` in the e2e bullet.
  - The layer table gains Component, Integration, Accessibility, Screenshot and Release
    smoke rows (where, runs on).
  - Architecture, "Dates are epoch days": today comes from `Days.today(clock)` with
    `AppContainer.clock` (`DeviceClock` in the app); nothing in `data/`, `domain/` or
    `ui/` reads the system clock directly, and the reminder is the exception.
  - Architecture, "Scheduling": the fuzz is the repository's `fuzz` parameter.
  - Architecture, "Wiring": `LocalAppContainer` lets a test supply its own container.
  - Architecture, "Layers": the `XScreen`/`XContent` split.
  - CI bullet and Release section: the per-layer jobs, the screenshot job, and the
    release smoke gate.
- `README.md`, "Releases" paragraph: the release workflow also runs a smoke test of the
  minified build on an emulator before publishing.
- `e2e/README.md`: as under "Release smoke run".
- `docs/testing-and-web-plan.md`, "Where things stand": component, integration,
  accessibility, screenshot and release smoke layers exist; what's left is the web app.
- `PRIVACY.md`: no change. `CHANGELOG.md`: only for fixes (build-3, build-4).

## Build steps

Each step follows `CLAUDE.md`'s Workflow and `PROTOCOL.md`. "Passing" means every command
exits 0. Connected runs and e2e go to the device `PROTOCOL.md` names: in the cloud,
`ANDROID_SERIAL` already points at the spare phone (rerun `bash jogging/cloud-setup.sh`
if `adb devices` doesn't list it); on a PC, start the emulator if `adb devices` lists none
and set `ANDROID_SERIAL` to its serial. `<layer X>` abbreviates:

```bash
./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.package=io.github.dontpanic345.tortoisespelling.X
```

`<e2e F…>` abbreviates `cd e2e && npm run e2e -- --spec features/F.feature …`, one
`--spec` per file: in the cloud, e2e crosses a slow link to the phone, so build steps run
only the features covering what they changed, and the review step runs the whole suite.

On Alan's PC `gh`'s active account is a work one: export
`GH_TOKEN=$(gh auth token --user DontPanic345)` before any `gh` command.

### build-1: injectable clock and fuzz (Sonnet, medium)

Everything under "The clock" and "Reaching the container from a test", with
`CLAUDE.md`'s Dates, Scheduling and Wiring notes. Add unit tests to `DaysTest`:
`today(clock)` for a fixed clock just either side of midnight in a non-UTC zone, and
`DeviceClock.zone` following `TimeZone.setDefault` (restored in `finally`).

Acceptance:

```bash
./gradlew assembleDebug testDebugUnitTest lintDebug assembleDebugAndroidTest
grep -rnE 'Days\.today\(\)|LocalDate\.now\(\)|LocalTime\.now\(\)|System\.currentTimeMillis\(\)|systemDefaultZone' app/src/main
                                      # only Word.kt's and Backup.kt's defaults
<layer data>                          # still passes
<e2e review completion daily_allowance word_list add_word>   # repository, Home, Completion, word list
```

### build-2: screen content split and component tests (Sonnet, medium)

The Gradle test dependencies (not the screenshot plugin), the `XContent` split for
Review, Home and the word list, and the four component test classes. `CLAUDE.md`:
the component command, its layer row, and the Layers convention.

Acceptance:

```bash
./gradlew assembleDebug testDebugUnitTest lintDebug assembleDebugAndroidTest
<layer component>                     # every component test passes
<e2e review completion daily_allowance word_list>   # the screens were restructured
```

- Temporarily make Check enabled on blank input: a `ReviewContentTest` test fails.
  Temporarily drop the `ending` condition on the button: another fails. Revert both.

### build-3: integration tests (Sonnet, medium)

`TestClock`, `AppHarness`, the five journey tests, `TortoiseSpellingNavHost` made
`internal`. `CLAUDE.md`: the integration command and its layer row.

Acceptance:

```bash
./gradlew testDebugUnitTest lintDebug assembleDebugAndroidTest
<layer integration>                   # five tests pass
```

- Temporarily change SM-2's second interval from 6 to 5: `SchedulingJourneyTest` fails.
  Temporarily remove `markTodaySatisfied()` from `HomeViewModel.refresh`:
  `StreakJourneyTest` fails. Revert both.
- If a test exposes an app bug, fix it here with a `CHANGELOG.md` line, and run the e2e
  features covering it too. Otherwise only `androidTest` and the one `internal` changed,
  and e2e isn't needed.

### build-4: accessibility checks (Sonnet, medium)

The accessibility dependency and `ScreenAccessibilityTest`, and a fix in the app for every
real finding. `CLAUDE.md`: the accessibility command and its layer row.

Acceptance:

```bash
./gradlew assembleDebug testDebugUnitTest lintDebug assembleDebugAndroidTest
<layer accessibility>                 # passes, in both themes
<layer component>                     # still passes after any fix
```

- Temporarily remove the "End session" icon's `contentDescription`: a test fails. Revert.
- If app code changed, run the e2e features covering the changed screens and add the
  `### Fixed` lines. Record each fix
  and any suppression (with its reason) in the log entry.

### build-5: screenshot tests (Sonnet, medium)

The screenshot plugin and properties, the preview tests, the committed references, and
the `screenshots` CI job (so the step can see whether Windows-recorded references pass on
Linux). `CLAUDE.md`: the two commands and the Screenshot row.

Acceptance:

```bash
./gradlew updateDebugScreenshotTest   # writes app/src/screenshotTestDebug/reference/
./gradlew validateDebugScreenshotTest testDebugUnitTest lintDebug
git push
gh run watch "$(gh run list --workflow ci.yml --commit "$(git rev-parse HEAD)" --limit 1 --json databaseId -q '.[0].databaseId')" --exit-status
```

- Look at every reference image: each state renders as the app does, dark is dark, and
  nothing is clipped or blank.
- Temporarily change a string in `CompletionPanel`: `validateDebugScreenshotTest` fails.
  Revert.
- The run's `screenshots` job is green. If it isn't because of cross-platform rendering,
  follow "Screenshot tests" above and record the outcome in this spec.

### build-6: release smoke run (Sonnet, high)

`release_smoke.feature`, the npm script and default-tag change, `release-smoke.yml`, the
`smoke` job in `release.yml`, and the `e2e/README.md`, `README.md` and `CLAUDE.md`
Release notes. High effort: getting Appium to run on a CI emulator usually takes a few
rounds of reading logs.

Acceptance:

```bash
cd e2e && npm run check-steps -- --all && npm run typecheck && npm run check-steps
RELEASE_KEYSTORE_PATH=~/.android/debug.keystore RELEASE_KEYSTORE_PASSWORD=android \
  RELEASE_KEY_ALIAS=androiddebugkey RELEASE_KEY_PASSWORD=android ./gradlew assembleRelease
cd e2e && APK=../app/build/outputs/apk/release/app-release.apk npm run e2e:release   # 1 scenario passes
git push
gh workflow run release-smoke.yml --ref main
gh run watch "$(gh run list --workflow release-smoke.yml --limit 1 --json databaseId -q '.[0].databaseId')" --exit-status
```

- `npm run check-steps` (default tags) doesn't list the smoke scenario.
- The dispatched run is green and its log shows the scenario passed. Fix emulator or
  Appium problems in follow-up commits until it is; record any departure from the YAML
  above (API level, target, action version) in this spec.
- `release.yml` is checked by reading: `build-and-release` can't start before `smoke`
  succeeds. It isn't run: it would publish a release.

### build-7: CI matrix and the plan doc (Sonnet, medium)

The `instrumented` matrix job replacing `data`, the `ci.yml` header, the CI bullet in
`CLAUDE.md`, and `docs/testing-and-web-plan.md`'s "Where things stand".

Acceptance:

```bash
node --test 'scripts/*.test.mjs'
./gradlew testDebugUnitTest lintDebug
git push
gh run watch "$(gh run list --workflow ci.yml --commit "$(git rev-parse HEAD)" --limit 1 --json databaseId -q '.[0].databaseId')" --exit-status
```

- The run shows four instrumented jobs and the screenshot job, all green, and each
  instrumented job's test count matches the local run of that layer.

### review (Sonnet, medium)

Review the piece against this spec and `GOALS.md`: no clock read left outside the
allowed list; the content split changed no behaviour; every component, integration and
accessibility test fails under its build step's mutation; no test waits with a sleep;
the reminder code untouched; docs match the commands; no war-story comments. Re-run
build-1's grep, `./gradlew testDebugUnitTest lintDebug validateDebugScreenshotTest`, the
component and integration layers, and the e2e suite, and check the latest CI run on
main is green. If build-3 or build-4 changed the app for users, finish with
`node scripts/bump-version.mjs patch`, committed and pushed, which runs the release and
its smoke job for real; watch that run to the end.

## What later pieces rely on

- **`word-forms`**: the review screen's state grows (the chosen form and sentence).
  `ReviewContent` takes the new state, and `ReviewContentTest`, the accessibility and
  screenshot fixtures follow it. The integration harness seeds words through the
  repository, so the new tables come for free; `SchedulingJourneyTest` must still pass
  unchanged (goal 4), and a new journey test covers the least-recently-shown rotation
  across two sessions with `nextDay()`. Word-list search by form gets a
  `WordListContentTest` case only if the content's inputs change; the matching itself is
  a unit test.
- **`copy-prompt`** and **`drop-api-key`**: when they rewrite Add and Settings, they
  split them into `AddWordContent`/`SettingsContent` and add component tests for their
  new states (copy prompt, paste-back validation messages), plus accessibility and
  screenshot states for them. `drop-api-key` deletes `CardRefresher`'s clock parameter
  along with it, and the release smoke scenario must keep passing.
- **`web-core`**: ports `Days.today(clock)`, the `fuzz` parameter and `TestClock` as they
  are here, so the Kotlin journeys and golden tests translate one for one.
- **`shared-specs`**: `@release-smoke` is an Android-only tag (`@android` once platform
  tags exist); the web app has no R8 step.

**build-5 outcome.** `imageDifferenceThreshold` is not in AGP 9.4's `screenshotTests` DSL (unresolved reference), so the default (exact match) applies. References were recorded on Linux in the cloud; the `screenshots` CI job's result is unverified (no `gh` login in that session), so `review` must check it is green and, if cross-platform rendering is the cause, follow "Screenshot tests" above.

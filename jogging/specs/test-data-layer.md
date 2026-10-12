# Piece: test-data-layer

androidTest scaffolding, Room DAO tests, the 1→2 migration test, per-layer commands and a
CI job. Source: `docs/testing-and-web-plan.md`, layer 2 ("Data") and steps 1–2 of its
"Suggested order".

## What it delivers

The app gets its first instrumented tests, in `app/src/androidTest/`, run against real
SQLite on an emulator:

- a **migration test** for 1→2, and a chain test that takes a version 1 database through
  every migration to the current version, so each future schema change is tested from
  the oldest data a user can have;
- **DAO tests** for every query's filtering and ordering, the unique index and the
  review log's foreign key;
- a few **repository tests** for the paths that guard the word list: import merging,
  duplicate detection, and `recordReview` re-reading the row before it writes;
- a **command per layer** and a **CI job** for the data layer, so a release can't be cut
  from a commit whose migrations fail.

Goals it leans on: 1 (every schema change has a migration test; this piece builds the
harness the next schema change, `word-forms`, needs), 7 (testing pyramid, minimal
dependencies, existing idiom) and 6 (CI runs on GitHub's free runners; the repo is
public). Goals 2–5 are untouched: no app behaviour changes. Test-only, so no version bump
and no `CHANGELOG.md` line.

## Design

### Layer selection

One package per layer under `androidTest`, as the plan proposes, selected with the
instrumentation runner's `package` argument. The data layer's package is
`io.github.dontpanic345.tortoisespelling.data`, the same as the code under test, so the
tests can reach `internal` members such as the migrations.

```bash
./gradlew connectedDebugAndroidTest \
  -Pandroid.testInstrumentationRunnerArguments.package=io.github.dontpanic345.tortoisespelling.data
```

No custom Gradle task: the runner argument already does the selection, and a task that
rewrote runner arguments at configuration time would be cleverer than it's worth
(goal 7). Each layer is one documented command in `CLAUDE.md` and one CI job.

`connectedDebugAndroidTest` runs on **every** attached device and uninstalls the app
afterwards, which deletes its data. Local runs set `ANDROID_SERIAL` to the emulator's
serial (`emulator-5554` for the first one). Debug and release share an application id,
so this matters on any phone with a real word list; the rule joins `CLAUDE.md` next to
the e2e suite's identical warning.

### Gradle

`gradle/libs.versions.toml`:

- `androidx-test-runner` (`androidx.test:runner`) and `androidx-test-ext-junit`
  (`androidx.test.ext:junit`), latest stable (at least 1.7.0 and 1.3.0, which are in the
  local Gradle cache).
- The existing `androidx-room-testing`.
- Plugin `androidx-room = { id = "androidx.room", version.ref = "room" }`.

`app/build.gradle.kts`:

- Apply the Room Gradle plugin and replace the `ksp { arg("room.schemaLocation", …) }`
  block with `room { schemaDirectory("$projectDir/schemas") }`, keeping the comment about
  no destructive fallback. Room's docs say the plugin adds the schema directory to the
  instrumented tests' assets, which `MigrationTestHelper` reads; with only the KSP
  argument, that has to be done by hand. If the plugin turns out not to add them (the
  migration test fails with a missing `1.json`), add
  `sourceSets.getByName("androidTest").assets.srcDir("$projectDir/schemas")` instead and
  say so in this spec. The root `build.gradle.kts` gets the plugin with `apply false`,
  like the others.
- The plugin must not change the exported schemas: after a build, `git status
  app/schemas` is clean.
- `androidTestImplementation`: `androidx-test-runner`, `androidx-test-ext-junit`,
  `androidx-room-testing`, `kotlinx-coroutines-test`.
- `testInstrumentationRunner` is already `androidx.test.runner.AndroidJUnitRunner`.

Dependabot's `gradle` ecosystem picks up the new entries with no config change.

### Database: one list of migrations

`data/TortoiseSpellingDatabase.kt`:

- `internal const val DATABASE_VERSION = 2`, top level in the file, used by
  `@Database(version = DATABASE_VERSION, …)`. Room's `@Database` isn't readable at run
  time, and the chain test needs the current version.
- `internal val ALL_MIGRATIONS: Array<Migration> = arrayOf(MIGRATION_1_2)` in the
  companion, and `build()` calls `.addMigrations(*ALL_MIGRATIONS)`. The builder and the
  chain test then share one list, so a migration added to the builder is tested from
  version 1 automatically.

No schema change, so no new schema JSON and no migration of its own.

### Test files

All under `app/src/androidTest/java/io/github/dontpanic345/tortoisespelling/data/`, JUnit 4
with `@RunWith(AndroidJUnit4::class)`, suspend calls inside `runTest`. NZ spelling in
names and messages.

**`TestWords.kt`**: a fixture builder, `testWord(text, …)`, returning a `Word` with every
field defaulted (`normalizedText` from `normalizeWord(text)`, `dueOn = 0`), so a test
names only the fields it cares about. Shared by every data test, and by later layers.

**`MigrationTest.kt`**, with `MigrationTestHelper(InstrumentationRegistry.getInstrumentation(),
TortoiseSpellingDatabase::class.java)` as a rule (the `SupportSQLiteDatabase` flavour,
matching the app; no `SQLiteDriver`):

- *1→2 keeps every word and review.* Create a version 1 database and insert, with
  `ContentValues` against the v1 columns (`app/schemas/.../1.json`):
  - a reviewed word with every scheduling column away from its default (repetitions 3,
    easeFactor 2.36, intervalDays 6, a `dueOn`, lapses 1, `lastReviewedAt`,
    `firstReviewedOn`, `isNew` 0);
  - a new word with `partOfSpeech`, `lastReviewedAt` and `firstReviewedOn` null;
  - a suspended word whose text has a non-ASCII letter and mixed case ("Café");
  - three `review_log` rows across two of the words.

  Run `runMigrationsAndValidate(name, 2, true, MIGRATION_1_2)`. On the returned
  database, check every v1 column of every row is unchanged, `autoRefresh` is 0 and
  `refreshedOn` is null, the logs are unchanged, and `PRAGMA foreign_key_check` returns
  no rows.
- *Room reads the migrated data.* Close the helper's database and open the same file with
  `Room.databaseBuilder(targetContext, TortoiseSpellingDatabase::class.java, name)
  .addMigrations(*ALL_MIGRATIONS)`. `dao().allWordsOnce()` returns the three words as the
  `Word` values expected (booleans mapped, nulls null), and `dueWords`/`newWords` see
  the reviewed and new word respectively. Close it.
- *Every migration, from version 1.* Create a version 1 database with the same rows and
  run `runMigrationsAndValidate(name, DATABASE_VERSION, true, *ALL_MIGRATIONS)`, then
  check the word and log counts are unchanged. This is the test that fails if a
  migration is missing from `ALL_MIGRATIONS`, or if a schema JSON is missing.

The v1 inserts live in one helper inside the test file, used by all three tests.

**`TortoiseSpellingDaoTest.kt`**, on `Room.inMemoryDatabaseBuilder(...)`, opened in
`@Before` and closed in `@After`. One test per behaviour, roughly:

| Query | Checks |
|---|---|
| `insertWord` | A second word with the same `normalizedText` throws `SQLiteConstraintException`. |
| `wordById`, `wordByNormalizedText` | Found and not found. |
| `dueWords`, `dueCount` | Overdue and due today in, tomorrow out, new out, suspended out; ordered by `dueOn`; count agrees. |
| `newWords`, `availableNewCount` | Only new, unsuspended words; oldest `createdAt` first; `LIMIT` respected. |
| `introducedOn` | Counts by `firstReviewedOn`, not by review. |
| `nextDueDay` | Minimum over scheduled, unsuspended words; null with none. |
| `randomWords` | Never suspended; at most `limit`. |
| `observeAllWords` | Newest first; emits again after an insert. |
| `allWordsOnce`, `firstCreatedAt`, `wordCount` | Oldest first; null and 0 when empty. |
| `updateContent`, `markRefreshed` | Change only their own columns; every scheduling column is untouched. |
| `reviewedCountOn` | Distinct words, so two logs for one word count once. |
| `recentStudyDays` | Distinct days, newest first, `LIMIT` respected. |
| Foreign key | Deleting a word deletes its logs (`CASCADE`); a log for a missing word is refused. |
| `clearWords`, `clearLogs` | Empty afterwards. |

If the foreign key tests fail, that's a real finding about the shipped app (orphaned logs
would feed the streak): fix the cause, don't loosen the test.

**`WordRepositoryTest.kt`**, a real `WordRepository` over the in-memory database and
`SettingsStore(targetContext)` (no test here writes a setting). Dates come from
`Days.today()`, as the repository's do; an injectable clock belongs to `test-ui-layers`.

- `addWord` trims and rejects a duplicate that differs only in case and spacing.
- `updateWord` renaming onto an existing word returns `Duplicate` and changes nothing.
- `importWords` adds new words, skips blanks and words already present (including a
  repeat within the same import), and leaves an existing word's scheduling exactly as it
  was.
- `recordReview` given a stale snapshot, after `refreshContent` has rewritten the
  definition, keeps the new definition and still writes the scheduling and one log row.

### CI

`.github/workflows/ci.yml` gets a third job, `data`, "Data layer tests (emulator)":

```yaml
  data:
    name: Data layer tests (emulator)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-java@v6     # as in the app job: temurin 17, cache gradle
      - name: Enable KVM
        run: |
          echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666", OPTIONS+="static_node=kvm"' \
            | sudo tee /etc/udev/rules.d/99-kvm4all.rules
          sudo udevadm control --reload-rules
          sudo udevadm trigger --name-match=kvm
      - uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: 26
          arch: x86_64
          target: default
          disable-animations: true
          script: ./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.package=io.github.dontpanic345.tortoisespelling.data
      - upload app/build/reports/androidTests/ and app/build/outputs/androidTest-results/
        with actions/upload-artifact@v7 on failure, as the app job does
```

- **API 26 in CI**, the app's `minSdk`: its SQLite (3.18) is the oldest any user has, and
  migrations fail on old SQLite, not new (`ALTER TABLE … RENAME COLUMN`, for one, needs
  3.25). Local runs on the `Medium_Phone` AVD (API 37) cover the newest. If API 26 can't
  boot reliably on the runner, use the lowest level that does and record which in this
  spec.
- Use the action's current major; check its README rather than trusting `@v2`.
- No AVD cache: one cold boot per run is a few minutes, and a cache is one more thing to
  go stale.
- `release.yml` already calls `ci.yml`, so a release now waits for the data layer too.
- Update the workflow's header comment: the Appium scenarios still don't run in CI, the
  data layer does.

### Docs

- `CLAUDE.md`:
  - Commands block: the data-layer command above, with a comment
    `# data layer tests, on the emulator (set ANDROID_SERIAL)`, and
    `./gradlew assembleDebugAndroidTest   # compile the instrumented tests, no device`.
  - The layer table gains a row: Data tests | `app/src/androidTest/.../data/` |
    Emulator, real SQLite. Add one sentence under it: each instrumented layer has its own
    package under `androidTest`, selected with the runner's `package` argument.
  - The CI bullet: CI also runs the data layer on an API 26 emulator.
  - A bullet: connected tests run on every attached device and uninstall the app, so set
    `ANDROID_SERIAL` to the emulator and never run them on a phone with real data.
  - "Secrets and data safety", Room bullet: a schema change also appends its `Migration`
    to `ALL_MIGRATIONS`, bumps `DATABASE_VERSION`, and adds a test to `MigrationTest`
    that seeds the previous version and checks every column comes through.
- `docs/testing-and-web-plan.md`, "Where things stand": the data layer exists
  (`app/src/androidTest/.../data/`, run in CI on API 26); the gaps left are component
  and integration tests.
- `README.md`, `PRIVACY.md`, `CHANGELOG.md`: no change.

## Build steps

Each step follows `CLAUDE.md`'s Workflow and `PROTOCOL.md`. "Passing" means every command
exits 0. Start the emulator if `adb devices` lists none, and set
`ANDROID_SERIAL=emulator-5554` (or whatever serial `adb devices` shows for it) for every
connected run. The data-layer command is abbreviated below as `<data>`:

```bash
./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.package=io.github.dontpanic345.tortoisespelling.data
```

### build-1: scaffolding and the migration tests (Sonnet, medium)

Gradle changes, `DATABASE_VERSION` and `ALL_MIGRATIONS`, `TestWords.kt` and
`MigrationTest.kt`.

Acceptance:

```bash
./gradlew assembleDebug testDebugUnitTest lintDebug assembleDebugAndroidTest
git status --short app/schemas        # prints nothing
<data>                                # MigrationTest: 3 tests, all pass
cd e2e && npm run e2e                 # the build and database wiring changed
```

- Temporarily delete the `refreshedOn` `ALTER TABLE` from `MIGRATION_1_2`: the
  migration tests fail. Temporarily remove `MIGRATION_1_2` from `ALL_MIGRATIONS` only:
  the chain test fails. Revert both.
- The HTML report under `app/build/reports/androidTests/connected/` lists the tests.

### build-2: DAO and repository tests (Sonnet, medium)

`TortoiseSpellingDaoTest.kt` and `WordRepositoryTest.kt`.

Acceptance:

```bash
./gradlew testDebugUnitTest lintDebug assembleDebugAndroidTest
<data>                                # every data-layer test passes
```

- Temporarily change `dueWords`' `dueOn <= :today` to `<`: a DAO test fails. Revert.
- If a test exposes a bug in app code, fix it in this step, add a `CHANGELOG.md` line
  under `### Fixed`, and run the e2e suite too. Otherwise the step touches only
  `androidTest`, and e2e isn't needed.

### build-3: CI job and docs (Sonnet, medium)

The `data` job in `ci.yml` and the **Docs** changes. CI is the check here, so push and
watch the run. On Alan's PC `gh`'s active account is a work one, so export
`GH_TOKEN=$(gh auth token --user DontPanic345)` first.

Acceptance:

```bash
node --test 'scripts/*.test.mjs'
./gradlew testDebugUnitTest lintDebug
git push
gh run watch "$(gh run list --workflow ci.yml --branch main --limit 1 --json databaseId -q '.[0].databaseId')" --exit-status
```

- The run's `data` job is green and its log shows the data-layer tests ran on API 26
  (the test count matches the local run).
- If the job fails for emulator reasons, fix it in follow-up commits until green; record
  any departure from the YAML above (API level, action version) in this spec.

### review (Sonnet, medium)

Review the piece against this spec and `GOALS.md`: every v1 column checked by the
migration test, the chain test driven by `ALL_MIGRATIONS` and `DATABASE_VERSION`, no
test that passes vacuously (each mutation in the build steps still fails it), the docs
match the commands, no war-story comments. Re-run build-2's acceptance and check the
latest CI run on main is green. No version bump: the piece is test-only.

## What later pieces rely on

- **`word-forms`** (schema version 3): appends `MIGRATION_2_3` to `ALL_MIGRATIONS`, bumps
  `DATABASE_VERSION`, and adds a test to `MigrationTest` that seeds version 2 (the
  helper's v1 rows migrated, plus `autoRefresh`/`refreshedOn` values) and checks each
  word becomes one `Definition`, one base `WordForm` and one `ExampleSentence`. The
  chain test then covers 1→3 with no change. New DAOs get tests in the same package, and
  `testWord` grows whatever the new entities need.
- **`drop-api-key`** (the next schema change after that): deletes the `updateContent`,
  `markRefreshed` and `refreshContent` tests along with the code. The chain test from
  version 1 must keep passing.
- **`test-ui-layers`**: reuses the runner, `androidx-test-ext-junit` and the layer
  convention. Component tests go in `io.github.dontpanic345.tortoisespelling.component`,
  integration tests in `…integration`, each with its own command and a CI job copied
  from `data` with a different `package`. `testWord` is the shared fixture.

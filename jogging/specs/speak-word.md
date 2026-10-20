# Piece: speak-word

A **Hear the word** button on the review screen that speaks the asked word form aloud
with the device's own text-to-speech, on Android and the web. Sources: the grilling
session of 2026-10-17/18 with Alan, whose answers are recorded below as decisions. There
is no separate design doc and no `spec` step: this spec was written in that session. A
`spec-review` session (2026-10-18) checked it against the code and corrected it.

## What it delivers

- A speaker icon button to the right of the review's answer field, labelled "Hear the
  word" for screen readers, in the same place on both apps.
- A tap speaks the form the card asks for ("ran", not "run"), never the root and never
  the sentence.
- It works all through a card: before the first attempt, after a miss, during the
  mandatory retype and on the Correct phase. Speaking changes nothing about grading.
- English only, at 0.8× speed, using the device's own English variant when there is a
  voice for it, otherwise any English voice. On-device voices only.
- When there is no usable voice or engine, the button is hidden.

Goals it leans on:

- **3 / privacy.** Nothing leaves the device: network voices are never chosen, on either
  platform. `PRIVACY.md` says speech is synthesised on the device.
- **4.** Grading and scheduling are untouched.
- **5.** Both apps in one piece, the voice rule as a shared pure function with golden
  cases, and one shared Gherkin scenario.
- **7.** No new dependency: Android's `TextToSpeech` and the browser's `speechSynthesis`.

### Decisions (settled with Alan)

- Tap only. No auto-speak setting; that can be a later piece.
- Only the asked form is spoken; reading the example sentence is a later piece if wanted.
- Hidden, not disabled, when nothing can speak.
- English chosen by the rule under "Choosing the voice", ignoring a non-English device
  locale.
- Web uses voices with `localService === true` only; Android uses voices whose
  `isNetworkConnectionRequired` is false. If that leaves none, the button is hidden.
- Rate 0.8, the same constant on both apps.
- Ends with a minor version bump (it changes the Android app for users).

## Design

### Choosing the voice (pure, shared)

`domain/Speech.kt` and `web/src/domain/speech.ts`:

```kotlin
const val SPEECH_RATE = 0.8f

/** The voice to speak with: its index in [voices], or null when none will do. */
fun chooseVoice(voices: List<String>, deviceLocales: List<String>): Int?
```

`voices` are the language tags of the **on-device** voices only (the caller filters out
network voices), in the caller's order. It returns an index, not a tag, because an engine
often has several voices with the same tag (Google's has many `en-US` ones), so a tag
can't find the voice again.

Tags are compared case-insensitively with `_` read as `-` (some engines and browsers
report `en_US`), and on their **language and region only**: the first subtag, and the
first later subtag of two letters or three digits (so a script like `Latn` is skipped).
Everything else is ignored, because Android 14's regional preferences put Unicode
extensions on the device locale (`en-NZ-u-mu-celsius`). A tag with no region (`en`) has
only a language. The rule:

1. For each device locale in preference order whose language is `en` and which has a
   region, the first voice with the same language and region.
2. Otherwise the first voice whose language is `en`, taking voices in their given order.
3. Otherwise null.

Golden: a new `golden/speech.json` (one file per domain area, like `pick.json` for
`CardPick.kt`), with a `SpeechGoldenTest.kt` and a `web/test/golden/speech.test.ts`, and
a row for it in `golden/README.md`'s file table. Its `chooseVoice` cases
give the expected index. Cases at least: en-NZ device with en-NZ, en-GB, en-US voices →
0; en-NZ device with en-GB, en-NZ voices → 1; en-NZ device with only en-GB and en-US → 0
(first given); `en_NZ` voice tag matched by an `en-NZ` device locale; case-insensitive
match; `en-NZ-u-mu-celsius` device locale matching an `en-NZ` voice; two `en-US` voices →
the first; device locales fr-FR then en-AU with an en-AU voice → its index; fr-FR device
only, en-US voice → 0; bare `en` device locale with en-GB, en-US → 0; bare `en` voice; no
English voice → null; no voices → null. Add a `speechRate` key holding 0.8, and have each
runner assert its constant equals it.

### Android

- `ui/review/Speaker.kt`: `interface Speaker { val ready: StateFlow<Boolean>; fun speak(text: String); fun shutdown() }`.
- `ui/review/TtsSpeaker.kt`: wraps `TextToSpeech`, built with the application context.
  On `onInit` success, it takes `voices` (null counts as none), keeps those with
  `!isNetworkConnectionRequired` and without `TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED`
  in `features`, sorts them by `name` (`voices` is a `Set`, so its order isn't stable),
  calls `chooseVoice` with their `locale.toLanguageTag()`s and the device's
  `LocaleList.getDefault()` tags, sets the voice at that index and
  `setSpeechRate(SPEECH_RATE)`, and sets `ready` true. Otherwise (init failure, no engine,
  null index, `setVoice` returning `ERROR`) `ready` stays false. `speak` uses
  `QUEUE_FLUSH`. `shutdown` calls `stop()` and `shutdown()`.
- Manifest: `<queries><intent><action android:name="android.intent.action.TTS_SERVICE" /></intent></queries>`.
  Without it, binding to the engine silently fails from target SDK 30.
- Construction goes through a constructor parameter `AppContainer(speakerFactory: (Context) -> Speaker = ::TtsSpeaker)`,
  exposed as a `val`. `ReviewScreen` creates one from `LocalContext.current.applicationContext`
  with `remember` + `DisposableEffect` (shut down on dispose), so the engine binds only on
  the review screen, not at app start.
- The debug build wraps it: `app/src/debug/.../debug/RecordingSpeaker.kt` reports `ready`
  true and logs `spoke "<text>"` at info level under the tag `TortoiseSpeech`, then passes
  through to the real speaker when it is ready. `TortoiseSpellingApp.onCreate` passes
  `speakerFactory = variantSpeakerFactory()`, a top-level function in the same package
  defined in both `app/src/debug` (wrapping `TtsSpeaker` in `RecordingSpeaker`) and a new
  `app/src/release` source set (returning `::TtsSpeaker`); debug and release are the only
  build types. This makes the e2e scenario independent of whether the emulator image has
  a TTS engine.
- The integration tests' `AppHarness` passes a fake speaker that is never ready, so they
  don't bind the emulator's engine and the review screen looks the same on every image.
- `ReviewUiState` doesn't change. `ReviewContent` gains `canSpeak: Boolean` and
  `onSpeak: () -> Unit`. `ReviewScreen` passes `speaker.ready.collectAsState()` and
  `{ state.current?.let { speaker.speak(it.form) } }`.
- The button: an `IconButton` with `Icons.AutoMirrored.Filled.VolumeUp` in the answer
  field's `trailingIcon`, content description "Hear the word",
  `testTag(TestTags.REVIEW_SPEAK)` (`"review_speak"`), shown only when `canSpeak`.
  Tapping it must not take focus from the field or close the keyboard.

### Web

- `Platform` gains `speech: SpeechPlatform`, in `web/src/ui/speechPlatform.ts`:
  `{ ready(): boolean; onReadyChange(listener): () => void; speak(text: string): void }`.
  `browserPlatform.ts` implements it with `speechSynthesis`: voices filtered to
  `localService`, `chooseVoice` over their `lang` with `navigator.languages`, re-run on
  `voiceschanged` (voices load asynchronously, and Safari may never fire the event, so
  also check once on creation). `speak` cancels anything queued, then speaks an
  `SpeechSynthesisUtterance` with the chosen voice, `lang` set to its tag and
  `rate = SPEECH_RATE`. No `speechSynthesis` at all → never ready.
- The `--mode e2e` build swaps in a fake (as `src/debug/fakePush.ts` is): `main.tsx`
  replaces `platform.speech` with `src/debug/fakeSpeech.ts` when `MODE === "e2e"`. The fake
  is always ready and appends each spoken text to `window.__tortoiseSpellingSpoken`. It is
  absent from the production bundle.
- `web/test/support/fakePlatform.ts` gains a `speech` fake, never ready by default.
- `ReviewContent.tsx` gains `canSpeak` and `onSpeak`, and renders a `<button
  type="button" aria-label="Hear the word" data-testid={TestIds.REVIEW_SPEAK}>` to the
  right of the answer input, only when `canSpeak`. Its `pointerdown` calls
  `preventDefault()` so the input keeps focus: blurring the input closes the iOS
  keyboard, and the field must never be remounted (`CLAUDE.md`): render the button after
  the input in the same parent, so its appearing or going never moves the input. The
  icon is an inline SVG of a speaker in `ui/common/icons.tsx`, beside `CloseIcon`.
- `TestIds.REVIEW_SPEAK` mirrors `TestTags.REVIEW_SPEAK`; `testIds.test.ts` checks it.
- iOS only speaks from a user gesture; a click handler qualifies.

### e2e (shared)

One scenario in `specs/review.feature`:

```gherkin
  Scenario: Hearing the word
    Given I have added the word "necessary" defined as "needed or required"
    And I go back to Home
    When I start today's session
    And I tap Hear the word
    Then "necessary" was spoken
```

The Given, And and first When are existing steps. A plain word, because there is no
seed step for a word whose card would deterministically ask for a different form (the
card pick breaks ties at random); speaking `card.form` rather than the root is proven by
the component tests. Only the two new steps are added. Android, in
`e2e/step-definitions/review.steps.ts`: the tap step clears the log first
(`mobile: shell` `logcat -c`, allowed already by `uiautomator2:adb_shell`) and taps the
`review_speak` resource-id; the Then step polls `mobile: shell`
`logcat -d -s TortoiseSpeech:I` for `spoke "necessary"`. Web, in `web/steps/`: click the
test id; poll `window.__tortoiseSpellingSpoken`. Mirror the tag in
`e2e/support/testIds.ts`.

### Docs

- `README.md`: a line under "How it works" (🔊 tap to hear the word, spoken by the
  phone's or browser's own voice).
- `PRIVACY.md`: speech is synthesised on the device; the apps never use a network voice.
- `CLAUDE.md`: under "Review screen details", the speaker: on-device voices only, hidden
  when none, the debug `RecordingSpeaker`, the manifest `<queries>` entry, and the web
  button's `preventDefault` on `pointerdown`.
- `CHANGELOG.md`: one line under `[Unreleased]` (Added).

## Build steps

Each step follows `CLAUDE.md`'s Workflow and `PROTOCOL.md`. "Passing" means every command
exits 0. Abbreviations:

- `<layer X>`: `./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.package=io.github.dontpanic345.tortoisespelling.X`
- `<web>`: `cd web && npm ci && npm run typecheck && npm test && npm run build`

### build-1: the voice rule on both apps (Sonnet, medium)

Reads: Design › Choosing the voice

Model: Sonnet, because it is one small pure function, and the golden cases hold the two apps
to the same answers mechanically.

`domain/Speech.kt`, `web/src/domain/speech.ts`, the `chooseVoice` and `speechRate`
cases in `golden/speech.json` and both runners. No UI.

Acceptance:

```bash
./gradlew testDebugUnitTest lintDebug
(cd web && npm ci && npm run typecheck && npm test)
```

- Temporarily drop step 1 of the rule (always take the first English voice): the golden
  case en-NZ device with en-GB, en-NZ voices fails on both runners. Revert.
- Temporarily compare whole tags instead of language and region: the
  `en-NZ-u-mu-celsius` case fails on both runners. Revert.

### build-2: Android (Sonnet, high)

Reads: Design › Choosing the voice, Design › Android

Model: Sonnet, because it is a contained change to one screen in a pattern the app already uses
(`XContent` callbacks, a factory on `AppContainer`). It is high effort because it spans three
test layers and a device-only API.

Everything under "Android": `Speaker`, `TtsSpeaker`, the manifest entry,
`AppContainer.speakerFactory`, the debug/release factory and `RecordingSpeaker`,
`ReviewContent`'s button and the `REVIEW_SPEAK` tag (and `e2e/support/testIds.ts`).
Tests:

- `ReviewContentTest`: the button is shown with `canSpeak` true and absent with false;
  tapping it calls `onSpeak`; it is there in the Prompting, Corrective (before and after
  Show answer) and Correct phases; the answer field keeps focus after a tap.
- `AppHarness` passes a never-ready fake speaker.
- Accessibility (`component/Fixtures.kt`) and screenshot tests gain a `canSpeak` state;
  update the screenshot references, look at them, and commit them.
- A JVM test of the part of `TtsSpeaker` that turns `Voice`s into tags and filters
  network voices, if it can be pulled out as a pure function; otherwise none (the
  engine is device-only).

Acceptance:

```bash
./gradlew testDebugUnitTest lintDebug validateDebugScreenshotTest assembleRelease
<layer component>
<layer accessibility>
```

- On the emulator, open Review on a debug build and tap the button: `adb logcat -d -s
  TortoiseSpeech` shows the line.

### build-3: web (Sonnet, high)

Reads: Design › Choosing the voice, Design › Web

Model: Sonnet, because it mirrors build-2 in the web's existing `Platform` and fake pattern.
It is high effort because the iOS keyboard rule (focus, never remount) is easy to break.

Everything under "Web": `SpeechPlatform`, the browser implementation, the e2e fake, the
button and `REVIEW_SPEAK` test id.
Tests (jsdom, under `web/test/ui/`): a fake `SpeechPlatform`; the button shown when ready
and absent when not, appearing when readiness changes, with the input the same DOM node
before and after; a click speaks the asked form, not the root; present in every phase;
the input stays focused after a pointer tap; the browser
implementation with a stubbed `speechSynthesis` ignores non-local voices, re-chooses on
`voiceschanged`, and sets `rate` 0.8 and the voice.

Acceptance:

```bash
<web>
(cd web && npm run smoke)
```

### build-4: the scenario, docs and changelog (Sonnet, medium)

Reads: Design › e2e, Design › Docs

Model: Sonnet, because it is two new steps on existing patterns, plus prose.

The scenario and its steps on both platforms, and everything under "Docs".

Acceptance:

```bash
node scripts/check-specs.mjs
(cd e2e && npm run check-steps -- --all && npm run typecheck)
(cd web && npm run check-steps && npm run specs -- review)
(cd e2e && npm run e2e -- --spec ../specs/review.feature)
```

### review (Sonnet, high)

Model: Sonnet, because it is a small piece of four steps with no data or reminder risk, and
the agreement between the apps is held by golden cases and the shared scenario. It is high
effort because it spans both apps and has a privacy rule (on-device voices only) to check.

Review the piece against this spec and the goals, fix substantive findings, run the
release smoke on a release build (CI runs every other suite), then
`node scripts/bump-version.mjs minor`, commit and push. Try the button on the release
build on the emulator too (R8 and the `<queries>` entry).

## What later pieces rely on

`Speaker`/`SpeechPlatform` and `chooseVoice` can speak any text, so reading the example
sentence or an auto-speak setting only adds a caller.

# Piece: speak-word

A **Hear the word** button on the review screen that speaks the asked word form aloud
with the device's own text-to-speech, on Android and the web. Sources: the grilling
session of 2026-10-17/18 with Alan, whose answers are recorded below as decisions. There
is no separate design doc, and no `spec` or `spec-review` session: this spec was written
in that session, so the piece starts at build-1.

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

/** The voice to speak with: tag of the chosen voice, or null when none will do. */
fun chooseVoice(voices: List<String>, deviceLocales: List<String>): String?
```

`voices` are the language tags of the **on-device** voices only (the caller filters out
network voices). Tags are compared case-insensitively with `_` read as `-` (Android's
`Locale.toString()` uses `_`). The rule:

1. For each device locale in preference order whose language is `en`, the first voice
   whose tag equals it.
2. Otherwise the first voice whose language is `en`, taking voices in their given order.
3. Otherwise null.

Return the voice's tag as given (not normalised), so the caller can find it again.
A tag with only a language (`en`) counts as English.

Golden: a `chooseVoice` section in `golden/ui.json` (the file already holds the review's
rules), run by the JUnit and Vitest golden runners. Cases at least: en-NZ device with
en-NZ, en-GB, en-US voices → en-NZ; en-NZ device with only en-GB and en-US → en-GB (first
given); `en_NZ` voice tag matched by an `en-NZ` device locale; case-insensitive match;
device locales fr-FR then en-AU with an en-AU voice → en-AU; fr-FR device only, en-US
voice → en-US; no English voice → null; no voices → null; bare `en` voice. Add a
`speechRate` key holding 0.8, and have each runner assert its constant equals it.

### Android

- `ui/review/Speaker.kt`: `interface Speaker { val ready: StateFlow<Boolean>; fun speak(text: String); fun shutdown() }`.
- `ui/review/TtsSpeaker.kt`: wraps `TextToSpeech`. On `onInit` success, it filters
  `voices` to `!isNetworkConnectionRequired` and not `FEATURE_NOT_INSTALLED`, calls
  `chooseVoice` with their `locale.toLanguageTag()`s and the device's
  `LocaleList.getDefault()` tags, sets that `voice` and `setSpeechRate(SPEECH_RATE)`, and
  sets `ready` true. Otherwise (init failure, no engine, null voice) `ready` stays false.
  `speak` uses `QUEUE_FLUSH`. `shutdown` calls `stop()` and `shutdown()`.
- Manifest: `<queries><intent><action android:name="android.intent.action.TTS_SERVICE" /></intent></queries>`.
  Without it, binding to the engine silently fails from target SDK 30.
- Construction goes through `AppContainer.speakerFactory: (Context) -> Speaker`, defaulting
  to `::TtsSpeaker`. `ReviewScreen` creates one with `remember` + `DisposableEffect`
  (shut down on dispose), so the engine binds only on the review screen, not at app start.
- The debug build wraps it: `app/src/debug/.../debug/RecordingSpeaker.kt` reports `ready`
  true and logs `TortoiseSpeech: spoke "<text>"` to logcat, then passes through to the
  real speaker when it is ready. The debug `TortoiseSpellingApp` path picks it via a
  `debugSpeakerFactory()` function defined in both `app/src/debug` and a new
  `app/src/release` source set (the release one returns `::TtsSpeaker`). This makes the
  e2e scenario independent of whether the emulator image has a TTS engine.
- `ReviewUiState` doesn't change. `ReviewContent` gains `canSpeak: Boolean` and
  `onSpeak: () -> Unit`. `ReviewScreen` passes `speaker.ready.collectAsState()` and
  `{ speaker.speak(card.form) }`.
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
- The `--mode e2e` build puts a fake in the container (as `src/debug/fakePush.ts` does):
  `src/debug/fakeSpeech.ts`, always ready, appending each spoken text to
  `window.__tortoiseSpellingSpoken`. Absent from the production bundle.
- `ReviewContent.tsx` gains `canSpeak` and `onSpeak`, and renders a `<button
  type="button" aria-label="Hear the word" data-testid={TestIds.REVIEW_SPEAK}>` to the
  right of the answer input, only when `canSpeak`. Its `pointerdown` calls
  `preventDefault()` so the input keeps focus: blurring the input closes the iOS
  keyboard, and the field must never be remounted (`CLAUDE.md`). The icon is an inline
  SVG of a speaker, like the other inline icons.
- `TestIds.REVIEW_SPEAK` mirrors `TestTags.REVIEW_SPEAK`; `testIds.test.ts` checks it.
- iOS only speaks from a user gesture; a click handler qualifies.

### e2e (shared)

One scenario in `specs/review.feature`:

```gherkin
  Scenario: Hearing the word
    Given the word "ran" is due
    When I tap Hear the word
    Then "ran" was spoken
```

Use the existing Given step that seeds a due word if one fits (check `check-steps`), and
a form that differs from the root if the seed steps support forms, otherwise a plain word.
Steps: Android in `e2e/step-definitions/` (tap the `review_speak` resource-id; read
logcat through Appium's `getLogs('logcat')` for the `TortoiseSpeech` line), web in
`web/steps/` (click the test id; read `window.__tortoiseSpellingSpoken`). Mirror the tag
in `e2e/support/testIds.ts`.

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

`domain/Speech.kt`, `web/src/domain/speech.ts`, the `chooseVoice` and `speechRate`
sections of `golden/ui.json` and both runners. No UI.

Acceptance:

```bash
./gradlew testDebugUnitTest lintDebug
(cd web && npm ci && npm run typecheck && npm test)
```

- Temporarily drop step 1 of the rule (always take the first English voice): the golden
  case en-NZ device with en-GB, en-NZ voices fails on both runners. Revert.

### build-2: Android (Sonnet, high)

Everything under "Android": `Speaker`, `TtsSpeaker`, the manifest entry,
`AppContainer.speakerFactory`, the debug/release factory and `RecordingSpeaker`,
`ReviewContent`'s button and the `REVIEW_SPEAK` tag (and `e2e/support/testIds.ts`).
Tests:

- `ReviewContentTest`: the button is shown with `canSpeak` true and absent with false;
  tapping it calls `onSpeak`; it is there in the Prompting, Retry and Correct phases; the
  answer field keeps focus after a tap.
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

Everything under "Web": `SpeechPlatform`, the browser implementation, the e2e fake, the
button and `REVIEW_SPEAK` test id.
Tests (jsdom, under `web/test/ui/`): a fake `SpeechPlatform`; the button shown when ready
and absent when not, appearing when readiness changes; a click speaks the asked form;
present in every phase; the input stays focused after a pointer tap; the browser
implementation with a stubbed `speechSynthesis` ignores non-local voices, re-chooses on
`voiceschanged`, and sets `rate` 0.8 and the voice.

Acceptance:

```bash
<web>
(cd web && npm run smoke)
```

### build-4: the scenario, docs and changelog (Sonnet, medium)

The scenario and its steps on both platforms, and everything under "Docs".

Acceptance:

```bash
node scripts/check-specs.mjs
(cd e2e && npm run check-steps -- --all && npm run typecheck)
(cd web && npm run check-steps && npm run specs -- review)
(cd e2e && npm run e2e -- --spec ../specs/review.feature)
```

### review (Sonnet, high)

Review the piece against this spec and the goals, run the full checks including every
e2e feature, fix substantive findings, watch `ci.yml` to green, then
`node scripts/bump-version.mjs minor`, commit and push. Try the button on a release
build on the emulator too (R8 and the `<queries>` entry).

## What later pieces rely on

`Speaker`/`SpeechPlatform` and `chooseVoice` can speak any text, so reading the example
sentence or an auto-speak setting only adds a caller.

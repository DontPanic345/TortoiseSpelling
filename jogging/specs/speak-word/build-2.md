# speak-word/build-2: Android

Everything under "Android" below: `Speaker`, `TtsSpeaker`, the manifest entry,
`AppContainer.speakerFactory`, the debug/release factory and `RecordingSpeaker`,
`ReviewContent`'s button and the `REVIEW_SPEAK` tag (and `e2e/support/testIds.ts`).
`chooseVoice` and `SPEECH_RATE` are already built (build-1).

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

On the emulator, open Review on a debug build and tap the button: `adb logcat -d -s
TortoiseSpeech` shows the `spoke` line. build-4's e2e scenario makes this a test.

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


## Acceptance

```bash
./gradlew assembleRelease
```

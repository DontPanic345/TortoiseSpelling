# speak-word/build-3: web

Everything under "Web" below: `SpeechPlatform`, the browser implementation, the e2e fake,
the button and the `REVIEW_SPEAK` test id. `chooseVoice` and `SPEECH_RATE` are already
built (build-1).

Tests (jsdom, under `web/test/ui/`), with a fake `SpeechPlatform`:

- The button is shown when ready and absent when not, and appears when readiness changes,
  with the input the same DOM node before and after.
- A click speaks the asked form, not the root.
- It is present in every phase, and the input stays focused after a pointer tap.
- The browser implementation, with a stubbed `speechSynthesis`, ignores non-local voices,
  chooses again on `voiceschanged`, and sets `rate` 0.8 and the voice.

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

# speak-word/build-1: the voice rule on both apps

`domain/Speech.kt`, `web/src/domain/speech.ts`, the `chooseVoice` and `speechRate` cases in
`golden/speech.json` and both runners. No UI.

Prove the golden cases bite, then revert each change:

- Drop step 1 of the rule (always take the first English voice): the case "en-NZ device
  with en-GB, en-NZ voices" fails on both runners.
- Compare whole tags instead of language and region: the `en-NZ-u-mu-celsius` case fails
  on both runners.

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

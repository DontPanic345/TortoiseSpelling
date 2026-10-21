# Jogging log

Newest at the bottom. One entry per step: date, piece/step, model, outcome. Entries for
finished pieces are in [the log before it was rolled](https://github.com/DontPanic345/TortoiseSpelling/blob/58f39f6192806b92431713675234b268fceb1633/jogging/LOG.md).

## 2026-10-18 14:40 speak-word/spec-review (opus)
Reviewed the spec against the goals and the code; applied the substantive findings to the spec and the step titles. `chooseVoice` returns an index, not a tag (engines have several voices per tag), compares language and region only (Android 14 puts `-u-…` extensions on the device locale), and its cases move to a new `golden/speech.json` rather than `ui.json`; Android sorts its voice `Set` by name for a stable order and uses `KEY_FEATURE_NOT_INSTALLED`. Wiring made concrete: `TortoiseSpellingApp` passes `variantSpeakerFactory()` (debug and release source sets), `AppHarness` gets a never-ready fake, the web fake replaces `platform.speech` in `main.tsx`, and the web button sits after the input so it never remounts it.
The e2e scenario used a Given step that doesn't exist; it now uses the existing seed and session steps with "necessary", and Android reads logcat through the already-allowed `mobile: shell` instead of `getLogs`. No code changes.

## 2026-10-21 12:00 review-outcome/spec-review (opus)
Checked the spec against `WordRepository.recordReview`, the DAO, `repository.ts` and the golden harness; the design matches the code, the nine cases' numbers check out against SM-2, and Room already enforces the `review_log` foreign key (`aLogForAMissingWordIsRefused`). Golden cases now carry a `name` and the runners' helpers are named; build-1's brief no longer carries build-2's instrumented tests and docs; build-2's DAO test points at the existing `assertThrows` idiom; the review brief also checks the deleted-word path.
build-1 moved from Sonnet/high to Opus/medium: keeping both apps in agreement is an Opus step under the sizing rules. `release` stays `patch`.

## 2026-10-21 14:30 icon-redraw/spec (opus)
Wrote the spec and five briefs. build-1 (explore) and build-2 (refine) end `blocked` for Alan's picks and, on his reply, write the choice (or the fallback) into the later briefs; `scripts/recraft.mjs` keeps a ledger in `docs/icon-concepts/log.json` and refuses requests past 10,000 units (vector images are 80 units, so ~50 images is ~4,000).
The generator moves to a plain SVG source, `scripts/icon-source.svg` (`M L H V C Q Z` paths only, so tests can flatten them), in its own step (build-3) before the art (build-4); the gap tests become "no two contours closer than GAP". `release` stays `minor`.

## 2026-10-21 15:10 icon-redraw/spec-review (opus)
Briefs hold up against the code and the crew's blocker round trip; models, efforts and `release: minor` stand.
Fixed build-4's backwards `GAP` advice (it must be ≥ the notification set's larger dimension ÷ 20), made the `final` sheet's 24 dp cell the notification set rather than `docs/icon.svg`, and gave the review brief checks for the fallback path.

## 2026-10-21 16:00 edit-after-miss/spec (opus)
Wrote the spec and five briefs: build-1 adds `undone` (golden cases) and `recordReview` → `ReviewUndo`, `undoReview`, `cardFor` on both repositories; build-2 (Android) hands the edit screen's `SAVED`/`DELETED` back through the review entry's `SavedStateHandle` and joins the miss's write before opening the editor; build-3 (web) keeps review mounted under `#/review/edit/<id>` via `screenKey`; build-4 adds a shared scenario from existing steps and the docs.
Recorded the approved goal 4 exception in `GOALS.md`. Delete removes the card from the queue so the title stays truthful; the e2e can't show the grade for a new word, so integration and web journey tests assert it. `release` stays `minor`.

## 2026-10-21 17:00 edit-after-miss/spec-review (opus)
Checked the spec and briefs against the code and the assumed review-outcome and speak-word builds. Fixed three things: build-2 also adds `REVIEW_EDIT` to the web's `TestIds`, as `testIds.test.ts` fails CI when an Android tag has no web twin; the web's `finished` effect waits while `editing` is set, because the async `history.back()` would otherwise let `replace(completion)` overwrite the editor's entry and remount a fresh session; and both apps guard a double tap (`launchSingleTop`, an `opening` ref).
Added "deleting the only word finishes" tests on both apps. Models, effort and `release: minor` stand.

## 2026-10-21 18:00 form-warnings/spec (opus)
Wrote the spec and five briefs: build-1 adds `formWarnings` and `ktHasWhitespace` with `golden/warnings.json` on both runners; build-2 (Android) shows live marks in the editor, warnings in the paste dialog and a "Check forms" badge (`WordRow.checkForms`, a `ui.json` case), adding the web test id too because `testIds.test.ts` needs a twin for every tag; build-3 mirrors it on the web; build-4 adds the `curious` fixture, a scenario each in `copy_prompt.feature` and `word_list.feature`, four new steps, and the docs.
Choices: the base form is never checked, whitespace is Kotlin's, and the marks are computed live from what's on screen. All Sonnet; `release` stays `minor`.

## 2026-10-21 18:40 form-warnings/spec-review (opus)
Fixed four gaps against the code: the web `filterRows` golden runner compares with `toEqual`, so build-2's new `checkForms` key would have failed `npm test` (build-2 now strips it there, build-3 compares it); the web has no error-container colours and its row is a flex column, so build-3 adds both and a badge row; the changelog line moves to build-2, the first user-visible change; the JVM tests are named (`AddWordUiStateTest.kt`).
Models, efforts and `release: minor` stand.

## 2026-10-21 12:10 speak-word/build-1 (sonnet)
Built `chooseVoice` and `SPEECH_RATE` in `domain/Speech.kt` and `web/src/domain/speech.ts`, with `golden/speech.json` (14 cases plus `speechRate`), `SpeechGoldenTest.kt`, `speech.test.ts` and the README row. Both bite checks failed on both runners (step 1 dropped; whole tags compared) and were reverted. Unit tests, lint, web tests and typecheck pass. No UI, so no CHANGELOG line yet.

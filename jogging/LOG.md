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

## 2026-10-21 13:00 speak-word/build-2 (sonnet)
Built Android: `Speaker`, `TtsSpeaker`, the manifest `<queries>` entry, `AppContainer.speakerFactory`, `variantSpeakerFactory()` in the debug and new release source sets, debug `RecordingSpeaker`, the `ReviewContent` button (`canSpeak`/`onSpeak`, `REVIEW_SPEAK`, mirrored in `e2e/support/testIds.ts`) and `ReviewScreen`'s remember + DisposableEffect speaker. `AppHarness` passes a never-ready fake; `ReviewContentTest` covers the button in every phase and focus; the accessibility test and screenshots gained a `canSpeak` state (two new references, looked at). No JVM test of the voice filter: `Voice` is an Android class that can't be built on the JVM, so there is no pure part to pull out.
The focus test clicks the field first because the field isn't focused in the bare component rule. It guards the behaviour but I didn't check it fails with a focusable button. Added `REVIEW_SPEAK` to `web/src/ui/testIds.ts` early, because `testIds.test.ts` fails once the Android tag exists; build-3 uses it. No CHANGELOG line: build-4 owns it, once both apps have the button. Unit tests, lint, screenshots, component, accessibility and integration tests, and `assembleRelease` pass.

## 2026-10-21 14:10 speak-word/build-3 (sonnet)
Built web: `SpeechPlatform` (`ui/speechPlatform.ts`), the `speechSynthesis` implementation in `browserPlatform.ts` (local voices only, `chooseVoice` over `navigator.languages`, re-chosen on `voiceschanged` and once on creation, cancel then speak at `SPEECH_RATE`), `debug/fakeSpeech.ts` swapped in by `main.tsx` in e2e mode (present in `dist-e2e`, absent from the production bundle), the `fakePlatform` speech fake, `VolumeUpIcon`, and the `ReviewContent` button after the input in a constant `.answer-input` row, with `ReviewScreen` following readiness. Tests: `ReviewContent.test.tsx` (absent/present, same node, every phase, pointerdown prevented — fails without the `preventDefault`), `review/speech.test.tsx` (readiness change, speaks the asked form `ran`), `browserSpeech.test.ts` (non-local ignored, voiceschanged, rate and voice). Unit tests, typecheck, check-steps, chromium specs and smoke pass (one unrelated flaky push smoke passed on retry); webkit isn't installed on the runner. No e2e scenario or CHANGELOG line yet: build-4 owns them.

## 2026-10-21 15:00 speak-word/build-4 (sonnet)
Added the "Hearing the word" scenario with its two steps on Android (logcat via `mobile: shell`) and web (poll `window.__tortoiseSpellingSpoken`), plus `speakButton` in both review screen objects. Docs: README, PRIVACY, CLAUDE.md and the CHANGELOG line. The scenario passes on the emulator and in web chromium; check-specs, both check-steps and typechecks pass.

## 2026-10-21 16:00 speak-word/review (sonnet)
Reviewed the whole piece against the spec, goals and standards. Acceptance passes (`assembleRelease`, `e2e:release`); by hand on the release APK (R8, no debug speaker) the button shows, a tap makes the Google engine synthesise (`en-us-x-iog-seanet-embedded`, an on-device voice), and the answer field keeps focus and the keyboard. Voice rule, golden cases, both platforms' on-device filters, hidden-when-none and the CHANGELOG line all match the spec. Only fix: `web/README.md` now mentions `fakeSpeech.ts` and `__tortoiseSpellingSpoken`. Left as a nit: `Voice.features` isn't null-guarded in `TtsSpeaker`.

## 2026-10-21 18:55 speak-word/review (sonnet)
The red `ci.yml` run was infrastructure, not code: the accessibility job's emulator download got HTTP 502 from dl.google.com, so no test ran. The next run, on the same code (only `state.json` differed), passed all ten jobs including accessibility. No code change; the review stands as logged above.

## 2026-10-21 13:45 review-outcome/build-1 (opus)
`reviewed` in `domain/Review.kt` and `web/src/domain/review.ts`, with nine cases in `golden/review.json` taken from today's `recordReview`, both runners, `ReviewTest` for the scheduler and fuzz parameters, and the `golden/README.md` row and "Not golden" paragraph. The repositories don't call it yet.
The brief's first bite check was wrong: dropping `?: today` fails the new-word cases (1, 2, 7, 8), not case 3. Writing `today` in its place is what fails case 3. Fixed in `build-1.md`. Ran both mutations and old-interval fuzz (case 4 alone fails) on both runners, then reverted.

## 2026-10-21 14:30 review-outcome/build-2 (opus)
Both repositories now call `reviewed`; Android's read, update and log run in `TortoiseSpellingDao.recordReview`'s one transaction, and a deleted word records nothing instead of failing the log's foreign key. New instrumented tests: a deleted word logs nothing, and a refused log rolls back the word's update (fails with `@Transaction` removed). CLAUDE.md "Scheduling" and a CHANGELOG "Fixed" line.
Unit, lint, data and integration layers, review/completion/daily_allowance e2e on Android and the web specs in Chromium and WebKit all pass; the emulator held a release-signed install that had to be removed before connected tests.

## 2026-10-21 14:15 review-outcome/review (opus)
Reviewed the whole piece: the nine golden cases match the removed `recordReview` (SM-2 numbers rechecked), the DAO's read, update and log run in one `@Transaction`, the web transaction still awaits only its own requests, and no caller passes a `Word` any more. No scheduling outcome changed; CHANGELOG's "Fixed" line covers both user-visible fixes. No fixes needed.
`assembleRelease` and the release e2e (20 passing) pass, as do the review unit/golden tests and the web golden and repository tests.

## 2026-10-21 14:30 icon-redraw/build-1 (opus)
Built `scripts/recraft.mjs` (ledger, cap and balance refusal, V4.1 vector at 80 units; the API is `external.api.recraft.ai/v1`, balance from `/users/me` `credits`) with `recraft.test.mjs`, and `web/scripts/icon-sheet.mjs`. Added an optional `--colors` flag (Recraft's `controls.colors`, kept as `colors` in the ledger) and noted it in the spec and build-2's brief.
Explore round: six directions a–f, 24 images, 1,920 of 10,000 units; dropped a-01, a-02, c-01, c-04. Sheet and prompts in `docs/icon-concepts/`. Blocked for Alan to pick a direction.

## 2026-10-21 14:40 edit-after-miss/build-1 (opus)
Added `undone` on both apps with three `undone` golden cases, `recordReview` returning `ReviewUndo` (null for a gone word), and `undoReview` and `cardFor` on both repositories, with the brief's DAO, repository and web tests; screens untouched.
The DAO test reads `review_log` ids through `db.openHelper` rather than adding a query. The emulator held a release-signed install that made `connectedDebugAndroidTest` skip silently while reporting success; uninstalled it, and the data layer then ran 47/47.

## 2026-10-21 17:45 edit-after-miss/build-2 (opus)
Android **Edit word** after a miss: `EditOutcome` from the edit screen through the review entry's `SavedStateHandle`, `ReviewDestination`, and `editWord`/`onEditClosed` in `ReviewViewModel` (joins the miss's write, undoes on save, drops the card on delete); tags on all three id lists, five component tests, six `EditAfterMissJourneyTest` journeys, four missed-shot references (light and dark).
Component, integration (13/13), unit, lint, screenshots, web and `review.feature` e2e pass. The practice journey reaches practice through completion, so it checks no log rows were *added*; corrected the brief to say so. Also moved a stray `cardsFor` KDoc from build-1 back to its function.

## 2026-10-21 17:55 edit-after-miss/build-3 (opus)
Web **Edit word** after a miss: `#/review/edit/<id>` and `#/practice/edit/<id>` with `screenKey` keeping review mounted, `AddWordScreen`'s `onClosed`, `editRequested`/`editSaving`/`editedCard`/`wordRemoved`, and `closeEdit` in `ReviewScreen`; with the brief's router, state, content, add-screen and eight review journeys (plus a double-tap one).
The "only word deleted" journey passed without the `finished` guard, as jsdom lands the pop first and the remounted session is empty anyway; it now delays `history.back` and asserts no second `buildSession`, and fails without the guard. Web tests (932), typecheck, check-steps, specs (30, Chromium and WebKit) and build pass; smoke's push reminder test flaked once, then passed 12/12.

## 2026-10-21 18:30 edit-after-miss/build-4 (sonnet)
Added the "Fixing a wrong entry after a miss asks the word again" scenario to `specs/review.feature` (no new steps, none needed fixing), plus the CLAUDE.md, README and CHANGELOG lines.
Passes on Android e2e (57) and web specs (Chromium); both check-steps and check-specs pass.

## 2026-10-21 18:20 edit-after-miss/review (opus)
Reviewed the whole piece against the spec, goals and coding standards: the editor opens only after the miss is written (Android joins `recordJob`, the web chains on `recorded`), the undo reads inside its transaction and writes only `undone`'s eight fields and its own log row, back and reload leave the miss, deletes keep the title truthful and finish cleanly, and grading and SM-2 are untouched. No substantive defect found, so no code changes.
Nits left as they are: Android has no double-tap test (the web has one), and when the word is gone on load the web editor closes but Android's opens empty (this predates the piece). Web tests (932) and typecheck pass; `assembleRelease` and `e2e:release` pass (20). The changelog line covers the one user-visible change.

## 2026-10-21 18:30 form-warnings/build-1 (sonnet)
Added `formWarnings` (Kotlin, TypeScript), `ktHasWhitespace`, `golden/warnings.json` and a runner on each side. Proved the cases bite: dropping the phrase check fails case 3 on both; `' ' in text` fails case 7/8 on Android.
Brief was wrong on one point: JavaScript's `/\s/` matches a non-breaking space and tab, so cases 7 and 8 pass on the web with it. Added two cases (a BOM inside a form is not whitespace, U+001F is) that fail with `/\s/`.

## 2026-10-21 18:55 form-warnings/build-2 (sonnet)
Android shows `formWarnings` live on the add screen (form field error and message), in the paste dialog, and as a "Check forms" badge in the word list (`WordRow.checkForms`, `ui.json` case, test id on Android, e2e and web). Web golden runner strips `checkForms` until build-3. Unit, lint, screenshot, component layer and web tests pass; no screenshot reference changed.

## 2026-10-21 19:20 form-warnings/build-2 (sonnet)
CI run 39655691396 was red from the runner, not the code: the data and accessibility jobs never booted an emulator (the `system-images;android-34` download failed with "Error on ZipFile unknown archive"), and in the e2e job the reminder scenario timed out waiting on the accessibility tree. `notifications.feature` passes 33/33 on this emulator, so no code change; re-running CI.

## 2026-10-21 19:30 form-warnings/build-3 (sonnet)
Web shows `formWarnings` live on the add screen's form fields, in the paste dialog, and as a "Check forms" badge beside the status badge in the word list (`WordRow.checkForms`, error-container colours, `.word-row-badges`). The `filterRows` golden runner now compares `checkForms`. Added add-screen, paste-dialog and word-row tests; `npm test` and `npm run typecheck` pass.

## 2026-10-21 20:00 form-warnings/build-4 (sonnet)
Added the `curious` fixture, a form-warnings scenario each in `copy_prompt.feature` and `word_list.feature`, and four steps (`the editor warns`, `I remove the form`, `is marked / is not marked Check forms`) on Android and web, plus the `CLAUDE.md` Lookup sentence. The changelog line from build-2 is there and still true.
`check-specs`, both `check-steps`, e2e typecheck, `npm run specs` (web, 36 passed) and both features on the emulator (24 and 43 steps passing) all pass.

## 2026-10-21 20:30 form-warnings/review (sonnet)
Reviewed the whole piece against the spec, goals and standards: the rule and its golden cases agree on both apps (Kotlin whitespace and trim, `ktHasWhitespace`), marks are computed live from the editor's state, `canSave` and every entity, migration and backup file are untouched, the tag is mirrored in all three places, the scenarios and four steps match on both runners, and `CLAUDE.md` and the changelog line are accurate. Nothing substantive to fix.
Web `npm test` (953) and typecheck, `check-specs` and `assembleRelease` pass; release e2e (`npm run e2e:release`, 20 steps) passes.

## 2026-10-21 21:00 icon-redraw/build-1 (opus)
Alan replied "B-02, B-04": direction b (friendly cartoon, smiling), refining from `b-02` and `b-04`.
Wrote it into `build-2.md` as "Alan's choice" with the prompt, model, colours and file names. No Recraft requests this session (1,920 of 10,000 units spent).

## 2026-10-21 22:30 icon-redraw/build-1 (opus)
CI was red for an e2e flake that has now hit twice (here and form-warnings/build-2): the scenario after "Open settings" fails in `resetApp`, as Android's notification settings sit in the app's task and `pm clear` tears them down under the relaunch, leaving no readable window for 30 s. It didn't reproduce locally (12 runs, some under CPU load).
`resetApp` now presses Home before clearing, and the failure hook saves the screenshot before the page source, which threw first here and left no image. Full Android e2e (207), typecheck and `check-steps --all` pass; acceptance passes. No Recraft requests (1,920 of 10,000 units).

## 2026-10-22 00:30 icon-redraw/build-1 (opus)
Alan replied "go again" to the red CI. Run 39685948045 failed before any test ran: the emulator package download was corrupt ("Error on ZipFile unknown archive"), so nothing came up on port 5554. That's a runner flake, not this step's code. `ci.yml` has since passed on every later main commit (6da8934, b29d4f0, 6dd55e1, 6c2649d), all of which include this step's work.
No code change. Acceptance passes; no Recraft requests (1,920 of 10,000 units).

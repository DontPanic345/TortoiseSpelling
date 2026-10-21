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

# Retro: the Jogging `spec-review` step

22/10/2026. Covers all 15 pieces that have had a spec-review, from `icon` (13/10/2026) to
`form-warnings` (21/10/2026). How Jogging works: [`jogging/README.md`](../../jogging/README.md).

## Verdict

**Keep it, but aim it.** Across 15 pieces, spec-review made 92 changes. 32 would have
broken something if left in (class a). About 14 of those would have broken something
silently: no test or CI job would have caught them. Examples: a privacy policy claiming
nothing leaves the phone (575ff76), a voice rule that never matches an NZ phone with
regional preferences on (c6b3e46), a streak that a `#/review` launch could corrupt
(b0bd115), a race that remounts a session after the last card is deleted (731f2b4), a
drift test that could never fail (489d286), an unused-steps check that always exits 0
(31bcf5f), and Safari refusing share and clipboard calls made after an `await` (0287d2b).
No build or review would plausibly have found those. The other 18 were loud: a red CI or
a failing test would have shown them in the build's first run (featuresRoot 31bcf5f,
`toEqual` on a new key e2f62cb, a missing web test-id twin 731f2b4). Builds already fix
that kind of mistake themselves. Build logs record about 25 "spec corrections" made
mid-session, and **not one build attempt in 15 pieces failed because of the spec**. Every
repeated attempt came from infrastructure or from a human step (see Attempts below). So
the loud half of the step's work mostly saves a CI cycle at best. The step costs
$0.73–$1.47 per piece in API-equivalent terms (4–8 points of the five-hour window), and
two to three and a half minutes. That is about a quarter of what the piece's builds and
review cost, but 72% for `form-warnings`, where the Opus spec-review cost more than all
four Sonnet builds and the review together. Spec-review also missed one kind of defect
again and again: **bite checks and mutations in the briefs that don't actually fail**
(88fa1f0, 1dcbbe5, e8de9f7, 0ae2d1c). In two places it introduced claims that turned out
to be false (9df29b6 → 496978c, b0bd115 → 00bacbf). Keep the step for what only an
independent reader catches. Point it at silent defects and at checks that can't fail.
Have the spec step carry the mechanical checklist. Size the step to the piece.

## Classes

- **a**: would have caused a build failure, a red CI, wrong behaviour or a failed attempt.
  Marked *silent* when no check in CI or the brief would have caught it.
- **b**: real but minor (clarity, a test named, a path fixed); a build would likely have
  worked it out.
- **c**: cosmetic, or a no-op in practice.
- **d**: a model, effort or release change.

"Wrong" counts changes that later steps showed to be incorrect.

## Per piece

Every spec-review step ran on **Opus, medium effort** (state.json in each commit below;
62bc135 for speak-word). Dates are the spec-review commit's.

| Piece | Date | What spec-review changed | a / b / c / d | What builds or review later hit that spec-review missed |
|---|---|---|---|---|
| icon | 13/10/2026 | 489d286: `main` must not run on import, or the drift test regenerates before comparing and can never fail (a, silent); exported gap constant; group transform; Edge preview recipe; CLAUDE.md wording | 1 / 3 / 1 / 0 | The Edge recipe was a no-op: the cloud had no Edge (39188cc). Nothing spec-level later. |
| test-data-layer | 13/10/2026 | 2881510: distinct `createdAt` for ordering tests (a, flaky ties); Room plugin fallback (unused); test-only database name; job timeout; `gh run watch` by commit (moot: no `gh` login, 8784404); `internal` explanation (c) | 1 / 3 / 2 / 0 | Nothing spec-level. |
| test-ui-layers | 13/10/2026 | 60f8c0f: seed before `launch()`, because Home loads once (a); accessibility layer on API 34, since the checks may silently no-op on 26 (a, silent); cloud device rules; e2e features per step; screenshot platform; title from `practiceMode` | 2 / 4 / 0 / 0 | `TortoiseSpellingNavHost` must be public, and seeded definitions must not contain the word (864e39a); Compose 1.12.1 has no `tryPerformAccessibilityChecks` (2d76fcb); `imageDifferenceThreshold` isn't in the AGP 9.4 DSL (037809d). The review's three attempts were the version bump being refused (e95cff0, 43030df, fe36fe2), not the spec. |
| word-forms | 13/10/2026 | 4208c47: blank part of speech becomes null and `hint` skips it, or imports show a stray " · " (a, silent); the edit save re-reads the row before writing the whole row (a, silent: a stale overwrite); `nextDay()` in the rotation journey (a); a fourth migration-test word | 3 / 1 / 0 / 0 | `scrollIntoView` can't find Save on the long editor; `AddWordContentTest` can't guard the base-form remove (1a08dc9). |
| copy-prompt | 13/10/2026 | 9df29b6: one validation pass in document order, so both apps report the same first failure (a, silent until golden cases); order tests; Save scrolled into view; `word_forms` added to the e2e list. **Wrong:** "default `Json` is strict like `JSON.parse`" | 1 / 2 / 0 / 0, 1 wrong | Pasting the prompt back parsed as valid (found 4d4e0d3, fixed in review 5d59910). The dialog's `testTagsAsResourceId` sat on the wrong node (d854c33). The strictness claim was false: web-core/build-2 corrected it (496978c). |
| drop-api-key | 13/10/2026 | 575ff76: PRIVACY.md's new opening said only the paste leaves the phone, but Export and Google backup remain (a, silent); build-4's grep allow-list completed, or its check fails (a); key cleanup on every start; `.gitignore` keeps `apikey`; review wording (c) | 2 / 2 / 1 / 0 | Nothing spec-level. The review fixed an e2e scroll on the 320×640 emulator (7de21f0). |
| web-core | 13/10/2026 | b02f51f: U+0130 lowercasing differs between Kotlin and JS (a, silent; added a golden case); IndexedDB `TransactionInactiveError` trap (a); clock-default fields expected as `"now"` (a); quoted numbers and booleans settled on the JVM; unsafe-integer Longs; duplicate check inside the transaction; deleted-word `recordReview`; 400-day bound; 0-based indexes; `cache: npm` (c) | 3 / 6 / 1 / 0 | kotlinx is looser than `JSON.parse` (496978c); kotlinx also takes a quoted boolean (be67d73); `updateWord` needs a `missing` result (69d3be0); the review found `reviewedToday` counting rows, not words (0d35a41). |
| web-ui | 13/10/2026 | 0287d2b: a list of effects per transition, since a correct first try both records and auto-advances (a); Safari's late-share refusal falls back to download (a, silent); Copy prompt writes before any `await` (a, silent); router on `pushState` with its own notify; jsdom stubs; SW registration in `browserPlatform`; `lastExportedAt` calls; `filterRows` may already be moved; a step title (c) | 3 / 5 / 1 / 0 | Vite 8's JSX option is `oxc.jsx`, and `blankedExample`'s signature (bda7f56); `markTodaySatisfied` loops forever if it notifies (c97f66e); a CI red from jsdom teardown (b4e110e); the service worker needs `ignoreVary: true` or offline reloads fail (b7ec055). |
| shared-specs | 13/10/2026 | 31bcf5f: `featuresRoot` is required (a); `--unused-steps` exits 0, so parse its output (a, silent); clipboard permissions on Chromium only, since an unknown one fails every WebKit test (a); the seed checks `result.kind` (a); typecheck covers `steps/`; "go back to Home" handles Done; `flatBackupFile`; docs path; the review grep skips `.git` | 4 / 5 / 0 / 0 | Nothing spec-level. |
| web-push | 13/10/2026 | b0bd115: the smoke registered after its time, which marks it sent (a; the fix was itself incomplete); `settleQuietDays` runs before the first render (a, silent: streak), never notifies (a, loop), and marks days only while reminders are on (a, silent: parity); dismissed prompt; 404 re-register; sync after a push; e2e fakes spelt out | 4 / 4 / 0 / 0 | The smoke needs a second subscription, as re-registering keeps the sent day; the file tree and `createSender` (00bacbf). The headless shell refuses notifications, and port 9 is unsafe (8db7c59). The review found PRIVACY missing two stored columns (bd6ed6d). build-4's five attempts were Cloudflare account setup (42ba2b8 … db5d966). |
| speak-word | 18/10/2026 | c6b3e46: match on language and region only, as Android 14 adds `-u-` extensions (a, silent: no NZ match); the e2e Given step didn't exist (a); logcat through the allowed `mobile: shell` (a); return an index, not a tag; sort the voice `Set`; `KEY_FEATURE_NOT_INSTALLED`; `variantSpeakerFactory` wiring; `AppHarness` fake; web fake and button placement; `speech.json` (c) | 3 / 6 / 1 / 0 | No JVM test of the voice filter is possible (fc000a1). The review added a README line (8b10325). Its second review attempt was an emulator download 502 (8e0bfdd). |
| review-outcome | 21/10/2026 | 4db7f53: build-1's brief carried build-2's instrumented tests and docs (a: scope collision); case `name`s; runner helpers named; the `assertThrows` idiom; a review check; **build-1 Sonnet/high → Opus/medium** (d) | 1 / 4 / 0 / 1 | build-1's first bite check was wrong: dropping `?: today` fails cases 1, 2, 7 and 8, not 3 (88fa1f0). The spec-review log said the cases "check out". |
| icon-redraw | 21/10/2026 | 7d87a35: build-4's `GAP` advice was backwards (a); the final sheet's 24 dp cell shows the notification set; review checks for the fallback path (c: never taken) | 1 / 1 / 1 / 0 | The Recraft API host and balance field (3f43d1c). The review found the containment test checked only the launcher set (0ae2d1c). build-1/build-2's extra attempts were the designed blocks for Alan's picks and CI flakes (1cf9625, 452453e, 18b3d91, 0d255dc). |
| edit-after-miss | 21/10/2026 | 731f2b4: build-2 must add the web `REVIEW_EDIT` twin, or `testIds.test.ts` turns CI red (a); the web `finished` effect waits while `editing`, or `history.back()` remounts a fresh session (a, silent); double-tap guards; "delete the only word" tests | 2 / 2 / 0 / 0 | The practice journey can only check no log rows were *added* (6011b34). The "only word deleted" journey passed in jsdom without the guard, so the brief's test didn't bite (e8de9f7). |
| form-warnings | 21/10/2026 | e2f62cb: the web `filterRows` runner compares with `toEqual`, so build-2's new key would turn `npm test` red (a); web error-container colours and a badge row; changelog line moved to build-2; JVM test file named | 1 / 3 / 0 / 0 | JavaScript's `/\s/` matches NBSP and tab, so cases 7 and 8 didn't bite on the web (1dcbbe5). build-2's second attempt was a corrupt emulator download (9e697a1). |
| **Total** | | | **32 / 51 / 8 / 1**, 2 wrong | |

The 32 class-a changes split into about 14 silent ones and 18 loud ones that a build's
first test or CI run would have exposed.

## Attempts and blockers

Counted from the `LOG.md` entries (each session appends one) and the crew's commits.
Every build step not listed took **one attempt**.

| Step | Attempts | Cause | Spec's fault? |
|---|---|---|---|
| test-ui-layers/review | 3 | The permission classifier refused `bump-version.mjs` (e95cff0, 43030df, fe36fe2) | No |
| web-core/build-1 | 2 | The token lacked `workflow` scope (b19e1db, 274a734) | No |
| web-ui/build-7 | 2 | Pages wasn't enabled (d7ffb62, f0d966a) | No |
| web-push/build-4 | 5 | Cloudflare secrets, token scope, workers.dev subdomain (42ba2b8, a8ff233, 6d2e3e1, 460c542, db5d966) | No |
| speak-word/review | 2 | Emulator download returned HTTP 502 (8e0bfdd) | No |
| form-warnings/build-2 | 2 | Corrupt emulator image (9e697a1) | No |
| icon-redraw/build-1 | 4 sessions | A designed block for Alan's pick, an e2e flake in `resetApp`, a corrupt emulator image (3f43d1c, 1cf9625, 452453e, 18b3d91) | No |
| icon-redraw/build-2 | 2 sessions | A designed block for Alan's pick (eb0ef14, 0d255dc) | No |

Builds hit no failed attempts that traced back to the spec. They corrected the spec
in-session instead: the "spec correction" notes above.

## Cost

- **Model and effort:** Opus, medium effort, every time.
- **Transcripts:** only the four spec-reviews from Jogging run 39546558340 (21/10/2026)
  were still in reach. Its `jogging-runs-*` artifact expires 28/10/2026. Their result
  frames show:

  | Spec-review | Duration | Turns | Output tokens | Cache read | Cost (API-equivalent) | Five-hour window |
  |---|---|---|---|---|---|---|
  | review-outcome | 111 s | 12 | 9,518 | 481,790 | $0.73 | 0% → 4% |
  | icon-redraw | 131 s | 13 | 12,900 | 660,664 | $0.89 | 13% → 18% |
  | edit-after-miss | 205 s | 26 | 19,497 | 1,796,000 | $1.47 | 31% → 39% |
  | form-warnings | 165 s | 25 | 16,301 | 1,326,878 | $1.12 | 47% → (run ended) |

  Window percentages come from the crew's start lines in the run's job log.
- **Compared with the rest of each piece** (the builds and review, from runs 39595540442,
  39642236402, 39681375330, 39699695049 and 39703610179, all retries included):

  | Piece | Spec | Spec-review | Builds and review | Spec-review ÷ builds and review |
  |---|---|---|---|---|
  | review-outcome | (written by hand, c0634cf) | $0.73 | $2.25 | 32% |
  | icon-redraw | $1.62 | $0.89 | $8.03 | 11% |
  | edit-after-miss | $2.48 | $1.47 | $6.13 | 24% |
  | form-warnings | $1.60 | $1.12 | $1.55 | 72% |
  | **Together** | | **$4.21** | **$17.96** | **23%** |

- **Earlier pieces:** the 13/10/2026 batch ran before the GitHub Actions runner, and
  speak-word's spec-review (18/10/2026) ran outside any Jogging run, so no transcripts or
  token figures survive for them. Their commits land two to four minutes after the spec
  commits (for example 2881510, 4208c47, 9df29b6), in line with the measured runs.

## Recommendations

### `jogging/prompts/spec-review.md`

1. **Rank findings by what CI can't see.** Tell the session that a defect no test, CI
   job or Acceptance line would catch matters most. That covers device-only browser
   rules (Safari's tap rule, the iOS keyboard), two-app parity, privacy and user-facing
   claims, data writes and streak days, async races, and checks that can't fail. A
   mistake the build's first test run would expose (a missing import, a config key)
   matters least: fix it in passing, but don't spend the session hunting for it. Every
   silent class-a change above is one of these kinds.
2. **Prove every bite check and mutation.** For each "temporarily break X: test Y
   fails" line in a brief, trace that Y really fails, including in jsdom and on the web
   runner. This was the most common miss (88fa1f0, 1dcbbe5, e8de9f7, 0ae2d1c).
3. **Don't assert library behaviour you haven't checked.** Either read the installed
   source or version, or write it into the brief as a question for the build to settle
   with a test ("whatever the JVM does", as b02f51f did well). Two spec-review claims
   were wrong: kotlinx strictness (9df29b6, corrected in 496978c) and re-registering a
   subscription (b0bd115, corrected in 00bacbf).
4. **Check each step's own CI run.** Look for tests that an earlier step's change makes
   fail on that step's push: test-id twins, `toEqual` on golden rows, a shared fixture.
   Spec-review caught this twice (731f2b4, e2f62cb). Saying so makes it routine.
5. **End the log entry with counts:** "N substantive (S silent), M minor". The next
   retro then won't have to reclassify diffs.

### `jogging/prompts/spec.md`

1. **Add the mechanical checklist** spec-review keeps applying, so the spec gets it
   right first time:
   - every new Android tag gets a web twin in the same step;
   - a new field in golden output is compared or stripped by both runners in the step
     that adds it;
   - the changelog line goes with the first user-visible step;
   - no brief carries a later step's tests or docs (4db7f53);
   - each bite check names the case it fails and why.
2. **Write for the runner that will run the steps.** Builds run on Ubuntu in GitHub
   Actions, with an emulator and `gh`. They have no Windows-only tools: the Edge recipe
   (489d286) and the `gh` steps (2881510) were moot in the cloud of the day.
3. **Name the API version you rely on.** For a DSL, plugin or framework option, give the
   version you checked: Vite 8 `oxc.jsx` (bda7f56), the Compose accessibility API
   (2d76fcb), the AGP screenshot DSL (037809d), the Workers typings (00bacbf).
4. **Size the spec-review step to the piece.** This is about the `spec-review` step's
   model, not the piece's final `review` step. Today the `spec-review` step is in
   `state.json` as Opus/medium from the moment the piece is queued (62bc135). The spec
   step may edit only its own steps and `release`, so it can't change it. Let the spec
   step set the `spec-review` step's model and effort once it has sized the builds:
   - Opus/medium when the piece touches goals 1, 2 or 5 (data, the reminder, both apps
     in agreement), has a migration or transaction, or has four or more build steps;
   - otherwise Sonnet/high, which should still catch the loud cross-step issues.

   Alternatively, whoever queues the piece picks the model by the same rule. Try it on
   the next two small pieces and compare. `form-warnings` (all-Sonnet builds, $1.55 in
   total, against a $1.12 Opus spec-review) is the case it targets.

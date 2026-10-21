# icon-redraw/review: the whole piece

The piece redesigned the app icon with Recraft (build-1 and build-2, with Alan's picks
recorded in `jogging/LOG.md` and `docs/icon-concepts/README.md`), made the generator read
`scripts/icon-source.svg` (build-3), and rebuilt the pick there (build-4), or restored the
placeholder WebPs if Alan chose the fallback.

Look hardest at:

- **The token and the spend.** `RECRAFT_API_TOKEN` appears in no committed file, log or
  test; `docs/icon-concepts/log.json` totals at most 10,000 units
  (`node scripts/recraft.mjs check`); no test, CI job or app code calls Recraft.
- **The art matches the pick** and Alan's notes: compare `docs/icon-concepts/final.png`
  with the chosen finalist. The committed art is clean hand-built paths, not a Recraft
  trace (check the path count and `d` lengths in `scripts/icon-source.svg`).
- **The generator's guarantees.** The tests in `scripts/icon.test.mjs` really enforce the
  safe circle, the 20×20 notification box, gaps a unit wide at 24 dp, single-colour themed
  and notification icons, and drift; a source that breaks each would fail.
- **On the emulator** (release build, installed): the launcher icon under the circle and
  squircle masks (switch with `adb shell cmd overlay` if the launcher offers shapes, or
  check the round and square adaptive icon in the app drawer); the themed icon with
  Material You themed icons on, on a light and on a dark wallpaper; and a real reminder
  notification in the status bar and shade. Trigger it by setting the reminder a minute
  ahead in Settings with a word due, or by running the worker through `adb shell cmd jobscheduler`.
  Take screenshots with `adb shell screencap` and look at them. The notification icon must
  read as one white shape (goal 2: it is the reminder's face).
- **On the fallback** instead of the art and generator checks: the 15 WebPs and the
  background colour match `39188cc^` byte for byte (`git diff --quiet 39188cc^ -- app/src/main/res/drawable-*dpi app/src/main/res/values/ic_launcher_background.xml`),
  `app/src/main/res/drawable/` has no `ic_launcher_*` or `ic_notification` XML left to
  shadow them, nothing still imports `scripts/icon.mjs`, and `docs/icon.svg` (the WebP in
  an `<image>`) renders as the favicon and PWA icons.
- **The web icons** are rebuilt from `docs/icon.svg` (`web/public/icons/`), and
  `CLAUDE.md`'s "Generated files" and the `CHANGELOG.md` line say what happened.

## Acceptance

```bash
node scripts/recraft.mjs check
./gradlew assembleRelease
cd e2e && APK=../app/build/outputs/apk/release/app-release.apk npm run e2e:release
```

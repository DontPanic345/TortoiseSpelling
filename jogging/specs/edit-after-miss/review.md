# edit-after-miss/review: the whole piece

Review `edit-after-miss` against its spec (`jogging/specs/edit-after-miss.md`) and the
design doc (`docs/edit-after-miss.md`). Look hardest at:

- **Ordering (goal 1).** The editor never opens before the miss's `recordReview` has
  finished (Android joins `recordJob`; the web chains on `recorded`). The undo runs after
  the edit's save, reads the row inside its own transaction, writes only the eight
  scheduling fields (`undone`), and deletes only its own log row by id. No path writes
  back a stale `Word` row over the edit or the undo.
- **Only a saved edit undoes.** Top bar back, system back and the browser's Back leave
  the miss and its log row in place, and the retype goes on. A process death (Android) or
  reload (web) with the editor open undoes nothing.
- **Goal 4.** Nothing in grading or SM-2 changed; after a save the next answer goes
  through the normal first-attempt path and records again. Practice still writes no
  scheduling state or logs.
- **Deleted words.** Deleting from the editor removes the card, the title stays truthful,
  and the last card's removal finishes the session; `undoReview` and `cardFor` for a gone
  word write nothing and don't throw.
- **Two apps agree (goal 5).** The same phases show the button, the same outcomes do the
  same things, the golden `undone` cases pass on both runners, and the shared scenario
  passes on both without a platform tag.
- **Docs.** `CLAUDE.md`'s "Scheduling" states the exception; `jogging/GOALS.md` records it;
  the changelog line is under `[Unreleased]`, `### Added`.

## Acceptance

```bash
./gradlew assembleRelease
cd e2e && APK=../app/build/outputs/apk/release/app-release.apk npm run e2e:release
```

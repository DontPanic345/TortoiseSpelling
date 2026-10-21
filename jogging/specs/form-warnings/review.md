# form-warnings/review: the whole piece

Review `jogging/specs/form-warnings.md` as built (build-1 to build-4). Look hardest at:

- **The two apps agree.** `formWarnings` in `domain/FormWarnings.kt` and
  `web/src/domain/formWarnings.ts` use Kotlin's trim and whitespace on both sides
  (`ktHasWhitespace`, not `/\s/`), and `golden/warnings.json` pins the edge cases
  (non-breaking space, tab, phrase root, base form, blank form). Both runners run every
  function in the file; the `filterRows` runners both compare `checkForms`.
- **Warnings never block and are never stored.** `canSave` is unchanged on both apps, no
  entity, `DATABASE_VERSION`, `Backup.kt` or `backup.ts` change, and scheduling code is
  untouched (goals 1 and 4).
- **The marks are live.** Fixing or removing a flagged form clears its mark at once, and a
  word opened from the list shows its marks, on both apps.
- **The shared scenarios** in `specs/copy_prompt.feature` and `specs/word_list.feature` pass
  on both runners with the same step texts; the new tag is mirrored in `TestTags.kt`,
  `e2e/support/testIds.ts` and `web/src/ui/testIds.ts`.
- `CLAUDE.md` "Lookup" and the `CHANGELOG.md` line.

## Acceptance

```bash
./gradlew assembleRelease
cd e2e && APK=../app/build/outputs/apk/release/app-release.apk npm run e2e:release
```

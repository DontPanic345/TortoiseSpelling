# speak-word/review: the whole piece

Look hardest at:

- On-device voices only, on both apps: network voices are filtered before `chooseVoice`.
- The two apps agree: the golden cases and the shared scenario hold them to the same rule.
- The release build: R8 and the `<queries>` entry. Install it on the emulator and tap the
  button.


## Acceptance

```bash
./gradlew assembleRelease
cd e2e && APK=../app/build/outputs/apk/release/app-release.apk npm run e2e:release
```

# review-outcome/review: the whole piece

Look hardest at:

- The golden cases match the code that was removed.
- The DAO method's read and both writes are inside one transaction.
- The web transaction still awaits only its own requests.
- No scheduling outcome changed (goal 4).


## Acceptance

```bash
./gradlew assembleRelease
cd e2e && APK=../app/build/outputs/apk/release/app-release.apk npm run e2e:release
```

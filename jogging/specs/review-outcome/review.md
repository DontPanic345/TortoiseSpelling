# review-outcome/review: the whole piece

Look hardest at:

- The golden cases match the code that was removed.
- The DAO method's read and both writes are inside one transaction.
- The web transaction still awaits only its own requests.
- No scheduling outcome changed (goal 4).
- Android's `recordReview` for a word deleted mid-session writes nothing and doesn't throw,
  and nothing else in the app still calls it with a `Word`.


## Acceptance

```bash
./gradlew assembleRelease
cd e2e && APK=../app/build/outputs/apk/release/app-release.apk npm run e2e:release
```

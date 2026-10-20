# Coding standards

Every change meets these: build sessions write to them, and the reviewer checks the diff
against them. They are the judgement calls no check can make; lint, typecheck, `check-steps`, `check-specs`, `testIds.test.ts`
and the golden runners already enforce the mechanical rules. `CLAUDE.md` holds the
architecture, and its "Data safety" rules apply to every review.

## Both apps agree

- A change to shared behaviour lands on both apps in the same piece, or the spec says
  which goal lets one wait.
- Ported logic follows `web/README.md`'s "Rules of the port". A behaviour both apps compute
  has a case in `golden/`; a difference between them is listed in `golden/README.md`'s
  "Known differences" with its reason, never left implicit.
- Copy, test ids and screen order match between the two apps, so the shared features in
  `specs/` read the same on both.

## Tests prove the change

- Every fix and every rule comes with a test that fails without it. A test that would
  still pass with the change reverted proves nothing.
- Tests sit at the lowest layer that can see the behaviour: logic in unit tests, Room
  and WorkManager in instrumented tests, e2e only for journeys and device-only behaviour.

## Code reads like its neighbours

- Names, structure and comment density match the surrounding code.
- Comments say why, in a line or two, and describe the code as it is now.
- NZ spelling in copy, comments and docs.
- A new dependency earns its place: the spec or the log says why the platform or an
  existing one won't do.

## Docs move with the code

- A user-visible change has a line under `[Unreleased]` in `CHANGELOG.md`.
- A change to what either app or the push server stores updates `PRIVACY.md`, column by
  column.
- A doc that describes the changed behaviour (`CLAUDE.md`, the READMEs, `docs/`) says what
  the code now does.

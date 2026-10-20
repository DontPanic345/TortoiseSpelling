# Review step

Review the whole piece as built, as an independent reader, against its spec, the goals and
`CODING_STANDARDS.md`. Read the diff (`git diff <base>..HEAD -- <path>`), beyond the spec
and the tests. Your brief says where to look hardest.

Fix what is substantive yourself, each fix with a test that fails without it, and leave
nits. CI runs every suite on your push, so locally run the tests for what you change and
the brief's Acceptance block.

When the piece is done the crew bumps the version from `CHANGELOG.md`'s `[Unreleased]`
notes, so check they cover every user-visible change in the piece.

Then finish as "Finishing" says.

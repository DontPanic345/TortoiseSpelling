# Changelog

All notable changes to TortoiseSpelling are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Add a line under **[Unreleased]** with every user-visible change. The release notes on
GitHub are taken from here; see [Releases](README.md#-releases) for how a version is cut.

## [Unreleased]

### Fixed

- The daily reminder no longer fails if notification permission is revoked at the
  exact moment it's being posted.

## [0.0.1] - 2026-09-13

The first release.

### Added

- Your own word list: add a word with its definition, an example sentence and its part
  of speech.
- Optional lookup with Claude: with your own Anthropic API key, the definition, example
  sentence and part of speech are filled in for you. The key is stored encrypted on the
  device.
- Reviews where you spell the word from memory, from its definition and an example
  sentence with the word blanked out. A miss shows a letter-by-letter diff and has you
  retype the word before moving on.
- SM-2 spaced repetition: a word you spell right comes back later and later; a miss
  brings it back tomorrow.
- A daily session of every due word plus a limited number of new words, with the limit
  set in Settings.
- A clear "all done for today" screen, and a practice mode that doesn't touch your
  schedule.
- A daily streak, which days with nothing due don't break.
- A daily reminder notification at a time you choose, sent only when words are due.
- A word list to browse, search, edit, suspend and delete words.
- Backup export and import as JSON. Importing adds new words and never overwrites the
  progress of words you already have.

[unreleased]: https://github.com/DontPanic345/TortoiseSpelling/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/DontPanic345/TortoiseSpelling/releases/tag/v0.0.1

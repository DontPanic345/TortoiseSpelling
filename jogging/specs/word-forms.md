# Piece: word-forms

Definitions, word forms and example sentences: schema version 3 and its migration, review
picking and rotation, editing, search, and the backup format. Sources:
`docs/word-forms.md` (the data model and the open questions, which `GOALS.md` answers) and
`docs/copy-prompt-lookup.md` (the JSON tree a later paste fills, so the shapes line up).

Builds on `test-data-layer` and `test-ui-layers` as specified. The crew builds
`test-ui-layers` first, so this spec assumes: `MigrationTest`, `testWord`, `DATABASE_VERSION`
and `ALL_MIGRATIONS`; `WordRepository(dao, settings, clock, fuzz)`; the stateless
`ReviewContent`/`WordListContent`; the component, integration, accessibility and screenshot
layers and their fixtures; `npm run e2e:release`.

## What it delivers

- A word carries **one or more definitions**, each with **word forms** ("ran",
  "children", "practise"), each with **example sentences**. The root's own spelling is
  the base form under the first definition. `Word.text` stays the word list label and
  the review queue key.
- **Review asks for a form, not always the root.** Each time a word comes up, the
  review shows the least recently shown example sentence across all its forms (random
  among ties), blanks *that form* out of it, and checks the answer against that form.
  This one rule chooses the form and rotates the sentences.
- **Editing by hand.** The add/edit screen edits the whole tree: add, edit and remove
  definitions, forms and examples. A lookup replaces the tree and keeps scheduling.
- **Search by any form.** "practise" finds "practice".
- **Backups carry the tree**, stay importable from every earlier version, and stay
  importable *into* earlier versions (they get the first definition and example).
- **Existing words migrate** to one definition, one base form and one example each.

Goals it leans on:

1. **Nothing lost.** Version 3 has a real `Migration` and migration tests. One of them
   runs through Room's own open path, because the migration rebuilds `words`, and a
   rebuild with foreign keys on would cascade-delete the review log. Backups read both
   ways across the change.
2. **Reminder.** Untouched.
3. **No API key.** Not this piece's to remove; `copy-prompt` and `drop-api-key` do that.
   This piece keeps the existing lookup and `CardRefresher` working on the new tables,
   in the smallest way, because a release ships between here and `drop-api-key`.
4. **Scheduling per root word.** `Word` keeps every SM-2 column. `recordReview`,
   `Sm2Scheduler`, `Grade`, `SessionBuilder` and the DAO's session queries don't
   change. Forms, definitions and examples are content only. The one new write during
   review is an example's `shownAt`, which is rotation state, not scheduling.
5. **Two apps.** The pick rule, the content rules and the backup JSON are pure and
   unit-tested, so `web-core` can port them with golden tests.
7. **Simple.** No new dependencies. Room `@Relation` for loading, one pure content model
   for the editor, the backup and the paste.

### Settled here (the decisions don't cover these)

- **Part of speech lives on `Definition`**, not `WordForm` as `docs/word-forms.md`
  sketches. A sense has one part of speech; the doc's "runs" example (verb under one
  sense, noun under another) is already split by definition. `copy-prompt-lookup.md`'s
  JSON also puts it on the definition. One field per definition instead of one per form
  keeps the editor smaller (goal 7).
- **The base form is positional.** It is `definitions[0].forms[0]`, and saving always
  sets its text to `Word.text`. The editor shows it as the word itself, with no text
  field and no remove button. The first definition can't be removed either.
- **Blank examples aren't migrated.** The migration creates an `ExampleSentence` only
  where the old `example` isn't blank. The decision assumes there is a sentence to bank;
  an empty one would only be skipped by the review anyway. Words with no example still
  get their definition and base form.
- **A form's label shows in review**: "verb · past tense" above the definition, when
  the form has a label. Without it, "They _____ every day" can't tell "run" from "runs".
  Migrated base forms have no label, so existing cards look as they do today.
- **Practice mode rotates too.** It stamps `shownAt`, since a sentence seen in practice
  has been seen. It still writes no scheduling and no log (`CLAUDE.md`'s rule is about
  those).
- **`shownAt` is stamped when the card is first shown,** not when it's answered or
  when the session is built. Building a 20-word session and quitting after two must
  not mark 18 unseen sentences as shown.
- **Auto refresh adds an example.** Until `drop-api-key` removes it, `CardRefresher` asks
  for a new example (as today, sending the stale card) and appends it to the base form's
  examples. It no longer rewrites the definition, which may now be one of several. A new
  example has never been shown, so it comes up next. A `### Changed` line says so.
- **The backup format stays version 1.** The tree is a new, defaulted `definitions` key,
  and the flat `definition`/`example`/`partOfSpeech` keys are still written from the
  root card. Older builds ignore unknown keys and read the flat ones, so a downgraded
  app can still restore every word and its progress (goal 1). This follows the
  precedent `autoRefresh` set (`Backup.kt`'s comment).

## Design

### Data model (schema version 3)

New entities in `data/`, one file each, NZ spelling in KDoc:

```kotlin
@Entity(
    tableName = "definitions",
    foreignKeys = [ForeignKey(entity = Word::class, parentColumns = ["id"],
        childColumns = ["wordId"], onDelete = ForeignKey.CASCADE)],
    indices = [Index(value = ["wordId"])],
)
data class Definition(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val wordId: Long,
    val text: String,
    val partOfSpeech: String? = null,
    val orderIndex: Int,
)

@Entity(tableName = "word_forms", /* FK definitionId -> definitions.id, CASCADE; Index(definitionId) */)
data class WordForm(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val definitionId: Long,
    /** The spelling asked for. Needn't share a letter with the root ("ran"). */
    val text: String,
    /** "past tense", "plural": whatever the user or the lookup wrote. Null for none. */
    val label: String? = null,
    val orderIndex: Int,
)

@Entity(tableName = "example_sentences", /* FK wordFormId -> word_forms.id, CASCADE; Index(wordFormId) */)
data class ExampleSentence(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val wordFormId: Long,
    val text: String,
    val orderIndex: Int,
    /** Millis the sentence was last shown in review, or null if never. */
    val shownAt: Long? = null,
)
```

`Word` loses `definition`, `example` and `partOfSpeech`. Everything else stays, including
`autoRefresh` and `refreshedOn` (`drop-api-key` removes those). The KDoc on `Word` says
its teaching content lives in the three tables and its SM-2 state stays here.

`data/WordWithContent.kt`, Room relations, loaded with `@Transaction` queries:

```kotlin
data class WordWithContent(
    @Embedded val word: Word,
    @Relation(entity = Definition::class, parentColumn = "id", entityColumn = "wordId")
    val definitions: List<DefinitionWithForms>,
)
data class DefinitionWithForms(@Embedded val definition: Definition, @Relation(…) val forms: List<FormWithExamples>)
data class FormWithExamples(@Embedded val form: WordForm, @Relation(…) val examples: List<ExampleSentence>)
```

Relations come back unordered: every reader goes through `WordWithContent.sorted()`
(by `orderIndex` at every level), defined beside them.

`@Database(entities = [Word, ReviewLog, Definition, WordForm, ExampleSentence],
version = DATABASE_VERSION)`, `DATABASE_VERSION = 3`, `ALL_MIGRATIONS` gains
`MIGRATION_2_3`. Commit the generated `app/schemas/.../3.json`.

### The migration (2→3)

`MIGRATION_2_3` in `TortoiseSpellingDatabase.kt`, with a KDoc of two or three lines. Write
the entities first, build, and copy every `CREATE TABLE`/`CREATE INDEX` statement from
the generated `3.json` (Room validates the result against it), then:

1. Create `definitions`, `word_forms` and `example_sentences`, and their indices.
2. Fill them from the old columns, reusing the word's id as each new row's id, so no
   join is needed and every row is traceable. A blank part of speech (an imported
   backup can hold `""`) becomes null, the content model's "none":

   ```sql
   INSERT INTO definitions (id, wordId, text, partOfSpeech, orderIndex)
       SELECT id, id, definition, NULLIF(TRIM(partOfSpeech), ''), 0 FROM words;
   INSERT INTO word_forms (id, definitionId, text, label, orderIndex)
       SELECT id, id, text, NULL, 0 FROM words;
   INSERT INTO example_sentences (id, wordFormId, text, orderIndex, shownAt)
       SELECT id, id, example, 0, NULL FROM words WHERE trim(example) != '';
   ```

3. Rebuild `words` without the three columns, as Room's own auto-migrations do (SQLite
   only gained `DROP COLUMN` in 3.35, API 34; `minSdk` is 26): create `_new_words` from
   `3.json`'s `words` statement, `INSERT INTO _new_words (…) SELECT … FROM words` naming
   every kept column, `DROP TABLE words`, `ALTER TABLE _new_words RENAME TO words`, then
   recreate the three `words` indices with the names in `3.json`.

**Foreign keys.** Room switches `foreign_keys` on in `onOpen`, after migrations, so the
`DROP TABLE` doesn't cascade into `review_log` or `definitions`. The migration tests prove
it, including one through Room's real open path. If that test loses a row, don't loosen
it and don't ship the rebuild: keep the three old columns on `words` instead (as
`@ColumnInfo` fields defaulting to `""`/null that nothing reads), drop the rebuild step,
leave the column drop to `drop-api-key`'s rebuild, and record it here.

### Content model (pure)

`domain/WordContent.kt`, plain Kotlin, the shape the editor edits, saves, backs up and
(in `copy-prompt`) pastes:

```kotlin
data class WordContent(val definitions: List<DefinitionDraft>)
data class DefinitionDraft(val text: String, val partOfSpeech: String = "", val forms: List<FormDraft>)
data class FormDraft(val text: String, val label: String = "", val examples: List<ExampleDraft> = emptyList())
data class ExampleDraft(val text: String, val shownAt: Long? = null)
```

`definitions[0].forms[0]` is the base form. Blank `partOfSpeech`/`label` mean none and are
stored as null. Functions, all unit-tested in `WordContentTest`:

- `simpleContent(word, definition, partOfSpeech, example)`: one definition, the base form,
  and one example if `example` isn't blank. Used by the lookup, the seed activity, a
  version 1 backup entry and the `addWord` convenience overload.
- `WordContent.preparedFor(word: String)`: what saving stores. Trims every field; drops
  blank examples, empty non-base forms (blank text and no non-blank example) and empty
  definitions after the first (blank text and only empty forms); gives the first
  definition a base form if it has none; sets the base form's text to `word`; blanks every
  form's text out of every definition (`hideWordInDefinition` once per distinct form
  text, which now covers "practise" in a definition of "practice"). Keeps `shownAt`.
- `WordContent.isComplete()`: after `preparedFor`, the first definition and every
  remaining definition have text, and every remaining non-base form has text. This plus
  a non-blank word is `canSave`.
- `WordContent.apply(edit: ContentEdit)`: one sealed `ContentEdit` per editor action
  (`DefinitionText(d, value)`, `PartOfSpeech(d, value)`, `FormText(d, f, value)`,
  `FormLabel(d, f, value)`, `ExampleText(d, f, e, value)`, `AddDefinition`,
  `RemoveDefinition(d)`, `AddForm(d)`, `RemoveForm(d, f)`, `AddExample(d, f)`,
  `RemoveExample(d, f, e)`). Removing the first definition or the base form is a no-op.
  `AddDefinition` adds one with a blank form holding one blank example; `AddForm` adds a
  blank form with one blank example; `AddExample` adds a blank example.
- `WordContent.searchTerms(word: String): Set<String>`: the normalized root and every
  normalized form text.
- `exampleMissesForm(example, formText)`: true when the example isn't blank and
  `blankWordIn(example, formText).didBlank` is false. Drives the editor's warning, and
  `copy-prompt`'s validation later.

`data/WordWithContent.kt` also has `WordWithContent.toContent()` (sorted, nulls to `""`).

### Review: picking and rotation

`domain/CardPick.kt`:

```kotlin
data class ReviewCard(
    val word: Word,
    val definition: String,
    val partOfSpeech: String?,
    val form: String,
    val label: String?,
    val example: ExampleSentence?,
) {
    val answer: String get() = normalizeWord(form)
    /** "verb · past tense", or null with neither. Blank parts count as absent. */
    val hint: String? get() = …
}

fun pickCard(content: WordWithContent, random: Random = Random.Default): ReviewCard
```

- Candidates are every (definition, form, example) in the sorted tree. The pick is a
  candidate with the smallest `shownAt`, null counting as smaller than any time; among
  ties, `random` chooses.
- A word with no examples asks for the base form under the first definition, with no
  example (the review shows its standalone blank, as today for a word with no example).
- A word with no content rows at all (only fixtures seeded straight through the DAO)
  gives `definition = ""`, `form = word.text`, no example. Defensive, and it keeps the
  integration tests' DAO-seeded words reviewable.

`WordRepository`:

- `buildSession(): List<ReviewCard>` and `practicePool(limit): List<ReviewCard>`: the
  same `dueWords`/`newWords`/`interleaveSession`/`randomWords` as now, then
  `contentFor(ids)` and `pickCard` per word, keeping the session's order. `contentFor`
  queries in chunks of 500 ids: API 26's SQLite allows 999 variables, and a long
  backlog can exceed that.
- `markShown(example: ExampleSentence)`: `UPDATE example_sentences SET shownAt = :at
  WHERE id = :id`, with `clock.millis()`.
- `recordReview(word, …)` is unchanged. Its comment about re-reading now names
  `markRefreshed` as the concurrent writer.

`ReviewViewModel` / `ReviewUiState`:

- `queue: List<ReviewCard>`, `current: ReviewCard?`.
- When a card becomes current (after the queue loads, and in `advance()` unless
  finished), call `repository.markShown(card.example)` if it has one. In practice mode
  too.
- Answers compare against `card.answer`; `spellingDiff(card.form, typed)`; a correct
  answer fills the field with `card.form`; `record(card.word, …)`.
- `blankedExample` blanks `card.form` out of `card.example?.text`.
- `cardRefresher.refreshInBackground(queue.map { it.word })`, unchanged otherwise.

`ReviewContent`: the prompt's italic line shows `card.hint` (it showed
`word.partOfSpeech`), then `card.definition`. The revealed sentence, the "Correct" word
(`REVIEW_CORRECT_WORD`) and the diff's "Correct" row show `card.form`. No other layout
change.

### Editing

`ui/add/`: `AddWordUiState` replaces `definition`, `example` and `partOfSpeech` with
`content: WordContent`. A new word starts as one blank definition holding the base form
with one blank example. `canSave = text.isNotBlank() &&
content.isComplete()`. The ViewModel gets `onEdit(edit: ContentEdit)`, which applies the
edit to `content`.

- **Load:** `repository.contentById(id)` gives the word and `toContent()`.
- **Save, new:** `repository.addWord(text, content, autoRefresh)`. After a save the form
  clears to a fresh one, as now.
- **Save, edit:** `repository.updateWord(word, content)`, with `word` re-read by id at
  save time as `save()` does now, never the row loaded when the editor opened:
  `updateWordWithContent` writes the whole `words` row. The duplicate check as now,
  then one transaction that writes the word row and replaces its content. `shownAt`
  rides along in the drafts, so an edit doesn't reset the rotation.
- **Look up with Claude:** success sets `text` and replaces `content` with
  `simpleContent(result…)` (the decision: a lookup replaces the content, scheduling is
  kept). `Unparsed` puts the raw text into the first definition's text, leaving the rest.

`AddWordScreen` splits into `AddWordScreen` (ViewModel, snackbar effect, focus,
navigation) and a stateless `AddWordContent(state, …, onEdit: (ContentEdit) -> Unit, …)`,
the same convention `test-ui-layers` set. Layout, top to bottom, in the existing
`Column` and `OutlinedTextField` style:

- Word field, then the Look up row, as now.
- Per definition: a "Definition 1" style heading, with a remove icon button
  ("Remove definition 2") from the second on; the Definition field (its supporting text
  as now); the "Part of speech (optional)" field.
- Per form, indented: the base form shows the word field's text (or "The word itself"
  while it's blank) as a heading with only a "Label (optional)" field; other forms get a
  "Form" field, a "Label (optional)" field and a remove icon button ("Remove form
  “ran”"). Then each example: an "Example sentence (optional)" field with a remove icon
  ("Remove example"), and supporting text "The word is blanked out during review." or,
  when `exampleMissesForm`, "Doesn't contain “ran”, so review can't blank it." in the
  error colour. The warning doesn't block saving. Then an "Add example" text button.
- "Add form" after a definition's forms; "Add definition" after the last definition.
- A blank Definition or Form field that blocks saving shows "Required" as its
  supporting text, so a disabled Save explains itself.
- The auto-refresh toggle (its copy now says Claude adds a fresh example sentence),
  Save, and the burst counter, as now.

Test tags (`ui/TestTags.kt`): the existing `ADD_WORD_DEFINITION`,
`ADD_WORD_PART_OF_SPEECH` and `ADD_WORD_EXAMPLE` stay on the first definition, its part
of speech and the base form's first example, so every existing add step keeps working.
New: `ADD_WORD_ADD_DEFINITION`, `addWordDefinition(d)`, `addWordAddForm(d)`,
`addWordFormText(d, f)`, `addWordFormLabel(d, f)`, `addWordAddExample(d, f)`,
`addWordExample(d, f, e)` (strings like `add_word_form_text_0_1`). Mirror in
`e2e/support/testIds.ts` only those the e2e suite uses.

### Word list and search

`WordListViewModel` observes `repository.observeWordsWithContent()` (a `@Transaction`
`Flow<List<WordWithContent>>`, newest first, replacing `observeAllWords`).
`WordRow(word, status, definition)`: `definition` is the first definition's text, which
`WordListContent` shows where it showed `word.definition`. `filtered` matches when the
needle is a substring of any of `toContent().searchTerms(word.text)`. The filters and
counts take the rows' `Word`s, unchanged.

### Repository and DAO

`TortoiseSpellingDao` gains:

- `insertDefinition`, `insertForm`, `insertExample` (`@Insert`);
- `deleteContent(wordId)`: `DELETE FROM definitions WHERE wordId = :wordId` (forms and
  examples cascade);
- `@Transaction` default methods `insertContent(wordId, content)` (maps a prepared
  `WordContent` to rows, `orderIndex` = list position, blank to null),
  `insertWordWithContent(word, content): Long`,
  `updateWordWithContent(word, content)` (`updateWord`, `deleteContent`,
  `insertContent`);
- `@Transaction` queries `contentById(id)`, `contentFor(ids)`,
  `observeWordsWithContent()`, `allContentOnce()` (oldest first);
- `markShown(id, at)`, and `nextExampleIndex(formId)`
  (`SELECT COALESCE(MAX(orderIndex) + 1, 0) …`) for the refresher.

It loses `updateContent` and `observeAllWords`. `markRefreshed`, the session queries and
the log queries are unchanged.

`WordRepository`:

- `addWord(text, content, autoRefresh = false)`: trims, duplicate check as now, then
  `insertWordWithContent(word, content.preparedFor(trimmed))`. The flat
  `addWord(text, definition, example, partOfSpeech, autoRefresh = false)` stays as a
  one-line overload through `simpleContent`, for the seed activity and the tests that
  use it.
- `updateWord(word, content)`: as now, plus the content.
- `contentById`, `observeWordsWithContent`, `buildSession`, `practicePool`, `markShown`
  as above.
- `addExample(word, text)` for the refresher: appends to the base form, unless an
  example with the same normalized text is already there.
- `refreshContent` goes.
- `exportAll(): List<WordWithContent>`; `importWords(words: List<ImportedWord>)` with
  `data class ImportedWord(val word: Word, val content: WordContent)`: the same merge
  rule, inserting each new word with its prepared content in one transaction.

`CardRefresher.refresh`: loads `contentById`; sends `StaleCard(definition = first
definition, example = the base form's last example or "")`; on success, if
`result.example` isn't blank, `repository.addExample(word, result.example)`. The class
KDoc says it adds examples now. `result.definition` and `result.partOfSpeech` are ignored.

`SeedWordsActivity` is unchanged: it uses the flat overload.

### Backup format

`data/Backup.kt`, still `CURRENT_VERSION = 1`:

```kotlin
@Serializable data class BackupWord(
    /* every existing field, unchanged */,
    val definitions: List<BackupDefinition> = emptyList(),
)
@Serializable data class BackupDefinition(val text: String, val partOfSpeech: String? = null, val forms: List<BackupForm> = emptyList())
@Serializable data class BackupForm(val text: String, val label: String? = null, val examples: List<BackupExample> = emptyList())
@Serializable data class BackupExample(val text: String, val shownAt: Long? = null)
```

- `WordWithContent.toBackup()`: the full tree in order, and the flat fields from the
  root card: `definition` = first definition's text, `partOfSpeech` = its part of
  speech, `example` = the base form's first example or `""`.
- `BackupWord.toImport(): ImportedWord`: the tree when `definitions` isn't empty,
  otherwise `simpleContent` from the flat fields (every backup written before this
  piece).
- Update the comment on the format version: the tree is additive, the flat fields keep
  older builds reading, so the version stays 1.

The e2e backup scenario's `e2e-two-words.json` is a flat, pre-tree file, so it keeps
proving old backups import on a device.

### Docs

- `CLAUDE.md`:
  - Layers, `data/`: the five entities and `WordWithContent`; `domain/`: the content
    model and card picking.
  - Dates: `shownAt` is millis, like every `…At`.
  - "Today's session": each word becomes a `ReviewCard` through `pickCard`, the least
    recently shown example across its forms, random among ties; `shownAt` is stamped
    when a card is first shown, in practice mode too, which still writes no scheduling
    or logs.
  - "Claude lookup": a lookup fills one definition, the base form and one example, and
    replaces the editor's content.
  - "Keeping cards fresh": the refresh appends an example to the base form instead of
    rewriting the card; the targeted write is now `markRefreshed`.
  - "Secrets and data safety": version 3 moved `definition`, `example` and
    `partOfSpeech` into `definitions`, `word_forms` and `example_sentences`, rebuilding
    `words` (the pattern a later column drop copies); backups carry a `definitions`
    tree beside flat fields from the root card, so the format version stays 1.
  - "Review screen details": the blank and the answer are the asked form's, and
    `hideWordInDefinition` scrubs every form of the word from every definition.
- `README.md`: the feature bullets mention definitions, forms ("ran", "practise") and
  rotating example sentences.
- `PRIVACY.md`: the on-device data list reads "your words, their definitions, word forms
  and example sentences".
- `CHANGELOG.md`, under `[Unreleased]`: `### Added` lines for definitions and forms
  edited by hand, review asking for a form and rotating sentences, and search by form;
  `### Changed` lines for "Keep this card fresh" adding an example, and for backups
  carrying the tree while older versions can still import them.
- `docs/word-forms.md`: status "implemented", with a short note on what differs from
  the sketch (part of speech on the definition, positional base form, refresh appends
  an example until `drop-api-key`). `docs/todo.md`: tick the word forms item.

## Build steps

Each step follows `CLAUDE.md`'s Workflow and `PROTOCOL.md`. "Passing" means every command
exits 0. Connected runs and e2e go to the device `PROTOCOL.md` names (in the cloud,
`ANDROID_SERIAL` already points at the spare phone; rerun `bash jogging/cloud-setup.sh`
if `adb devices` doesn't list it). Abbreviations, as in `test-ui-layers`:

- `<layer X>`: `./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.package=io.github.dontpanic345.tortoisespelling.X`
- `<e2e F…>`: `cd e2e && npm run e2e -- --spec features/F.feature …`, one `--spec` per
  file.

### build-1: schema v3, migration and the data layer (Sonnet, high)

The entities, `WordWithContent`, the DAO and repository changes, `MIGRATION_2_3` and
`3.json`, `domain/WordContent.kt`, `Backup.kt` mapping through the root card **without**
the tree yet (export writes the flat fields from `WordWithContent`, import uses
`simpleContent`), `CardRefresher`'s append, and the smallest glue to compile: the add
screen edits the root card through `ContentEdit`s on the first definition and base form
(no tree UI yet); the review moves to a queue of `ReviewCard`s, built by a temporary
`rootCard(content)` (the first definition, the base form and its first example), with
no hint line yet; the word list shows the first definition. build-2 replaces `rootCard`
with `pickCard`. High effort: the migration is the one place this piece can lose data.

Tests:

- `WordContentTest` (JVM): every rule under "Content model".
- `MigrationTest` (`data` layer):
  - *2→3 splits each word into a definition, a base form and an example.* Create
    version 2 with `ContentValues`: a reviewed word with every scheduling column off its
    default, `partOfSpeech` set, `autoRefresh` 1 and `refreshedOn` set; a new word with a
    blank example and null `partOfSpeech`; "Café", suspended; three `review_log` rows.
    A fourth word with `partOfSpeech` `""` (as an old backup import can leave it).
    `runMigrationsAndValidate(name, 3, true, MIGRATION_2_3)`. Then: every kept `words`
    column unchanged; one `definitions` row per word (`wordId`, text, part of speech,
    order 0; the `""` part of speech is null); one `word_forms` row per word (text = the word's, label null); an
    `example_sentences` row for each non-blank example only, `shownAt` null; the logs
    unchanged; `PRAGMA foreign_key_check` empty.
  - *Room migrates a version 2 database without losing a review.* Same rows, close, and
    open the file with `Room.databaseBuilder(…).addMigrations(*ALL_MIGRATIONS)`, so Room
    runs the migration in the app's own way. Four words, three logs (a count query on
    `review_log`), `contentById` gives each its definition, form and example.
  - The existing 1→2 "Room reads" test now opens at version 3: its expected `Word`s
    lose the moved fields and it checks the content instead. The chain test from version
    1 needs no change.
- `TortoiseSpellingDaoTest`: the `updateContent` test goes; `observeAllWords`' moves to
  `observeWordsWithContent` (also emits after a content-only change).
  New: `insertWordWithContent` stores the tree in order; `contentById` sorts by
  `orderIndex` whatever the insert order; `updateWordWithContent` replaces the tree and
  leaves the word's scheduling and logs alone; deleting a word cascades through all three
  tables; `markShown` changes only its row; `contentFor` with 1,200 ids returns all of
  them (the chunking, on API 26).
- `WordRepositoryTest`: `addWord` scrubs a form's text out of a definition; a rename via
  `updateWord` renames the base form; `importWords` adds content with the word; the
  stale-snapshot test now uses `markRefreshAttempted` and checks `refreshedOn` survives
  `recordReview`.
- `testWord` and any `androidTest`/fixture code that set the removed fields: fix them,
  keeping each test's intent. Words seeded straight through the DAO that a test reads a
  definition from get one with a `seedContent(dao, wordId, definition, example)` helper
  in `TestWords.kt`.

Acceptance:

```bash
./gradlew assembleDebug testDebugUnitTest lintDebug assembleDebugAndroidTest
git status --short app/schemas         # only the new 3.json
<layer data>                           # every test passes, including the two new migration tests
<layer component>                      # fixtures follow the new types
<layer integration>                    # SchedulingJourneyTest unchanged and passing
./gradlew validateDebugScreenshotTest  # no visual change yet
<e2e add_word review word_list backup>
```

- Temporarily leave `lapses` out of the `_new_words` copy: the 2→3 test fails.
  Temporarily drop the `WHERE` on the example insert: it fails too. Temporarily add
  `DELETE FROM review_log WHERE id = 1` at the end of the migration: the Room-path test
  fails. Revert all three. (A `PRAGMA foreign_keys` inside the migration's transaction
  is a no-op, so it can't stand in for the cascade.)

### build-2: review picks a form and rotates sentences (Sonnet, medium)

`domain/CardPick.kt`, `buildSession`/`practicePool` returning cards, `markShown`,
`ReviewViewModel`/`ReviewUiState`/`ReviewContent` as under "Review", and `rootCard`
deleted.

Tests:

- `CardPickTest` (JVM): never-shown beats shown; the oldest `shownAt` wins across forms
  and definitions; ties go to `random` (with two seeded `Random`s, both tied candidates
  come up); a form without examples is never picked while another form has one; no
  examples gives the base form and no example; no content gives `word.text`; `answer`
  normalizes the form; `hint` joins part of speech and label, skips a blank one, and is null with neither.
- `ReviewUiStateTest`: `blankedExample` blanks the form ("He _____ the whole way
  home.").
- `ReviewContentTest`: a card for "ran" shows "verb · past tense", blanks "ran", and
  the Correct state shows "ran". Accessibility and screenshot fixtures become cards;
  add a screenshot state with a label.
- Integration `RotationJourneyTest`, *a word's sentences take turns*: add "necessary"
  through `addWord(text, content)` with two examples on the base form, the first
  already shown (a `shownAt` a week before the test clock), the second never. Day D:
  the review shows the second; spell it. `nextDay()`: it shows the first. Seeding one
  as shown keeps both picks certain, with no tie for `random` to break. Second test, *the form in the sentence is the answer*: a word "run" whose only
  example is on "ran"; typing "run" gets "Not quite" (a miss, so the word is due
  tomorrow), and after `nextDay()` a new session takes "ran" as correct first time.

Acceptance:

```bash
./gradlew assembleDebug testDebugUnitTest lintDebug assembleDebugAndroidTest
<layer component>
<layer integration>                    # RotationJourneyTest and the five journeys pass
<layer accessibility>
./gradlew updateDebugScreenshotTest    # look at the review references: only the new state differs
./gradlew validateDebugScreenshotTest
<e2e review completion daily_allowance>
```

- Temporarily make `pickCard` always take the first candidate: `RotationJourneyTest`
  fails. Temporarily drop the `markShown` call: it fails too. Revert both.

### build-3: the content editor (Sonnet, high)

`ContentEdit` handling in `AddWordViewModel`, the `AddWordScreen`/`AddWordContent`
split and the tree layout under "Editing", the lookup replacing content, the new tags,
and the e2e scenario. High effort: it's the biggest screen change in the piece, and
the e2e step needs nested selectors.

Tests:

- `AddWordUiStateTest`: `canSave` follows `isComplete` (a blank second definition with
  content blocks; an empty one doesn't).
- `AddWordContentTest` (`component` layer): a new word shows one definition, the base
  form under the word's text and no remove button for either; "Add form" and "Add
  definition" send their `ContentEdit`s with the right indices; a second form's remove
  button sends `RemoveForm(0, 1)`; an example without its form shows the warning; Save
  is disabled while the first definition is blank.
- Accessibility and screenshot states: a new word, and "run" with two definitions and a
  "ran" form, light and dark.
- `e2e/features/word_forms.feature`, one journey:

  ```gherkin
  Feature: Word forms
    As a learner
    I want a word to carry its other spellings, like "ran" for "run"
    So that I practise them all without learning each one as a separate word

    Scenario: A form added by hand is what review asks for
      Given I have added the word "run" defined as "to move fast on foot"
      And I open the word list
      When I open "run"
      And I add the form "ran" labelled "past tense" with the example "He ran the whole way home."
      And I save the changes
      And I go back to Home
      And I start today's session
      Then I see "past tense"
      And the example reads "He _____ the whole way home."
      When I spell it "ran"
      Then I am told the correct word "ran"
  ```

  "run" is seeded with no example, so "ran"'s is the only sentence and the pick is
  certain. One new step, `I add the form {string} labelled {string} with the example
  {string}`, in `words.steps.ts`, through new `addWord` screen helpers; the rest exist.

Acceptance:

```bash
./gradlew assembleDebug testDebugUnitTest lintDebug assembleDebugAndroidTest
<layer component>
<layer accessibility>
./gradlew updateDebugScreenshotTest && ./gradlew validateDebugScreenshotTest   # look at the new references
cd e2e && npm run check-steps -- --all && npm run typecheck
<e2e word_forms add_word word_list>
```

- Temporarily let `RemoveForm` remove the base form: `WordContentTest` and
  `AddWordContentTest` fail. Revert.

### build-4: search, backup tree and docs (Sonnet, medium)

Search by form, the backup tree under "Backup format", and every doc under "Docs".

Tests:

- `WordContentTest`: `searchTerms` includes the root and every form, normalized.
- A JVM test of the word list's filtering (pull `filtered` out of the ViewModel into a
  pure `filterRows` beside `statusLabel` if needed): "practise" finds "practice"; "ran"
  finds "run"; a definition's text doesn't match.
- `BackupTest`: a tree round-trips (order, labels, parts of speech, `shownAt`); the flat
  fields mirror the root card; a file with no `definitions` imports as simple content
  (the existing pre-refresh fixture still reads); a tree file decodes with a stand-in
  serializer of today's `BackupWord` minus `definitions` (what an older build sees),
  giving the root card's definition and example.
- `WordListContentTest` only if `WordListContent`'s inputs changed in a way its tests
  don't already cover.

Acceptance:

```bash
./gradlew assembleDebug testDebugUnitTest lintDebug assembleDebugAndroidTest
<layer data>
<layer component>
<e2e word_list backup>
grep -n "Unreleased" -A12 CHANGELOG.md   # the Added and Changed lines are there
```

- Temporarily make `toImport` ignore `definitions`: the round-trip test fails. Revert.

### review (Sonnet, high)

Review the whole piece against this spec and `GOALS.md`, independently. In particular:
`MIGRATION_2_3` matches `3.json` statement for statement and copies every kept column;
each migration test fails under build-1's mutations; nothing outside `Word`'s SM-2 fields,
`recordReview` and the session queries decides scheduling, and none of those changed
(goal 4: `git diff` them against the piece's first commit); `shownAt` is written only by
`markShown` and the editor's save; the editor can't remove the base form or first
definition; the backup reads both ways; the docs say what the code does; no war-story
comments. High effort: the migration and backup are where goal 1 can fail, and reading
SQL against a schema JSON rewards care.

Run the full checks: unit, lint, all four instrumented layers, screenshot validation, the
whole e2e suite (`cd e2e && npm run e2e`), and the release smoke on a signed release
build (`test-ui-layers`' `npm run e2e:release`, with the debug-keystore variables
`CLAUDE.md` gives). Then finish with `node scripts/bump-version.mjs minor`, commit and
push, and watch the release run to the end.

## What later pieces rely on

- **`copy-prompt`**: parses the pasted JSON into a `WordContent` and applies it with the
  same replace the lookup uses (`AddWordViewModel` replacing `content`). Its JSON has
  `partOfSpeech` on the definition, matching. It must put the root's spelling first in
  the first definition before `preparedFor`, which takes the base form by position.
  Its "each example contains its form" rule is `exampleMissesForm`. It adds its states to
  `AddWordContent`, `AddWordContentTest` and the accessibility and screenshot sets.
- **`drop-api-key`**: deletes `CardRefresher` (with `addExample`, `nextExampleIndex` and
  the `StaleCard` mapping), the lookup and the toggle, and drops `autoRefresh` and
  `refreshedOn` in schema version 4 with the same table rebuild as `MIGRATION_2_3`, and
  the same Room-path migration test. `BackupWord`'s two fields can stay as ignored,
  defaulted keys or go; either way old files must still read.
- **`web-core`**: ports `WordContent` (`preparedFor`, `isComplete`, `apply`,
  `searchTerms`, `exampleMissesForm`), `pickCard` and the backup JSON as they are here,
  with golden tests from `WordContentTest`, `CardPickTest` and `BackupTest` (tie cases
  assert the pick is one of the tied candidates, since the two platforms' random
  generators differ). Its IndexedDB store keeps the same tree and `shownAt`.
- **`shared-specs`**: `word_forms.feature` is a shared scenario; the web app needs the
  same tree editor and the step's selectors.

Feature: Backing up the word list
  As a learner whose word list can't be recreated
  I want to export it to a file and import it back
  So that a new phone, or a mistake, doesn't cost me my words and their progress

  # Files go through Android's document picker, in the emulator's Downloads folder.

  Background:
    Given Downloads has no TortoiseSpelling test files
    And I have added the word "necessary" defined as "needed or required"
    And I open Settings

  Scenario: Exporting then importing the same backup changes nothing
    When I export a backup to Downloads as "e2e-backup.json"
    Then I am told "Backup saved."
    When I import "e2e-backup.json" from Downloads
    Then I am told "Imported 0 words, skipped 1 already in your list."

  Scenario: Importing a backup adds only the words I don't have
    Given Downloads has a backup "e2e-two-words.json" containing "rhythm" and "necessary"
    When I import "e2e-two-words.json" from Downloads
    Then I am told "Imported 1 word, skipped 1 already in your list."
    When I open the word list
    Then "rhythm" is listed

  Scenario: A file that isn't a backup is refused
    Given Downloads has a text file "e2e-notes.txt" containing "hello"
    When I import "e2e-notes.txt" from Downloads
    Then I am told "That file isn't a TortoiseSpelling backup."

  Scenario: A backup from a newer version of the app is refused
    Given Downloads has a version 99 backup "e2e-future.json"
    When I import "e2e-future.json" from Downloads
    Then I am told "That backup was made by a newer version of TortoiseSpelling (v99)."

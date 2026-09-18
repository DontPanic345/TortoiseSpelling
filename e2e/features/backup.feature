Feature: Backing up the word list
  As a learner whose word list can't be recreated
  I want to export it to a file and import it back
  So that a new phone, or a mistake, doesn't cost me my words and their progress

  # Files go through Android's document picker, in the emulator's Downloads folder.

  Scenario: Exporting a backup, then importing one adds only the words I don't have
    Given Downloads has no Tortoise Spelling test files
    And I have added the word "necessary" defined as "needed or required"
    And I open Settings
    When I export a backup to Downloads as "e2e-backup.json"
    Then I am told "Backup saved."
    Given Downloads has a backup "e2e-two-words.json" containing "rhythm" and "necessary"
    When I import "e2e-two-words.json" from Downloads
    Then I am told "Imported 1 word, skipped 1 already in your list."
    When I open the word list
    Then "rhythm" is listed

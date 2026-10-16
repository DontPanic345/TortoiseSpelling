# Android only: it exercises the R8-minified release APK.
@e2e @android @release-smoke
Feature: The release build works end to end
  As a learner installing the published APK
  I want the build that R8 has shrunk to behave like the one that was tested
  So that a release can't lose my words or my reminder

  # Runs only against a release APK (npm run e2e:release): the release build has no
  # SeedWordsActivity, so nothing here seeds.

  Scenario: Add a word, get reminded, review it, and back the list up
    Given I have no words yet
    And Downloads has no Tortoise Spelling test files
    When I add the word "necessary" defined as "needed or required"
    Then I am told "Added ✓ (1 total)"
    When I go back to Home
    And I open Settings
    And I choose "Send a test notification"
    Then a notification "Time to practise spelling" arrives saying "1 word ready"
    When I go back to Home
    And I start today's session
    And I spell it "necessary"
    Then I am told the correct word "necessary"
    And the session moves on by itself to the finish line
    When I choose "Done"
    And I open Settings
    And I export a backup to Downloads as "e2e-backup.json"
    Then I am told "Backup saved."
    Given Downloads has a backup "e2e-two-words.json" containing "rhythm" and "necessary"
    When I import "e2e-two-words.json" from Downloads
    Then I am told "Imported 1 word, skipped 1 already in your list."

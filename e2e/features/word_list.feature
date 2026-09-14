Feature: Managing the word list
  As a learner
  I want to browse, search, edit, pause and delete my words
  So that my list stays the words I actually want to learn

  Background:
    Given I have added these words:
      | word      | definition                          |
      | rhythm    | a regular repeated pattern of sound |
      | necessary | needed or required                  |
    And I open the word list

  Scenario: Every word is listed with its status
    Then the title reads "All words (2)"
    And "rhythm" is listed as "new"
    And "necessary" is listed as "new"

  Scenario: Searching filters the list
    When I search for "rhy"
    Then "rhythm" is listed
    And "necessary" is not listed

  Scenario: A search with no matches says so
    When I search for "xyz"
    Then I see "No matches"
    And I see "Nothing in your list matches “xyz”."

  Scenario: Filtering narrows the list to the selected status
    Given Downloads has no TortoiseSpelling test files
    And Downloads has a backup "e2e-word-progress.json" containing these words with progress:
      | word    | definition                   | intervalDays | due |
      | glisten | shines with a soft light     | 5            | yes |
      | opaque  | not able to be seen through  | 30           | no  |
    And I open Settings
    And I import "e2e-word-progress.json" from Downloads
    And I open the word list
    When I filter by "Known"
    Then "opaque" is listed
    And "rhythm" is not listed
    And "necessary" is not listed
    And "glisten" is not listed

  Scenario: A filter combines with search
    Given Downloads has no TortoiseSpelling test files
    And Downloads has a backup "e2e-word-progress.json" containing these words with progress:
      | word    | definition                   | intervalDays | due |
      | glisten | shines with a soft light     | 5            | yes |
      | opaque  | not able to be seen through  | 30           | no  |
    And I open Settings
    And I import "e2e-word-progress.json" from Downloads
    And I open the word list
    When I filter by "New"
    And I search for "e"
    Then "necessary" is listed
    And "rhythm" is not listed
    And "opaque" is not listed
    And "glisten" is not listed

  Scenario: A filter with no matches shows the empty state
    When I filter by "Suspended"
    Then I see "No matches"
    And I see "No suspended words."

  Scenario: Suspending a word takes it out of today's practice
    When I suspend "rhythm"
    Then "rhythm" is listed as "suspended"
    When I go back to Home
    Then Home shows 1 word to practice today

  Scenario: A suspended word can be resumed
    When I suspend "rhythm"
    And I resume "rhythm"
    Then "rhythm" is listed as "new"

  Scenario: Deleting asks first, and Cancel keeps the word
    When I ask to delete "rhythm"
    Then I see "Delete “rhythm”?"
    And I see "Its review history goes too. This can't be undone."
    When I choose "Cancel"
    Then "rhythm" is listed

  Scenario: Confirming the delete removes the word
    When I ask to delete "rhythm"
    And I choose "Delete"
    Then "rhythm" is not listed
    And the title reads "All words (1)"

  Scenario: Editing a word's definition
    When I open "rhythm"
    Then the title reads "Edit word"
    When I change the definition to "a strong regular pattern"
    And I save the changes
    Then "rhythm" is listed with the definition "a strong regular pattern"

  Scenario: A definition that gives the word away is blanked when saved
    When I open "rhythm"
    And I change the definition to "the rhythm of a song"
    And I save the changes
    Then "rhythm" is listed with the definition "the _____ of a song"

  Scenario: Renaming a word onto one already in the list is refused
    When I open "rhythm"
    And I change the word to "necessary"
    And I save the changes
    Then I am told "“necessary” is already in your list."

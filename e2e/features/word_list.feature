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

  Scenario: Every word is listed with its status, and search narrows the list
    Then the title reads "All words (2)"
    And "rhythm" is listed as "new"
    And "necessary" is listed as "new"
    When I search for "rhy"
    Then "rhythm" is listed
    And "necessary" is not listed

  Scenario: A suspended word leaves today's practice
    When I suspend "rhythm"
    Then "rhythm" is listed as "suspended"
    When I filter by "Suspended"
    Then "rhythm" is listed
    And "necessary" is not listed
    When I go back to Home
    Then Home shows 1 word to practise today

  Scenario: Deleting asks first
    When I ask to delete "rhythm"
    Then I see "Delete “rhythm”?"
    When I choose "Cancel"
    Then "rhythm" is listed
    When I ask to delete "rhythm"
    And I choose "Delete"
    Then "rhythm" is not listed
    And the title reads "All words (1)"

  Scenario: Editing a definition, which is blanked if it gives the word away
    When I open "rhythm"
    Then the title reads "Edit word"
    When I change the definition to "the rhythm of a song"
    And I save the changes
    Then "rhythm" is listed with the definition "the _____ of a song"

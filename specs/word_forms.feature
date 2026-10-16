@e2e
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

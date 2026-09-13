Feature: Adding words
  As a learner
  I want to add the words I actually misspell, typing the definition myself if I like
  So that I can start practising them straight away, with or without Claude

  Background:
    Given I have no words yet

  Scenario: Adding a word by hand
    When I add the word "necessary" defined as "needed or required"
    Then I am told "Added ✓ (1 total)"
    And the add-word form is cleared, ready for the next word
    When I go back to Home
    Then Home shows 1 word to practice today
    And 1 of them is new

  Scenario: Adding several words in a row
    When I add the word "necessary" defined as "needed or required"
    And I add the word "rhythm" defined as "a regular repeated pattern of sound"
    Then I see "Added 2 this session · 2 total"
    When I go back to Home
    Then Home shows 2 words to practice today

  Scenario: The same word cannot be added twice, whatever its case
    Given I have added the word "necessary" defined as "needed or required"
    When I add the word "Necessary" defined as "something else entirely"
    Then I am told "“necessary” is already in your list."

  Scenario: A word needs a definition before it can be saved
    When I start adding the word "rhythm" without a definition
    Then I cannot save the word

  Scenario: Without an API key, Claude lookup is unavailable
    When I start adding the word "rhythm" without a definition
    Then looking it up with Claude is unavailable
    And I see "Add an API key in Settings to use lookup, or write the fields yourself."

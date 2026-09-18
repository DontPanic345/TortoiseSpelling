Feature: Adding words
  As a learner
  I want to add the words I actually misspell, typing the definition myself if I like
  So that I can start practising them straight away, with or without Claude

  Scenario: Adding a word by hand
    Given I have no words yet
    When I add the word "necessary" defined as "needed or required"
    Then I am told "Added ✓ (1 total)"
    And the add-word form is cleared, ready for the next word
    When I go back to Home
    Then Home shows 1 word to practice today
    And 1 of them is new

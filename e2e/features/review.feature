Feature: Reviewing words
  As a learner
  I want to spell each of today's words from its definition, and be made to fix my misses
  So that the correct spelling is what sticks

  # Timing: a correct answer stays on screen for only ~1.1 s before the session
  # auto-advances, so the Then steps straight after "I spell it" must not dawdle.

  Scenario: The prompt hides the word
    Given I have added the word "necessary" defined as "needed or required" with the example "It is necessary to sleep."
    And I go back to Home
    When I start today's session
    Then the session title reads "1 / 1"
    And I am shown the definition "needed or required"
    And the example reads "It is _____ to sleep."

  Scenario: Spelling a word correctly on the first try
    Given I have added the word "necessary" defined as "needed or required" with the example "It is necessary to sleep."
    And I go back to Home
    When I start today's session
    And I spell it "necessary"
    Then I am told "Correct: necessary"
    And the example reads "It is necessary to sleep."
    And the session moves on by itself to the finish line
    And I see "You practiced 1 word today."

  Scenario: Answers are not case sensitive
    Given I have added the word "necessary" defined as "needed or required"
    And I go back to Home
    When I start today's session
    And I spell it "NECESSARY"
    Then I am told "Correct: necessary"

  Scenario: A miss shows where it went wrong and demands a clean retype
    Given I have added the word "necessary" defined as "needed or required"
    And I go back to Home
    When I start today's session
    And I spell it "neccessary"
    Then I am told "Not quite"
    And I see my attempt "neccessary" beside the correct spelling "necessary"
    When I retype it as "necesary"
    Then I am told "Not yet: type it exactly as shown above."
    When I retype it as "necessary"
    Then I see "All done — see you tomorrow"

  Scenario: A word without an example is prompted with standalone blanks
    Given I have added the word "rhythm" defined as "a regular repeated pattern of sound"
    And I go back to Home
    When I start today's session
    Then I see "_____"
    And I see "type the word"

  Scenario: The progress counter shows my place in the session
    Given I have added these words:
      | word      | definition                          |
      | rhythm    | a regular repeated pattern of sound |
      | necessary | needed or required                  |
    And I go back to Home
    When I start today's session
    Then the session title reads "1 / 2"
    When I spell the current word correctly
    Then the session title reads "2 / 2"

  Scenario: Ending a session early returns to Home
    Given I have added the word "necessary" defined as "needed or required"
    And I go back to Home
    When I start today's session
    And I end the session
    Then I am on Home
    And Home shows 1 word to practice today

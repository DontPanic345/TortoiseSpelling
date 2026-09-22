Feature: Reviewing words
  As a learner
  I want to spell each of today's words from its definition, and be made to fix my misses
  So that the correct spelling is what sticks

  # Timing: a correct answer stays on screen for only ~1.1 s before the session
  # auto-advances, so the Then steps straight after "I spell it" must not dawdle.

  Scenario: Spelling a word correctly, through to the finish line
    Given I have added the word "necessary" defined as "needed or required" with the example "It is necessary to sleep."
    And I go back to Home
    When I start today's session
    Then the session title reads "1 / 1"
    And I am shown the definition "needed or required"
    And the example reads "It is _____ to sleep."
    When I spell it "necessary"
    Then I am told the correct word "necessary"
    And the example reads "It is necessary to sleep."
    And the session moves on by itself to the finish line
    And I see "You practised 1 word today."
    And I see "🔥 1 day streak"
    And I see "Next review: tomorrow"
    When I choose "Done"
    Then I am on Home
    And I see "All done — see you tomorrow"
    And the week shows "Today, practised"
    And my words read "0 known, 1 learning, 0 new"

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

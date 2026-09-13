Feature: A clear finish line
  As a learner
  I want an unmistakable "you're done" once today's words are practised
  So that I know when to stop, and that extra practice is optional

  Scenario: Home with no words asks for a first word rather than claiming I'm done
    Then I see "No words yet"
    And I see "Add your first word"

  Scenario: Finishing today's session shows the finish line
    Given I have added the word "necessary" defined as "needed or required"
    And I go back to Home
    When I start today's session
    And I spell it "necessary"
    Then the session moves on by itself to the finish line
    And I see "You practiced 1 word today."
    And I see "🔥 1 day streak"
    And I see "Next review: tomorrow"

  Scenario: Done on the finish line returns to Home, which stays finished
    Given I have added the word "necessary" defined as "needed or required"
    And I have practised today's words correctly
    When I choose "Done"
    Then I am on Home
    And I see "All done — see you tomorrow"
    And I see "Practice a few more anyway"

  Scenario: Extra practice does not touch the schedule
    Given I have added the word "necessary" defined as "needed or required"
    And I have practised today's words correctly
    When I choose "Done"
    And I choose "Practice a few more anyway"
    Then the session title reads "Extra practice"
    When I spell it "necessary"
    Then I am on Home
    And I see "All done — see you tomorrow"
    And I see "You practiced 1 word today."
    When I open the word list
    Then "necessary" is listed as "tomorrow"

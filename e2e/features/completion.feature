Feature: A clear finish line
  As a learner
  I want an unmistakable "you're done" once today's words are practised
  So that I know when to stop, and that extra practice is optional

  Scenario: Extra practice does not touch the schedule
    Given I have added the word "necessary" defined as "needed or required"
    And I have practised today's words correctly
    When I choose "Done"
    And I choose "Practise a few more anyway"
    Then the session title reads "Extra practice"
    When I spell it "necessary"
    Then I am on Home
    And I see "All done — see you tomorrow"
    And I see "You practised 1 word today."
    When I open the word list
    Then "necessary" is listed as "tomorrow"

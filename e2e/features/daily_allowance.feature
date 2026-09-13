Feature: New words arrive in small daily batches
  As a learner who adds words in bursts
  I want only a few new words introduced each day
  So that a big list never turns into one overwhelming session

  Scenario: Only the daily allowance of new words is offered
    Given new words per day is set to 2
    And I have added these words:
      | word      | definition                          |
      | rhythm    | a regular repeated pattern of sound |
      | necessary | needed or required                  |
      | separate  | apart from others                   |
    When I go back to Home
    Then Home shows 2 words to practice today
    And 2 of them are new

  Scenario: Once today's allowance is introduced, the rest wait for tomorrow
    Given new words per day is set to 1
    And I have added these words:
      | word      | definition                          |
      | rhythm    | a regular repeated pattern of sound |
      | necessary | needed or required                  |
    And I have practised today's words correctly
    When I go back to Home
    Then I see "All done — see you tomorrow"

  Scenario: A missed word is scheduled for tomorrow, like a correct one
    Given I have added the word "necessary" defined as "needed or required"
    And I go back to Home
    When I start today's session
    And I spell it "neccessary"
    And I retype it as "necessary"
    And I open the word list
    Then "necessary" is listed as "tomorrow"

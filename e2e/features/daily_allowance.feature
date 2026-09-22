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
    Then Home shows 2 words to practise today
    And 2 of them are new

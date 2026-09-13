Feature: Settings
  As a learner
  I want to tune how many new words I get and when I'm reminded
  So that the app fits my day

  Background:
    Given I open Settings

  Scenario: New words per day starts at 10 and can be raised and lowered
    Then new words per day shows 10
    When I raise new words per day
    Then new words per day shows 11
    When I lower new words per day
    And I lower new words per day
    Then new words per day shows 9

  Scenario: New words per day cannot go below 1
    Given new words per day is set to 1
    Then I cannot lower new words per day

  Scenario: Changing the reminder time
    When I set the reminder time to 21:30
    Then I see "Reminder time: 21:30"

  Scenario: The reminder time cannot be changed while reminders are off
    When I turn the daily reminder off
    Then the daily reminder is off
    And I cannot change the reminder time

  Scenario: Testing the key with none saved asks for a key first
    When I choose "Test key"
    Then I am told "Enter a key first."

  @network
  Scenario: A rejected key is reported as such
    # Uses a deliberately fake key; it reaches Anthropic and comes back 401.
    When I enter the API key "sk-ant-fake-key-for-e2e"
    And I choose "Test key"
    Then I am told "Key rejected (401). Check it and try again."

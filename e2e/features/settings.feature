Feature: Settings
  As a learner
  I want to tune how many new words I get and when I'm reminded
  So that the app fits my day

  Scenario: Back up to Google account is off by default, and turning it on persists
    Given I open Settings
    Then cloud backup is off
    When I turn cloud backup on
    And I go back to Home
    And I open Settings
    Then cloud backup is on

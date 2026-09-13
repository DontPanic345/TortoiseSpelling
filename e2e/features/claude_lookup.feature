@live-api
Feature: Looking words up with Claude
  As a learner who doesn't want to write definitions
  I want Claude to fill in the definition and example, and fix my spelling of the word
  So that adding a word takes seconds

  # Types the real key from TORTOISESPELLING_ANTHROPIC_KEY into the app's Settings field,
  # so it is excluded from every default run and is for a human to run:
  #   TORTOISESPELLING_ANTHROPIC_KEY=... npm run e2e -- --cucumberOpts.tags=@live-api
  # The same API calls are covered without the UI by the JUnit ClaudeIntegrationTest.

  Background:
    Given my Anthropic API key is saved in Settings

  Scenario: The saved key passes the key test
    Given I open Settings
    When I choose "Test key"
    Then I am told "Key works."

  Scenario: Looking up a word fills in the card
    When I start adding the word "punctuation" without a definition
    And I look it up with Claude
    Then the definition is filled in
    And the example contains "punctuation"
    And the part of speech reads "noun"

  Scenario: A misspelled word is corrected
    When I start adding the word "recieve" without a definition
    And I look it up with Claude
    Then I am told "Corrected spelling to “receive”."
    And the word reads "receive"

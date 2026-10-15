@live-api
Feature: Keeping cards fresh with Claude
  As a learner who wants new example sentences as a word comes round
  I want to save an Anthropic key in Settings and know it works
  So that "Keep this card fresh" can ask Claude for them

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

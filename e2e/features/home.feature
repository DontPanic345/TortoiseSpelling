Feature: Home shows how I'm getting on
  As a learner
  I want Home to show my week and how far along my words are
  So that I can see the habit building, not just today's count

  Scenario: A word I've just added is new, and today isn't practised yet
    Given I have added the word "necessary" defined as "needed or required"
    When I go back to Home
    Then the week shows "Today, not practised yet"
    And my words read "0 known, 0 learning, 1 new"

  Scenario: Practising marks today and moves the word on to learning
    Given I have added the word "necessary" defined as "needed or required"
    And I have practised today's words correctly
    When I choose "Done"
    Then the week shows "Today, practised"
    And my words read "0 known, 1 learning, 0 new"
    And I see "🔥 1 day in a row"

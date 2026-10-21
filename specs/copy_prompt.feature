@e2e
Feature: Looking a word up with a chat AI
  As a learner who doesn't want to write definitions
  I want to paste a chat AI's answer into a word
  So that it gets its definitions, forms and examples in one go, with no account

  Scenario: A pasted answer fills in the word, ready to save
    Given I have no words yet
    When I start adding the word "practice" without a definition
    And I copy the lookup prompt
    Then the clipboard holds the lookup prompt for "practice"
    When I paste the chat's answer for "practice"
    Then I see "2 definitions, 4 forms, 4 example sentences"
    When I use the answer
    And I save the changes
    Then I am told "Added ✓ (1 total)"
    When I open the word list
    Then "practice" is listed with the definition "repeated exercise to improve a skill"
    When I search for "practise"
    Then "practice" is listed

  Scenario: A pasted form of two words is flagged, and fixed before saving
    Given I have no words yet
    When I start adding the word "curious" without a definition
    And I paste the chat's answer for "curious"
    Then I see "“most curious” is more than one word. Spelling review asks for one word."
    When I use the answer
    Then the editor warns "“most curious” is more than one word. Spelling review asks for one word."
    When I remove the form "most curious"
    And I save the changes
    Then I am told "Added ✓ (1 total)"
    When I open the word list
    Then "curious" is not marked Check forms

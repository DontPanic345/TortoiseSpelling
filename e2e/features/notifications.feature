@todo
Feature: Daily reminder
  As a learner who forgets to open the app
  I want one notification a day when words are due
  So that the habit sticks

  # Scenarios starting "Given the app is freshly installed" reinstall the APK, because
  # only a reinstall resets a notification-permission decision. Every other scenario
  # starts with notifications already allowed (support/app.ts resetApp).

  Scenario: A fresh install asks for notification permission once there is a word
    Given the app is freshly installed
    Then I am not asked to allow notifications
    When I add the word "necessary" defined as "needed or required"
    And I go back to Home
    Then I am asked to allow notifications

  Scenario: Allowing notifications keeps the daily reminder on
    Given the app is freshly installed
    And I have added the word "necessary" defined as "needed or required"
    When I go back to Home
    And I allow notifications
    And I open Settings
    Then the daily reminder is on

  Scenario: Refusing notifications turns the daily reminder off, and it stays asked
    Given the app is freshly installed
    And I have added the word "necessary" defined as "needed or required"
    When I go back to Home
    And I refuse notifications
    And I open Settings
    Then the daily reminder is off
    When I go back to Home
    Then I am not asked to allow notifications

  Scenario: After a second refusal, Settings points to the system page
    Given the app is freshly installed
    And I have added the word "necessary" defined as "needed or required"
    And I go back to Home
    And I refuse notifications
    And I open Settings
    When I turn the daily reminder on
    And I refuse notifications
    Then I am told "Notifications are blocked for TortoiseSpelling."
    And the daily reminder is off
    When I choose "Open settings"
    Then Android's notification settings for TortoiseSpelling are shown

  Scenario: A test notification arrives even when nothing is due
    Given I open Settings
    When I choose "Send a test notification"
    Then I am told "Test reminder queued."
    And a notification "Reminders are working" arrives saying "Nothing is due right now."

  Scenario: Tapping the reminder opens today's session
    Given I have added the word "necessary" defined as "needed or required"
    And I open Settings
    And I choose "Send a test notification"
    And a notification "Time to practice spelling" arrives saying "1 word ready"
    When I tap that notification
    Then the session title reads "1 / 1"

  Scenario: Rotating a reminder-opened session does not stack a second one
    Given I have added the word "necessary" defined as "needed or required"
    And I open Settings
    And I choose "Send a test notification"
    And a notification "Time to practice spelling" arrives saying "1 word ready"
    When I tap that notification
    And I rotate the device
    Then the session title reads "1 / 1"
    When I press the system Back button
    Then I am not in a session

  @slow
  Scenario: The reminder arrives even when the app is not running
    # The bug this guards against: app start used to cancel the pending reminder, so
    # it only fired if the process happened to be alive. Takes about three minutes.
    Given I have added the word "necessary" defined as "needed or required"
    And I open Settings
    And the reminder time is set to 2 minutes from now
    When the app is sent to the background and its process is killed
    Then within 4 minutes a notification "Time to practice spelling" arrives saying "1 word ready"

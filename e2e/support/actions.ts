type Element = ReturnType<typeof $>;

// No tap() helper: the session runs with an invisible keyboard (appium:hideKeyboard in
// wdio.conf.ts), so nothing can cover a button and a plain element.click() is enough.

/**
 * Replaces a text field's contents (Compose honours the accessibility set-text action).
 * setValue() alone appends to whatever the field already holds, so a field pre-filled
 * from a loaded word (e.g. the edit screen) must be cleared first. clearValue() returns
 * before Compose's recomposition has caught up, so typing immediately after it can land
 * on the stale value (it did: renaming "rhythm" to "necessary" this way produced
 * "rhythmnecessary") — wait for the field to actually read empty first.
 *
 * setValue() itself returns before recomposition catches up too: a step that saves right
 * after typing (clicking a Save button whose enabled state is derived from this field)
 * can click while the button is still disabled from the pre-edit state. Waiting for the
 * field to reflect the typed text closes that race the same way. Checking length rather
 * than an exact match also covers a masked field (the Settings API key uses
 * PasswordVisualTransformation): its reported text is a run of bullet characters, one
 * per typed character, never the literal string.
 */
export const typeInto = async (element: Element, text: string): Promise<void> => {
    await element.clearValue();
    await driver.waitUntil(async () => (await element.getText()) === '', {
        timeoutMsg: 'Field did not clear before typing into it',
    });
    await element.setValue(text);
    await driver.waitUntil(async () => (await element.getText()).length === text.length, {
        timeoutMsg: 'Field did not show the typed text before continuing',
    });
};

/**
 * What the user has typed into a text field; '' when it is empty. Compose keeps the
 * label in a separate TextView node, so the field's own text is only ever the value.
 */
export const fieldValue = async (element: Element): Promise<string> => element.getText();

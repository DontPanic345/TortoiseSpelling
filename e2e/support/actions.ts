type Element = ReturnType<typeof $>;

// No tap() helper: the session runs with an invisible keyboard (appium:hideKeyboard in
// wdio.conf.ts), so nothing can cover a button and a plain element.click() is enough.

/** Replaces a text field's contents (Compose honours the accessibility set-text action). */
export const typeInto = async (element: Element, text: string): Promise<void> => {
    await element.setValue(text);
};

/**
 * What the user has typed into a text field; '' when it is empty. Compose keeps the
 * label in a separate TextView node, so the field's own text is only ever the value.
 */
export const fieldValue = async (element: Element): Promise<string> => element.getText();

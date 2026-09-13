/**
 * Element lookups, all via UiAutomator's UiSelector (Appium's `android=` strategy),
 * which is much faster than XPath on Compose's deep view trees.
 *
 * Prefer byText for anything with unique visible text: it keeps steps close to what
 * the user sees. Fall back to byTestId (see testIds.ts) when text is ambiguous or
 * changes, e.g. a text field whose label is replaced by its value.
 */

const quoted = (value: string): string => JSON.stringify(value);

export const byText = (text: string) => $(`android=new UiSelector().text(${quoted(text)})`);

export const byTextContaining = (text: string) =>
    $(`android=new UiSelector().textContains(${quoted(text)})`);

/** Icon buttons expose their contentDescription, e.g. "Back", "More", "Delete word". */
export const byDescription = (description: string) =>
    $(`android=new UiSelector().description(${quoted(description)})`);

export const byTestId = (testId: string) =>
    $(`android=new UiSelector().resourceId(${quoted(testId)})`);

/** Scrolls the screen's scrollable container until the text is on screen. */
export const scrollToText = (text: string) =>
    $(
        'android=new UiScrollable(new UiSelector().scrollable(true))' +
            `.scrollIntoView(new UiSelector().text(${quoted(text)}))`,
    );

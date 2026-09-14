/**
 * Element lookups, all via UiAutomator's UiSelector (Appium's `android=` strategy),
 * which is much faster than XPath on Compose's deep view trees.
 *
 * Prefer byText for anything with unique visible text: it keeps steps close to what
 * the user sees. Fall back to byTestId (see testIds.ts) when text is ambiguous or
 * changes, e.g. a text field whose label is replaced by its value.
 */

import { APP_ID } from './config.ts';

const quoted = (value: string): string => JSON.stringify(value);

export const byText = (text: string) => $(`android=new UiSelector().text(${quoted(text)})`);

/**
 * Text inside this app's own windows only. For text another app can also show: the
 * launcher labels the app's icon "Tortoise Spelling", the same text as Home's title.
 */
export const byTextInApp = (text: string) =>
    $(`android=new UiSelector().packageName(${quoted(APP_ID)}).text(${quoted(text)})`);

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

/** Scrolls the screen's scrollable container until the tagged element is on screen. */
export const scrollToTestId = (testId: string) =>
    $(
        'android=new UiScrollable(new UiSelector().scrollable(true))' +
            `.scrollIntoView(new UiSelector().resourceId(${quoted(testId)}))`,
    );

/**
 * Scrolls a horizontally-scrolling row (its own resource-id, e.g. a filter chip row)
 * until the tagged element inside it is on screen. `UiScrollable.scrollable(true)` alone
 * assumes a vertical list, so a row that only scrolls sideways needs `setAsHorizontalList()`
 * and its own selector to avoid matching the screen's outer (vertical) scroll container.
 */
export const scrollToTestIdInRow = (rowTestId: string, testId: string) =>
    $(
        `android=new UiScrollable(new UiSelector().resourceId(${quoted(rowTestId)}))` +
            '.setAsHorizontalList()' +
            `.scrollIntoView(new UiSelector().resourceId(${quoted(testId)}))`,
    );

/**
 * A resource-id one of several possible values, e.g. Android's two differently-named
 * permission "deny" buttons (first refusal vs. "don't ask again").
 */
export const byResourceIdMatching = (pattern: string) =>
    $(`android=new UiSelector().resourceIdMatches(${quoted(pattern)})`);

/** For system UI (e.g. Android's document picker) that carries no test tags of its own. */
export const byClassName = (className: string) =>
    $(`android=new UiSelector().className(${quoted(className)})`);

/** Scopes a per-row icon: rows share identical content-descriptions, so find within the row. */
export const byTestIdWithDescendantDescription = (testId: string, description: string) =>
    $(
        `android=new UiSelector().resourceId(${quoted(testId)})` +
            `.childSelector(new UiSelector().description(${quoted(description)}))`,
    );

// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../../../src/app";
import { TestIds, wordFilter, wordRow, wordRowStatus } from "../../../src/ui/testIds";
import { fakePlatform } from "../../support/fakePlatform";
import { content, openTestRepository } from "../../support/repo";

afterEach(() => history.replaceState(null, "", "#/"));

async function setup() {
  const { repo, clock } = await openTestRepository();
  const platform = fakePlatform();
  history.replaceState(null, "", "#/words");
  render(<App container={{ repository: repo, clock, platform, autoAdvanceMillis: 0, reminders: null }} />);
  return { repo, platform };
}

describe("word list journeys", () => {
  it("search matches a form, suspend and filter, then delete", async () => {
    const { repo } = await setup();
    await repo.addWord("run", content("to move fast", "They run daily."));
    await repo.addWord("cat", content("a pet"));
    await screen.findByTestId(wordRow("cat"));
    await screen.findByTestId(wordRow("run"));

    fireEvent.input(screen.getByTestId(TestIds.WORD_LIST_SEARCH), { target: { value: "ca" } });
    await waitFor(() => expect(screen.queryByTestId(wordRow("run"))).toBeNull());
    fireEvent.input(screen.getByTestId(TestIds.WORD_LIST_SEARCH), { target: { value: "" } });

    fireEvent.click(within(screen.getByTestId(wordRow("cat"))).getByLabelText("Suspend word"));
    await waitFor(() => expect(screen.getByTestId(wordRowStatus("cat")).textContent).toBe("suspended"));
    fireEvent.click(screen.getByTestId(wordFilter("suspended")));
    await waitFor(() => expect(screen.queryByTestId(wordRow("run"))).toBeNull());
    expect(screen.getByTestId(wordRow("cat"))).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Delete word"));
    fireEvent.click(screen.getByText("Delete"));
    await waitFor(() => expect(screen.queryByTestId(wordRow("cat"))).toBeNull());
    expect(await repo.wordCount()).toBe(1);
  });
});

describe("settings journey", () => {
  it("changing new words per day is stored", async () => {
    const { repo } = await setup();
    history.replaceState(null, "", "#/settings");
    window.dispatchEvent(new PopStateEvent("popstate"));
    const increase = await screen.findByTestId(TestIds.SETTINGS_NEW_WORDS_INCREASE);
    await screen.findByText("10");
    fireEvent.click(increase);
    await waitFor(async () => expect((await repo.settings()).newWordsPerDay).toBe(11));
  });
});

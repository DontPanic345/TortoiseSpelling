// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../../../src/app";
import { TestIds } from "../../../src/ui/testIds";
import { fakePlatform } from "../../support/fakePlatform";
import { content, openTestRepository } from "../../support/repo";

const D = Date.UTC(2026, 2, 2) / 86_400_000;

afterEach(() => {
  history.replaceState(null, "", "#/");
});

describe("quiet days", () => {
  it("a skipped due day stays unmarked when the app opens at #/review and the word is reviewed before Home loads", async () => {
    const { repo, clock, db } = await openTestRepository();
    await repo.addWord("rhythm", content("A regular pattern of sound.", "The rhythm of the drums was steady."));
    await repo.settleQuietDays();
    const [first] = await repo.buildSession();
    await repo.recordReview(first!.word.id, true, "rhythm");

    clock.advanceDays(3);
    // main.tsx settles before the first render, so the notification's launch reviews afterwards.
    await repo.settleQuietDays();
    history.replaceState(null, "", "#/review");
    render(<App container={{ repository: repo, clock, platform: fakePlatform(), autoAdvanceMillis: 0, reminders: null }} />);
    await screen.findByText("1 / 1");
    fireEvent.input(screen.getByTestId(TestIds.REVIEW_ANSWER), { target: { value: "rhythm" } });
    fireEvent.click(screen.getByTestId(TestIds.REVIEW_SUBMIT));
    await screen.findByText("You practised 1 word today.");

    fireEvent.click(await screen.findByText("Done"));
    await repo.settleQuietDays();
    const satisfied = ((await db.get("settings", "satisfiedDays")) as number[] | undefined) ?? [];
    expect(satisfied).not.toContain(D + 1);
    expect(satisfied).not.toContain(D + 2);
  });
});

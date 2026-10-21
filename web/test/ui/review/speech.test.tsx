// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../../../src/app";
import { TestIds } from "../../../src/ui/testIds";
import { testCard } from "../../support/cards";
import { fakePlatform } from "../../support/fakePlatform";
import { openTestRepository } from "../../support/repo";

afterEach(() => {
  history.replaceState(null, "", "#/");
});

async function setup() {
  const { repo, clock } = await openTestRepository();
  const ran = testCard("run", { form: "ran", partOfSpeech: "verb", label: "past tense" });
  const repository = { ...repo, buildSession: async () => [ran] };
  const platform = fakePlatform();
  const container = { repository, clock, platform, autoAdvanceMillis: 0, reminders: null };
  history.replaceState(null, "", "#/review");
  render(<App container={container} />);
  await screen.findByTestId(TestIds.REVIEW_ANSWER);
  return platform;
}

describe("speaking on the review screen", () => {
  it("has no button while the platform is not ready, then gains one without moving the field", async () => {
    const platform = await setup();
    const field = screen.getByTestId(TestIds.REVIEW_ANSWER);
    expect(screen.queryByTestId(TestIds.REVIEW_SPEAK)).toBeNull();

    act(() => platform.speech.setReady(true));

    expect(screen.getByTestId(TestIds.REVIEW_SPEAK)).toBeTruthy();
    expect(screen.getByTestId(TestIds.REVIEW_ANSWER)).toBe(field);
    expect(document.activeElement).toBe(field);

    act(() => platform.speech.setReady(false));
    expect(screen.queryByTestId(TestIds.REVIEW_SPEAK)).toBeNull();
  });

  it("speaks the asked form, not the root", async () => {
    const platform = await setup();
    act(() => platform.speech.setReady(true));

    fireEvent.click(screen.getByTestId(TestIds.REVIEW_SPEAK));

    expect(platform.speech.spoken).toEqual(["ran"]);
  });
});

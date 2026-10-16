// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../../../src/app";
import { TestIds } from "../../../src/ui/testIds";
import { fakePlatform } from "../../support/fakePlatform";
import { content, openTestRepository } from "../../support/repo";

const D = Date.UTC(2026, 2, 2) / 86_400_000;

async function setup() {
  const { repo, clock, db } = await openTestRepository();
  const platform = fakePlatform();
  const container = { repository: repo, clock, platform, autoAdvanceMillis: 0, reminders: null };
  return { repo, clock, db, container };
}

function type(value: string) {
  fireEvent.input(screen.getByTestId(TestIds.REVIEW_ANSWER), { target: { value } });
  fireEvent.click(screen.getByTestId(TestIds.REVIEW_SUBMIT));
}

afterEach(() => {
  history.replaceState(null, "", "#/");
});

describe("review journeys", () => {
  it("scheduling: a correct answer completes the session and the word returns tomorrow", async () => {
    const { repo, container } = await setup();
    await repo.addWord("rhythm", content("A strong, regular pattern of sound.", "The rhythm of the drums was steady."));
    history.replaceState(null, "", "#/");
    render(<App container={container} />);

    fireEvent.click(await screen.findByText("Start"));
    await screen.findByText("1 / 1");
    type("rhythm");

    await screen.findByText("You practised 1 word today.");
    const [word] = await repo.wordsWithContent();
    expect(word).toMatchObject({ dueOn: D + 1, repetitions: 1, lapses: 0 });
    expect(location.hash).toBe("#/completion");
  });

  it("lapse: a miss, Show answer and a retype finish the session with one failed log row", async () => {
    const { repo, container, db } = await setup();
    await repo.addWord("rhythm", content("A strong, regular pattern of sound.", "The rhythm of the drums was steady."));
    history.replaceState(null, "", "#/review");
    render(<App container={container} />);

    await screen.findByText("1 / 1");
    type("rythm");
    await screen.findByText("Not quite");
    fireEvent.click(screen.getByText("Show answer"));
    await screen.findByText("Type the correct spelling");
    type("rhythm");

    await screen.findByText("You practised 1 word today.");
    const logs = await db.getAll("reviewLog");
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ correct: false, typedAnswer: "rythm" });
    const [word] = await repo.wordsWithContent();
    expect(word).toMatchObject({ dueOn: D + 1, lapses: 1 });
  });

  it("practice: answering changes no scheduling and writes no log", async () => {
    const { repo, container, db } = await setup();
    await repo.addWord("rhythm", content("A strong, regular pattern of sound.", "The rhythm of the drums was steady."));
    const [card] = await repo.buildSession();
    await repo.recordReview(card!.word.id, true, "rhythm");
    const scheduling = async () => (await repo.wordsWithContent()).map(({ content: _, ...rest }) => rest);
    const before = await scheduling();
    const logsBefore = await db.getAll("reviewLog");
    history.replaceState(null, "", "#/");
    render(<App container={container} />);

    fireEvent.click(await screen.findByText("Practise a few more anyway"));
    await screen.findByText("Extra practice");
    await screen.findByTestId(TestIds.REVIEW_ANSWER);
    type("rhythm");

    await waitFor(() => expect(location.hash).toBe("#/"));
    expect(await scheduling()).toEqual(before);
    expect(await db.getAll("reviewLog")).toEqual(logsBefore);
  });

  it("an empty review goes straight to the completion panel", async () => {
    const { container } = await setup();
    history.replaceState(null, "", "#/review");
    render(<App container={container} />);
    await waitFor(() => expect(location.hash).toBe("#/completion"));
  });
});

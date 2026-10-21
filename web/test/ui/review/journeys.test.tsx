// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../../src/app";
import { TestIds } from "../../../src/ui/testIds";
import { fakePlatform } from "../../support/fakePlatform";
import { content, openTestRepository, type Db } from "../../support/repo";
import type { createRepository } from "../../../src/data/repository";

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
  vi.restoreAllMocks();
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

const RHYTHM = "A strong, regular pattern of sound.";

/** A word reviewed twice before and due today, so a miss visibly changes its scheduling. */
async function seedReviewed(repo: ReturnType<typeof createRepository>, db: Db, text: string, definition: string) {
  await repo.addWord(text, content(definition, `The ${text} was there.`));
  const added = (await repo.wordsWithContent()).find((w) => w.text === text)!;
  const seed = {
    ...added,
    repetitions: 2,
    easeFactor: 2.5,
    intervalDays: 6,
    dueOn: D,
    lastReviewedAt: 1_000,
    firstReviewedOn: D - 7,
    isNew: false,
  };
  await db.put("words", seed);
  return seed;
}

const scheduling = async (repo: ReturnType<typeof createRepository>) =>
  (await repo.wordsWithContent()).map(({ content: _, ...rest }) => rest);

/** Miss the current word and open its editor. */
async function missAndEdit(wrong: string, text: string) {
  type(wrong);
  await screen.findByText("Not quite");
  fireEvent.click(screen.getByTestId(TestIds.REVIEW_EDIT));
  await waitFor(() => expect((screen.getByTestId(TestIds.ADD_WORD_TEXT) as HTMLInputElement).value).toBe(text));
}

function editDefinition(value: string) {
  fireEvent.input(screen.getByTestId(TestIds.ADD_WORD_DEFINITION), { target: { value } });
  fireEvent.click(screen.getByTestId(TestIds.ADD_WORD_SAVE));
}

describe("Edit word after a miss", () => {
  it("a saved edit undoes the miss and the word is asked again: right is a first-try pass", async () => {
    const { repo, db, container } = await setup();
    await seedReviewed(repo, db, "rhythm", RHYTHM);
    history.replaceState(null, "", "#/review");
    render(<App container={container} />);

    await screen.findByText("1 / 1");
    await missAndEdit("rythm", "rhythm");
    expect(location.hash).toMatch(/^#\/review\/edit\/\d+$/);
    editDefinition("A regular, repeated beat.");

    await screen.findByText("A regular, repeated beat.");
    expect(location.hash).toBe("#/review");
    expect(screen.getByText("1 / 1")).toBeTruthy();
    expect(screen.queryByText("Not quite")).toBeNull();
    type("rhythm");

    await screen.findByText("You practised 1 word today.");
    const [word] = await repo.wordsWithContent();
    expect(word).toMatchObject({ repetitions: 3, lapses: 0 });
    const logs = await db.getAll("reviewLog");
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ correct: true });
  });

  it("Back from the editor keeps the miss and the retype", async () => {
    const { repo, db, container } = await setup();
    await seedReviewed(repo, db, "rhythm", RHYTHM);
    history.replaceState(null, "", "#/review");
    render(<App container={container} />);

    await screen.findByText("1 / 1");
    await missAndEdit("rythm", "rhythm");
    history.back();

    await screen.findByText("Not quite");
    expect(location.hash).toBe("#/review");
    const [word] = await repo.wordsWithContent();
    expect(word).toMatchObject({ lapses: 1 });
    const logs = await db.getAll("reviewLog");
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ correct: false });
  });

  it("deleting the word takes it out of the session and the next is asked", async () => {
    const { repo, db, container } = await setup();
    await seedReviewed(repo, db, "rhythm", RHYTHM);
    await seedReviewed(repo, db, "necessary", "Required to be done.");
    history.replaceState(null, "", "#/review");
    render(<App container={container} />);

    await screen.findByText("1 / 2");
    const first = screen.queryByText(RHYTHM) ? "rhythm" : "necessary";
    const nextDefinition = first === "rhythm" ? "Required to be done." : RHYTHM;
    await missAndEdit("x", first);
    fireEvent.click(screen.getByLabelText("Delete word"));

    await screen.findByText(nextDefinition);
    expect(screen.getByText("1 / 1")).toBeTruthy();
    expect(location.hash).toBe("#/review");
    expect(await repo.wordCount()).toBe(1);
  });

  it("deleting the only word finishes the session and stays finished", async () => {
    const { repo, db, container } = await setup();
    await seedReviewed(repo, db, "rhythm", RHYTHM);
    history.replaceState(null, "", "#/review");
    render(<App container={container} />);

    await screen.findByText("1 / 1");
    await missAndEdit("rythm", "rhythm");
    // A browser may land the pop after review has rendered its finish; jsdom lands it first.
    const pop = history.back.bind(history);
    vi.spyOn(history, "back").mockImplementation(() => void setTimeout(pop, 200));
    const sessions = vi.spyOn(repo, "buildSession");
    fireEvent.click(screen.getByLabelText("Delete word"));

    await waitFor(() => expect(location.hash).toBe("#/completion"), { timeout: 1_000 });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(location.hash).toBe("#/completion");
    // The pop must not have remounted review over the completion panel.
    expect(sessions).not.toHaveBeenCalled();
  });

  it("ending the session after a saved edit leaves the seed's scheduling and no log", async () => {
    const { repo, db, container } = await setup();
    await seedReviewed(repo, db, "rhythm", RHYTHM);
    const before = await scheduling(repo);
    history.replaceState(null, "", "#/review");
    render(<App container={container} />);

    await screen.findByText("1 / 1");
    await missAndEdit("rythm", "rhythm");
    editDefinition("A regular, repeated beat.");
    await screen.findByText("A regular, repeated beat.");
    fireEvent.click(screen.getByLabelText("End session"));

    await waitFor(() => expect(location.hash).toBe("#/"));
    expect(await scheduling(repo)).toEqual(before);
    expect(await db.getAll("reviewLog")).toEqual([]);
  });

  it("practice: a saved edit asks the word again and writes no log", async () => {
    const { repo, db, container } = await setup();
    await seedReviewed(repo, db, "rhythm", RHYTHM);
    history.replaceState(null, "", "#/practice");
    render(<App container={container} />);

    await screen.findByText("Extra practice");
    await screen.findByTestId(TestIds.REVIEW_ANSWER);
    await missAndEdit("rythm", "rhythm");
    expect(location.hash).toMatch(/^#\/practice\/edit\/\d+$/);
    editDefinition("A regular, repeated beat.");

    await screen.findByText("A regular, repeated beat.");
    expect(location.hash).toBe("#/practice");
    expect(screen.queryByText("Not quite")).toBeNull();
    expect(await db.getAll("reviewLog")).toEqual([]);
  });

  it("a double tap on Edit word opens one editor", async () => {
    const { repo, db, container } = await setup();
    await seedReviewed(repo, db, "rhythm", RHYTHM);
    history.replaceState(null, "", "#/review");
    render(<App container={container} />);

    await screen.findByText("1 / 1");
    type("rythm");
    await screen.findByText("Not quite");
    fireEvent.click(screen.getByTestId(TestIds.REVIEW_EDIT));
    fireEvent.click(screen.getByTestId(TestIds.REVIEW_EDIT));

    await screen.findByTestId(TestIds.ADD_WORD_TEXT);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(history.state).toEqual({ depth: 1 });
  });

  it("a reload on the editor drops back to a fresh session", async () => {
    const { repo, db, container } = await setup();
    const seed = await seedReviewed(repo, db, "rhythm", RHYTHM);
    history.replaceState(null, "", `#/review/edit/${seed.id}`);
    render(<App container={container} />);

    await screen.findByText("1 / 1");
    expect(location.hash).toBe("#/review");
    expect(screen.queryByTestId(TestIds.ADD_WORD_TEXT)).toBeNull();
  });
});

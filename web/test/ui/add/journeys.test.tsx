// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { lookupPrompt } from "../../../src/domain/lookupPrompt";
import { App } from "../../../src/app";
import { TestIds } from "../../../src/ui/testIds";
import { filterRows } from "../../../src/ui/words/wordListState";
import { fakePlatform } from "../../support/fakePlatform";
import { content, openTestRepository } from "../../support/repo";

async function setup() {
  const { repo, clock, db } = await openTestRepository();
  const platform = fakePlatform();
  const container = { repository: repo, clock, platform, autoAdvanceMillis: 0 };
  return { repo, clock, db, platform, container };
}

const input = (id: string, value: string) => fireEvent.input(screen.getByTestId(id), { target: { value } });
const click = (id: string) => fireEvent.click(screen.getByTestId(id));

const practiceAnswer = `Here you go:

\`\`\`json
{
  "word": "practice",
  "definitions": [
    {
      "text": "repeated exercise to improve a skill",
      "partOfSpeech": "noun",
      "forms": [
        { "text": "practice", "label": "singular", "examples": ["She has piano practice on Tuesdays."] },
        { "text": "practices", "label": "plural", "examples": ["He runs two medical practices."] }
      ]
    },
    {
      "text": "to perform an activity repeatedly to improve at it",
      "partOfSpeech": "verb",
      "forms": [
        { "text": "practise", "label": "base", "examples": ["I practise every day."] },
        { "text": "practised", "label": "past tense", "examples": ["He practised for hours."] }
      ]
    }
  ]
}
\`\`\``;

afterEach(() => {
  history.replaceState(null, "", "#/");
});

describe("add and edit journeys", () => {
  it("lookup: copy the prompt, paste the answer, use it and save; searching for a form finds the word", async () => {
    const { repo, clock, platform, container } = await setup();
    history.replaceState(null, "", "#/add");
    render(<App container={container} />);

    input(TestIds.ADD_WORD_TEXT, "practice");
    click(TestIds.ADD_WORD_COPY_PROMPT);
    expect(platform.calls).toEqual([`copyText:${lookupPrompt("practice")}`]);
    await screen.findByText("Prompt copied.");

    click(TestIds.ADD_WORD_PASTE);
    input(TestIds.ADD_WORD_PASTE_TEXT, practiceAnswer);
    await screen.findByText("2 definitions, 4 forms, 4 example sentences");
    click(TestIds.ADD_WORD_PASTE_USE);
    expect(screen.queryByText("Paste the answer")).toBeNull();
    expect((screen.getByTestId(TestIds.ADD_WORD_DEFINITION) as HTMLTextAreaElement).value).toBe(
      "repeated exercise to improve a skill",
    );

    click(TestIds.ADD_WORD_SAVE);
    await screen.findByText("Added ✓ (1 total)");
    expect((screen.getByTestId(TestIds.ADD_WORD_TEXT) as HTMLInputElement).value).toBe("");
    expect(screen.getByText("Added 1 this session · 1 total")).toBeTruthy();

    const words = await repo.wordsWithContent();
    expect(words).toHaveLength(1);
    expect(filterRows(words, "practise", "ALL", Math.floor(clock.millis() / 86_400_000)).map((r) => r.word.text)).toEqual([
      "practice",
    ]);
  });

  it("a failed copy says so", async () => {
    const { platform, container } = await setup();
    platform.copyResult = false;
    history.replaceState(null, "", "#/add");
    render(<App container={container} />);

    input(TestIds.ADD_WORD_TEXT, "rhythm");
    click(TestIds.ADD_WORD_COPY_PROMPT);

    await screen.findByText("Couldn't copy the prompt.");
  });

  it("a duplicate word is refused with its message and the form keeps what was typed", async () => {
    const { repo, container } = await setup();
    await repo.addWord("rhythm", content("A strong, regular pattern of sound.", "The rhythm of the drums was steady."));
    history.replaceState(null, "", "#/add");
    render(<App container={container} />);

    input(TestIds.ADD_WORD_TEXT, "Rhythm");
    input(TestIds.ADD_WORD_DEFINITION, "Another definition.");
    click(TestIds.ADD_WORD_SAVE);

    await screen.findByText("“rhythm” is already in your list.");
    expect((screen.getByTestId(TestIds.ADD_WORD_TEXT) as HTMLInputElement).value).toBe("Rhythm");
    expect(await repo.wordCount()).toBe(1);
  });

  it("edit keeps scheduling: changing the definition leaves the SM-2 fields and the log alone", async () => {
    const { repo, db, container } = await setup();
    await repo.addWord("rhythm", content("A strong, regular pattern of sound.", "The rhythm of the drums was steady."));
    const [card] = await repo.buildSession();
    await repo.recordReview(card!.word.id, false, "rythm");
    const [before] = await repo.wordsWithContent();
    const logsBefore = await db.getAll("reviewLog");
    history.replaceState(null, "", `#/edit/${before!.id}`);
    render(<App container={container} />);

    await waitFor(() =>
      expect((screen.getByTestId(TestIds.ADD_WORD_TEXT) as HTMLInputElement).value).toBe("rhythm"),
    );
    input(TestIds.ADD_WORD_DEFINITION, "A regular, repeated beat.");
    click(TestIds.ADD_WORD_SAVE);

    await waitFor(() => expect(location.hash).toBe("#/words"));
    const [after] = await repo.wordsWithContent();
    expect(after!.content.definitions[0]!.text).toBe("A regular, repeated beat.");
    const { content: _before, ...schedulingBefore } = before!;
    const { content: _after, ...schedulingAfter } = after!;
    expect(schedulingAfter).toEqual(schedulingBefore);
    expect(await db.getAll("reviewLog")).toEqual(logsBefore);
  });

  it("renaming onto another word shows the duplicate message and stays on the screen", async () => {
    const { repo, container } = await setup();
    await repo.addWord("rhythm", content("A strong, regular pattern of sound."));
    await repo.addWord("necessary", content("Required to be done."));
    const necessary = (await repo.wordsWithContent()).find((w) => w.text === "necessary")!;
    history.replaceState(null, "", `#/edit/${necessary.id}`);
    render(<App container={container} />);

    await waitFor(() =>
      expect((screen.getByTestId(TestIds.ADD_WORD_TEXT) as HTMLInputElement).value).toBe("necessary"),
    );
    input(TestIds.ADD_WORD_TEXT, "Rhythm");
    click(TestIds.ADD_WORD_SAVE);

    await screen.findByText("“rhythm” is already in your list.");
    expect(location.hash).toBe(`#/edit/${necessary.id}`);
  });

  it("delete removes the word and its log at once and returns to the list", async () => {
    const { repo, db, container } = await setup();
    await repo.addWord("rhythm", content("A strong, regular pattern of sound.", "The rhythm of the drums was steady."));
    const [card] = await repo.buildSession();
    await repo.recordReview(card!.word.id, true, "rhythm");
    history.replaceState(null, "", `#/edit/${card!.word.id}`);
    render(<App container={container} />);
    await waitFor(() =>
      expect((screen.getByTestId(TestIds.ADD_WORD_TEXT) as HTMLInputElement).value).toBe("rhythm"),
    );

    fireEvent.click(screen.getByLabelText("Delete word"));

    await waitFor(() => expect(location.hash).toBe("#/words"));
    expect(await repo.wordCount()).toBe(0);
    expect(await db.getAll("reviewLog")).toEqual([]);
  });

  it("editing a word that no longer exists goes back to the list", async () => {
    const { container } = await setup();
    history.replaceState(null, "", "#/edit/99");
    render(<App container={container} />);
    await waitFor(() => expect(location.hash).toBe("#/words"));
  });
});

// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import type { Word } from "../../../src/data/model";
import { WORD_FILTERS } from "../../../src/domain/progress";
import { TestIds, wordFilter, wordRow, wordRowCheckForms, wordRowStatus } from "../../../src/ui/testIds";
import { WordListContent } from "../../../src/ui/words/WordListContent";
import { initialWordListState, noMatchesBody, type WordListUiState } from "../../../src/ui/words/wordListState";

function word(text: string, id: number, over: Partial<Word> = {}): Word {
  return {
    id,
    text,
    normalizedText: text.toLowerCase(),
    createdAt: 0,
    repetitions: 0,
    easeFactor: 2.5,
    intervalDays: 0,
    dueOn: 0,
    lapses: 0,
    lastReviewedAt: null,
    firstReviewedOn: null,
    isNew: true,
    suspended: false,
    ...over,
  };
}

const words = [word("rhythm", 1), word("necessary", 2), word("liaison", 3)];
const statuses = ["new", "due today", "in 4 days"];

function listState(): WordListUiState {
  return {
    ...initialWordListState,
    loading: false,
    filterCounts: Object.fromEntries(WORD_FILTERS.map((f) => [f, 3])),
    rows: words.map((w, i) => ({ word: w, status: statuses[i]!, definition: `A definition of ${w.text}.`, checkForms: false })),
    totalCount: 3,
  };
}

function show(state: WordListUiState) {
  const calls: string[] = [];
  render(
    <WordListContent
      state={state}
      onBack={() => calls.push("back")}
      onEdit={(id) => calls.push(`edit:${id}`)}
      onQueryChange={(q) => calls.push(`query:${q}`)}
      onFilterChange={(f) => calls.push(`filter:${f}`)}
      onToggleSuspended={(w) => calls.push(`suspend:${w.text}`)}
      onDelete={(w) => calls.push(`delete:${w.text}`)}
    />,
  );
  return calls;
}

describe("WordListContent", () => {
  it("no words shows the empty state without filters", () => {
    show({ ...initialWordListState, loading: false });
    expect(screen.getByText("No words yet")).toBeTruthy();
    expect(screen.queryByTestId(TestIds.WORD_FILTER_ROW)).toBeNull();
  });

  it("a query matching nothing says so", () => {
    show({
      ...initialWordListState,
      loading: false,
      query: "zzz",
      filterCounts: Object.fromEntries(WORD_FILTERS.map((f) => [f, 3])),
      totalCount: 3,
    });
    expect(screen.getByText("No matches")).toBeTruthy();
    expect(screen.getByText(noMatchesBody("zzz", "ALL"))).toBeTruthy();
  });

  it("rows show their status and the total", () => {
    show(listState());
    expect(screen.getByText("All words (3)")).toBeTruthy();
    words.forEach((w, i) => {
      expect(screen.getByTestId(wordRowStatus(w.normalizedText)).textContent).toBe(statuses[i]);
    });
  });

  it("filter chips show their counts and select", () => {
    const calls = show(listState());
    expect(screen.getByTestId(wordFilter("due")).textContent).toBe("Due 3");
    expect(screen.getByTestId(wordFilter("all")).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByTestId(wordFilter("known")));
    expect(calls).toEqual(["filter:KNOWN"]);
  });

  it("typing in the search calls back", () => {
    const calls = show(listState());
    fireEvent.input(screen.getByTestId(TestIds.WORD_LIST_SEARCH), { target: { value: "rhy" } });
    expect(calls).toEqual(["query:rhy"]);
  });

  it("tapping a row edits it", () => {
    const calls = show(listState());
    fireEvent.click(within(screen.getByTestId(wordRow("necessary"))).getByText("necessary"));
    expect(calls).toEqual(["edit:2"]);
  });

  it("a suspended word offers Resume and the others Suspend", () => {
    const state = listState();
    state.rows[1] = { ...state.rows[1]!, word: word("necessary", 2, { suspended: true }), status: "suspended" };
    const calls = show(state);
    expect(screen.getAllByLabelText("Suspend word")).toHaveLength(2);
    fireEvent.click(screen.getByLabelText("Resume word"));
    fireEvent.click(screen.getAllByLabelText("Suspend word")[0]!);
    expect(calls).toEqual(["suspend:necessary", "suspend:rhythm"]);
  });

  it("a row with checkForms shows Check forms and the others don't", () => {
    const state = listState();
    state.rows[1] = { ...state.rows[1]!, checkForms: true };
    show(state);
    expect(screen.getByTestId(wordRowCheckForms("necessary")).textContent).toBe("Check forms");
    expect(screen.queryByTestId(wordRowCheckForms("rhythm"))).toBeNull();
    expect(screen.getAllByText("Check forms")).toHaveLength(1);
  });

  it("delete asks first, then deletes", () => {
    const calls = show(listState());
    fireEvent.click(screen.getAllByLabelText("Delete word")[0]!);
    expect(screen.getByText("Delete “rhythm”?")).toBeTruthy();
    expect(screen.getByText("Its review history goes too. This can't be undone.")).toBeTruthy();
    fireEvent.click(screen.getByText("Delete"));
    expect(calls).toEqual(["delete:rhythm"]);
    expect(screen.queryByText("Delete “rhythm”?")).toBeNull();
  });

  it("cancel deletes nothing", () => {
    const calls = show(listState());
    fireEvent.click(screen.getAllByLabelText("Delete word")[0]!);
    fireEvent.click(screen.getByText("Cancel"));
    expect(calls).toEqual([]);
    expect(screen.queryByText("Delete “rhythm”?")).toBeNull();
  });
});

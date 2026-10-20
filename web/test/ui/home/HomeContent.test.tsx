// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { HomeContent } from "../../../src/ui/home/HomeContent";
import { initialHomeState, type HomeUiState } from "../../../src/ui/home/homeState";
import { TestIds } from "../../../src/ui/testIds";

function show(state: HomeUiState) {
  const calls: string[] = [];
  render(
    <HomeContent
      state={state}
      onStartReview={() => calls.push("start")}
      onPracticeMore={() => calls.push("practice")}
      onAddWord={() => calls.push("add")}
      onOpenWords={() => calls.push("words")}
      onOpenSettings={() => calls.push("settings")}
      onExport={() => calls.push("export")}
      onReminderTurnOn={() => calls.push("turn-on")}
      onReminderNotNow={() => calls.push("not-now")}
      locale="en"
    />,
  );
  return calls;
}

function withWords(
  over: {
    due?: number;
    fresh?: number;
    reviewedToday?: number;
    streak?: number;
    nextDueDay?: number | null;
    showBackupNudge?: boolean;
    showReminderCard?: boolean;
  } = {},
): HomeUiState {
  return {
    ...initialHomeState,
    loading: false,
    plan: { dueCount: over.due ?? 0, newCount: over.fresh ?? 0 },
    totalWords: 5,
    reviewedToday: over.reviewedToday ?? 0,
    streak: over.streak ?? 0,
    nextDueDay: over.nextDueDay ?? null,
    today: 100,
    greeting: "Good morning",
    dateLabel: "Monday",
    showBackupNudge: over.showBackupNudge ?? false,
    showReminderCard: over.showReminderCard ?? false,
  };
}

const noWords: HomeUiState = { ...initialHomeState, loading: false };

describe("HomeContent", () => {
  it("loading shows no cards", () => {
    show(initialHomeState);
    expect(screen.queryByText("No words yet")).toBeNull();
    expect(screen.queryByText("Start")).toBeNull();
  });

  it("with no words the first-run panel offers to add one", () => {
    const calls = show(noWords);
    expect(screen.getByText("No words yet")).toBeTruthy();
    expect(screen.getByText("How it works")).toBeTruthy();
    fireEvent.click(screen.getByText("Add your first word"));
    expect(calls).toEqual(["add"]);
  });

  it("the info button explains the review gaps until dismissed", () => {
    show(withWords({ due: 2 }));
    expect(screen.queryByText("How Tortoise Spelling works")).toBeNull();
    fireEvent.click(screen.getByLabelText("How it works"));
    expect(screen.getByText("How Tortoise Spelling works")).toBeTruthy();
    expect(screen.getByText(/after 1 day, then 6 days, 17 days, 49 days, 147 days, and then once a year/)).toBeTruthy();
    fireEvent.click(screen.getByText("Got it"));
    expect(screen.queryByText("How Tortoise Spelling works")).toBeNull();
  });

  it("the add word button calls onAddWord", () => {
    const calls = show(noWords);
    fireEvent.click(screen.getByTestId(TestIds.HOME_ADD_WORD));
    expect(calls).toEqual(["add"]);
  });

  it("due words show the count and Start", () => {
    const calls = show(withWords({ due: 2, fresh: 1, reviewedToday: 4 }));
    expect(screen.getByTestId(TestIds.HOME_PRACTICE_COUNT).textContent).toBe("3");
    expect(screen.getByText("words to practise today")).toBeTruthy();
    expect(screen.getByText("1 of them is new")).toBeTruthy();
    expect(screen.getByText("Reviewed today: 4")).toBeTruthy();
    fireEvent.click(screen.getByText("Start"));
    expect(calls).toEqual(["start"]);
  });

  it("one word is singular", () => {
    show(withWords({ due: 1 }));
    expect(screen.getByText("word to practise today")).toBeTruthy();
  });

  it("many new words are plural", () => {
    show(withWords({ due: 1, fresh: 2 }));
    expect(screen.getByText("2 of them are new")).toBeTruthy();
  });

  it("all done replaces the Today card with the completion panel", () => {
    const calls = show(withWords({ reviewedToday: 3, nextDueDay: 101 }));
    expect(screen.queryByText("Start")).toBeNull();
    expect(screen.getByText("All done — see you tomorrow")).toBeTruthy();
    fireEvent.click(screen.getByText("Practise a few more anyway"));
    expect(calls).toEqual(["practice"]);
  });

  it("the week card reads the streak, and the completion panel doesn't repeat it", () => {
    show(withWords({ reviewedToday: 1, streak: 1, nextDueDay: 101 }));
    expect(screen.getByText("🔥 1 day in a row")).toBeTruthy();
    expect(screen.queryByText("🔥 1 day streak")).toBeNull();
  });

  it("the week card pluralises the streak", () => {
    show(withWords({ due: 1, streak: 3 }));
    expect(screen.getByText("🔥 3 days in a row")).toBeTruthy();
  });

  it("the menu opens Settings and All words", () => {
    const calls = show(withWords({ due: 1 }));
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByText("Settings"));
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByText("All words"));
    expect(calls).toEqual(["settings", "words"]);
  });

  it("See all opens the word list", () => {
    const calls = show(withWords({ due: 1 }));
    fireEvent.click(screen.getByText("See all"));
    expect(calls).toEqual(["words"]);
  });

  it("the week dots carry labels, and the last is Today", () => {
    const state = {
      ...withWords({ due: 1 }),
      week: [
        { day: 20_512, mark: "MISSED" as const },
        { day: 20_513, mark: "PRACTICED" as const },
        { day: 20_514, mark: "PENDING" as const },
      ],
    };
    show(state);
    expect(screen.getByLabelText("Saturday, missed")).toBeTruthy();
    expect(screen.getByLabelText("Sunday, practised")).toBeTruthy();
    expect(screen.getByLabelText("Today, not practised yet")).toBeTruthy();
  });

  it("the progress bar is labelled with the counts", () => {
    show({ ...withWords({ due: 1 }), progress: { new: 3, learning: 2, known: 1, total: 6 } });
    expect(screen.getByLabelText("1 known, 2 learning, 3 new")).toBeTruthy();
    expect(screen.getByText("2 learning")).toBeTruthy();
  });

  describe("the backup nudge", () => {
    it("shows when the state asks for it, and Export runs the export", () => {
      const calls = show(withWords({ due: 1, showBackupNudge: true }));
      expect(screen.getByTestId(TestIds.HOME_BACKUP_NUDGE).textContent).toContain(
        "This browser can clear its storage. Export a backup now and then, so you never lose your words.",
      );
      fireEvent.click(screen.getByRole("button", { name: "Export" }));
      expect(calls).toEqual(["export"]);
    });

    it("is absent when the state doesn't ask for it", () => {
      show(withWords({ due: 1 }));
      expect(screen.queryByTestId(TestIds.HOME_BACKUP_NUDGE)).toBeNull();
    });

    it("is absent with no words", () => {
      show({ ...noWords, showBackupNudge: true });
      expect(screen.queryByTestId(TestIds.HOME_BACKUP_NUDGE)).toBeNull();
    });
  });

  describe("the reminder card", () => {
    it("asks, and its buttons call back", () => {
      const calls = show(withWords({ due: 1, showReminderCard: true }));
      expect(screen.getByTestId(TestIds.HOME_REMINDER_CARD).textContent).toContain(
        "Get a reminder each day when words are due?",
      );
      fireEvent.click(screen.getByTestId(TestIds.HOME_REMINDER_TURN_ON));
      fireEvent.click(screen.getByTestId(TestIds.HOME_REMINDER_NOT_NOW));
      expect(calls).toEqual(["turn-on", "not-now"]);
    });

    it("sits above the week card", () => {
      show(withWords({ due: 1, showReminderCard: true }));
      const card = screen.getByTestId(TestIds.HOME_REMINDER_CARD);
      const week = screen.getByTestId(TestIds.HOME_WEEK);
      expect(card.compareDocumentPosition(week) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("is absent when the state doesn't ask for it", () => {
      show(withWords({ due: 1 }));
      expect(screen.queryByTestId(TestIds.HOME_REMINDER_CARD)).toBeNull();
    });

    it("is absent with no words", () => {
      show({ ...noWords, showReminderCard: true });
      expect(screen.queryByTestId(TestIds.HOME_REMINDER_CARD)).toBeNull();
    });
  });
});

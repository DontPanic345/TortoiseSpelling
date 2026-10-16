// @vitest-environment jsdom
import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { CompletionPanel } from "../../../src/ui/complete/CompletionPanel";

function show(reviewed = 0, streak = 0, next: number | null = null) {
  render(<CompletionPanel reviewedCount={reviewed} streak={streak} nextDueDay={next} today={100} />);
}

describe("CompletionPanel", () => {
  it("one word is singular", () => {
    show(1);
    expect(screen.getByText("You practised 1 word today.")).toBeTruthy();
  });
  it("many words are plural", () => {
    show(3);
    expect(screen.getByText("You practised 3 words today.")).toBeTruthy();
  });
  it("nothing due says so", () => {
    show();
    expect(screen.getByText("Nothing was due today.")).toBeTruthy();
  });
  it("no streak line at zero", () => {
    show(1, 0);
    expect(screen.queryByText(/day streak/)).toBeNull();
  });
  it("the streak line shows when there is one", () => {
    show(1, 4);
    expect(screen.getByText("🔥 4 day streak")).toBeTruthy();
  });
  it("see you tomorrow only when something is due tomorrow", () => {
    show(1, 0, 101);
    expect(screen.getByText("All done — see you tomorrow")).toBeTruthy();
  });
  it("otherwise all done for today", () => {
    show(1, 0, 105);
    expect(screen.getByText("All done for today")).toBeTruthy();
    expect(screen.getByText("Next review: in 5 days")).toBeTruthy();
  });
  it("nothing scheduled yet", () => {
    show(1, 0, null);
    expect(screen.getByText("Next review: nothing scheduled yet")).toBeTruthy();
  });
  it("has no practise button without a callback", () => {
    show(1);
    expect(screen.queryByText("Practise a few more anyway")).toBeNull();
  });
});

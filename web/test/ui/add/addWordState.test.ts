import { describe, expect, it } from "vitest";
import type { PastedLookup } from "../../../src/domain/pastedLookup";
import {
  afterAdd,
  applying,
  canCopyPrompt,
  canSave,
  dismissPaste,
  editableContent,
  edited,
  loadedForEdit,
  newAddWordState,
  openPaste,
  pasteTextChanged,
  textChanged,
  usePaste,
} from "../../../src/ui/add/addWordState";
import { simpleContent } from "../../../src/domain/wordContent";
import { addPasteValid, addRun } from "../../support/addWord";

describe("addWordState", () => {
  it("copying the prompt needs a word, and a blank one is not a word", () => {
    expect(canCopyPrompt(newAddWordState())).toBe(false);
    expect(canCopyPrompt(textChanged(newAddWordState(), " \t "))).toBe(false);
    expect(canCopyPrompt(textChanged(newAddWordState(), "run"))).toBe(true);
  });

  it("saving needs a word and a complete tree", () => {
    expect(canSave("", addRun().content)).toBe(false);
    expect(canSave("run", newAddWordState().content)).toBe(false);
    expect(canSave("run", addRun().content)).toBe(true);
  });

  it("opening the dialog starts it empty, and dismissing closes it", () => {
    const open = openPaste(newAddWordState());
    expect(open.paste).toEqual({ text: "", result: null });
    expect(dismissPaste(open).paste).toBeNull();
  });

  it("pasted text is parsed against the word as typed; blank text has no result", () => {
    const base = openPaste(textChanged(newAddWordState(), "practice"));
    expect(pasteTextChanged(base, "  ").paste).toEqual({ text: "  ", result: null });
    const bad = pasteTextChanged(base, "Sure! Here you go").paste;
    expect(bad?.result?.kind).toBe("invalid");
    const answer = JSON.stringify({
      word: "practice",
      definitions: [
        { text: "repeated exercise", forms: [{ text: "practice", examples: ["She has piano practice on Tuesdays."] }] },
      ],
    });
    const good = pasteTextChanged(base, answer).paste?.result;
    expect(good).toMatchObject({ kind: "valid", word: "practice", renames: false });
  });

  it("using an invalid or missing result does nothing", () => {
    const invalid = pasteTextChanged(openPaste(textChanged(newAddWordState(), "run")), "nope");
    expect(usePaste(invalid)).toBe(invalid);
    const closed = textChanged(newAddWordState(), "run");
    expect(usePaste(closed)).toBe(closed);
  });

  it("using a valid result replaces the text and content and closes the dialog", () => {
    const state = addPasteValid("recieve", "receive");
    const used = usePaste(state);
    expect(used.text).toBe("receive");
    expect(used.content).toEqual(addRun().content);
    expect(used.paste).toBeNull();
    expect(used.message).toBe("Corrected spelling to “receive”.");
  });

  it("applying keeps the message when the word is not renamed", () => {
    const answer = (addPasteValid().paste?.result ?? null) as Extract<PastedLookup, { kind: "valid" }>;
    expect(applying({ ...newAddWordState(), message: "kept" }, answer).message).toBe("kept");
  });

  it("an add clears the form and carries the burst counter and total forward", () => {
    const first = afterAdd({ ...addRun(), addedThisSession: 2 }, 7);
    expect(first).toMatchObject({
      text: "",
      editingId: null,
      addedThisSession: 3,
      totalWords: 7,
      message: "Added ✓ (7 total)",
    });
    expect(first.content).toEqual(newAddWordState().content);
  });

  it("edits go through apply", () => {
    const state = edited(newAddWordState(), { edit: "AddDefinition" });
    expect(state.content.definitions).toHaveLength(2);
  });

  it("an edited word loads with a blank example to fill when its base form has none", () => {
    const loaded = loadedForEdit(newAddWordState(7), "ran", simpleContent("ran", "Past of run.", "verb", ""));
    expect(loaded.editingId).toBe(7);
    expect(loaded.text).toBe("ran");
    expect(loaded.content.definitions[0]?.forms[0]?.examples).toEqual([{ text: "", shownAt: null }]);
  });

  it("an empty tree gets a first definition and base form to type into", () => {
    const content = editableContent({ definitions: [] }, "run");
    expect(content.definitions).toHaveLength(1);
    expect(content.definitions[0]?.forms[0]).toMatchObject({ text: "run", examples: [{ text: "" }] });
  });

  it("loading keeps the examples a base form already has", () => {
    const content = simpleContent("run", "To move fast.", null, "They run every day.");
    expect(editableContent(content, "run").definitions[0]?.forms[0]?.examples).toEqual([
      { text: "They run every day.", shownAt: null },
    ]);
  });
});

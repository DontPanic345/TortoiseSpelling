// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { apply, type ContentEdit } from "../../../src/domain/wordContent";
import { AddWordContent } from "../../../src/ui/add/AddWordContent";
import type { AddWordState } from "../../../src/ui/add/addWordState";
import { TestIds, addWordAddExample, addWordAddForm, addWordFormText } from "../../../src/ui/testIds";
import {
  addNew,
  addPasteInvalid,
  addPasteValid,
  addRun,
  addRunWithExampleMissingTheForm,
  addRunWithTwoDefinitions,
} from "../../support/addWord";

function show(state: AddWordState) {
  const { calls, view } = mount(state);
  return Object.assign(calls, { view });
}

function mount(state: AddWordState) {
  const calls = {
    edits: [] as ContentEdit[],
    saved: 0,
    copied: 0,
    opened: 0,
    used: 0,
    dismissed: 0,
    deleted: 0,
    pasted: [] as string[],
    copiedErrors: [] as string[],
    copyWorks: true,
  };
  const element = (state: AddWordState) => (
    <AddWordContent
      state={state}
      onBack={() => {}}
      onDelete={() => calls.deleted++}
      onTextChange={() => {}}
      onCopyPrompt={() => calls.copied++}
      onOpenPaste={() => calls.opened++}
      onPasteTextChange={(value) => calls.pasted.push(value)}
      onUsePaste={() => calls.used++}
      onDismissPaste={() => calls.dismissed++}
      onCopyPasteError={(message) => {
        calls.copiedErrors.push(message);
        return Promise.resolve(calls.copyWorks);
      }}
      onEdit={(edit) => calls.edits.push(edit)}
      onSave={() => calls.saved++}
    />
  );
  const view = render(element(state));
  return { calls, view: { rerender: (next: AddWordState) => view.rerender(element(next)) } };
}

const byId = (id: string) => screen.getByTestId(id) as HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement;
const count = (text: string | RegExp) => screen.queryAllByText(text).length;

describe("AddWordContent", () => {
  it("a new word shows one definition and the base form with nothing to remove", () => {
    show(addNew());
    expect(screen.getByText("Definition 1")).toBeTruthy();
    expect(screen.getByText("The word itself")).toBeTruthy();
    expect(count("Definition 2")).toBe(0);
    expect(screen.queryAllByLabelText("Remove definition 1")).toHaveLength(0);
    expect(screen.queryAllByLabelText(/^Remove form/)).toHaveLength(0);
    expect(screen.queryByTestId(addWordFormText(0, 0))).toBeNull();
  });

  it("the base form drops the placeholder once there is a word", () => {
    show(addRun());
    expect(count("The word itself")).toBe(0);
    expect(screen.getByRole("heading", { name: "run" })).toBeTruthy();
  });

  it("the title and button follow whether a word is being edited", () => {
    show({ ...addRun(), editingId: 3 });
    expect(screen.getByRole("heading", { name: "Edit word" })).toBeTruthy();
    expect(byId(TestIds.ADD_WORD_SAVE).textContent).toBe("Save changes");
    expect(screen.getByLabelText("Delete word")).toBeTruthy();
  });

  it("a new word has no delete button and saves as Add word", () => {
    show(addRun());
    expect(screen.queryAllByLabelText("Delete word")).toHaveLength(0);
    expect(byId(TestIds.ADD_WORD_SAVE).textContent).toBe("Add word");
  });

  it("delete calls back", () => {
    const calls = show({ ...addRun(), editingId: 3 });
    fireEvent.click(screen.getByLabelText("Delete word"));
    expect(calls.deleted).toBe(1);
  });

  it("Add form, Add definition and Add example send their edits with the right indices", () => {
    const calls = show(addRunWithTwoDefinitions());
    fireEvent.click(byId(addWordAddForm(1)));
    fireEvent.click(byId(TestIds.ADD_WORD_ADD_DEFINITION));
    fireEvent.click(byId(addWordAddExample(0, 1)));
    expect(calls.edits).toEqual([
      { edit: "AddForm", definition: 1 },
      { edit: "AddDefinition" },
      { edit: "AddExample", definition: 0, form: 1 },
    ]);
  });

  it("a second form's remove button sends RemoveForm", () => {
    const calls = show(addRun());
    fireEvent.click(screen.getByLabelText("Remove form “ran”"));
    expect(calls.edits).toEqual([{ edit: "RemoveForm", definition: 0, form: 1 }]);
  });

  it("a second definition can be removed", () => {
    const calls = show(addRunWithTwoDefinitions());
    fireEvent.click(screen.getByLabelText("Remove definition 2"));
    expect(calls.edits).toEqual([{ edit: "RemoveDefinition", definition: 1 }]);
  });

  it("an example can be removed", () => {
    const calls = show(addRun());
    fireEvent.click(screen.getAllByLabelText("Remove example")[0] as HTMLElement);
    expect(calls.edits).toEqual([{ edit: "RemoveExample", definition: 0, form: 0, example: 0 }]);
  });

  it("typing sends the edit for that field", () => {
    const calls = show(addRun());
    fireEvent.input(byId(TestIds.ADD_WORD_DEFINITION), { target: { value: "Go fast." } });
    fireEvent.input(byId(TestIds.ADD_WORD_PART_OF_SPEECH), { target: { value: "noun" } });
    fireEvent.input(byId(addWordFormText(0, 1)), { target: { value: "runs" } });
    expect(calls.edits).toEqual([
      { edit: "DefinitionText", definition: 0, value: "Go fast." },
      { edit: "PartOfSpeech", definition: 0, value: "noun" },
      { edit: "FormText", definition: 0, form: 1, value: "runs" },
    ]);
  });

  it("an example without its form shows the warning", () => {
    show(addRunWithExampleMissingTheForm());
    expect(screen.getByText("Doesn't contain “ran”, so review can't blank it.")).toBeTruthy();
  });

  it("an example with its form shows no warning", () => {
    show(addRun());
    expect(count(/Doesn't contain/)).toBe(0);
  });

  it("save is disabled while the first definition is blank, and says Required", () => {
    show({ ...addNew(), text: "run" });
    expect((byId(TestIds.ADD_WORD_SAVE) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Required")).toBeTruthy();
  });

  it("a form with no text is Required and blocks save", () => {
    const state = addRun();
    const content = structuredClone(state.content);
    content.definitions[0]!.forms[1]!.text = "";
    show({ ...state, content });
    expect(screen.getByText("Required")).toBeTruthy();
    expect((byId(TestIds.ADD_WORD_SAVE) as HTMLButtonElement).disabled).toBe(true);
  });

  it("save is enabled once the tree is complete", () => {
    const calls = show(addRun());
    const save = byId(TestIds.ADD_WORD_SAVE) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    expect(calls.saved).toBe(1);
  });

  it("the burst line shows only for a new word after the first add", () => {
    show({ ...addNew(), addedThisSession: 3, totalWords: 12 });
    expect(screen.getByText("Added 3 this session · 12 total")).toBeTruthy();
  });

  it("no burst line while editing", () => {
    show({ ...addRun(), editingId: 3, addedThisSession: 3 });
    expect(count(/this session/)).toBe(0);
  });

  it("Copy prompt needs a word and Paste answer does not", () => {
    const calls = show(addNew());
    expect((byId(TestIds.ADD_WORD_COPY_PROMPT) as HTMLButtonElement).disabled).toBe(true);
    expect((byId(TestIds.ADD_WORD_PASTE) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(byId(TestIds.ADD_WORD_PASTE));
    expect(calls.opened).toBe(1);
    expect(calls.copied).toBe(0);
    expect(count("Look up with Claude")).toBe(0);
    expect(
      screen.getByText(
        "Copy the prompt into any chat AI, such as Claude or ChatGPT. Then copy its whole reply and tap Paste answer.",
      ),
    ).toBeTruthy();
  });

  it("Copy prompt calls back once there is a word", () => {
    const calls = show(addRun());
    const copy = byId(TestIds.ADD_WORD_COPY_PROMPT) as HTMLButtonElement;
    expect(copy.disabled).toBe(false);
    fireEvent.click(copy);
    expect(calls.copied).toBe(1);
  });

  it("the dialog is closed until Paste answer is tapped", () => {
    show(addNew());
    expect(count("Paste the answer")).toBe(0);
  });

  it("an invalid answer shows its message and cannot be used", () => {
    show(addPasteInvalid());
    expect(
      screen.getByText("That JSON is broken, so Tortoise Spelling can't read it. A bracket or comma may be missing. Ask the chat to fix it, or copy its whole answer again."),
    ).toBeTruthy();
    expect((byId(TestIds.ADD_WORD_PASTE_USE) as HTMLButtonElement).disabled).toBe(true);
    expect(byId(TestIds.ADD_WORD_PASTE_TEXT).getAttribute("aria-invalid")).toBe("true");
  });

  it("Copy error sends the message and says it was copied", async () => {
    const message = "That JSON is broken, so Tortoise Spelling can't read it. A bracket or comma may be missing. Ask the chat to fix it, or copy its whole answer again.";
    const calls = show(addPasteInvalid());
    fireEvent.click(byId(TestIds.ADD_WORD_PASTE_COPY_ERROR));
    expect(calls.copiedErrors).toEqual([message]);
    expect(await screen.findByText("Error copied")).toBeTruthy();
  });

  it("Copy error says so when the copy fails", async () => {
    const calls = show(addPasteInvalid());
    calls.copyWorks = false;
    fireEvent.click(byId(TestIds.ADD_WORD_PASTE_COPY_ERROR));
    expect(await screen.findByText("Couldn't copy the error")).toBeTruthy();
  });

  it("a valid answer has no Copy error", () => {
    show(addPasteValid());
    expect(screen.queryByTestId(TestIds.ADD_WORD_PASTE_COPY_ERROR)).toBeNull();
  });

  it("a blank dialog says to paste the whole reply and cannot be used", () => {
    show({ ...addNew(), paste: { text: "", result: null } });
    expect(screen.getByText("Paste the chat's whole reply.")).toBeTruthy();
    expect((byId(TestIds.ADD_WORD_PASTE_USE) as HTMLButtonElement).disabled).toBe(true);
  });

  it("a valid answer shows its summary and can be used or cancelled", () => {
    const calls = show(addPasteValid());
    expect(screen.getByText("1 definition, 2 forms, 2 example sentences")).toBeTruthy();
    const use = byId(TestIds.ADD_WORD_PASTE_USE) as HTMLButtonElement;
    expect(use.disabled).toBe(false);
    fireEvent.click(use);
    fireEvent.click(screen.getByText("Cancel"));
    expect(calls.used).toBe(1);
    expect(calls.dismissed).toBe(1);
  });

  it("the rename line shows only when the answer changes the word", () => {
    show(addPasteValid("recieve", "receive"));
    expect(screen.getByText("This answer is for “receive”. Using it changes the word from “recieve”.")).toBeTruthy();
  });

  it("a valid answer with a two-word form lists the warning", () => {
    const state = addPasteValid("curious", "curious");
    state.paste!.result = {
      kind: "valid",
      word: "curious",
      renames: false,
      content: apply(addRun().content, { edit: "FormText", definition: 0, form: 1, value: "most curious" }),
    };
    show(state);
    expect(screen.getByText("“most curious” is more than one word. Spelling review asks for one word.")).toBeTruthy();
  });

  it("a two-word form is marked but Save stays enabled", () => {
    const state = addRun();
    state.content = apply(state.content, { edit: "FormText", definition: 0, form: 1, value: "most curious" });
    show(state);
    expect(screen.getByText("“most curious” is more than one word. Spelling review asks for one word.")).toBeTruthy();
    expect((byId(TestIds.ADD_WORD_SAVE) as HTMLButtonElement).disabled).toBe(false);
  });

  it("a one-word form has no warning", () => {
    show(addRun());
    expect(count(/is more than one word/)).toBe(0);
  });

  it("no rename line when the word matches", () => {
    show(addPasteValid());
    expect(count(/This answer is for/)).toBe(0);
  });

  it("the replace line shows when editing", () => {
    show({ ...addPasteValid(), editingId: 3 });
    expect(screen.getByText("Using it replaces the definitions, forms and examples on this screen.")).toBeTruthy();
  });

  it("no replace line for a blank new word", () => {
    show(addPasteValid());
    expect(count(/Using it replaces/)).toBe(0);
  });

  it("the replace line shows for a new word that already has content", () => {
    show({ ...addPasteValid(), content: addRun().content });
    expect(count(/Using it replaces/)).toBe(1);
  });

  it("typing in the answer field reaches the callback, and the field has focus", () => {
    const calls = show(addNew());
    calls.view.rerender({ ...addNew(), paste: { text: "", result: null } });
    const field = byId(TestIds.ADD_WORD_PASTE_TEXT);
    expect(document.activeElement).toBe(field);
    fireEvent.input(field, { target: { value: "{}" } });
    expect(calls.pasted).toEqual(["{}"]);
  });

  it("Escape (cancel) dismisses the dialog", () => {
    const calls = show(addPasteValid());
    const dialog = document.querySelector("dialog") as HTMLDialogElement;
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(calls.dismissed).toBe(1);
  });

  it("the word field is focused on arrival", () => {
    show(addNew());
    expect(document.activeElement).toBe(byId(TestIds.ADD_WORD_TEXT));
  });
});

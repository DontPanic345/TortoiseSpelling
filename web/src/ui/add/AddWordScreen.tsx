import { useEffect, useRef, useState } from "preact/hooks";
import { lookupPrompt } from "../../domain/lookupPrompt";
import type { ContentEdit } from "../../domain/wordContent";
import { Snackbar, useSnackbar } from "../common/Snackbar";
import { useContainer } from "../container";
import { back, type Route } from "../router";
import { AddWordContent } from "./AddWordContent";
import {
  afterAdd,
  canSave,
  dismissPaste,
  duplicateMessage,
  edited,
  loadedForEdit,
  messageConsumed,
  newAddWordState,
  openPaste,
  pasteTextChanged,
  textChanged,
  usePaste,
  withMessage,
  type AddWordState,
} from "./addWordState";

/** How an editor opened from review closed; null is Back, which changed nothing. */
export type EditOutcome = "saved" | "deleted";

interface AddWordScreenProps {
  editingId: number | null;
  /** Given by review, which takes over every exit from the screen. */
  onClosed?: (outcome: EditOutcome | null) => void;
}

export function AddWordScreen({ editingId, onClosed }: AddWordScreenProps) {
  const { repository, platform } = useContainer();
  const [state, setState] = useState(() => newAddWordState(editingId));
  // The loads and the user's typing interleave, so each change reads the latest state
  // rather than the one this render closed over.
  const latest = useRef<AddWordState>(state);
  const unmounted = useRef(false);
  const snackbar = useSnackbar();

  const close = (outcome: EditOutcome | null, fallback: Route) => {
    if (onClosed) onClosed(outcome);
    else back(fallback);
  };

  const update = (change: (state: AddWordState) => AddWordState) => {
    if (unmounted.current) return;
    latest.current = change(latest.current);
    setState(latest.current);
  };

  useEffect(() => {
    unmounted.current = false;
    void repository.wordCount().then((count) => update((s) => ({ ...s, totalWords: count })));
    if (editingId !== null) {
      void repository.wordById(editingId).then((word) => {
        if (word) update((s) => loadedForEdit(s, word.text, word.content));
        else close("deleted", { name: "words" });
      });
    }
    return () => {
      unmounted.current = true;
    };
  }, []);

  useEffect(() => {
    if (state.message === null) return;
    snackbar.show(state.message);
    update(messageConsumed);
  }, [state.message]);

  const save = async () => {
    const snapshot = latest.current;
    if (!canSave(snapshot.text, snapshot.content)) return;
    if (snapshot.editingId !== null) {
      const result = await repository.updateWord(snapshot.editingId, snapshot.text, snapshot.content);
      if (result.kind === "duplicate") update((s) => withMessage(s, duplicateMessage(result.existing.text)));
      else close("saved", { name: "words" });
      return;
    }
    const result = await repository.addWord(snapshot.text, snapshot.content);
    if (result.kind === "added") {
      // Stay on the screen with the fields cleared: adding words happens in bursts, and
      // bouncing back home after each one is friction.
      const total = await repository.wordCount();
      update((s) => afterAdd(s, total));
    } else if (result.kind === "duplicate") {
      update((s) => withMessage(s, duplicateMessage(result.existing.text)));
    } else {
      update((s) => withMessage(s, "Type a word first."));
    }
  };

  const remove = async () => {
    if (editingId === null) return;
    await repository.deleteWord(editingId);
    close("deleted", { name: "words" });
  };

  // The copy runs synchronously in the tap: Safari refuses a clipboard write that comes
  // after an await. The browser gives no confirmation of its own, so the app always does.
  const copyPrompt = () => {
    const copied = platform.copyText(lookupPrompt(latest.current.text));
    void copied.then((ok) => snackbar.show(ok ? "Prompt copied." : "Couldn't copy the prompt."));
  };

  return (
    <>
      <AddWordContent
        state={state}
        onBack={() => close(null, { name: "home" })}
        onDelete={() => void remove()}
        onTextChange={(value) => update((s) => textChanged(s, value))}
        onCopyPrompt={copyPrompt}
        onOpenPaste={() => update(openPaste)}
        onPasteTextChange={(value) => update((s) => pasteTextChanged(s, value))}
        onUsePaste={() => update(usePaste)}
        onDismissPaste={() => update(dismissPaste)}
        onCopyPasteError={(message) => platform.copyText(message)}
        onEdit={(edit: ContentEdit) => update((s) => edited(s, edit))}
        onSave={() => void save()}
      />
      <Snackbar message={snackbar.current} />
    </>
  );
}

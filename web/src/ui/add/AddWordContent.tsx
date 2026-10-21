import type { ComponentChildren } from "preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";
import { formWarnings, type FormWarning } from "../../domain/formWarnings";
import { isBlank, summary, type PastedLookup } from "../../domain/pastedLookup";
import { ktIsBlank, ktTrim } from "../../domain/text";
import {
  exampleMissesForm,
  type ContentEdit,
  type DefinitionDraft,
  type FormDraft,
} from "../../domain/wordContent";
import { BackButton } from "../common/BackButton";
import { Dialog } from "../common/Dialog";
import { ContentCopyIcon, ContentPasteIcon, DeleteIcon } from "../common/icons";
import { TopBar } from "../common/TopBar";
import {
  addWordAddExample,
  addWordAddForm,
  addWordDefinition,
  addWordExample,
  addWordFormLabel,
  addWordFormText,
  TestIds,
} from "../testIds";
import { canCopyPrompt, canSave, isEditing, type AddWordState, type PasteDraft } from "./addWordState";

export interface AddWordContentProps {
  state: AddWordState;
  onBack: () => void;
  onDelete: () => void;
  onTextChange: (value: string) => void;
  onCopyPrompt: () => void;
  onOpenPaste: () => void;
  onPasteTextChange: (value: string) => void;
  onUsePaste: () => void;
  onDismissPaste: () => void;
  /** Resolves to whether the copy worked. */
  onCopyPasteError: (message: string) => Promise<boolean>;
  onEdit: (edit: ContentEdit) => void;
  onSave: () => void;
}

export function AddWordContent({
  state,
  onBack,
  onDelete,
  onTextChange,
  onCopyPrompt,
  onOpenPaste,
  onPasteTextChange,
  onUsePaste,
  onDismissPaste,
  onCopyPasteError,
  onEdit,
  onSave,
}: AddWordContentProps) {
  const wordField = useRef<HTMLInputElement>(null);
  const editing = isEditing(state);
  const word = ktTrim(state.text);
  const warnings = formWarnings(word, state.content);

  // Focus on arrival and after each add, so a run of words can be added without reaching
  // for anything. The fields clear after a save, so this is the new burst's first field.
  useEffect(() => {
    wordField.current?.focus();
  }, [state.addedThisSession]);

  return (
    <main class="screen add-word">
      <TopBar
        title={editing ? "Edit word" : "Add word"}
        navigation={<BackButton onClick={onBack} />}
        actions={
          editing && (
            <button type="button" class="icon-button" aria-label="Delete word" onClick={onDelete}>
              <DeleteIcon />
            </button>
          )
        }
      />

      <Field
        label="Word"
        value={state.text}
        onInput={onTextChange}
        testId={TestIds.ADD_WORD_TEXT}
        inputRef={wordField}
        autocapitalize="none"
        enterkeyhint="next"
      />

      <div class="lookup-row">
        <div class="lookup-buttons">
          <button
            type="button"
            class="button outlined"
            data-testid={TestIds.ADD_WORD_COPY_PROMPT}
            disabled={!canCopyPrompt(state)}
            onClick={onCopyPrompt}
          >
            <ContentCopyIcon />
            Copy prompt
          </button>
          <button type="button" class="button outlined" data-testid={TestIds.ADD_WORD_PASTE} onClick={onOpenPaste}>
            <ContentPasteIcon />
            Paste answer
          </button>
        </div>
        <p class="support">
          Copy the prompt into any chat AI, such as Claude or ChatGPT. Then copy its whole reply and tap Paste answer.
        </p>
      </div>

      {/* Every field stays editable whether or not a pasted answer filled it: the app has
          to be fully usable offline and with no chat AI at all. */}
      {state.content.definitions.map((definition, d) => (
        <DefinitionEditor key={d} d={d} definition={definition} word={word} warnings={warnings} onEdit={onEdit} />
      ))}
      <button
        type="button"
        class="text-button start-aligned"
        data-testid={TestIds.ADD_WORD_ADD_DEFINITION}
        onClick={() => onEdit({ edit: "AddDefinition" })}
      >
        Add definition
      </button>

      <button
        type="button"
        class="button"
        data-testid={TestIds.ADD_WORD_SAVE}
        disabled={!canSave(state.text, state.content)}
        onClick={onSave}
      >
        {editing ? "Save changes" : "Add word"}
      </button>

      {!editing && state.addedThisSession > 0 && (
        <p class="support">
          Added {state.addedThisSession} this session · {state.totalWords} total
        </p>
      )}

      {state.paste && (
        <PasteDialog
          paste={state.paste}
          replacesContent={editing || !isBlank(state.content)}
          typedWord={word}
          onTextChange={onPasteTextChange}
          onUse={onUsePaste}
          onDismiss={onDismissPaste}
          onCopyError={onCopyPasteError}
        />
      )}
    </main>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onInput: (value: string) => void;
  testId?: string;
  error?: boolean;
  /** The line under the field; red when `error`. */
  support?: string | null;
  rows?: number;
  inputRef?: { current: HTMLInputElement | null };
  autocapitalize?: "none";
  enterkeyhint?: "next";
  /** Sits to the right of the field, like Android's trailing icon. */
  trailing?: ComponentChildren;
  class?: string;
}

/** A labelled text field: a single line, or a textarea when `rows` is given. */
function Field({
  label,
  value,
  onInput,
  testId,
  error = false,
  support = null,
  rows,
  inputRef,
  autocapitalize,
  enterkeyhint,
  trailing,
  class: className,
}: FieldProps) {
  const id = useId();
  const supportId = `${id}-support`;
  const shared = {
    id,
    value,
    "data-testid": testId,
    "aria-invalid": error,
    "aria-describedby": support ? supportId : undefined,
  };
  return (
    <div class={`field ${error ? "error" : ""} ${className ?? ""}`.trim()}>
      <label for={id}>{label}</label>
      <div class="field-control">
        {rows ? (
          <textarea
            {...shared}
            rows={rows}
            onInput={(event) => onInput(event.currentTarget.value)}
          />
        ) : (
          <input
            {...shared}
            ref={inputRef}
            type="text"
            autocapitalize={autocapitalize}
            enterkeyhint={enterkeyhint}
            onInput={(event) => onInput(event.currentTarget.value)}
          />
        )}
        {trailing}
      </div>
      {support && (
        <p id={supportId} class="support">
          {support}
        </p>
      )}
    </div>
  );
}

function DefinitionEditor({
  d,
  definition,
  word,
  warnings,
  onEdit,
}: {
  d: number;
  definition: DefinitionDraft;
  word: string;
  warnings: readonly FormWarning[];
  onEdit: (edit: ContentEdit) => void;
}) {
  const missing = ktIsBlank(definition.text);
  return (
    <section class="definition-editor">
      <div class="editor-heading">
        <h2>Definition {d + 1}</h2>
        {d > 0 && (
          <button
            type="button"
            class="icon-button"
            aria-label={`Remove definition ${d + 1}`}
            onClick={() => onEdit({ edit: "RemoveDefinition", definition: d })}
          >
            <DeleteIcon />
          </button>
        )}
      </div>

      <Field
        label="Definition"
        value={definition.text}
        rows={2}
        error={missing}
        support={missing ? "Required" : "Shown as the prompt. Should not contain the word."}
        testId={d === 0 ? TestIds.ADD_WORD_DEFINITION : addWordDefinition(d)}
        onInput={(value) => onEdit({ edit: "DefinitionText", definition: d, value })}
      />

      <Field
        label="Part of speech (optional)"
        value={definition.partOfSpeech}
        testId={d === 0 ? TestIds.ADD_WORD_PART_OF_SPEECH : undefined}
        onInput={(value) => onEdit({ edit: "PartOfSpeech", definition: d, value })}
      />

      {definition.forms.map((form, f) => (
        <FormEditor
          key={f}
          d={d}
          f={f}
          form={form}
          word={word}
          warning={warnings.find((w) => w.definition === d && w.form === f)?.message ?? null}
          onEdit={onEdit}
        />
      ))}
      <button
        type="button"
        class="text-button start-aligned"
        data-testid={addWordAddForm(d)}
        onClick={() => onEdit({ edit: "AddForm", definition: d })}
      >
        Add form
      </button>
    </section>
  );
}

function FormEditor({
  d,
  f,
  form,
  word,
  warning,
  onEdit,
}: {
  d: number;
  f: number;
  form: FormDraft;
  word: string;
  warning: string | null;
  onEdit: (edit: ContentEdit) => void;
}) {
  const isBase = d === 0 && f === 0;
  const spelling = isBase ? word : ktTrim(form.text);
  const formMissing = ktIsBlank(form.text);
  return (
    <div class="form-editor">
      {isBase ? (
        <h3>{word === "" ? "The word itself" : word}</h3>
      ) : (
        <Field
          label="Form"
          value={form.text}
          error={formMissing || warning !== null}
          support={formMissing ? "Required" : warning}
          autocapitalize="none"
          testId={addWordFormText(d, f)}
          onInput={(value) => onEdit({ edit: "FormText", definition: d, form: f, value })}
          trailing={
            <button
              type="button"
              class="icon-button"
              aria-label={`Remove form${spelling === "" ? "" : ` “${spelling}”`}`}
              onClick={() => onEdit({ edit: "RemoveForm", definition: d, form: f })}
            >
              <DeleteIcon />
            </button>
          }
        />
      )}

      <Field
        label="Label (optional)"
        value={form.label}
        testId={addWordFormLabel(d, f)}
        onInput={(value) => onEdit({ edit: "FormLabel", definition: d, form: f, value })}
      />

      {form.examples.map((example, e) => {
        const misses = spelling !== "" && exampleMissesForm(example.text, spelling);
        return (
          <Field
            key={e}
            label="Example sentence (optional)"
            value={example.text}
            rows={2}
            error={misses}
            support={misses ? `Doesn't contain “${spelling}”, so review can't blank it.` : "The word is blanked out during review."}
            testId={d === 0 && f === 0 && e === 0 ? TestIds.ADD_WORD_EXAMPLE : addWordExample(d, f, e)}
            onInput={(value) => onEdit({ edit: "ExampleText", definition: d, form: f, example: e, value })}
            trailing={
              <button
                type="button"
                class="icon-button"
                aria-label="Remove example"
                onClick={() => onEdit({ edit: "RemoveExample", definition: d, form: f, example: e })}
              >
                <DeleteIcon />
              </button>
            }
          />
        );
      })}
      <button
        type="button"
        class="text-button start-aligned"
        data-testid={addWordAddExample(d, f)}
        onClick={() => onEdit({ edit: "AddExample", definition: d, form: f })}
      >
        Add example
      </button>
    </div>
  );
}

function PasteDialog({
  paste,
  replacesContent,
  typedWord,
  onTextChange,
  onUse,
  onDismiss,
  onCopyError,
}: {
  paste: PasteDraft;
  replacesContent: boolean;
  typedWord: string;
  onTextChange: (value: string) => void;
  onUse: () => void;
  onDismiss: () => void;
  onCopyError: (message: string) => Promise<boolean>;
}) {
  const { result } = paste;
  const field = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  // The modal dialog covers the snackbar, so the button itself says how the copy went,
  // until the message changes.
  const [copy, setCopy] = useState<{ message: string; ok: boolean } | null>(null);
  const copyError = (message: string) => {
    // Called straight from the tap: Safari refuses a clipboard write after an await.
    void onCopyError(message).then((ok) => setCopy({ message, ok }));
  };
  useEffect(() => {
    field.current?.focus();
  }, []);

  return (
    <Dialog
      title="Paste the answer"
      onDismiss={onDismiss}
      actions={
        <>
          <button type="button" class="text-button" onClick={onDismiss}>
            Cancel
          </button>
          <button
            type="button"
            class="text-button"
            data-testid={TestIds.ADD_WORD_PASTE_USE}
            disabled={result?.kind !== "valid"}
            onClick={onUse}
          >
            Use this
          </button>
        </>
      }
    >
      <div class={`field ${result?.kind === "invalid" ? "error" : ""}`}>
        <label for={id}>The chat's answer</label>
        <div class="field-control">
          <textarea
            id={id}
            ref={field}
            rows={4}
            value={paste.text}
            aria-invalid={result?.kind === "invalid"}
            data-testid={TestIds.ADD_WORD_PASTE_TEXT}
            onInput={(event) => onTextChange(event.currentTarget.value)}
          />
        </div>
        <p class="support">{pasteSupport(result)}</p>
      </div>
      {result?.kind === "valid" &&
        formWarnings(result.word, result.content).map((w, i) => (
          <p key={i} class="warning">
            {w.message}
          </p>
        ))}
      {result?.kind === "invalid" && (
        // So the message can go back to the chat, which can usually fix its answer.
        <button
          type="button"
          class="text-button"
          data-testid={TestIds.ADD_WORD_PASTE_COPY_ERROR}
          onClick={() => copyError(result.message)}
        >
          {copy?.message !== result.message ? "Copy error" : copy.ok ? "Error copied" : "Couldn't copy the error"}
        </button>
      )}
      {result?.kind === "valid" && result.renames && (
        <p>
          This answer is for “{result.word}”. Using it changes the word from “{typedWord}”.
        </p>
      )}
      {result?.kind === "valid" && replacesContent && (
        <p>Using it replaces the definitions, forms and examples on this screen.</p>
      )}
    </Dialog>
  );
}

function pasteSupport(result: PastedLookup | null): string {
  if (result === null) return "Paste the chat's whole reply.";
  return result.kind === "invalid" ? result.message : summary(result.content);
}

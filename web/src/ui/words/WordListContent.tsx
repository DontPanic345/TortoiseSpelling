import { useState } from "preact/hooks";
import type { Word } from "../../data/model";
import { WORD_FILTERS, WORD_FILTER_LABELS, type WordFilter } from "../../domain/progress";
import { BackButton } from "../common/BackButton";
import { Dialog } from "../common/Dialog";
import { EmptyState } from "../common/EmptyState";
import { DeleteIcon, PauseCircleIcon, PlayCircleIcon } from "../common/icons";
import { TopBar } from "../common/TopBar";
import { TestIds, wordFilter, wordRow, wordRowStatus } from "../testIds";
import { isFiltering, noMatchesBody, type WordListUiState, type WordRow } from "./wordListState";

export interface WordListContentProps {
  state: WordListUiState;
  onBack: () => void;
  onEdit: (id: number) => void;
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: WordFilter) => void;
  onToggleSuspended: (word: Word) => void;
  onDelete: (word: Word) => void;
}

export function WordListContent({
  state,
  onBack,
  onEdit,
  onQueryChange,
  onFilterChange,
  onToggleSuspended,
  onDelete,
}: WordListContentProps) {
  const [pendingDelete, setPendingDelete] = useState<Word | null>(null);

  return (
    <main class="screen word-list">
      <TopBar title={`All words (${state.totalCount})`} navigation={<BackButton onClick={onBack} />} />
      <div class="field word-search">
        <label for="word-search">Search</label>
        <input
          id="word-search"
          type="text"
          value={state.query}
          data-testid={TestIds.WORD_LIST_SEARCH}
          onInput={(event) => onQueryChange(event.currentTarget.value)}
        />
      </div>

      {/* With no words at all, six chips reading 0 would only crowd "No words yet". */}
      {(state.filterCounts.ALL ?? 0) > 0 && (
        <div class="filter-row" data-testid={TestIds.WORD_FILTER_ROW}>
          {WORD_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              class={`chip ${filter === state.filter ? "selected" : ""}`.trim()}
              aria-pressed={filter === state.filter}
              data-testid={wordFilter(filter.toLowerCase())}
              onClick={() => onFilterChange(filter)}
            >
              {`${WORD_FILTER_LABELS[filter]} ${state.filterCounts[filter] ?? 0}`}
            </button>
          ))}
        </div>
      )}

      {state.loading ? null : state.rows.length === 0 && isFiltering(state) ? (
        <EmptyState icon={<BookIcon />} title="No matches" body={noMatchesBody(state.query, state.filter)} />
      ) : state.rows.length === 0 ? (
        <EmptyState
          icon={<BookIcon />}
          title="No words yet"
          body="Words you add will show up here with their next review date."
        />
      ) : (
        <ul class="word-rows">
          {state.rows.map((row) => (
            <WordListItem
              key={row.word.id}
              row={row}
              onClick={() => onEdit(row.word.id)}
              onToggleSuspended={() => onToggleSuspended(row.word)}
              onDelete={() => setPendingDelete(row.word)}
            />
          ))}
        </ul>
      )}

      {pendingDelete && (
        <Dialog
          title={`Delete “${pendingDelete.text}”?`}
          onDismiss={() => setPendingDelete(null)}
          actions={
            <>
              <button type="button" class="text-button" onClick={() => setPendingDelete(null)}>
                Cancel
              </button>
              <button
                type="button"
                class="text-button"
                onClick={() => {
                  onDelete(pendingDelete);
                  setPendingDelete(null);
                }}
              >
                Delete
              </button>
            </>
          }
        >
          <p>Its review history goes too. This can't be undone.</p>
        </Dialog>
      )}
    </main>
  );
}

function BookIcon() {
  return (
    <svg class="icon empty-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z" />
    </svg>
  );
}

function WordListItem({
  row,
  onClick,
  onToggleSuspended,
  onDelete,
}: {
  row: WordRow;
  onClick: () => void;
  onToggleSuspended: () => void;
  onDelete: () => void;
}) {
  const { word } = row;
  return (
    <li class="word-row" data-testid={wordRow(word.normalizedText)}>
      <button type="button" class="word-row-main" onClick={onClick}>
        <span class="word-row-text">{word.text}</span>
        <span class="word-row-definition">{row.definition}</span>
        <span
          class={`status-badge ${word.suspended ? "suspended" : ""}`.trim()}
          data-testid={wordRowStatus(word.normalizedText)}
        >
          {row.status}
        </span>
      </button>
      <button
        type="button"
        class="icon-button"
        aria-label={word.suspended ? "Resume word" : "Suspend word"}
        onClick={onToggleSuspended}
      >
        {word.suspended ? <PlayCircleIcon /> : <PauseCircleIcon />}
      </button>
      <button type="button" class="icon-button" aria-label="Delete word" onClick={onDelete}>
        <DeleteIcon />
      </button>
    </li>
  );
}

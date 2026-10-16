import { useRef, useState } from "preact/hooks";
import type { StoredWord } from "../../data/model";
import { today } from "../../domain/days";
import type { WordFilter } from "../../domain/progress";
import { useContainer } from "../container";
import { back, navigate } from "../router";
import { useRefresh } from "../useRefresh";
import { WordListContent } from "./WordListContent";
import { buildWordList, initialWordListState, type WordListUiState } from "./wordListState";

export function WordListScreen() {
  const { repository, clock } = useContainer();
  const [state, setState] = useState<WordListUiState>(initialWordListState);
  const words = useRef<StoredWord[]>([]);
  const query = useRef("");
  const filter = useRef<WordFilter>("ALL");

  const rebuild = () => setState(buildWordList(words.current, query.current, filter.current, today(clock)));

  useRefresh(repository, () =>
    void repository.wordsWithContent().then((all) => {
      words.current = all;
      rebuild();
    }),
  );

  return (
    <WordListContent
      state={state}
      onBack={() => back({ name: "home" })}
      onEdit={(id) => navigate({ name: "edit", id })}
      onQueryChange={(value) => {
        query.current = value;
        rebuild();
      }}
      onFilterChange={(value) => {
        filter.current = value;
        rebuild();
      }}
      onToggleSuspended={(word) => void repository.setSuspended(word.id, !word.suspended)}
      onDelete={(word) => void repository.deleteWord(word.id)}
    />
  );
}

import { simpleContent } from "../domain/wordContent";
import type { AppContainer } from "../ui/container";

export interface SeedWord {
  word: string;
  definition?: string;
  example?: string;
  partOfSpeech?: string;
}

declare global {
  interface Window {
    /** Installed by the `--mode e2e` build only: adds words through the repository, as the APK's SeedWordsActivity does. */
    __tortoiseSpellingSeed?: (words: SeedWord[]) => Promise<void>;
  }
}

/** Lets the shared specs arrange words without typing them into the Add screen. */
export function installSeedHook(container: AppContainer): void {
  window.__tortoiseSpellingSeed = async (words) => {
    for (const { word, definition, partOfSpeech, example } of words) {
      const result = await container.repository.addWord(
        word,
        simpleContent(word, definition ?? "", partOfSpeech ?? null, example ?? ""),
      );
      if (result.kind !== "added") throw new Error(`Could not seed "${word}": ${result.kind}`);
    }
  };
}

import { simpleContent } from "../domain/wordContent";
import type { Permission } from "../push/pushPlatform";
import type { AppContainer } from "../ui/container";
import type { FakePush } from "./fakePush";

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
    /** Stands in for the browser's notification prompt: what the next permission request answers. */
    __tortoiseSpellingPush?: { answer: (permission: Permission) => void };
  }
}

/**
 * Lets the shared specs arrange words without typing them into the Add screen, and answer the
 * notification prompt, which no browser under Playwright can really show.
 */
export function installSeedHook(container: AppContainer, push: FakePush): void {
  window.__tortoiseSpellingPush = { answer: (permission) => void (push.answer = permission) };
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

import type { SpeechPlatform } from "../ui/speechPlatform";

declare global {
  interface Window {
    __tortoiseSpellingSpoken?: string[];
  }
}

/** The e2e build's speech: always ready, and records what was spoken where the specs can read it. */
export function fakeSpeech(): SpeechPlatform {
  window.__tortoiseSpellingSpoken = [];
  return {
    ready: () => true,
    onReadyChange: () => () => {},
    speak(text) {
      window.__tortoiseSpellingSpoken?.push(text);
    },
  };
}

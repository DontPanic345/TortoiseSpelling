/** Text-to-speech from the browser's own on-device English voice. */
export interface SpeechPlatform {
  /** Whether there is a voice to speak with; false hides the button. */
  ready(): boolean;
  onReadyChange(listener: () => void): () => void;
  /** Cancels anything still speaking, then says `text`. Call it from a user gesture: iOS refuses otherwise. */
  speak(text: string): void;
}

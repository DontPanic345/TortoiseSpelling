// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { browserPlatform } from "../../src/ui/browserPlatform";

class FakeUtterance {
  voice: unknown = null;
  lang = "";
  rate = 1;
  constructor(readonly text: string) {}
}

function voice(lang: string, localService: boolean, name = lang) {
  return { lang, localService, name } as SpeechSynthesisVoice;
}

/** A `speechSynthesis` stub whose voice list a test can change and announce. */
function stubSynthesis(initial: SpeechSynthesisVoice[]) {
  const target = new EventTarget();
  const synth = Object.assign(target, {
    voices: initial,
    getVoices() {
      return synth.voices;
    },
    log: [] as string[],
    spoken: [] as FakeUtterance[],
    cancel() {
      synth.log.push("cancel");
    },
    speak(utterance: FakeUtterance) {
      synth.log.push("speak");
      synth.spoken.push(utterance);
    },
    load(voices: SpeechSynthesisVoice[]) {
      synth.voices = voices;
      target.dispatchEvent(new Event("voiceschanged"));
    },
  });
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  return synth;
}

beforeEach(() => {
  vi.spyOn(navigator, "languages", "get").mockReturnValue(["en-NZ"]);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the browser's speech", () => {
  it("is never ready without speechSynthesis", () => {
    vi.stubGlobal("speechSynthesis", undefined);
    const speech = browserPlatform().speech;
    expect(speech.ready()).toBe(false);
    speech.speak("ran");
  });

  it("checks the voices once on creation, for browsers that never fire voiceschanged", () => {
    stubSynthesis([voice("en-US", true)]);
    expect(browserPlatform().speech.ready()).toBe(true);
  });

  it("ignores voices that are not local", () => {
    const synth = stubSynthesis([voice("en-NZ", false), voice("en-US", false)]);
    const speech = browserPlatform().speech;
    expect(speech.ready()).toBe(false);
    speech.speak("ran");
    expect(synth.spoken).toEqual([]);
  });

  it("chooses again when the voices load, and tells the listeners", () => {
    const synth = stubSynthesis([]);
    const speech = browserPlatform().speech;
    const changes: boolean[] = [];
    speech.onReadyChange(() => changes.push(speech.ready()));
    expect(speech.ready()).toBe(false);

    synth.load([voice("en-GB", true)]);

    expect(speech.ready()).toBe(true);
    expect(changes).toEqual([true]);
  });

  it("stops telling a listener that unsubscribed", () => {
    const synth = stubSynthesis([]);
    const speech = browserPlatform().speech;
    let calls = 0;
    speech.onReadyChange(() => calls++)();
    synth.load([voice("en-GB", true)]);
    expect(calls).toBe(0);
  });

  it("speaks with the chosen local voice at the shared rate, after cancelling", () => {
    const gb = voice("en-GB", true, "gb");
    const nz = voice("en-NZ", true, "nz");
    const synth = stubSynthesis([voice("en-NZ", false, "network"), gb, nz]);
    const speech = browserPlatform().speech;

    speech.speak("ran");

    expect(synth.log).toEqual(["cancel", "speak"]);
    const [utterance] = synth.spoken;
    expect(utterance).toMatchObject({ text: "ran", voice: nz, lang: "en-NZ", rate: 0.8 });
  });
});

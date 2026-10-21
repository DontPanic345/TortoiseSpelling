import { describe, expect, it } from "vitest";
import { chooseVoice, SPEECH_RATE } from "../../src/domain/speech";
import { cases, expectFunctions, loadGolden } from "./load";

const file = loadGolden("speech");

describe("speech golden cases", () => {
  it("has a runner for every function", () => {
    expectFunctions(file, ["speechRate", "chooseVoice"]);
  });

  it("speechRate matches", () => expect(SPEECH_RATE).toBe(file.speechRate));

  describe.each(cases(file, "chooseVoice"))("chooseVoice: $name", (c) => {
    it("matches", () => expect(chooseVoice(c.voices, c.deviceLocales)).toBe(c.out));
  });
});

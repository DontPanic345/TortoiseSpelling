import { describe, expect, it } from "vitest";
import { formWarnings } from "../../src/domain/formWarnings";
import { cases, contentFrom, expectFunctions, loadGolden } from "./load";

const file = loadGolden("warnings");

describe("warnings golden cases", () => {
  it("has a runner for every function", () => {
    expectFunctions(file, ["formWarnings"]);
  });

  describe.each(cases(file, "formWarnings"))("formWarnings: $name", (c) => {
    it("matches", () => expect(formWarnings(c.word, contentFrom(c.content))).toEqual(c.out));
  });
});

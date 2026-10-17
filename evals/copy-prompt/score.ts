import { readdirSync, readFileSync } from "node:fs";
import { parsePastedLookup } from "../../web/src/domain/pastedLookup";
const typed = (f: string) => f.replace(/^(haiku|sonnet)-/, "").replace(".txt", "");
for (const f of readdirSync("out").sort()) {
  const text = readFileSync(`out/${f}`, "utf8");
  const r: any = parsePastedLookup(text, typed(f));
  const fenced = /```/.test(text), prose = !/^\s*(```(json)?\s*)?\{/.test(text);
  console.log(f.padEnd(24), r.kind === "valid" ? `VALID  word=${r.word} renames=${r.renames}` : `INVALID ${r.message}`, fenced ? "[fenced]" : "", prose ? "[prose]" : "");
}

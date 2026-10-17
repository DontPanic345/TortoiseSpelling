import { readFileSync, writeFileSync } from "node:fs";
const flip = Math.random() < 0.5;
const A = flip ? "sonnet-high" : "haiku-low", B = flip ? "haiku-low" : "sonnet-high";
writeFileSync("blind-key.txt", `A=${A}\nB=${B}\n`);
const show = (id) => {
  const t = readFileSync(`out2/${id}.txt`, "utf8");
  const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
  return j.definitions.map((d, i) => `  ${i + 1}. (${d.partOfSpeech}) ${d.text}\n` + d.forms.map(f => `     - ${f.text} [${f.label}]\n` + f.examples.map(e => `         "${e}"`).join("\n")).join("\n")).join("\n");
};
let out = "";
for (const w of ["fish", "sheep", "read", "analysis", "knife"]) {
  out += `\n===== ${w} =====\n--- A ---\n${show(`${A}-${w}`)}\n--- B ---\n${show(`${B}-${w}`)}\n`;
}
console.log(out);

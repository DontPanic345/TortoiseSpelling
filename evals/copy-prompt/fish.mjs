import { readdirSync, readFileSync } from "node:fs";
for (const f of readdirSync("out2").sort().filter(f=>/-(fish|sheep)\.txt/.test(f))) {
  const t=readFileSync(`out2/${f}`,"utf8"); const j=JSON.parse(t.slice(t.indexOf("{"),t.lastIndexOf("}")+1));
  console.log(f.padEnd(26), j.definitions.map(d=>d.partOfSpeech+": "+d.forms.map(x=>x.text).join("/")).join(" | "));
}

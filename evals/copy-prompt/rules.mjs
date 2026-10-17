import { readdirSync, readFileSync } from "node:fs";
const rows = {};
for (const f of readdirSync("out").sort()) {
  const t = readFileSync(`out/${f}`, "utf8"); const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
  const [m] = f.split("-"); const issues = [];
  const forms = j.definitions.flatMap(d => d.forms), ex = forms.flatMap(x => x.examples).length;
  const allForms = forms.map(x => x.text.toLowerCase());
  j.definitions.forEach((d, i) => {
    const w = d.text.toLowerCase().split(/\W+/);
    for (const ft of d.forms.map(x => x.text.toLowerCase())) if (w.includes(ft)) issues.push(`def${i+1} uses "${ft}"`);
    if (d.text.split(/\s+/).length >= 25) issues.push(`def${i+1} ${d.text.split(/\s+/).length} words`);
    const seen = d.forms.map(x => x.text.toLowerCase()); if (new Set(seen).size < seen.length) issues.push(`def${i+1} duplicate form`);
  });
  if (j.definitions[0].forms[0].text.toLowerCase() !== j.word.toLowerCase()) issues.push("first form isn't the word");
  (rows[m] ??= []).push({ f, defs: j.definitions.length, forms: forms.length, ex, issues });
}
for (const m in rows) { const r = rows[m]; const avg = k => (r.reduce((a, x) => a + x[k], 0) / r.length).toFixed(1);
  console.log(`${m}: n=${r.length} avg defs ${avg("defs")}, forms ${avg("forms")}, examples ${avg("ex")}`);
  r.filter(x => x.issues.length).forEach(x => console.log("  ", x.f, x.issues.join("; "))); }

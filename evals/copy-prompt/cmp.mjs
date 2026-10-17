import { readFileSync } from "node:fs";
const load=(p)=>{const t=readFileSync(p,"utf8");return JSON.parse(t.slice(t.indexOf("{"),t.lastIndexOf("}")+1));};
for (const w of ["fish","sheep","read","analysis","knife"]) {
  for (const [lab,p] of [["old",`out2/haiku-low-${w}.txt`],["new",`out3/haiku-low-${w}.txt`]]) {
    const j=load(p); let f=0,e=0; j.definitions.forEach(d=>d.forms.forEach(x=>{f++;e+=x.examples.length;}));
    console.log(`${w} ${lab}: ${j.definitions.length} defs, ${f} forms, ${e} ex`);
    j.definitions.forEach(d=>console.log(`   (${d.partOfSpeech}) ${d.text}  [${d.forms.map(x=>x.text).join("/")}]`));
  }
}

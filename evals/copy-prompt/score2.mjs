import { readdirSync, readFileSync } from "node:fs";
const rows=[];
for (const f of readdirSync("out2").sort()) {
  const t=readFileSync(`out2/${f}`,"utf8");
  const [model,effort,word]=f.replace(".txt","").split("-");
  let j; try{ j=JSON.parse(t.slice(t.indexOf("{"),t.lastIndexOf("}")+1)); }catch(e){ rows.push({model,effort,word,bad:1}); continue; }
  let forms=0,ex=0,dup=0,miss=0,defs=j.definitions.length,dupfish=false;
  for(const d of j.definitions){ const seen=new Set(); for(const fm of d.forms){forms++; if(seen.has(fm.text))dup++; seen.add(fm.text);
    for(const e of fm.examples){ex++; if(!new RegExp(`(^|[^\\p{L}])${fm.text}($|[^\\p{L}])`,"iu").test(e))miss++;}}}
  rows.push({model,effort,word,defs,forms,ex,dup,miss,fenced:/```/.test(t)?1:0,renames:j.word!==word?1:0});
}
console.table(rows);
const agg={};
for(const r of rows){ if(r.bad)continue; const k=r.model+"-"+r.effort; const a=agg[k]??={n:0,defs:0,forms:0,ex:0,dup:0,miss:0}; a.n++;for(const x of ["defs","forms","ex","dup","miss"])a[x]+=r[x];}
console.table(agg);

import { writeFileSync } from "node:fs";
import { lookupPrompt } from "../../web/src/domain/lookupPrompt";
const words = ["fish","sheep","read","analysis","knife"];
for (const w of words) writeFileSync(`prompts/${w}.txt`, lookupPrompt(w));
console.log(words.join(" "));

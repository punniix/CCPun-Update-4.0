import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=(path: string)=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
test("UAT SEO input allows Thai combining vowels and tone marks, rejects private punctuation",()=>{
 const ui=read("features/admin/components/UatSeoN8nCanary.tsx");
 const api=read("apps/admin/app/api/admin/n8n/p1/seo/route.ts");
 for(const code of [ui,api]) assert.ok(code.includes(String.raw`\p{L}\p{M}\p{N}`),"Thai mark property must appear in both UI and API");
 const safe=/^[\p{L}\p{M}\p{N} ._-]+$/u;
 for(const input of ["ประกันสุขภาพ","วางแผนเกษียณ","เบี้ยประกันภัย 2569"]) assert.ok(safe.test(input),input);
 for(const input of ["user@example.com","090-123-4567!","https://secret.example/x"]) assert.equal(safe.test(input),false);
});

import { websiteV5PhaseBRenderGoldens } from "./website-v5-phase-a-proof.mjs";
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const fixture=readFileSync(new URL('./v5-eyebrow-html-successors.json',import.meta.url),'utf8');
assert.equal(sha(fixture),'0a8c6a2b77875455e68f07294b7ce2c0757155b9520dea1d8c18f187f0ff4669','C15 default HTML pins stay frozen');
export const eyebrowHtmlPins=JSON.parse(fixture);
/** Used only by default-output golden checks; edited CMS output always stays actual. */
export function inverseEyebrowHtml(html,index) {
 const pin=eyebrowHtmlPins[String(index)];if(!pin)return html;
 const digest=sha(html);if(digest===pin.before || digest===websiteV5PhaseBRenderGoldens.v5[String(index)])return html;
 assert.equal(digest,pin.after,'C15 refuses unknown full render, CMS edits, duplicates or moved nodes');
 for(const [now,before]of pin.replacements){assert.equal(html.split(now).length,2);html=html.replace(now,before);}
 assert.equal(sha(html),pin.before,'C15 reconstructs the whole actual predecessor before C11 inversion');return html;
}

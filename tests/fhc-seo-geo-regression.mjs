import { createHash } from 'node:crypto';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../features/financial-health-check/page.tsx', import.meta.url), 'utf8');
const client = readFileSync(new URL('../features/financial-health-check/components/ClientFHC.tsx', import.meta.url), 'utf8');

const {getFhcFaqs,FHC_COPY_DEFAULTS}=loadFixtureModule('lib/content/tool-copy-defaults.ts');
assert.equal(createHash('sha256').update(JSON.stringify(getFhcFaqs(key=>FHC_COPY_DEFAULTS[key]))).digest('hex'),'176328e73f1555b4b4ec366fd6eb5682dc032d5760a990123a8decade56e13b0','all original visible FAQ answers and ordering stay unchanged');
assert.match(client, /import \{ getFhcFaqs \} from '@\/lib\/content\/tool-copy-defaults';/, 'Visible FHC renderer must import the shared FAQ source');
assert.match(client, /getFhcFaqs\(t\)\.map\(/, 'Visible FHC FAQs must render from the shared FAQ source');
// Website v5 Phase B: the FHC route renders features/financial-health-check/v5/V5Fhc, which owns both the
// visible FAQ and the FAQPage schema from one `getFhcFaqs(t)` list. The retained 4.3 ClientFHC keeps the checks above.
const v5 = readFileSync(new URL('../features/financial-health-check/v5/V5Fhc.tsx', import.meta.url), 'utf8');
assert.match(page, /return <V5Fhc copy=/, 'FHC render owner renders the v5 page');
assert.match(v5, /import \{ getFhcFaqs \} from '@\/lib\/content\/tool-copy-defaults';/, 'FHC schema must use the visible FAQ source');
assert.match(v5, /const faqs = getFhcFaqs\(t\);/, 'one FAQ list feeds both the page and the schema');
assert.match(v5, /<V5Faq items=\{faqs\} \/>/, 'Visible FHC FAQs render from the shared FAQ source');
assert.match(v5, /'@type': 'FAQPage'/, 'FHC must expose FAQPage only from visible FAQ content');
assert.match(v5, /mainEntity: faqs\.map\(/, 'FHC FAQ schema answers must match visible answers');
assert.match(page, /canonical: 'https:\/\/ccpun\.com\/tools\/financial-health-check\/'/, 'FHC canonical must remain self-referencing');

console.log('PASS FHC SEO/GEO answerability regression');

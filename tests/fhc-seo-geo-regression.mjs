import { createHash } from 'node:crypto';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../features/financial-health-check/page.tsx', import.meta.url), 'utf8');
const client = readFileSync(new URL('../features/financial-health-check/v5/V5Fhc.tsx', import.meta.url), 'utf8');

const {getFhcFaqs,FHC_COPY_DEFAULTS}=loadFixtureModule('lib/content/tool-copy-defaults.ts');
assert.equal(createHash('sha256').update(JSON.stringify(getFhcFaqs(key=>FHC_COPY_DEFAULTS[key]))).digest('hex'),'176328e73f1555b4b4ec366fd6eb5682dc032d5760a990123a8decade56e13b0','all original visible FAQ answers and ordering stay unchanged');
assert.match(client, /import \{ getFhcFaqs \} from '@\/lib\/content\/tool-copy-defaults';/, 'Visible FHC renderer must import the shared FAQ source');
assert.match(client, /const faqs = getFhcFaqs\(t\)/, 'Visible FHC FAQs must use the shared FAQ source');
assert.match(client, /<V5Faq items=\{faqs\}/, 'actual native answers use exactly the schema FAQ array');
assert.match(page, /return <V5Fhc copy=\{copyOverride/, 'active wrapper delegates schema and visible content to the native owner');
assert.match(client, /'@type': 'FAQPage'/, 'FHC must expose FAQPage only from visible FAQ content');
assert.match(client, /mainEntity: faqs\.map\(/, 'FHC FAQ schema answers must match visible answers');
assert.match(page, /canonical: 'https:\/\/ccpun\.com\/tools\/financial-health-check\/'/, 'FHC canonical must remain self-referencing');

console.log('PASS FHC SEO/GEO answerability regression');

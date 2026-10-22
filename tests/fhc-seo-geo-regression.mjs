import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';

const page = readFileSync(new URL('../features/financial-health-check/page.tsx', import.meta.url), 'utf8');
const client = readFileSync(new URL('../features/financial-health-check/components/ClientFHC.tsx', import.meta.url), 'utf8');

assert.match(client, /import \{ getFhcFaqs \} from '@\/lib\/content\/tool-copy-defaults'/, 'Visible FAQ renderer must import the CMS-aware shared FAQ source');
assert.match(client, /getFhcFaqs\(t\)\.map\(/, 'Visible FHC FAQs must render from the shared FAQ source');
assert.match(page, /import \{ getFhcFaqs \} from '@\/lib\/content\/tool-copy-defaults'/, 'FHC schema must use the visible FAQ source');
assert.match(page, /'@type': 'FAQPage'/, 'FHC must expose FAQPage only from visible FAQ content');
assert.match(page, /mainEntity: getFhcFaqs\(t\)\.map\(/, 'FHC FAQ schema answers must match visible answers');
assert.match(page, /canonical: 'https:\/\/ccpun\.com\/tools\/financial-health-check\/'/, 'FHC canonical must remain self-referencing');

const registry = loadFixtureModule('lib/content/public-copy-registry.ts');
const { FHC_COPY_DEFAULTS } = loadFixtureModule('lib/content/tool-copy-defaults.ts');
async function resolveServer(node) {
  if (Array.isArray(node)) return Promise.all(node.map(resolveServer));
  if (!React.isValidElement(node)) return node;
  if (typeof node.type === 'function' && ['Website43Footer', 'ClientFHC'].includes(node.type.name)) return resolveServer(await node.type(node.props));
  const children = await resolveServer(node.props.children);
  return React.cloneElement(node, {}, ...(Array.isArray(children) ? children : [children]));
}
for (const overrides of [{}, { 'fhc.faq2.question': 'คำถามฉบับร่าง UAT', 'fhc.faq2.answer': 'คำตอบฉบับร่าง UAT ที่ต้องตรงกันทั้งหน้าและข้อมูลสำหรับการค้นหา' }]) {
  const values = { ...FHC_COPY_DEFAULTS, ...overrides };
  const provider = loadFixtureModule('components/ui/PublicCopyProvider.tsx');
  const featureModule = loadFixtureModule('features/financial-health-check/page.tsx', { mocks: new Map([
    ['@/components/ui/PublicCopyProvider', provider],
    ['@/lib/content/public-copy', { getPublicCopy: async scope => scope === 'fhc' ? values : registry.parsePublicCopy(scope, null) }],
    ['@/features/financial-health-check/article-availability', { getFhcPyramidHref: async () => '/blog/' }],
    ['@/components/layout/website-43/Website43Navbar', { Website43Navbar: () => null }],
    ['@/lib/analytics', { trackEvent: () => assert.fail('SSR must not emit analytics') }],
  ]) });
  const tree = await resolveServer(await featureModule.renderFinancialHealthCheckPage(values));
  const html = renderToStaticMarkup(React.createElement(provider.PublicCopyProvider, { values }, tree));
  const document = new JSDOM(html).window.document;
  const visible = [...document.querySelectorAll('section[aria-labelledby="fhc-faq-title"] details')].map(detail => ({ question: detail.querySelector('summary').textContent, answer: detail.querySelector('p').textContent }));
  const expected = [1, 2, 3].map(index => ({ question: values[`fhc.faq${index}.question`], answer: values[`fhc.faq${index}.answer`] }));
  assert.deepEqual(visible, expected, 'All three approved or CMS-overridden questions/answers remain visible');
  const schemas = [...document.querySelectorAll('script[type="application/ld+json"]')].map(script => JSON.parse(script.textContent));
  const faqs = schemas.filter(schema => schema['@type'] === 'FAQPage');
  assert.equal(faqs.length, 1, 'Exactly one FAQ schema describes the visible FAQ');
  assert.deepEqual(faqs[0].mainEntity, visible.map(faq => ({ '@type': 'Question', name: faq.question, acceptedAnswer: { '@type': 'Answer', text: faq.answer } })), 'Actual SSR JSON-LD exactly matches every visible answer, including draft changes');
  assert.equal(featureModule.metadata.alternates.canonical, 'https://ccpun.com/tools/financial-health-check/');
}

console.log('PASS FHC SEO/GEO answerability regression');

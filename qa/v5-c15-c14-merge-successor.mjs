import { ownerReviewSourcePredecessor } from './v5-owner-review-source-successor.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { eyebrowHtmlPins } from './v5-eyebrow-html.mjs';
import { eyebrowSourceSuccessors } from './v5-eyebrow-proof.mjs';
import { websiteV5C14RenderPins } from './website-v5-c14-successor.mjs';

// Integration of C15 (eyebrow cleanup) onto the C12-C14 v5 head. Both branches were reviewed
// from the same base 457867b8, so C15.before === C14.before for every shared render case.
// These pins admit only the exact merged output: they peel off C15's own reviewed fragments
// and require the complete C14 render (or C14's source) underneath. Nothing else is normalized.
const sha = value => createHash('sha256').update(value).digest('hex');

/** Exact merged default renders (C14 render + C15 fragments) per shared golden case. */
export const c15OnC14RenderPins = Object.freeze({
  '1': 'a2818c445487716d568ba6817b61d96073b8ab853335aa90e9e8ad9c48b0f92e',
  '2': 'ebf0a4f91512a2ef0325bb8a2ef96cb0384636f92da97128cc7cbce8f092e4cd',
  '3': '9580645fe79efaf9eb3965d71ace782b6aea2b7778cb584a326819367077ffc5',
  '4': '99ca9068f56032d47d14e38614034f54776d9d628d9980d3b61f1220f918176a',
  // C14's v5 Article fixture; C15 adds only the normal "ขั้นต่อไป" h2 above its next-step cards.
  v5Article: '4e0f04594911dc443ebf6098962896db44d7c94c8d6ab68a245c6dad3a3a6b63',
});

const C15_ARTICLE_NEXT_STEP = Object.freeze([
  ['<div class="inner narrow"><h2 class="h2">ขั้นต่อไป</h2><div class="nextStep">', '<div class="inner narrow"><div class="nextStep">'],
]);

/** Default fixtures only: merged render -> exact C14 render. Unknown output is returned untouched for C14 to reject. */
export function inverseC15OnC14Html(html, index) {
  const key = String(index);
  if (!Object.hasOwn(c15OnC14RenderPins, key) || sha(html) !== c15OnC14RenderPins[key]) return html;
  const replacements = key === 'v5Article' ? C15_ARTICLE_NEXT_STEP : eyebrowHtmlPins[key].replacements;
  for (const [now, before] of replacements) {
    assert.equal(html.split(now).length, 2, 'C15-on-C14 exact unique fragment');
    html = html.replace(now, before);
  }
  assert.equal(sha(html), websiteV5C14RenderPins[key].after, 'C15-on-C14 reconstructs the entire C14 render');
  return html;
}

const ARTICLE = 'features/blog/v5/V5Article.tsx';
const ARTICLE_MERGED = '5882c19a0704e82b3184524689e1c0d7e585b7259441cde3770819c260b142c5';
const ARTICLE_C14 = 'cc3e24a3a59e91ecf7c41fee41a64782a8844add2d13228aa5f8d8ffb355af74';
// C14's reviewed V5Article edits (article-dates), [merged text, C15-branch text].
const ARTICLE_C14_EDITS = Object.freeze([
  ['import V5ArticleEngagementMeta from "./V5ArticleEngagementMeta";\nimport { articleUpdatedOnLaterBangkokDay } from "./article-dates";\n',
    'import V5ArticleEngagementMeta from "./V5ArticleEngagementMeta";\n'],
  ['  const updated = articleUpdatedOnLaterBangkokDay(article.publishedAt, article.updatedAt)\n    ? thaiDate.format(new Date(article.updatedAt!)) : null;\n',
    '  const optimized = article.optimizedAt && Number.isFinite(Date.parse(article.optimizedAt)) ? thaiDate.format(new Date(article.optimizedAt)) : null;\n'],
  ['{updated && <span>{text.node("blog.date.updated")} <time dateTime={article.updatedAt}>{updated}</time></span>}',
    '{optimized && <span>{text.node("blog.articleDateLabel2")} <time dateTime={article.optimizedAt}>{optimized}</time></span>}'],
]);

/** Merged source -> exact C15 branch source (for C15's own pins). Unknown source is returned untouched. */
export function c15SourceFromMerge(file, source) {
  source = ownerReviewSourcePredecessor(file, source);
  if (file !== ARTICLE || sha(source) !== ARTICLE_MERGED) return source;
  for (const [merged, prior] of ARTICLE_C14_EDITS) {
    assert.equal(source.split(merged).length, 2, 'C15-on-C14 exact unique source edit');
    source = source.replace(merged, prior);
  }
  assert.equal(sha(source), eyebrowSourceSuccessors[ARTICLE].after, 'C15-on-C14 reconstructs the exact C15 source');
  return source;
}

/** Merged source -> exact C14 source: removes only C15's reviewed fragment. */
export function c14SourceFromMerge(file, source) {
  source = ownerReviewSourcePredecessor(file, source);
  if (file !== ARTICLE || sha(source) !== ARTICLE_MERGED) return source;
  for (const [before, after] of eyebrowSourceSuccessors[ARTICLE].replacements) {
    assert.equal(source.split(after).length, 2, 'C15-on-C14 exact unique source fragment');
    source = source.replace(after, before);
  }
  assert.equal(sha(source), ARTICLE_C14, 'C15-on-C14 reconstructs the exact C14 source');
  return source;
}

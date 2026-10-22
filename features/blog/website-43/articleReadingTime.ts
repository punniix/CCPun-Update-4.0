import type { Article, ArticleBlock, ArticleRichText } from '@/lib/content/types';

function richText(text: ArticleRichText): string {
  return text.segments?.length ? text.segments.map((segment) => segment.text).join(' ') : text.text;
}

function blockText(block: ArticleBlock): string {
  switch (block.type) {
    case 'paragraph':
    case 'heading':
    case 'quote':
      return richText(block);
    case 'bulletList':
    case 'numberList':
      return block.items.map((item) => typeof item === 'string' ? item : richText(item)).join(' ');
    case 'callout':
      return [block.title, block.text].filter(Boolean).join(' ');
    case 'table':
      return [...block.headers, ...block.rows.flat()].join(' ');
    case 'image':
      return block.caption ?? '';
    case 'gallery':
      return block.images.map((image) => image.caption ?? '').join(' ');
    case 'details':
      return [block.summary, block.text].join(' ');
    case 'cta':
      return block.label;
    case 'pdf':
      return [block.title, block.description].filter(Boolean).join(' ');
    case 'signatureEditorial':
      return [block.title,block.description,block.firstLabel,block.secondLabel,block.takeaway,...block.entries.map(e=>e.label+' '+e.value)].filter(Boolean).join(' ');
    case 'signatureStructuredTable':
      return [block.title,...block.headers,...block.rows.flat(),block.takeaway].filter(Boolean).join(' ');
    case 'signaturePlanExplorer':
      return [block.title,...block.plans.flatMap(p=>[p.name,p.headline,...p.benefits.map(b=>b.label+' '+b.value)])].filter(Boolean).join(' ');
    case 'divider':
      return '';
  }
}

/** Thai ICU word-like segments; server-rendered and updated whenever Sanity content changes. */
export function estimateArticleReadingMinutes(article: Pick<Article, 'body' | 'faq'>): number {
  const bodyText = article.body.map(blockText).join(' ');
  const faqText = (article.faq ?? []).map(({ question, answer }) => question + ' ' + answer).join(' ');
  const text = (bodyText + ' ' + faqText).trim();
  if (!text) return 1;
  const words = [...new Intl.Segmenter('th', { granularity: 'word' }).segment(text)]
    .filter((part) => part.isWordLike).length;
  return Math.max(1, Math.ceil(words / 220));
}

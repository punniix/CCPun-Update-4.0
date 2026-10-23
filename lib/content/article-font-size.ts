/**
 * Font-size marks an editor can put on text inside an article body
 * (Portable Text decorators). The mark values are persisted in Sanity, so
 * never rename them. Sizes are relative (em) to the surrounding text, so the
 * same mark works in a paragraph, heading or list on every screen size.
 */
export const ARTICLE_FONT_SIZES = {
  fontSmall: { size: "small", title: "ตัวเล็ก", em: 0.875, lineHeight: undefined },
  fontLarge: { size: "large", title: "ตัวใหญ่", em: 1.2, lineHeight: 1.5 },
  fontXLarge: { size: "xlarge", title: "ตัวใหญ่พิเศษ", em: 1.45, lineHeight: 1.4 },
} as const;

export type ArticleFontSizeMark = keyof typeof ARTICLE_FONT_SIZES;
export type ArticleFontSize = (typeof ARTICLE_FONT_SIZES)[ArticleFontSizeMark]["size"];

const BY_SIZE = Object.fromEntries(Object.values(ARTICLE_FONT_SIZES).map((entry) => [entry.size, entry])) as Record<ArticleFontSize, (typeof ARTICLE_FONT_SIZES)[ArticleFontSizeMark]>;

/** If a span carries more than one size mark, the largest one wins. */
export function articleFontSizeFromMarks(marks: readonly string[]): ArticleFontSize | undefined {
  let chosen: (typeof ARTICLE_FONT_SIZES)[ArticleFontSizeMark] | undefined;
  for (const mark of marks) {
    const entry = Object.hasOwn(ARTICLE_FONT_SIZES, mark) ? ARTICLE_FONT_SIZES[mark as ArticleFontSizeMark] : undefined;
    if (entry && (!chosen || entry.em > chosen.em)) chosen = entry;
  }
  return chosen?.size;
}

export function articleFontSizeStyle(size: ArticleFontSize | undefined): { fontSize: string; lineHeight?: number } | undefined {
  const entry = size ? BY_SIZE[size] : undefined;
  if (!entry) return undefined;
  return entry.lineHeight ? { fontSize: `${entry.em}em`, lineHeight: entry.lineHeight } : { fontSize: `${entry.em}em` };
}

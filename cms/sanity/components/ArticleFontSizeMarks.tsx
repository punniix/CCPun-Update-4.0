import type { BlockDecoratorProps } from "sanity";
import { ARTICLE_FONT_SIZES, articleFontSizeStyle, type ArticleFontSizeMark } from "../../../lib/content/article-font-size";

/**
 * Toolbar icons and in-editor rendering for the article-body font-size marks,
 * so editors see the size in Studio exactly as the article will show it.
 */
function icon(label: string, fontSize: string) {
  function FontSizeIcon() {
    return <span aria-hidden style={{ display: "inline-block", minWidth: "1.6em", textAlign: "center", fontWeight: 600, fontSize, lineHeight: 1 }}>{label}</span>;
  }
  return FontSizeIcon;
}

function decorator(mark: ArticleFontSizeMark) {
  function FontSizeDecorator({ children }: BlockDecoratorProps) {
    return <span style={articleFontSizeStyle(ARTICLE_FONT_SIZES[mark].size)}>{children}</span>;
  }
  return FontSizeDecorator;
}

const ICONS: Record<ArticleFontSizeMark, { label: string; fontSize: string }> = {
  fontSmall: { label: "ก-", fontSize: "11px" },
  fontLarge: { label: "ก+", fontSize: "14px" },
  fontXLarge: { label: "ก++", fontSize: "16px" },
};

export const articleFontSizeDecorators = (Object.keys(ARTICLE_FONT_SIZES) as ArticleFontSizeMark[]).map((mark) => ({
  title: ARTICLE_FONT_SIZES[mark].title,
  value: mark,
  icon: icon(ICONS[mark].label, ICONS[mark].fontSize),
  component: decorator(mark),
}));

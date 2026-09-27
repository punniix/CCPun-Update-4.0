import type { Article } from "../content/types";
import { getArticlePath } from "../content/url";
import type { LineJourneyId } from "./ecosystem";

export const LINE_DISCOVERY_CONFIG: Record<
  LineJourneyId,
  {
    label: string;
    campaign: string;
    articleSlugs: readonly string[];
    maxCards: number;
  }
> = {
  life_health_policy_review: {
    label: "ประกันชีวิต",
    campaign: "rich_menu_v3_life",
    articleSlugs: [
      "critical-illness-insurance",
      "aia-health-ci-hero-guide",
      "aia-senior-happy",
    ],
    maxCards: 3,
  },
  motor_quote_review: {
    label: "ประกันรถ",
    campaign: "rich_menu_v3_motor",
    articleSlugs: ["car-insurance-types"],
    maxCards: 3,
  },
  investment_before_you_act: {
    label: "เรื่องลงทุน",
    campaign: "rich_menu_v3_investment",
    // No published Investment-category article exists yet. Financial Pyramid is
    // an approved published bridge article until the Investment pillar is live.
    articleSlugs: ["financial-pyramid"],
    maxCards: 3,
  },
};

export type LineDiscoverySelection = {
  maxCards: number;
  items: Array<{ slug: string; enabled: boolean }>;
};

export type LineArticleCardSource = Pick<
  Article,
  | "slug"
  | "title"
  | "excerpt"
  | "lineTitle"
  | "lineDescription"
  | "category"
  | "categorySlug"
  | "status"
  | "noindex"
  | "featuredImage"
>;

function trimCardText(value: string, max: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  const graphemes = [...new Intl.Segmenter("th", { granularity: "grapheme" }).segment(normalized)]
    .map(({ segment }) => segment);
  if (graphemes.length <= max) return normalized;
  return `${graphemes.slice(0, Math.max(1, max - 1)).join("").trimEnd()}…`;
}

export function buildLineArticleUrl(
  article: Pick<Article, "slug" | "category" | "categorySlug">,
  journey: LineJourneyId,
) {
  const config = LINE_DISCOVERY_CONFIG[journey];
  const url = new URL(`https://ccpun.com${getArticlePath(article)}`);
  url.searchParams.set("utm_source", "line");
  url.searchParams.set("utm_medium", "flex_message");
  url.searchParams.set("utm_campaign", config.campaign);
  url.searchParams.set("utm_content", article.slug);
  return url.toString();
}

function articleBubble(journey: LineJourneyId, article: LineArticleCardSource) {
  const config = LINE_DISCOVERY_CONFIG[journey];
  const bodyContents: Record<string, unknown>[] = [
    {
      type: "text",
      text: config.label,
      size: "xs",
      weight: "bold",
      color: "#E0C985",
    },
    {
      type: "text",
      text: trimCardText(article.lineTitle?.trim() || article.title, 60),
      size: "lg",
      weight: "bold",
      color: "#FAF9F9",
      wrap: true,
      margin: "md",
      maxLines: 2,
    },
    {
      type: "text",
      text: trimCardText(article.lineDescription?.trim() || article.excerpt || article.title, 90),
      size: "sm",
      color: "#BAABAB",
      wrap: true,
      margin: "md",
      maxLines: 2,
    },
  ];

  const bubble: Record<string, unknown> = {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#352727",
      paddingAll: "16px",
      contents: bodyContents,
    },
    footer: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#352727",
      paddingAll: "16px",
      paddingTop: "0px",
      contents: [
        {
          type: "button",
          style: "link",
          height: "sm",
          color: "#E0C985",
          action: {
            type: "uri",
            label: "อ่านต่อบน CCPun",
            uri: buildLineArticleUrl(article, journey),
          },
        },
      ],
    },
  };

  if (article.featuredImage?.src?.startsWith("https://")) {
    bubble.hero = {
      type: "image",
      url: article.featuredImage.src,
      size: "full",
      aspectRatio: "1.91:1",
      aspectMode: "cover",
    };
  }

  return bubble;
}

export function selectLineDiscoveryArticles(
  journey: LineJourneyId,
  articles: readonly LineArticleCardSource[],
  selection?: LineDiscoverySelection,
) {
  const config = LINE_DISCOVERY_CONFIG[journey];
  const bySlug = new Map(
    articles
      .filter((article) => article.status === "published" && article.noindex !== true)
      .map((article) => [article.slug, article] as const),
  );
  const slugs = selection
    ? selection.items.filter((item) => item.enabled).map((item) => item.slug)
    : config.articleSlugs;
  const maxCards = selection?.maxCards ?? config.maxCards;
  return slugs
    .map((slug) => bySlug.get(slug))
    .filter((article): article is LineArticleCardSource => Boolean(article))
    .slice(0, maxCards);
}

export function buildLineArticleFlexMessage(
  journey: LineJourneyId,
  articles: readonly LineArticleCardSource[],
  selection?: LineDiscoverySelection,
) {
  const selected = selectLineDiscoveryArticles(journey, articles, selection);
  if (selected.length === 0) return null;

  return {
    type: "flex",
    altText: `${LINE_DISCOVERY_CONFIG[journey].label} — เรื่องที่น่าอ่านจาก CCPun`,
    contents: {
      type: "carousel",
      contents: selected.map((article) => articleBubble(journey, article)),
    },
  } as const;
}

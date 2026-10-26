import type { Article } from "../content/types";
import { getArticleCategorySlug, getArticlePath, isArticleCanonicalAligned } from "../content/url";
import { articleBelongsToPhysicalCategory } from "../content/category-registry";
import type { LineJourneyId } from "./ecosystem";

export const LINE_DISCOVERY_CONFIG: Record<
  LineJourneyId,
  {
    label: string;
    campaign: string;
    articleSlugs: readonly string[];
    categorySlugs: readonly string[];
    maxCards: number;
  }
> = {
  life_health_policy_review: {
    label: "ประกันชีวิต",
    campaign: "rich_menu_v3_life",
    categorySlugs: ["life-insurance", "health-insurance", "critical-illness-insurance"],
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
    categorySlugs: ["motor-insurance"],
    articleSlugs: ["car-insurance-types"],
    maxCards: 3,
  },
  investment_before_you_act: {
    label: "เรื่องลงทุน",
    campaign: "rich_menu_v3_investment",
    categorySlugs: ["investment"],
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
> & Partial<Pick<Article, "id" | "publishedAt" | "canonical">>;

export function trimCardText(value: string, max: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (max < 1) return "";
  const graphemes = [...new Intl.Segmenter("th", { granularity: "grapheme" }).segment(normalized)]
    .map(({ segment }) => segment);
  if (graphemes.length <= max) return normalized;
  const prefix = graphemes.slice(0, max).join("");
  let boundary = 0;
  for (const word of new Intl.Segmenter("th", { granularity: "word" }).segment(normalized)) {
    const end = word.index + word.segment.length;
    if (end > prefix.length) break;
    if (word.isWordLike) boundary = end;
  }
  // A single word longer than the card limit still needs non-empty Flex text.
  return (boundary ? normalized.slice(0, boundary) : prefix).trimEnd();
}

/** Keep the original asset path; request JPEG bytes rather than auto WebP. */
export function buildLineArticleImageUrl(src?: string) {
  if (!src) return null;
  try {
    const url = new URL(src);
    if (!["http:", "https:"].includes(url.protocol)
      || url.hostname !== "cdn.sanity.io"
      || url.username || url.password || url.port) return null;
    url.protocol = "https:";
    url.searchParams.delete("auto");
    url.searchParams.set("fm", "jpg");
    url.searchParams.set("w", "1040");
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
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
  const bodyContents: Record<string, unknown>[] = [
    {
      type: "text",
      text: article.category,
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
      text: trimCardText(article.lineDescription?.trim() || article.excerpt?.trim() || article.title, 90),
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

  const imageUrl = buildLineArticleImageUrl(article.featuredImage?.src);
  if (imageUrl) {
    bubble.hero = {
      type: "image",
      url: imageUrl,
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
  now = Date.now(),
) {
  const config = LINE_DISCOVERY_CONFIG[journey];
  const bySlug = new Map(
    articles
      .filter((article) => article.status === "published" && article.noindex !== true
        && !article.id?.startsWith("drafts.")
        && (!article.publishedAt || (Number.isFinite(Date.parse(article.publishedAt))
          && Date.parse(article.publishedAt) <= now)))
      .map((article) => [article.slug, article] as const),
  );
  const maxCards = selection?.maxCards ?? config.maxCards;
  if (selection?.items.length === 0) {
    return [...bySlug.values()]
      .filter((article) => {
        // Reuse the public indexability/URL contract without changing public policy.
        if (!article.publishedAt || !isArticleCanonicalAligned(article)) return false;
        const categorySlug = getArticleCategorySlug(article);
        return config.categorySlugs.some((slug) =>
          articleBelongsToPhysicalCategory({ ...article, categorySlug }, { slug }));
      })
      .sort((left, right) => Date.parse(right.publishedAt!) - Date.parse(left.publishedAt!))
      .slice(0, maxCards);
  }
  const slugs = selection
    ? selection.items.filter((item) => item.enabled).map((item) => item.slug)
    : config.articleSlugs;
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

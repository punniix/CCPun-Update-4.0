export const ACTIVE_ARTICLE_CATEGORIES = [
  { slug: "personal-finance", title: "การเงินส่วนบุคคล" },
  { slug: "life-insurance", title: "ประกันชีวิต" },
  { slug: "health-insurance", title: "ประกันสุขภาพ" },
  { slug: "critical-illness-insurance", title: "ประกันโรคร้ายแรง" },
  { slug: "motor-insurance", title: "ประกันรถยนต์" },
  { slug: "investment", title: "การลงทุน" },
] as const;

export const BLOG_TOPIC_HUBS = [
  {
    slug: "personal-finance",
    title: "การเงินส่วนบุคคล",
    seoTitle: "การเงินส่วนบุคคล | วางรากฐานการเงินให้มั่นคง | CCPun",
    description: "รวมบทความการเงินส่วนบุคคล ตั้งแต่เงินสำรอง กระแสเงินสด การจัดการความเสี่ยง ไปจนถึงการวางรากฐานก่อนเริ่มลงทุน",
    eyebrow: "Personal Finance",
    intro: [
      "การเงินส่วนบุคคลที่แข็งแรงไม่ได้เริ่มจากการเลือกสินค้าที่ให้ผลตอบแทนสูงที่สุด แต่เริ่มจากการจัดลำดับเงินสำรอง ภาระหนี้ ความเสี่ยง และเป้าหมายให้ทำงานร่วมกันได้",
      "หัวข้อนี้รวบรวมแนวคิดและเครื่องมือที่ช่วยมองภาพรวมก่อนตัดสินใจเรื่องประกันหรือการลงทุน เพื่อให้แต่ละแผนไม่แย่งกระแสเงินสดกันในระยะยาว",
    ],
    indexable: true,
  },
  {
    slug: "life-insurance",
    title: "ประกันชีวิต",
    seoTitle: "ประกันชีวิต | วางแผนความคุ้มครองและคนข้างหลัง | CCPun",
    description: "รวมบทความประกันชีวิต การวางทุนความคุ้มครอง การส่งต่อ และแนวคิดเลือกแบบประกันให้สัมพันธ์กับแผนการเงินระยะยาว",
    eyebrow: "Life Insurance",
    intro: [
      "ประกันชีวิตมีหน้าที่หลักในการช่วยจัดการผลกระทบทางการเงินเมื่อรายได้หรือคนสำคัญของครอบครัวหายไป จึงควรเริ่มจากภาระและเป้าหมายที่ต้องการปกป้องก่อนเลือกแบบประกัน",
      "ในหมวดนี้จะรวมเนื้อหาที่เกี่ยวกับความคุ้มครองชีวิต การวางแผนระยะยาว และองค์ประกอบที่เชื่อมประกันเข้ากับภาพการเงินโดยรวม",
    ],
    indexable: true,
  },
  {
    slug: "health-insurance",
    title: "ประกันสุขภาพ",
    seoTitle: "ประกันสุขภาพ | วางแผนค่ารักษาและเลือกความคุ้มครอง | CCPun",
    description: "รวมบทความประกันสุขภาพ ค่ารักษาพยาบาล วงเงิน ความคุ้มครอง ค่าใช้จ่ายร่วม และแนวคิดเลือกแผนให้เหมาะกับสิทธิที่มีอยู่",
    eyebrow: "Health Insurance",
    intro: [
      "ประกันสุขภาพช่วยบริหารความเสี่ยงจากค่ารักษาพยาบาล แต่แผนที่เหมาะไม่ได้ดูจากวงเงินสูงสุดเพียงอย่างเดียว ควรดูสิทธิเดิม โรงพยาบาลที่ใช้ เงื่อนไข และค่าใช้จ่ายที่เรารับเองได้ร่วมกัน",
      "หน้านี้รวบรวมบทความที่มีโจทย์หลักเกี่ยวกับประกันสุขภาพ เพื่อให้ตามอ่านเรื่องวงเงิน ความคุ้มครอง สวัสดิการ และการเลือกแผนที่สัมพันธ์กับสถานการณ์ของตัวเองได้ง่ายขึ้น",
    ],
    indexable: true,
  },
  {
    slug: "critical-illness-insurance",
    title: "ประกันโรคร้ายแรง",
    seoTitle: "ประกันโรคร้ายแรง | วางแผนเงินก้อนเมื่อเจ็บป่วย | CCPun",
    description: "รวมบทความประกันโรคร้ายแรง ความต่างจากประกันสุขภาพ และแนวทางประเมินเงินก้อนเพื่อรองรับรายได้และค่าใช้จ่ายนอกโรงพยาบาล",
    eyebrow: "Critical Illness",
    intro: [
      "ประกันโรคร้ายแรงต่างจากประกันสุขภาพตรงที่โจทย์สำคัญไม่ได้มีเพียงค่ารักษาในโรงพยาบาล แต่ยังรวมถึงรายได้ที่อาจหยุด ค่าเดินทาง การพักฟื้น และภาระทางการเงินของครอบครัว",
      "หมวดนี้จึงเชื่อมบทความความรู้กับเครื่องมือ CI Planning เพื่อช่วยประมาณโจทย์เงินก้อนก่อนนำไปพิจารณาความคุ้มครองที่เหมาะกับสถานการณ์ของแต่ละคน",
    ],
    indexable: true,
    featuredLink: {
      href: "/ci-planning/",
      title: "CI Planning — เครื่องมือวางแผนทุนประกันโรคร้ายแรง",
      description: "ลองประเมินภาระรายได้ ค่าใช้จ่าย หนี้ และทรัพย์สินสภาพคล่อง เพื่อเห็นกรอบทุนที่ควรนำไปวางแผนต่อ",
      label: "ลองใช้ CI Planning",
    },
  },
  {
    slug: "investment",
    title: "การลงทุน",
    seoTitle: "การลงทุน | วางแผนลงทุนตามเป้าหมาย | CCPun",
    description: "พื้นที่รวมบทความการลงทุน การจัดพอร์ต ความเสี่ยง และการลงทุนตามเป้าหมายทางการเงินจาก CCPun",
    eyebrow: "Investment Planning",
    intro: [
      "การลงทุนควรเริ่มจากเป้าหมาย ระยะเวลา สภาพคล่อง และความเสี่ยงที่รับได้ ไม่ใช่เริ่มจากการเลือกสินทรัพย์เพียงอย่างเดียว",
      "พื้นที่นี้กำลังทยอยจัดทำบทความเพื่อเชื่อมการเลือกสินทรัพย์ การจัดพอร์ต และการลงทุนตามเป้าหมายให้เป็นระบบเดียวกัน",
    ],
    indexable: false,
  },
] as const;

export type BlogTopicSlug = (typeof BLOG_TOPIC_HUBS)[number]["slug"];
export type BlogTopicHub = (typeof BLOG_TOPIC_HUBS)[number];

type ArticleTaxonomyInput = {
  categoryTitle?: string | null;
  categorySlug?: string | null;
  tags?: readonly string[] | null;
};

type ArticleSemanticTopicInput = ArticleTaxonomyInput & {
  articleSlug?: string | null;
  semanticTopic?: string | null;
};

type NormalizedArticleTaxonomy = {
  categorySlug: string | null;
  tags: string[];
};

const activeSlugByTitle = new Map<string, string>(ACTIVE_ARTICLE_CATEGORIES.map(({ title, slug }) => [title, slug]));
const activeSlugs = new Set<string>(ACTIVE_ARTICLE_CATEGORIES.map(({ slug }) => slug));
const hubBySlug = new Map<string, BlogTopicHub>(BLOG_TOPIC_HUBS.map((hub) => [hub.slug, hub] as const));

const CATEGORY_SLUG_ALIASES: Record<string, string> = {
  "personal-finance-uat": "personal-finance",
  "critical-illness": "critical-illness-insurance",
};

export const LEGACY_CATEGORY_TOPICS = {
  "health-insurance": "ประกันสุขภาพ",
  "critical-illness": "ประกันโรคร้ายแรง",
} as const;

const LEGACY_TOPIC_BY_TITLE: Record<string, string> = {
  "ประกันสุขภาพ": "ประกันสุขภาพ",
  "ประกันโรคร้ายแรง": "ประกันโรคร้ายแรง",
};

const TOPIC_SLUG_BY_TAG: Record<string, BlogTopicSlug> = {
  "ประกันชีวิต": "life-insurance",
  "ประกันสุขภาพ": "health-insurance",
  "ประกันโรคร้ายแรง": "critical-illness-insurance",
};

// Protected semantic identity is independent from editor metadata. Health Happy
// and Health CI Hero own Health physical/canonical URLs. The approved Critical
// Illness migration now gives the lump-sum topic its own physical category while
// preserving the legacy topic slug as an alias during migration.
const ARTICLE_SEMANTIC_TOPIC_OVERRIDES: Record<string, BlogTopicSlug> = {
  "aia-health-happy-describe": "health-insurance",
  "aia-health-ci-hero-guide": "health-insurance",
  "critical-illness-insurance": "critical-illness-insurance",
  "what-is-critical-illness-insurance": "critical-illness-insurance",
  "aia-vitality": "life-insurance",
};

function normalizeTags(tags: readonly string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of tags) {
    const displayTag = tag.trim();
    const dedupeKey = displayTag.toLowerCase();
    if (!displayTag || seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    normalized.push(displayTag);
  }

  return normalized;
}

export function normalizeArticleTaxonomy({
  categoryTitle,
  categorySlug,
  tags,
}: ArticleTaxonomyInput): NormalizedArticleTaxonomy {
  const title = categoryTitle?.trim() ?? "";
  const suppliedSlug = categorySlug?.trim().toLowerCase() ?? "";
  const slug = CATEGORY_SLUG_ALIASES[suppliedSlug] ?? suppliedSlug;
  const legacySlugTopic = LEGACY_CATEGORY_TOPICS[slug as keyof typeof LEGACY_CATEGORY_TOPICS];
  const legacyTitleTopic = LEGACY_TOPIC_BY_TITLE[title];
  const combinedLegacyTitle = title === "ประกันสุขภาพและโรคร้ายแรง";
  const slugCategory = activeSlugs.has(slug) ? slug : legacySlugTopic ? "life-insurance" : null;
  const titleCategory = activeSlugByTitle.get(title) ?? (legacyTitleTopic || combinedLegacyTitle ? "life-insurance" : null);
  const categoryConflict = Boolean(slugCategory && titleCategory && slugCategory !== titleCategory && !combinedLegacyTitle);
  const inheritedTopics = legacySlugTopic
    ? [legacySlugTopic]
    : combinedLegacyTitle
      ? Object.values(LEGACY_CATEGORY_TOPICS)
      : legacyTitleTopic
        ? [legacyTitleTopic]
        : [];
  const resolvedCategory = combinedLegacyTitle
    ? "life-insurance"
    : categoryConflict
      ? null
      : slugCategory ?? titleCategory;

  return {
    categorySlug: resolvedCategory,
    tags: normalizeTags([...(tags ?? []), ...inheritedTopics]),
  };
}

export function getBlogTopicHub(slug?: string | null): BlogTopicHub | null {
  if (!slug) return null;
  return hubBySlug.get(slug) ?? null;
}

export function getArticleSemanticTopic({
  articleSlug,
  semanticTopic,
  categoryTitle,
  categorySlug,
  tags,
}: ArticleSemanticTopicInput): BlogTopicHub | null {
  const override = articleSlug ? ARTICLE_SEMANTIC_TOPIC_OVERRIDES[articleSlug] : undefined;
  if (override) return hubBySlug.get(override) ?? null;

  const explicitTopic = semanticTopic?.trim().toLowerCase();
  if (explicitTopic) {
    const normalizedExplicitTopic = CATEGORY_SLUG_ALIASES[explicitTopic] ?? explicitTopic;
    const explicitHub = hubBySlug.get(normalizedExplicitTopic);
    if (explicitHub) return explicitHub;
  }

  const normalized = normalizeArticleTaxonomy({ categoryTitle, categorySlug, tags });
  const primarySlug = normalized.categorySlug as BlogTopicSlug | null;
  if (primarySlug && primarySlug !== "life-insurance") {
    const primaryHub = hubBySlug.get(primarySlug);
    if (primaryHub) return primaryHub;
  }

  const inferred = new Set<BlogTopicSlug>();
  for (const tag of normalized.tags) {
    const topic = TOPIC_SLUG_BY_TAG[tag];
    if (topic && topic !== primarySlug) inferred.add(topic);
  }
  if (inferred.size === 1) return hubBySlug.get([...inferred][0]) ?? null;

  if (primarySlug) return hubBySlug.get(primarySlug) ?? null;
  return null;
}

export function isArticleInSemanticTopic(input: ArticleSemanticTopicInput, topicSlug: BlogTopicSlug) {
  return getArticleSemanticTopic(input)?.slug === topicSlug;
}

export function isReservedArticleSlug(slug?: string | null) {
  return Boolean(slug && (Object.hasOwn(LEGACY_CATEGORY_TOPICS, slug) || hubBySlug.has(slug)));
}

import "server-only";

import { createClient, groq } from "next-sanity";
import { z } from "zod";
import type { Article, ArticleBlock, ContentProvider } from "./types";
import { sanityFetch } from "@/lib/sanity-live";
import { isSanityLaneAllowed } from "@/lib/admin/environment";
import { getAdminSanityReadToken } from "@/lib/admin/sanity-credentials";
import { IS_DRAFT_PREVIEW_ALLOWED } from "@/lib/deployment-environment";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = getAdminSanityReadToken();

export const hasSanityConfig = Boolean(projectId && dataset && isSanityLaneAllowed(dataset));

const client = hasSanityConfig
  ? createClient({
      projectId: projectId!,
      dataset: dataset!,
      apiVersion: "2026-08-18",
      useCdn: false,
      stega: { enabled: false, studioUrl: "/studio" },
    })
  : null;

const spanSchema = z.object({ text: z.string(), marks: z.array(z.string()).nullish() });
const linkMarkSchema = z.object({
  _key: z.string(),
  _type: z.literal("link"),
  href: z.string().min(1).refine((value) => /^(https?:\/\/|\/(?!\/)|#|mailto:|tel:)/.test(value)),
  openInNewTab: z.boolean().nullish(),
  nofollow: z.boolean().nullish(),
  sponsored: z.boolean().nullish(),
});
const portableBlockSchema = z.object({
  _type: z.literal("block"),
  style: z.string().nullish(),
  listItem: z.string().nullish(),
  children: z.array(spanSchema),
  markDefs: z.array(linkMarkSchema).nullish(),
});
const calloutSchema = z.object({ _type: z.literal("callout"), title: z.string().nullish(), text: z.string() });
const migratedImageSchema = z.object({
  _type: z.literal("migratedImage"),
  src: z.string().min(1),
  alt: z.string().min(1),
  width: z.number().positive(),
  height: z.number().positive(),
  caption: z.string().nullish(),
});
const renderedImageSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  width: z.number().positive(),
  height: z.number().positive(),
  caption: z.string().nullish(),
  credit: z.string().nullish(),
});
const inlineImageSchema = renderedImageSchema.extend({ _type: z.literal("imageWithAlt") });
const imageGallerySchema = z.object({ _type: z.literal("imageGallery"), images: z.array(renderedImageSchema).min(2).max(12) });
const ctaBlockSchema = z.object({
  _type: z.literal("ctaBlock"),
  label: z.string().min(1).max(80),
  url: z.string().refine((value) => /^(https?:\/\/|\/(?!\/))/.test(value)),
  style: z.enum(["primary", "secondary"]),
  openInNewTab: z.boolean().nullish(),
});
const pdfDownloadSchema = z.object({
  _type: z.literal("pdfDownload"),
  title: z.string().min(1).max(120),
  description: z.string().nullish(),
  file: z.object({
    url: z.string().url(),
    filename: z.string().nullish(),
    mimeType: z.literal("application/pdf"),
    size: z.number().nonnegative().nullish(),
  }),
});
const detailsBlockSchema = z.object({ _type: z.literal("detailsBlock"), summary: z.string().min(1), text: z.string().min(1) });
const legacyTableRowSchema = z.array(z.string());
const tableRowSchema = z.object({
  _type: z.literal("tableRow"),
  _key: z.string().nullish(),
  cells: z.array(z.string()),
});
const simpleTableSchema = z.object({
  _type: z.literal("simpleTable"),
  headers: z.array(z.string()).nullish(),
  rows: z.array(z.union([legacyTableRowSchema, tableRowSchema])).nullish(),
});
const dividerSchema = z.object({ _type: z.literal("divider") });
const bodyItemSchema = z.union([
  portableBlockSchema,
  calloutSchema,
  inlineImageSchema,
  imageGallerySchema,
  ctaBlockSchema,
  pdfDownloadSchema,
  detailsBlockSchema,
  migratedImageSchema,
  simpleTableSchema,
  dividerSchema,
]);
const faqItemSchema = z.object({ question: z.string().min(1), answer: z.string().min(1) });

// A draft can contain an unfinished Studio block. It must not turn Preview into a 500.
function parseRenderableBodyItems(items: unknown[]): PortableBodyItem[] {
  return items.flatMap((item) => {
    const parsed = bodyItemSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

function parseRenderableFaqItems(items: unknown[]) {
  return items.flatMap((item) => {
    const parsed = faqItemSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

const rawArticleSchema = z.object({
  _id: z.string(),
  _originalId: z.string().nullish(),
  slug: z.string().min(1),
  title: z.string().min(1),
  excerpt: z.string().min(1).nullish(),
  category: z.string().min(1),
  categorySlug: z.string().min(1).nullish(),
  tags: z.array(z.string()).nullish(),
  authorName: z.string().min(1),
  author: z.object({
    name: z.string().min(1),
    profileName: z.string().min(1).nullish().catch(undefined),
    profileRole: z.string().min(1).nullish().catch(undefined),
    profileBio: z.string().min(1).nullish().catch(undefined),
    profileCtaLabel: z.string().min(1).nullish().catch(undefined),
    profileCtaUrl: z.string().refine((value) => /^(https?:\/\/|\/(?!\/)|#)/.test(value)).nullish().catch(undefined),
    profileAvatar: z.object({
      src: z.string().min(1),
      alt: z.string().min(1),
      width: z.number().positive(),
      height: z.number().positive(),
    }).nullish().catch(undefined),
  }).nullish().catch(undefined),
  publishedAt: z.string().nullish(),
  updatedAt: z.string().min(1),
  seo: z.object({
    title: z.string().min(1).nullish(),
    description: z.string().min(1).nullish(),
    ogTitle: z.string().min(1).nullish(),
    ogDescription: z.string().min(1).nullish(),
    semanticTopic: z.string().min(1).nullish(),
    canonical: z.string().url().nullish(),
    noindex: z.boolean().nullish(),
  }).nullish(),
  ogImage: z.object({
    src: z.string().min(1),
    alt: z.string().min(1),
    width: z.number().positive(),
    height: z.number().positive(),
  }).nullish(),
  featuredImage: z
    .object({
      src: z.string().min(1),
      alt: z.string().min(1),
      width: z.number().positive(),
      height: z.number().positive(),
      caption: z.string().nullish(),
      credit: z.string().nullish(),
    })
    .nullish(),
  body: z.array(z.unknown()),
  faq: z.array(z.unknown()).nullish(),
  sources: z
    .array(
      z.object({
        label: z.string().min(1),
        url: z.string().url().nullish(),
        publisher: z.string().nullish(),
        accessedAt: z.string().nullish(),
      }),
    )
    .nullish(),
  review: z
    .object({
      status: z.enum(["drafting", "content-review", "fact-check", "compliance-review", "ready-for-coo", "approved"]).optional(),
      contentReviewedAt: z.string().nullish(),
      factCheckedAt: z.string().nullish(),
      complianceReviewedAt: z.string().nullish(),
    })
    .nullish(),
  geo: z
    .object({
      summary: z.string().nullish(),
      keyEntities: z.array(z.string()).nullish(),
      keyQuestions: z.array(z.string()).nullish(),
    })
    .nullish(),
});

type RawArticle = z.infer<typeof rawArticleSchema>;
type PortableBodyItem = z.infer<typeof bodyItemSchema>;

export function portableTextToArticleBlocks(items: PortableBodyItem[]): ArticleBlock[] {
  const result: ArticleBlock[] = [];
  let listType: "bulletList" | "numberList" | null = null;
  let listItems: Array<string | { text: string; segments?: Array<{ text: string; href?: string; strong?: boolean; emphasis?: boolean }> }> = [];

  const flushList = () => {
    if (listType && listItems.length) result.push({ type: listType, items: listItems });
    listType = null;
    listItems = [];
  };

  const richText = (item: Extract<PortableBodyItem, { _type: "block" }>) => {
    const markDefs = new Map((item.markDefs ?? []).map((mark) => [mark._key, mark]));
    const segments = item.children
      .filter((child) => child.text.length > 0)
      .map((child) => {
        const marks = child.marks ?? [];
        const linkKey = marks.find((mark) => markDefs.has(mark));
        return {
          text: child.text,
          ...(linkKey
            ? {
                href: markDefs.get(linkKey)?.href,
                openInNewTab: markDefs.get(linkKey)?.openInNewTab ?? undefined,
                nofollow: markDefs.get(linkKey)?.nofollow ?? undefined,
                sponsored: markDefs.get(linkKey)?.sponsored ?? undefined,
              }
            : {}),
          ...(marks.includes("strong") ? { strong: true } : {}),
          ...(marks.includes("em") ? { emphasis: true } : {}),
        };
      });
    const text = segments.map((segment) => segment.text).join("").trim();
    return { text, ...(segments.some((segment) => segment.href || segment.strong || segment.emphasis) ? { segments } : {}) };
  };

  for (const item of items) {
    if (item._type === "callout") {
      flushList();
      result.push({ type: "callout", title: item.title ?? undefined, text: item.text });
      continue;
    }
    if (item._type === "imageWithAlt" || item._type === "migratedImage") {
      flushList();
      result.push({
        type: "image",
        src: item.src,
        alt: item.alt,
        width: item.width,
        height: item.height,
        caption: item.caption ?? undefined,
        ...(item._type === "imageWithAlt" ? { credit: item.credit ?? undefined } : {}),
      });
      continue;
    }
    if (item._type === "imageGallery") {
      flushList();
      result.push({
        type: "gallery",
        images: item.images.map((image) => ({
          src: image.src,
          alt: image.alt,
          width: image.width,
          height: image.height,
          caption: image.caption ?? undefined,
          credit: image.credit ?? undefined,
        })),
      });
      continue;
    }
    if (item._type === "ctaBlock") {
      flushList();
      result.push({ type: "cta", label: item.label, url: item.url, style: item.style, openInNewTab: item.openInNewTab ?? undefined });
      continue;
    }
    if (item._type === "pdfDownload") {
      flushList();
      result.push({
        type: "pdf",
        title: item.title,
        description: item.description ?? undefined,
        url: item.file.url,
        filename: item.file.filename ?? undefined,
        size: item.file.size ?? undefined,
      });
      continue;
    }
    if (item._type === "detailsBlock") {
      flushList();
      result.push({ type: "details", summary: item.summary, text: item.text });
      continue;
    }
    if (item._type === "simpleTable") {
      flushList();
      result.push({
        type: "table",
        headers: item.headers ?? [],
        rows: (item.rows ?? []).map((row) => Array.isArray(row) ? row : row.cells),
      });
      continue;
    }
    if (item._type === "divider") {
      flushList();
      result.push({ type: "divider" });
      continue;
    }

    const rich = richText(item);
    if (!rich.text) continue;

    if (item.listItem === "bullet" || item.listItem === "number") {
      const nextType = item.listItem === "bullet" ? "bulletList" : "numberList";
      if (listType !== nextType) flushList();
      listType = nextType;
      listItems.push(rich);
      continue;
    }

    flushList();
    if (item.style === "h2" || item.style === "h3") {
      result.push({ type: "heading", level: item.style === "h2" ? 2 : 3, ...rich });
    } else if (item.style === "blockquote") {
      result.push({ type: "quote", ...rich });
    } else {
      result.push({ type: "paragraph", ...rich });
    }
  }

  flushList();
  return result;
}

function toArticle(rawInput: unknown): Article {
  const raw: RawArticle = rawArticleSchema.parse(rawInput);
  const originalId = raw._originalId ?? raw._id;
  const status = originalId.startsWith("drafts.") ? "draft" : "published";
  const body = status === "draft" ? parseRenderableBodyItems(raw.body) : z.array(bodyItemSchema).parse(raw.body);
  const faq = raw.faq
    ? status === "draft"
      ? parseRenderableFaqItems(raw.faq)
      : z.array(faqItemSchema).parse(raw.faq)
    : undefined;
  const excerpt = raw.excerpt?.trim();
  const seoTitle = raw.seo?.title?.trim();
  const seoDescription = raw.seo?.description?.trim();
  if (status === "published" && (!excerpt || !seoDescription)) {
    throw new Error("Published article is missing required SEO fields");
  }

  return {
    id: originalId,
    slug: raw.slug,
    title: raw.title,
    excerpt: excerpt || raw.title,
    category: raw.category,
    categorySlug: raw.categorySlug ?? undefined,
    tags: raw.tags ?? undefined,
    semanticTopic: raw.seo?.semanticTopic ?? undefined,
    authorName: raw.authorName,
    author: raw.author
      ? {
          name: raw.author.name,
          profileName: raw.author.profileName ?? undefined,
          profileRole: raw.author.profileRole ?? undefined,
          profileBio: raw.author.profileBio ?? undefined,
          profileCtaLabel: raw.author.profileCtaLabel ?? undefined,
          profileCtaUrl: raw.author.profileCtaUrl ?? undefined,
          profileAvatar: raw.author.profileAvatar ?? undefined,
        }
      : undefined,
    status,
    publishedAt: raw.publishedAt ?? undefined,
    updatedAt: raw.updatedAt,
    seoTitle: seoTitle || raw.title,
    seoDescription: seoDescription || excerpt || raw.title,
    ogTitle: raw.seo?.ogTitle ?? undefined,
    ogDescription: raw.seo?.ogDescription ?? undefined,
    ogImage: raw.ogImage ?? undefined,
    canonical: raw.seo?.canonical ?? undefined,
    noindex: raw.seo?.noindex ?? false,
    featuredImage: raw.featuredImage
      ? {
          src: raw.featuredImage.src,
          alt: raw.featuredImage.alt,
          width: raw.featuredImage.width,
          height: raw.featuredImage.height,
          caption: raw.featuredImage.caption ?? undefined,
          credit: raw.featuredImage.credit ?? undefined,
        }
      : undefined,
    body: portableTextToArticleBlocks(body),
    faq,
    sources: raw.sources?.map((source) => ({
      label: source.label,
      url: source.url ?? undefined,
      publisher: source.publisher ?? undefined,
      accessedAt: source.accessedAt ?? undefined,
    })),
    review: raw.review
      ? {
          status: raw.review.status,
          contentReviewedAt: raw.review.contentReviewedAt ?? undefined,
          factCheckedAt: raw.review.factCheckedAt ?? undefined,
          complianceReviewedAt: raw.review.complianceReviewedAt ?? undefined,
        }
      : undefined,
    geo: raw.geo
      ? {
          summary: raw.geo.summary ?? undefined,
          keyEntities: raw.geo.keyEntities ?? undefined,
          keyQuestions: raw.geo.keyQuestions ?? undefined,
        }
      : undefined,
  };
}

const articleProjection = groq`{
  _id,
  _originalId,
  "slug": slug.current,
  title,
  excerpt,
  "category": category->title,
  "categorySlug": category->slug.current,
  tags,
  "authorName": author->name,
  "author": author->{
    name,
    profileName,
    profileRole,
    profileBio,
    profileCtaLabel,
    profileCtaUrl,
    "profileAvatar": select(defined(profileAvatar.asset) => {
      "src": profileAvatar.asset->url,
      "width": profileAvatar.asset->metadata.dimensions.width,
      "height": profileAvatar.asset->metadata.dimensions.height,
      "alt": profileAvatar.alt
    })
  },
  publishedAt,
  "updatedAt": coalesce(contentUpdatedAt, migration.sourceModifiedAt, _updatedAt),
  seo,
  "ogImage": select(defined(seo.ogImage.asset) => {
    "src": seo.ogImage.asset->url,
    "width": seo.ogImage.asset->metadata.dimensions.width,
    "height": seo.ogImage.asset->metadata.dimensions.height,
    "alt": seo.ogImage.alt
  }),
  "featuredImage": select(
    defined(featuredImage.asset) => {
      "src": featuredImage.asset->url,
      "width": featuredImage.asset->metadata.dimensions.width,
      "height": featuredImage.asset->metadata.dimensions.height,
      "alt": featuredImage.alt,
      "caption": featuredImage.caption,
      "credit": featuredImage.credit
    },
    defined(migratedFeaturedImage.src) => {
      "src": migratedFeaturedImage.src,
      "width": migratedFeaturedImage.width,
      "height": migratedFeaturedImage.height,
      "alt": migratedFeaturedImage.alt,
      "caption": migratedFeaturedImage.caption
    }
  ),
  body[]{
    _type,
    style,
    listItem,
    children[]{text, marks},
    markDefs[]{_key, _type, href, openInNewTab, nofollow, sponsored},
    title,
    text,
    "src": select(_type == "imageWithAlt" => asset->url, src),
    alt,
    "width": select(_type == "imageWithAlt" => asset->metadata.dimensions.width, width),
    "height": select(_type == "imageWithAlt" => asset->metadata.dimensions.height, height),
    caption,
    credit,
    label,
    url,
    style,
    openInNewTab,
    summary,
    description,
    images[]{
      "src": asset->url,
      "width": asset->metadata.dimensions.width,
      "height": asset->metadata.dimensions.height,
      alt,
      caption,
      credit
    },
    "file": file.asset->{"url": url, "filename": originalFilename, mimeType, size},
    headers,
    rows
  },
  faq[]{question, answer},
  sources[]{label, url, publisher, accessedAt},
  review,
  geo
}`;

const listQuery = groq`*[_type == "article" && defined(slug.current)] | order(coalesce(publishedAt, _updatedAt) desc) ${articleProjection}`;
const bySlugQuery = groq`*[_type == "article" && slug.current == $slug][0] ${articleProjection}`;

function configuredClient(includeDrafts: boolean) {
  if (!client) throw new Error("Sanity is not configured");
  if (includeDrafts && !IS_DRAFT_PREVIEW_ALLOWED) throw new Error("Sanity Draft Mode is not allowed in this application lane");
  if (includeDrafts && !token) throw new Error("Sanity Draft Mode requires SANITY_API_READ_TOKEN");
  return client.withConfig({
    perspective: includeDrafts ? "drafts" : "published",
    token: token || undefined,
    useCdn: false,
    stega: { enabled: includeDrafts, studioUrl: "/studio" },
  });
}

export function getSanityPreviewClient() {
  return configuredClient(true);
}

export const sanityContentProvider: ContentProvider = {
  async listArticles(options = {}) {
    try {
      const includeDrafts = options.includeDrafts === true;
      if (includeDrafts && !IS_DRAFT_PREVIEW_ALLOWED) throw new Error("DRAFT_PREVIEW_NOT_ALLOWED");
      const { data } = await sanityFetch({
        query: listQuery,
        perspective: includeDrafts ? "drafts" : "published",
        stega: includeDrafts,
      });
      return z.array(z.unknown()).parse(data).map(toArticle);
    } catch {
      throw new Error("Sanity content request failed; details redacted");
    }
  },
  async getArticleBySlug(slug, options = {}) {
    try {
      const includeDrafts = options.includeDrafts === true;
      if (includeDrafts && !IS_DRAFT_PREVIEW_ALLOWED) throw new Error("DRAFT_PREVIEW_NOT_ALLOWED");
      const { data } = await sanityFetch({
        query: bySlugQuery,
        params: { slug },
        perspective: includeDrafts ? "drafts" : "published",
        stega: includeDrafts,
      });
      return data ? toArticle(data) : null;
    } catch {
      throw new Error("Sanity content request failed; details redacted");
    }
  },
};
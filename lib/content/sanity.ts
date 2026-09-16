import "server-only";

import { createClient, groq } from "next-sanity";
import { z } from "zod";
import type { Article, ArticleBlock, ContentProvider } from "./types";
import { baseArticleSchema, bodyItemSchema, faqItemSchema, parseRenderableBodyItems, parseRenderableFaqItems, rawArticleSchema, type PortableBodyItem, type RawArticle, type RawArticleSummary } from './sanity-schema';
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
    const segments = item.children.filter((child) => child.text.length > 0).map((child) => {
      const marks = child.marks ?? [];
      const linkKey = marks.find((mark) => markDefs.has(mark));
      return {
        text: child.text,
        ...(linkKey ? {
          href: markDefs.get(linkKey)?.href,
          openInNewTab: markDefs.get(linkKey)?.openInNewTab ?? undefined,
          nofollow: markDefs.get(linkKey)?.nofollow ?? undefined,
          sponsored: markDefs.get(linkKey)?.sponsored ?? undefined,
        } : {}),
        ...(marks.includes("strong") ? { strong: true } : {}),
        ...(marks.includes("em") ? { emphasis: true } : {}),
      };
    });
    const text = segments.map((segment) => segment.text).join("").trim();
    return { text, ...(segments.some((segment) => segment.href || segment.strong || segment.emphasis) ? { segments } : {}) };
  };

  for (const item of items) {
    const keylessFlush = () => flushList();
    if (item._type === "callout") { keylessFlush(); result.push({ type: "callout", title: item.title ?? undefined, text: item.text }); continue; }
    if (item._type === "imageWithAlt" || item._type === "migratedImage") {
      keylessFlush();
      result.push({ type: "image", src: item.src, alt: item.alt, width: item.width, height: item.height, caption: item.caption ?? undefined, ...(item._type === "imageWithAlt" ? { credit: item.credit ?? undefined } : {}) });
      continue;
    }
    if (item._type === "imageGallery") { keylessFlush(); result.push({ type: "gallery", images: item.images.map((image) => ({ ...image, caption: image.caption ?? undefined, credit: image.credit ?? undefined })) }); continue; }
    if (item._type === "ctaBlock") { keylessFlush(); result.push({ type: "cta", label: item.label, url: item.url, style: item.style, openInNewTab: item.openInNewTab ?? undefined }); continue; }
    if (item._type === "pdfDownload") { keylessFlush(); result.push({ type: "pdf", title: item.title, description: item.description ?? undefined, url: item.file.url, filename: item.file.filename ?? undefined, size: item.file.size ?? undefined }); continue; }
    if (item._type === "detailsBlock") { keylessFlush(); result.push({ type: "details", summary: item.summary, text: item.text }); continue; }
    if (item._type === "simpleTable") { keylessFlush(); result.push({ type: "table", headers: item.headers ?? [], rows: (item.rows ?? []).map((row) => Array.isArray(row) ? row : row.cells) }); continue; }
    if (item._type === "divider") { keylessFlush(); result.push({ type: "divider" }); continue; }

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
    if (item.style === "h2" || item.style === "h3") result.push({ type: "heading", level: item.style === "h2" ? 2 : 3, ...rich });
    else if (item.style === "blockquote") result.push({ type: "quote", ...rich });
    else result.push({ type: "paragraph", ...rich });
  }

  flushList();
  return result;
}

function articleBase(raw: RawArticleSummary, body: ArticleBlock[] = []): Article {
  const originalId = raw._originalId ?? raw._id;
  const status = originalId.startsWith("drafts.") ? "draft" : "published";
  const excerpt = raw.excerpt?.trim();
  const seoTitle = raw.seo?.title?.trim();
  const seoDescription = raw.seo?.description?.trim();
  if (status === "published" && (!excerpt || !seoDescription)) throw new Error("Published article is missing required SEO fields");

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
    author: raw.author ? {
      name: raw.author.name,
      profileName: raw.author.profileName ?? undefined,
      profileRole: raw.author.profileRole ?? undefined,
      profileBio: raw.author.profileBio ?? undefined,
      profileCtaLabel: raw.author.profileCtaLabel ?? undefined,
      profileCtaUrl: raw.author.profileCtaUrl ?? undefined,
      profileAvatar: raw.author.profileAvatar ?? undefined,
    } : undefined,
    status,
    publishedAt: raw.publishedAt ?? undefined,
    updatedAt: raw.updatedAt,
    seoTitle: seoTitle || raw.title,
    seoDescription: seoDescription || excerpt || raw.title,
    ogTitle: raw.seo?.ogTitle ?? undefined,
    ogDescription: raw.seo?.ogDescription ?? undefined,
    ogImage: raw.ogImage ? { src: raw.ogImage.src, alt: raw.ogImage.alt, width: raw.ogImage.width, height: raw.ogImage.height } : undefined,
    canonical: raw.seo?.canonical ?? undefined,
    noindex: raw.seo?.noindex ?? false,
    featuredImage: raw.featuredImage ? {
      src: raw.featuredImage.src,
      alt: raw.featuredImage.alt,
      width: raw.featuredImage.width,
      height: raw.featuredImage.height,
      caption: raw.featuredImage.caption ?? undefined,
      credit: raw.featuredImage.credit ?? undefined,
    } : undefined,
    body,
  };
}

function toArticle(rawInput: unknown): Article {
  const raw: RawArticle = rawArticleSchema.parse(rawInput);
  const originalId = raw._originalId ?? raw._id;
  const status = originalId.startsWith("drafts.") ? "draft" : "published";
  const bodyItems = status === "draft" ? parseRenderableBodyItems(raw.body) : z.array(bodyItemSchema).parse(raw.body);
  const faq = raw.faq ? (status === "draft" ? parseRenderableFaqItems(raw.faq) : z.array(faqItemSchema).parse(raw.faq)) : undefined;
  const article = articleBase(raw, portableTextToArticleBlocks(bodyItems));
  return {
    ...article,
    faq,
    sources: raw.sources?.map((source) => ({ label: source.label, url: source.url ?? undefined, publisher: source.publisher ?? undefined, accessedAt: source.accessedAt ?? undefined })),
    review: raw.review ? {
      status: raw.review.status,
      contentReviewedAt: raw.review.contentReviewedAt ?? undefined,
      factCheckedAt: raw.review.factCheckedAt ?? undefined,
      complianceReviewedAt: raw.review.complianceReviewedAt ?? undefined,
    } : undefined,
    geo: raw.geo ? {
      summary: raw.geo.summary ?? undefined,
      keyEntities: raw.geo.keyEntities ?? undefined,
      keyQuestions: raw.geo.keyQuestions ?? undefined,
    } : undefined,
  };
}

function toArticleSummary(rawInput: unknown): Article {
  return articleBase(baseArticleSchema.parse(rawInput));
}

const baseProjection = groq`{
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
  )
}`;

const articleProjection = groq`{
  ...${baseProjection},
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
    images[]{"src": asset->url, "width": asset->metadata.dimensions.width, "height": asset->metadata.dimensions.height, alt, caption, credit},
    "file": file.asset->{"url": url, "filename": originalFilename, mimeType, size},
    headers,
    rows
  },
  faq[]{question, answer},
  sources[]{label, url, publisher, accessedAt},
  review,
  geo
}`;

const listQuery = groq`*[_type == "article" && defined(slug.current)] | order(coalesce(publishedAt, _updatedAt) desc) ${baseProjection}`;
const bySlugQuery = groq`*[_type == "article" && slug.current == $slug][0] ${articleProjection}`;

function configuredClient(includeDrafts: boolean) {
  if (!client) throw new Error("Sanity is not configured");
  if (includeDrafts && !IS_DRAFT_PREVIEW_ALLOWED) throw new Error("Sanity Draft Mode is not allowed in this application lane");
  if (includeDrafts && !token) throw new Error("Sanity Draft Mode requires SANITY_API_READ_TOKEN");
  return client.withConfig({ perspective: includeDrafts ? "drafts" : "published", token: token || undefined, useCdn: false, stega: { enabled: includeDrafts, studioUrl: "/studio" } });
}

export function getSanityPreviewClient() {
  return configuredClient(true);
}

function reportSanityError(scope: string, error: unknown) {
  const detail = error instanceof z.ZodError
    ? { type: "validation", issues: error.issues.map((issue) => ({ path: issue.path.join("."), code: issue.code })) }
    : { type: error instanceof Error ? error.name : "unknown" };
  console.error("[sanity-content]", scope, detail);
}

export const sanityContentProvider: ContentProvider = {
  async listArticles(options = {}) {
    try {
      const includeDrafts = options.includeDrafts === true;
      if (includeDrafts && !IS_DRAFT_PREVIEW_ALLOWED) throw new Error("DRAFT_PREVIEW_NOT_ALLOWED");
      const { data } = await sanityFetch({ query: listQuery, perspective: includeDrafts ? "drafts" : "published", stega: includeDrafts });
      const rows = z.array(z.unknown()).parse(data);
      return rows.flatMap((row) => {
        try {
          return [toArticleSummary(row)];
        } catch (error) {
          reportSanityError("listArticles:record-skipped", error);
          return [];
        }
      });
    } catch (error) {
      reportSanityError("listArticles:request-failed", error);
      throw new Error("Sanity content request failed; details redacted");
    }
  },
  async getArticleBySlug(slug, options = {}) {
    try {
      const includeDrafts = options.includeDrafts === true;
      if (includeDrafts && !IS_DRAFT_PREVIEW_ALLOWED) throw new Error("DRAFT_PREVIEW_NOT_ALLOWED");
      const { data } = await sanityFetch({ query: bySlugQuery, params: { slug }, perspective: includeDrafts ? "drafts" : "published", stega: includeDrafts });
      return data ? toArticle(data) : null;
    } catch (error) {
      reportSanityError("getArticleBySlug:request-failed", error);
      throw new Error("Sanity content request failed; details redacted");
    }
  },
};

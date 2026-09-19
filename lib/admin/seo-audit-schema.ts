import { z } from "zod";

const portableChildSchema = z.object({ text: z.string().optional() }).passthrough();
const markDefSchema = z.object({ href: z.string().optional() }).passthrough();
const portableBlockSchema = z.object({
  _type: z.string().optional(),
  style: z.string().optional(),
  children: z.array(portableChildSchema).optional(),
  markDefs: z.array(markDefSchema).nullish().transform((value) => value ?? []),
}).passthrough();

const auditArticleSchema = z.object({
  id: z.string(),
  revision: z.string(),
  title: z.string().nullish(),
  slug: z.string().nullish(),
  category: z.string().nullish(),
  categorySlug: z.string().nullish(),
  excerpt: z.string().nullish(),
  body: z.array(portableBlockSchema).nullish(),
  faqCount: z.number().nullish().transform((value) => value ?? 0),
  sourcesCount: z.number().nullish().transform((value) => value ?? 0),
  sourceUrlsCount: z.number().nullish().transform((value) => value ?? 0),
  faqQuestions: z.array(z.string()).nullish().transform((value) => value ?? []),
  authorName: z.string().nullish(),
  reviewStatus: z.string().nullish(),
  factCheckedAt: z.string().nullish(),
  complianceReviewedAt: z.string().nullish(),
  featuredAlt: z.string().nullish(),
  hasFeaturedImage: z.boolean(),
  hasNativeFeaturedImage: z.boolean(),
  usesMigratedFeaturedImage: z.boolean(),
  seo: z.object({
    title: z.string().nullish(),
    description: z.string().nullish(),
    focusKeyword: z.string().nullish(),
    secondaryKeywords: z.array(z.string()).nullish(),
    searchIntent: z.string().nullish(),
    canonical: z.string().nullish(),
    noindex: z.boolean().nullish(),
  }).nullish(),
  geo: z.object({
    summary: z.string().nullish(),
    keyEntities: z.array(z.string()).nullish(),
    keyQuestions: z.array(z.string()).nullish(),
    reviewedAt: z.string().nullish(),
  }).nullish(),
});

export type SeoAuditArticle = z.infer<typeof auditArticleSchema>;

export function parseSeoAuditArticle(raw: unknown): SeoAuditArticle {
  return auditArticleSchema.parse(raw);
}

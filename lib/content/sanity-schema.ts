import { z } from 'zod';

export const spanSchema = z.object({ text: z.string(), marks: z.array(z.string()).nullish() });
export const linkMarkSchema = z.object({
  _key: z.string(),
  _type: z.literal("link"),
  href: z.string().min(1).refine((value) => /^(https?:\/\/|\/(?!\/)|#|mailto:|tel:)/.test(value)),
  openInNewTab: z.boolean().nullish(),
  nofollow: z.boolean().nullish(),
  sponsored: z.boolean().nullish(),
});
export const portableBlockSchema = z.object({
  _type: z.literal("block"),
  style: z.string().nullish(),
  listItem: z.string().nullish(),
  children: z.array(spanSchema),
  markDefs: z.array(linkMarkSchema).nullish(),
});
export const calloutSchema = z.object({ _type: z.literal("callout"), title: z.string().nullish(), text: z.string() });
export const migratedImageSchema = z.object({
  _type: z.literal("migratedImage"),
  src: z.string().min(1),
  alt: z.string().min(1),
  width: z.number().positive(),
  height: z.number().positive(),
  caption: z.string().nullish(),
});
export const renderedImageSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  width: z.number().positive(),
  height: z.number().positive(),
  caption: z.string().nullish(),
  credit: z.string().nullish(),
});
export const inlineImageSchema = renderedImageSchema.extend({ _type: z.literal("imageWithAlt") });
export const imageGallerySchema = z.object({ _type: z.literal("imageGallery"), images: z.array(renderedImageSchema).min(2).max(12) });
export const ctaBlockSchema = z.object({
  _type: z.literal("ctaBlock"),
  label: z.string().min(1).max(80),
  url: z.string().refine((value) => /^(https?:\/\/|\/(?!\/))/.test(value)),
  style: z.enum(["primary", "secondary"]),
  openInNewTab: z.boolean().nullish(),
});
export const pdfDownloadSchema = z.object({
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
export const detailsBlockSchema = z.object({ _type: z.literal("detailsBlock"), summary: z.string().min(1), text: z.string().min(1) });
export const legacyTableRowSchema = z.array(z.string());
export const tableRowSchema = z.object({
  _type: z.literal("tableRow"),
  _key: z.string().nullish(),
  cells: z.array(z.string()),
});
export const simpleTableSchema = z.object({
  _type: z.literal("simpleTable"),
  headers: z.array(z.string()).nullish(),
  rows: z.array(z.union([legacyTableRowSchema, tableRowSchema])).nullish(),
});
export const signatureEditorialSchema = z.object({
  _type: z.literal("signatureEditorial"),
  kind: z.enum(["insight", "limit", "beforeAfter", "timeline", "checklist", "calculation", "glossary", "sources"]),
  title: z.string().min(4), description: z.string().nullish(),
  takeaway: z.string().nullish(), sampleNote: z.string().nullish(),
  firstLabel: z.string().nullish(), secondLabel: z.string().nullish(),
  limit: z.number().nonnegative().nullish(), used: z.number().nonnegative().nullish(),
  monthlyAmount: z.number().nonnegative().nullish(), months: z.number().int().min(1).max(120).nullish(),
  existingAmount: z.number().nonnegative().nullish(),
  entries: z.array(z.object({
    label:z.string().min(1),value:z.string().min(1),
    detail:z.string().nullish(),url:z.string().url().nullish(),
  })).nullish(),
});
export const signatureStructuredTableSchema = z.object({
  _type:z.literal("signatureStructuredTable"),title:z.string().min(4),
  description:z.string().nullish(),takeaway:z.string().nullish(),sampleNote:z.string().nullish(),
  headers:z.array(z.string()).min(2).max(6),
  rows:z.array(z.union([legacyTableRowSchema,tableRowSchema])).min(1).max(60),
});
export const signaturePlanExplorerSchema = z.object({
  _type:z.literal("signaturePlanExplorer"),title:z.string().min(4),
  description:z.string().nullish(),takeaway:z.string().nullish(),sampleNote:z.string().nullish(),
  plans:z.array(z.object({
    name:z.string().min(1),headline:z.string().nullish(),
    benefits:z.array(z.object({label:z.string().min(1),value:z.string().min(1),category:z.string().nullish()})).min(1).max(40),
  })).min(2).max(12),
});
export const dividerSchema = z.object({ _type: z.literal("divider") });
export const bodyItemSchema = z.union([
  portableBlockSchema,
  calloutSchema,
  inlineImageSchema,
  imageGallerySchema,
  ctaBlockSchema,
  pdfDownloadSchema,
  detailsBlockSchema,
  migratedImageSchema,
  simpleTableSchema,
  signatureEditorialSchema,
  signatureStructuredTableSchema,
  signaturePlanExplorerSchema,
  dividerSchema,
]);
export const faqItemSchema = z.object({ question: z.string().min(1), answer: z.string().min(1) });

export const professionalQualificationSchema = z.object({
  _key: z.string().min(1).nullish().transform((value) => value ?? undefined).catch(undefined),
  shortName: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(160),
  identifier: z.string().trim().min(1).max(80).nullish().transform((value) => value ?? undefined).catch(undefined),
  issuer: z.string().trim().min(1).max(160),
  issuerUrl: z.string().url().nullish().transform((value) => value ?? undefined).catch(undefined),
});

export function parseProfessionalQualifications(items: unknown) {
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    const parsed = professionalQualificationSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

export const professionalLicenseSchema = z.object({
  _key: z.string().min(1).nullish().transform((value) => value ?? undefined).catch(undefined),
  name: z.string().trim().min(1).max(160),
  identifier: z.string().trim().min(1).max(80),
  issuer: z.string().trim().min(1).max(160),
  issuerUrl: z.string().url().nullish().transform((value) => value ?? undefined).catch(undefined),
});

export function parseProfessionalLicenses(items: unknown) {
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    const parsed = professionalLicenseSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

export const authorSchema = z.object({
  name: z.string().min(1),
  profileName: z.string().min(1).nullish().catch(undefined),
  profileRole: z.string().min(1).nullish().catch(undefined),
  profileBio: z.string().min(1).nullish().catch(undefined),
  profileCtaLabel: z.string().min(1).nullish().catch(undefined),
  profileCtaUrl: z.string().refine((value) => /^(https?:\/\/|\/(?!\/)|#)/.test(value)).nullish().catch(undefined),
  professionalQualifications: z.array(z.unknown()).nullish().catch(undefined),
  professionalLicenses: z.array(z.unknown()).nullish().catch(undefined),
  sameAs: z.array(z.string().url()).nullish().catch(undefined),
  profileAvatar: z.object({
    src: z.string().min(1),
    alt: z.string().min(1),
    width: z.number().positive(),
    height: z.number().positive(),
  }).nullish().catch(undefined),
});

export const seoSchema = z.object({
  title: z.string().min(1).nullish(),
  description: z.string().min(1).nullish(),
  ogTitle: z.string().min(1).nullish(),
  ogDescription: z.string().min(1).nullish(),
  semanticTopic: z.string().min(1).nullish(),
  canonical: z.string().url().nullish(),
  noindex: z.boolean().nullish(),
}).nullish();

export const imageSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  width: z.number().positive(),
  height: z.number().positive(),
  caption: z.string().nullish().optional(),
  credit: z.string().nullish().optional(),
}).nullish();

export const baseArticleSchema = z.object({
  _id: z.string(),
  _originalId: z.string().nullish(),
  slug: z.string().min(1),
  title: z.string().min(1),
  excerpt: z.string().min(1).nullish(),
  lineTitle: z.string().trim().min(1).max(60).nullish().catch(undefined),
  lineDescription: z.string().trim().min(1).max(90).nullish().catch(undefined),
  category: z.string().min(1),
  categorySlug: z.string().min(1).nullish(),
  tags: z.array(z.string()).nullish(),
  authorName: z.string().min(1).nullish().transform((value) => value ?? undefined).catch(undefined),
  author: authorSchema.nullish().catch(undefined),
  publishedAt: z.string().nullish(),
  updatedAt: z.string().min(1),
  contentOptimizedAt: z.string().datetime({ offset: true }).nullish().transform((value) => value ?? undefined).catch(undefined),
  seo: seoSchema,
  ogImage: imageSchema,
  featuredImage: imageSchema,
});

export const rawArticleSchema = baseArticleSchema.extend({
  body: z.array(z.unknown()),
  faq: z.array(z.unknown()).nullish(),
  sources: z.array(z.object({
    label: z.string().min(1),
    url: z.string().url().nullish(),
    publisher: z.string().nullish(),
    accessedAt: z.string().nullish(),
  })).nullish(),
  review: z.object({
    status: z.enum(["content-review", "ready-for-coo", "approved"]).optional(),
    contentReviewedAt: z.string().nullish(),
    factCheckedAt: z.string().nullish(),
    complianceReviewedAt: z.string().nullish(),
  }).nullish(),
  geo: z.object({
    summary: z.string().nullish(),
    keyEntities: z.array(z.string()).nullish(),
    keyQuestions: z.array(z.string()).nullish(),
  }).nullish(),
});

export type RawArticle = z.infer<typeof rawArticleSchema>;
export type RawArticleSummary = z.infer<typeof baseArticleSchema>;
export type PortableBodyItem = z.infer<typeof bodyItemSchema>;

export function parseRenderableBodyItems(items: unknown[]): PortableBodyItem[] {
  return items.flatMap((item) => {
    const parsed = bodyItemSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

export function parseRenderableFaqItems(items: unknown[]) {
  return items.flatMap((item) => {
    const parsed = faqItemSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

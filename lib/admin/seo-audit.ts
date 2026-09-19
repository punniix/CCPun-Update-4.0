import "server-only";

import { randomUUID } from "node:crypto";
import { createClient, groq } from "next-sanity";
import { z } from "zod";
import { summarizeContentReadiness, type ContentReadiness } from "./content-readiness";
import { isAdminDataPlaneAllowed, isAdminReadDataPlaneAllowed } from "./environment";
import { getAdminSanityReadToken, getAdminSanityWriteToken } from "./sanity-credentials";
import { buildAuditLogDocument, isRevisionConflict } from "./sanity-control";
import { findAdminProposalResearch, insertAdminAudit } from "./operations/database";
import { normalizeResearchKeyword } from "./research-input";
import { isArticleCanonicalAligned } from "../content/url";
import { countGraphemes, countMatchingQuestions, isReviewDateFresh, META_DESCRIPTION_MAX, META_DESCRIPTION_MIN, SEO_AUDIT_VERSION, SEO_TITLE_MAX, SEO_TITLE_MIN, seoBodyFacts } from "./seo-heuristics";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim();
const readToken = getAdminSanityReadToken();
const writeToken = getAdminSanityWriteToken();
const articleDocumentIdSchema = z.string().min(1).max(200).regex(/^[A-Za-z0-9_.-]+$/);

function parseArticleDocumentId(value: string) {
  const parsed = articleDocumentIdSchema.safeParse(value);
  if (!parsed.success) throw new Error("INVALID_ARTICLE_ID");
  return parsed.data.replace(/^drafts\./, "");
}

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

export function parseSeoAuditArticle(raw: unknown) {
  return auditArticleSchema.parse(raw);
}

export type SeoAuditSeverity = "critical" | "warning" | "opportunity";

export type SeoAuditCheck = {
  id: string;
  label: string;
  passed: boolean;
  weight: number;
  severity: SeoAuditSeverity;
  detail: string;
  proposalType?: "seo-title" | "meta-description" | "primary-keyword" | "search-intent" | "structure" | "internal-links" | "content";
};

export type SeoAuditResult = {
  version: number;
  articleId: string;
  sourceRevision: string;
  score: number;
  passedChecks: number;
  criticalIssues: number;
  warnings: number;
  opportunities: number;
  auditedAt: string;
  summary: string;
  checks: SeoAuditCheck[];
  contentReadiness: ContentReadiness;
  geoAudit: GeoAuditResult;
};

export type GeoAuditCheck = { id: string; label: string; passed: boolean; detail: string; required: boolean };
export type GeoAuditResult = { version: 2; auditedAt: string; passedChecks: number; totalChecks: number; checks: GeoAuditCheck[] };

function normalize(value: unknown) {
  return String(value ?? "").toLocaleLowerCase("th-TH").replace(/\s+/g, " ").trim();
}

function buildCheck(input: Omit<SeoAuditCheck, "passed"> & { passed: boolean }): SeoAuditCheck {
  return input;
}

export function auditArticleSeo(article: z.infer<typeof auditArticleSchema>): SeoAuditResult {
  const seo = article.seo ?? {};
  const facts = seoBodyFacts(article.body);
  const contentReadiness = summarizeContentReadiness({
    links: facts.links,
    bodyTypes: facts.bodyTypes,
    faqCount: article.faqCount,
    sourcesCount: article.sourcesCount,
    hasNativeFeaturedImage: article.hasNativeFeaturedImage,
    usesMigratedFeaturedImage: article.usesMigratedFeaturedImage,
    factCheckedAt: article.factCheckedAt,
    complianceReviewedAt: article.complianceReviewedAt,
    geo: article.geo,
  });
  const keyword = normalize(seo.focusKeyword);
  const keywordIn = (value: unknown) => Boolean(keyword && normalize(value).includes(keyword));
  const canonicalSafe = Boolean(article.slug && article.category && isArticleCanonicalAligned({
    slug: article.slug,
    category: article.category,
    categorySlug: article.categorySlug ?? undefined,
    canonical: seo.canonical ?? undefined,
  }));
  const effectiveSeoTitle = seo.title?.trim() || article.title?.trim() || "";
  const seoTitleLength = countGraphemes(effectiveSeoTitle);
  const descriptionLength = countGraphemes(seo.description ?? "");
  const excerptLength = countGraphemes(article.excerpt ?? "");
  const bodyLength = countGraphemes(facts.text);
  const geo = article.geo ?? {};
  const geoIsFresh = isReviewDateFresh(geo.reviewedAt);
  const matchingQuestions = countMatchingQuestions(geo.keyQuestions ?? [], article.faqQuestions);
  const draftWillPublishIndexable = article.id.startsWith("drafts.");
  const geoChecks: GeoAuditCheck[] = [
    { id: "answer-first", label: "มี GEO summary อย่างน้อย 60 ตัวอักษร", passed: countGraphemes(geo.summary ?? "") >= 60, detail: geo.summary ? `${countGraphemes(geo.summary)} ตัวอักษร` : "ยังไม่มี GEO summary", required: true },
    { id: "entities", label: "ระบุบุคคล/ผลิตภัณฑ์/แนวคิดสำคัญชัดเจน", passed: (geo.keyEntities?.length ?? 0) >= 2, detail: `${geo.keyEntities?.length ?? 0} entities`, required: true },
    { id: "questions", label: "ระบุคำถามหลักที่บทความตอบ", passed: (geo.keyQuestions?.length ?? 0) >= 2, detail: `${geo.keyQuestions?.length ?? 0} คำถาม`, required: true },
    { id: "author", label: "ระบุผู้เขียน", passed: Boolean(article.authorName?.trim()), detail: article.authorName || "ยังไม่พบผู้เขียน", required: true },
    { id: "sources", label: "มีแหล่งอ้างอิงที่ระบุ URL", passed: article.sourceUrlsCount >= 1, detail: `${article.sourceUrlsCount}/${article.sourcesCount} แหล่งมี URL`, required: true },
    { id: "faq-alignment", label: "คำถามหลักตรงกับ FAQ ที่แสดงจริง", passed: matchingQuestions >= 2, detail: `ตรงกัน ${matchingQuestions}/${geo.keyQuestions?.length ?? 0} คำถาม`, required: false },
    { id: "review", label: "บันทึก Fact-check และ Compliance", passed: Boolean(article.factCheckedAt && article.complianceReviewedAt), detail: article.factCheckedAt && article.complianceReviewedAt ? "บันทึกครบ" : "ยังไม่ครบ", required: true },
    { id: "internal-links", label: "มีลิงก์ภายในช่วยอธิบายบริบท", passed: contentReadiness.internalLinks > 0, detail: `${contentReadiness.internalLinks} ลิงก์`, required: false },
    { id: "structured-alignment", label: "FAQ schema มีเนื้อหาที่มองเห็นตรงกัน", passed: article.faqQuestions.length > 0, detail: article.faqQuestions.length ? "ใช้ FAQ ที่แสดงจริง" : "ไม่มี FAQ schema", required: false },
    { id: "freshness", label: "ทบทวน GEO ภายใน 180 วัน", passed: geoIsFresh, detail: geo.reviewedAt || "ยังไม่มีวันที่ทบทวน", required: true },
  ];

  const checks: SeoAuditCheck[] = [
    buildCheck({ id: "seo-title-length", label: `ชื่อสำหรับ Google ${SEO_TITLE_MIN}–${SEO_TITLE_MAX} ตัวอักษร`, passed: seoTitleLength >= SEO_TITLE_MIN && seoTitleLength <= SEO_TITLE_MAX, weight: 10, severity: "critical", detail: `${seo.title ? "ใช้ SEO Title" : "ใช้ชื่อบทความอัตโนมัติ"} ${seoTitleLength} ตัวอักษร`, proposalType: "seo-title" }),
    buildCheck({ id: "meta-description-length", label: `Meta description ${META_DESCRIPTION_MIN}–${META_DESCRIPTION_MAX} ตัวอักษร`, passed: Boolean(seo.description && descriptionLength >= META_DESCRIPTION_MIN && descriptionLength <= META_DESCRIPTION_MAX), weight: 10, severity: "critical", detail: seo.description ? `ปัจจุบัน ${descriptionLength} ตัวอักษร` : "ยังไม่มี Meta description", proposalType: "meta-description" }),
    buildCheck({ id: "primary-keyword", label: "มี Primary keyword", passed: Boolean(keyword), weight: 7, severity: "critical", detail: keyword ? `Keyword: ${seo.focusKeyword}` : "ยังไม่ได้กำหนดคำหลัก", proposalType: "primary-keyword" }),
    buildCheck({ id: "keyword-seo-title", label: "Primary keyword อยู่ในชื่อสำหรับ Google", passed: keywordIn(effectiveSeoTitle), weight: 6, severity: "warning", detail: keyword ? "ช่วยให้ชื่อสอดคล้องกับหัวข้อเป้าหมาย" : "ต้องมี Primary keyword ก่อน", proposalType: "seo-title" }),
    buildCheck({ id: "keyword-meta", label: "Primary keyword อยู่ใน Meta description", passed: keywordIn(seo.description), weight: 5, severity: "warning", detail: keyword ? "ช่วยให้ snippet สอดคล้องกับ search intent" : "ต้องมี Primary keyword ก่อน", proposalType: "meta-description" }),
    buildCheck({ id: "keyword-article-title", label: "Primary keyword อยู่ในชื่อบทความ", passed: keywordIn(article.title), weight: 5, severity: "warning", detail: article.title ?? "ยังไม่มีชื่อบทความ", proposalType: "content" }),
    buildCheck({ id: "keyword-body", label: "Primary keyword ปรากฏในเนื้อหาอย่างเป็นธรรมชาติ", passed: keywordIn(facts.text), weight: 5, severity: "warning", detail: keywordIn(facts.text) ? "พบ keyword ใน body" : "ไม่พบ keyword ใน body", proposalType: "content" }),
    buildCheck({ id: "slug", label: "URL slug พร้อม", passed: Boolean(article.slug), weight: 4, severity: "critical", detail: article.slug ? `/${article.slug}` : "ยังไม่มี slug" }),
    buildCheck({ id: "h2", label: "มี H2 อย่างน้อย 1 หัวข้อ", passed: facts.h2Count > 0, weight: 5, severity: "warning", detail: `H2: ${facts.h2Count}`, proposalType: "structure" }),
    buildCheck({ id: "heading-depth", label: "โครงสร้างหัวข้อมีหลายระดับ/หลายส่วน", passed: facts.h3Count > 0 || facts.h2Count >= 2, weight: 4, severity: "opportunity", detail: `H2: ${facts.h2Count}, H3: ${facts.h3Count}`, proposalType: "structure" }),
    buildCheck({ id: "content-depth", label: "เนื้อหามีรายละเอียดเพียงพอ", passed: bodyLength >= 1200, weight: 6, severity: "warning", detail: `Body text: ${bodyLength} ตัวอักษร`, proposalType: "content" }),
    buildCheck({ id: "internal-link", label: "มี Internal link", passed: contentReadiness.internalLinks > 0, weight: 5, severity: "opportunity", detail: `Internal links: ${contentReadiness.internalLinks}`, proposalType: "internal-links" }),
    buildCheck({ id: "featured-image", label: "มี Featured image", passed: article.hasFeaturedImage, weight: 4, severity: "warning", detail: article.hasFeaturedImage ? "มีภาพแล้ว" : "ยังไม่มีภาพ" }),
    buildCheck({ id: "image-alt", label: "Featured image มี Alt text", passed: Boolean(article.featuredAlt), weight: 4, severity: "warning", detail: article.featuredAlt || "ยังไม่มี Alt text" }),
    buildCheck({ id: "excerpt", label: "มีคำโปรย Blog/Search อย่างน้อย 40 ตัวอักษร", passed: Boolean(article.excerpt && excerptLength >= 40), weight: 4, severity: "warning", detail: article.excerpt ? `${excerptLength} ตัวอักษร` : "ยังไม่มี excerpt" }),
    buildCheck({ id: "sources", label: "มีแหล่งอ้างอิง", passed: article.sourcesCount > 0, weight: 5, severity: "warning", detail: `Sources: ${article.sourcesCount}` }),
    buildCheck({ id: "canonical", label: "Canonical ปลอดภัย", passed: canonicalSafe, weight: 5, severity: "critical", detail: seo.canonical || "ใช้ canonical อัตโนมัติ" }),
    buildCheck({
      id: "indexability",
      label: "พร้อมให้ index เมื่อ Publish",
      passed: draftWillPublishIndexable || seo.noindex !== true,
      weight: 5,
      severity: "critical",
      detail: draftWillPublishIndexable && seo.noindex === true
        ? "Draft noindex=true; CCPun Publish workflow จะบังคับ Live เป็น false"
        : seo.noindex === true
          ? "Live noindex=true"
          : "indexable",
    }),
    buildCheck({ id: "search-intent", label: "กำหนด Search intent", passed: Boolean(seo.searchIntent), weight: 3, severity: "opportunity", detail: seo.searchIntent || "ยังไม่กำหนด", proposalType: "search-intent" }),
    buildCheck({ id: "review", label: "ผ่าน Review workflow", passed: article.reviewStatus === "approved", weight: 3, severity: "warning", detail: article.reviewStatus || "missing" }),
  ];

  const maxWeight = checks.reduce((sum, check) => sum + check.weight, 0);
  const earned = checks.reduce((sum, check) => sum + (check.passed ? check.weight : 0), 0);
  const score = Math.round((earned / maxWeight) * 100);
  const failed = checks.filter((check) => !check.passed);
  const criticalIssues = failed.filter((check) => check.severity === "critical").length;
  const warnings = failed.filter((check) => check.severity === "warning").length;
  const opportunities = failed.filter((check) => check.severity === "opportunity").length;
  const auditedAt = new Date().toISOString();
  const summary = score >= 85
    ? `SEO readiness ดีมาก (${score}/100) เหลือ ${failed.length} จุดที่ควรตรวจ`
    : score >= 70
      ? `SEO readiness ดี (${score}/100) มี ${criticalIssues} critical และ ${warnings} warning`
      : score >= 50
        ? `SEO readiness ควรปรับ (${score}/100) มี ${criticalIssues} critical และ ${warnings} warning`
        : `SEO readiness ต้องปรับ (${score}/100) มี ${criticalIssues} critical และ ${warnings} warning`;

  return {
    version: SEO_AUDIT_VERSION,
    articleId: article.id,
    sourceRevision: article.revision,
    score,
    passedChecks: checks.length - failed.length,
    criticalIssues,
    warnings,
    opportunities,
    auditedAt,
    summary,
    checks,
    contentReadiness,
    geoAudit: { version: 2, auditedAt, passedChecks: geoChecks.filter((check) => check.passed).length, totalChecks: geoChecks.length, checks: geoChecks },
  };
}

function clientForRead() {
  if (!projectId || !dataset || !readToken || !isAdminReadDataPlaneAllowed(dataset)) return null;
  return createClient({ projectId, dataset, token: readToken, apiVersion: "2026-08-20", useCdn: false, perspective: "raw" });
}

function clientForWrite() {
  if (!projectId || !dataset || !writeToken || !isAdminDataPlaneAllowed(dataset)) return null;
  return createClient({ projectId, dataset, token: writeToken, apiVersion: "2026-08-20", useCdn: false, perspective: "raw" });
}

const seoAuditMutationContextSchema = z.object({
  actor: z.string().min(1).max(320),
  actorType: z.enum(["human", "ai", "system"]),
  requestId: z.string().uuid(),
});

type SeoAuditMutationContext = z.infer<typeof seoAuditMutationContextSchema>;

export async function runSeoAudit(
  articleId: string,
  persist = true,
  context?: SeoAuditMutationContext,
): Promise<SeoAuditResult> {
  const cleanId = parseArticleDocumentId(articleId);
  const readClient = clientForRead();
  if (!readClient) throw new Error("SANITY_READ_NOT_CONFIGURED");

  const draftId = `drafts.${cleanId}`;
  const articleRaw = await readClient.fetch(groq`coalesce(*[_type == "article" && _id == $draftId][0], *[_type == "article" && _id == $publishedId][0]){
    "id": _id,
    "revision": _rev,
    title,
    "slug": slug.current,
    "category": category->title,
    "categorySlug": category->slug.current,
    excerpt,
    body,
    "faqCount": count(faq),
    "sourcesCount": count(sources),
    "sourceUrlsCount": count(sources[defined(url)]),
    "faqQuestions": faq[].question,
    "authorName": author->name,
    "reviewStatus": review.status,
    "factCheckedAt": review.factCheckedAt,
    "complianceReviewedAt": review.complianceReviewedAt,
    "featuredAlt": coalesce(featuredImage.alt, migratedFeaturedImage.alt),
    "hasFeaturedImage": defined(featuredImage.asset) || defined(migratedFeaturedImage.src),
    "hasNativeFeaturedImage": defined(featuredImage.asset),
    "usesMigratedFeaturedImage": defined(migratedFeaturedImage.src) && !defined(featuredImage.asset),
    seo {
      title,
      description,
      focusKeyword,
      secondaryKeywords,
      searchIntent,
      canonical,
      noindex
    },
    geo {
      summary,
      keyEntities,
      keyQuestions,
      reviewedAt
    }
  }`, { draftId, publishedId: cleanId });

  if (!articleRaw) throw new Error("ARTICLE_NOT_FOUND");
  const article = parseSeoAuditArticle(articleRaw);
  const result = auditArticleSeo(article);

  if (persist) {
    if (!article.id.startsWith("drafts.")) throw new Error("SEO_AUDIT_DRAFT_REQUIRED");
    const writeClient = clientForWrite();
    if (!writeClient) throw new Error("SANITY_WRITE_NOT_CONFIGURED");
    const auditContext = seoAuditMutationContextSchema.parse(context);
    const targetId = article.id.startsWith("drafts.") ? article.id : `drafts.${article.id}`;
    const auditSnapshot = {
      _type: "seoAuditSnapshot",
      version: result.version,
      score: result.score,
      criticalIssues: result.criticalIssues,
      warnings: result.warnings,
      passedChecks: result.passedChecks,
      summary: result.summary,
      auditedAt: result.auditedAt,
      sourceRevision: result.sourceRevision,
      geoVersion: result.geoAudit.version,
      geoPassedChecks: result.geoAudit.passedChecks,
      geoTotalChecks: result.geoAudit.totalChecks,
      geoAuditedAt: result.geoAudit.auditedAt,
    };
    const auditDocument = buildAuditLogDocument({
      id: `auditLog.${randomUUID()}`,
      actor: auditContext.actor,
      actorType: auditContext.actorType,
      action: "seo-audit:run",
      objectType: "article",
      objectId: targetId,
      after: {
        score: result.score,
        criticalIssues: result.criticalIssues,
        warnings: result.warnings,
        opportunities: result.opportunities,
      },
      requestId: auditContext.requestId,
      timestamp: result.auditedAt,
    });
    const intentAudit = buildAuditLogDocument({
      id: `auditLog.${randomUUID()}`,
      actor: auditContext.actor,
      actorType: auditContext.actorType,
      action: "seo-audit:persist-intent",
      objectType: "article",
      objectId: targetId,
      after: { status: "started", score: result.score },
      requestId: auditContext.requestId,
      timestamp: result.auditedAt,
    });

    try {
      await insertAdminAudit(intentAudit);
      await writeClient.patch(targetId).ifRevisionId(article.revision).set({
        "seo.auditSnapshot": {
          ...auditSnapshot,
        },
      }).commit();
      await insertAdminAudit(auditDocument);
    } catch (error) {
      if (isRevisionConflict(error)) throw new Error("SEO_AUDIT_STALE");
      throw error;
    }
  }

  return result;
}

const proposalContextSchema = z.object({
  revision: z.string(),
  title: z.string().nullish(),
  slug: z.string().nullish(),
  categorySlug: z.string().nullish(),
  seoTitle: z.string().nullish(),
  seoDescription: z.string().nullish(),
  ogTitle: z.string().nullish(),
  ogDescription: z.string().nullish(),
  canonical: z.string().nullish(),
  socialImage: z.string().nullish(),
  focusKeyword: z.string().nullish(),
  searchIntent: z.string().nullish(),
});

const proposalResearchSchema = z.object({
  provider: z.string(),
  intent: z.string().nullable(),
  checkedAt: z.string(),
});

export async function getSeoProposalContext(articleId: string) {
  const cleanId = parseArticleDocumentId(articleId);
  const readClient = clientForRead();
  if (!readClient) throw new Error("SANITY_READ_NOT_CONFIGURED");
  const draftId = `drafts.${cleanId}`;
  const raw = await readClient.fetch(groq`coalesce(*[_type == "article" && _id == $draftId][0], *[_type == "article" && _id == $publishedId][0]){
    "revision": _rev,
    title,
    "slug": slug.current,
    "categorySlug": category->slug.current,
    "seoTitle": seo.title,
    "seoDescription": seo.description,
    "ogTitle": seo.ogTitle,
    "ogDescription": seo.ogDescription,
    "canonical": seo.canonical,
    "socialImage": coalesce(seo.ogImage.asset->url, featuredImage.asset->url, migratedFeaturedImage.src),
    "focusKeyword": seo.focusKeyword,
    "searchIntent": seo.searchIntent
  }`, { draftId, publishedId: cleanId });
  if (!raw) throw new Error("ARTICLE_NOT_FOUND");
  const article = proposalContextSchema.parse(raw);
  const keywordKey = normalizeResearchKeyword(article.focusKeyword ?? "");
  if (!keywordKey) return { ...article, research: null };
  const freshAfter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const researchRaw = await findAdminProposalResearch(keywordKey, freshAfter);
  return { ...article, research: proposalResearchSchema.nullable().parse(researchRaw) };
}
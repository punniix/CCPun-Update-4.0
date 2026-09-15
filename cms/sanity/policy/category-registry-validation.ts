import type { ValidationContext } from "sanity";
import {
  buildCategoryRegistry,
  CATEGORY_SLUG_PATTERN,
  getCategoryCanonical,
  type CategoryRegistryIssueCode,
  type RawCategoryRegistryRow,
} from "../../../lib/content/category-registry";

const API_VERSION = "2026-08-18";

function publishedId(id: string) {
  return id.replace(/^drafts\./, "");
}

const ISSUE_MESSAGES: Record<CategoryRegistryIssueCode, string> = {
  "invalid-record": "Category นี้มีข้อมูลไม่ครบหรือรูปแบบไม่ถูกต้อง",
  "duplicate-slug": "URL Slug นี้ซ้ำกับ Category อื่น กรุณาใช้ slug ที่ไม่ซ้ำ",
  "route-collision": "URL Slug นี้ชนกับ article route เดิม จึงไม่สามารถใช้เป็น Category URL ได้",
  "canonical-collision": "Canonical ของ Category นี้ถูก article อื่นอ้างเป็น canonical อยู่ กรุณาแก้ collision ก่อน",
  "active-has-redirect": "Category ที่ Active ต้องไม่มี Redirect To",
  "deactivation-without-redirect": "Category นี้เคยมี public ownership/บทความอ้างอิงอยู่ ต้องกำหนด Redirect To ก่อนเปลี่ยนเป็น Draft",
  "redirect-self": "Category ห้าม redirect กลับมาหาตัวเอง",
  "redirect-target-missing": "Redirect To หา Category ปลายทางไม่พบ",
  "redirect-target-not-active": "Redirect To ต้องชี้ไปยัง Category ที่ Active",
  "redirect-chain": "Redirect To ต้องชี้ตรงไปยัง Category ปลายทางสุดท้าย ห้ามสร้าง redirect chain",
  "redirect-loop": "Redirect นี้ทำให้เกิด redirect loop",
  "redirect-target-unsafe": "Redirect To ชี้ไปยัง Category ที่ยังมี validation/collision ไม่ผ่าน",
};

function firstIssueMessage(codes: CategoryRegistryIssueCode[]) {
  return codes.length ? ISSUE_MESSAGES[codes[0]] : true;
}

export function validateCategorySlugFormat(value?: { current?: string } | null) {
  const slug = value?.current?.trim() ?? "";
  if (!slug) return true;
  return CATEGORY_SLUG_PATTERN.test(slug)
    ? true
    : "URL Slug ใช้ได้เฉพาะ a-z, 0-9 และขีดกลาง โดยห้ามขึ้นต้น/ลงท้ายหรือมีขีดกลางซ้อน";
}

export async function validateCategoryRegistryDocument(
  document: Record<string, unknown> | undefined,
  context: ValidationContext,
): Promise<true | string> {
  if (!document) return true;
  const rawId = String(document._id ?? "");
  const id = publishedId(rawId);
  const slug = String((document.slug as { current?: string } | undefined)?.current ?? "").trim().toLowerCase();
  const status = String(document.status ?? "");
  const redirectToId = publishedId(String((document.redirectTo as { _ref?: string } | undefined)?._ref ?? ""));
  if (!id || !slug || !status) return true;
  if (!CATEGORY_SLUG_PATTERN.test(slug)) return validateCategorySlugFormat({ current: slug });

  try {
    const client = context.getClient({ apiVersion: API_VERSION }).withConfig({ useCdn: false, perspective: "drafts" });
    const publishedClient = client.withConfig({ perspective: "published" });
    const [categories, routeOwnerSlugs, canonicalOwnerUrls, referencedCategoryIds, publishedStatus] = await Promise.all([
      client.fetch<RawCategoryRegistryRow[]>(`*[_type == "category"] | order(_id asc){
        _id,title,"slug":slug.current,status,description,"redirectToId":redirectTo._ref,"redirectToSlug":redirectTo->slug.current
      }`),
      client.fetch<string[]>(`*[_type == "article" && defined(slug.current)].slug.current`),
      client.fetch<string[]>(`*[_type == "article" && defined(seo.canonical)].seo.canonical`),
      client.fetch<string[]>(`*[_type == "article" && defined(publishedAt) && defined(category._ref)].category._ref`),
      publishedClient.fetch<string | null>(`*[_type == "category" && _id == $id][0].status`, { id }),
    ]);

    // Sanity validation can run before the edited document is reflected in a
    // query result. Overlay the in-memory version so validation always covers
    // the exact value the editor is trying to publish.
    const currentRow: RawCategoryRegistryRow = {
      _id: id,
      title: String(document.title ?? ""),
      slug,
      status,
      description: typeof document.description === "string" ? document.description : undefined,
      redirectToId: redirectToId || undefined,
      redirectToSlug: redirectToId
        ? categories.find((category) => publishedId(String(category._id ?? "")) === redirectToId)?.slug
        : undefined,
    };
    const withoutCurrent = categories.filter((category) => publishedId(String(category._id ?? "")) !== id);
    const references = new Set(referencedCategoryIds.map(publishedId));
    if (publishedStatus === "active" && status === "draft") references.add(id);

    const registry = buildCategoryRegistry([...withoutCurrent, currentRow], {
      routeOwnerSlugs,
      canonicalOwnerUrls,
      referencedCategoryIds: references,
    });
    const codes = registry.issues.filter((issue) => issue.id === id).map((issue) => issue.code);
    return firstIssueMessage(codes);
  } catch {
    return "ตรวจสอบ Category Registry กับ Sanity ไม่สำเร็จ กรุณาลองใหม่ก่อน Publish";
  }
}

export function categoryCanonicalForValidation(slug: string) {
  return getCategoryCanonical(slug);
}

export async function validateArticleSlugAgainstCategoryRegistry(
  value: { current?: string } | null | undefined,
  context: ValidationContext,
): Promise<true | string> {
  const slug = value?.current?.trim().toLowerCase() ?? "";
  if (!slug || !CATEGORY_SLUG_PATTERN.test(slug)) return true;
  try {
    const client = context.getClient({ apiVersion: API_VERSION }).withConfig({ useCdn: false, perspective: "drafts" });
    const collision = await client.fetch<number>(
      `count(*[_type == "category" && slug.current == $slug])`,
      { slug },
    );
    return collision > 0
      ? "URL Slug นี้ถูก Category Registry ใช้เป็น /blog/<slug>/ แล้ว กรุณาใช้ slug บทความอื่น"
      : true;
  } catch {
    return "ตรวจสอบ article slug กับ Category Registry ไม่สำเร็จ กรุณาลองใหม่ก่อน Publish";
  }
}

export async function validateArticleCanonicalAgainstCategoryRegistry(
  value: string | null | undefined,
  context: ValidationContext,
): Promise<true | string> {
  if (!value?.trim()) return true;
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return true;
  }
  if (parsed.origin !== "https://ccpun.com" || parsed.search || parsed.hash) return true;
  const match = parsed.pathname.match(/^\/blog\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
  if (!match) return true;
  try {
    const client = context.getClient({ apiVersion: API_VERSION }).withConfig({ useCdn: false, perspective: "drafts" });
    const collision = await client.fetch<number>(
      `count(*[_type == "category" && slug.current == $slug])`,
      { slug: match[1] },
    );
    return collision > 0
      ? "Canonical นี้เป็นเจ้าของโดย Category Registry แล้ว ห้ามให้บทความ claim canonical ของหน้า Category"
      : true;
  } catch {
    return "ตรวจสอบ canonical กับ Category Registry ไม่สำเร็จ กรุณาลองใหม่ก่อน Publish";
  }
}

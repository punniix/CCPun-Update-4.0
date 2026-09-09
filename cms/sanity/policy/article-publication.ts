import type { SanityClient, SanityDocument } from "@sanity/client";

export type PublishableArticle = SanityDocument & {
  publishedAt?: string;
  contentUpdatedAt?: string;
  slug?: { current?: string };
  category?: { _ref?: string };
  review?: { status?: string };
};

export const reviewLabels: Record<string, string> = {
  drafting: "กำลังเขียน", "content-review": "กำลังตรวจเนื้อหา", "fact-check": "กำลังตรวจข้อเท็จจริง",
  "compliance-review": "กำลังตรวจข้อกำหนดและกฎหมาย", "ready-for-coo": "พร้อมให้คุณอนุมัติ", approved: "อนุมัติเนื้อหาแล้ว",
};

export function publicationSummary(published: unknown, draft: unknown) {
  return published
    ? draft ? "Live · มีฉบับแก้ไขที่ยังไม่เผยแพร่" : "Live · ฉบับปัจจุบันเผยแพร่อยู่"
    : "ฉบับร่าง · ยังไม่เผยแพร่";
}

function hasPendingReference(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const object = value as Record<string, unknown>;
  return (object._type === "reference" && (Boolean(object._strengthenOnPublish) || /^(drafts\.|versions\.)/.test(String(object._ref))))
    || Object.values(object).some(hasPendingReference);
}

export function articlePublishBlock(draft: PublishableArticle | null, published: PublishableArticle | null, now = Date.now()) {
  if (!draft || draft._type !== "article" || !draft._id.startsWith("drafts.") || !draft._rev) return "ไม่มีฉบับร่างพร้อมเผยแพร่";
  if (draft.review?.status !== "approved") return "เลือกสถานะ อนุมัติเนื้อหาแล้ว ก่อนเผยแพร่";
  if (published && published._id !== draft._id.slice(7)) return "ฉบับร่างและฉบับเผยแพร่ไม่ตรงกัน";
  if (published && (!published._rev || !published.publishedAt)) return "ให้ผู้ดูแลตรวจวันเผยแพร่เดิมก่อนดำเนินการ";
  if (published && (draft.slug?.current !== published.slug?.current || draft.category?._ref !== published.category?._ref)) return "URL หรือหมวดหมู่ต่างจากฉบับ Live ต้องผ่าน SEO Migration ก่อน";
  const firstDate = published?.publishedAt || draft.publishedAt;
  if (firstDate && (!Number.isFinite(Date.parse(firstDate)) || Date.parse(firstDate) > now)) return "ตรวจวันเผยแพร่ หรือใช้ Schedule สำหรับวันในอนาคต";
  if (hasPendingReference(draft)) return "เผยแพร่เอกสารที่อ้างอิงและเชื่อมโยงใหม่ให้เรียบร้อยก่อนเผยแพร่บทความ";
  return null;
}

/** Atomic publication: failed/conflicting writes leave both versions and dates untouched. */
export async function publishApprovedArticle(client: SanityClient, draft: PublishableArticle, published: PublishableArticle | null, now = new Date().toISOString()) {
  const blocked = articlePublishBlock(draft, published, Date.parse(now));
  if (blocked) throw new Error(blocked);
  const publishedId = draft._id.slice(7);
  const document = { ...draft, _id: publishedId, publishedAt: published?.publishedAt || draft.publishedAt || now, contentUpdatedAt: now };
  // Sanity owns document system metadata; content and existing weak references stay intact.
  const payload: Record<string, unknown> = { ...document };
  for (const field of ["_rev", "_createdAt", "_updatedAt", "_system"]) delete payload[field];
  let transaction = client.transaction().patch(draft._id, (patch) => patch.ifRevisionId(draft._rev).unset(["_empty_action_guard_pseudo_field_"]));
  if (published) {
    transaction = transaction.patch(publishedId, (patch) => patch.ifRevisionId(published._rev).unset(["_empty_action_guard_pseudo_field_"]))
      .createOrReplace(payload as PublishableArticle);
  } else {
    // Create fails if another editor publishes between confirmation and commit.
    transaction = transaction.create(payload as PublishableArticle);
  }
  return transaction.delete(draft._id).commit({ visibility: "sync", tag: "article.optimize.publish" });
}

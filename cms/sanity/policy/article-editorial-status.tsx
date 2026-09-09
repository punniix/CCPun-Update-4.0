"use client";

import { useEditState, useWorkspace, type ObjectInputProps, type DocumentBadgeComponent } from "sanity";
import { IntentLink } from "sanity/router";
import { publicationSummary, reviewLabels } from "./article-publication";

function ArticleDraftPreview({ id, slug, categoryId }: { id: string; slug: string; categoryId: string }) {
  const category = useEditState(categoryId.replace(/^drafts\./, ""), "category");
  const categorySlug = ((category.draft || category.published)?.slug as { current?: string } | undefined)?.current;
  if (!category.ready) return <span>กำลังเตรียมตัวอย่างบทความ…</span>;
  if (!categorySlug) return <span>ตรวจหมวดหมู่และ URL ของบทความก่อนดูตัวอย่าง</span>;
  return <IntentLink
    intent="edit"
    params={{ id, type: "article", mode: "presentation", presentation: "presentation", preview: `/blog/${encodeURIComponent(categorySlug)}/${encodeURIComponent(slug)}/` }}
    style={{ display: "inline-block", border: "1px solid currentColor", borderRadius: 4, padding: "10px 16px", color: "inherit", textDecoration: "none" }}
  >ดูตัวอย่าง</IntentLink>;
}

export function ArticleEditorialInput(props: ObjectInputProps) {
  const id = String(props.value?._id || "").replace(/^drafts\./, "");
  const { published, draft, ready } = useEditState(id, "article");
  const { projectId, dataset } = useWorkspace();
  const document = props.value || draft || published;
  const review = document?.review as { status?: string } | undefined;
  const slug = (document?.slug as { current?: string } | undefined)?.current;
  const categoryId = (document?.category as { _ref?: string } | undefined)?._ref;
  return <>
    <section aria-label="สถานะบทความ" style={{ border: "1px solid var(--card-border-color)", padding: 16, marginBottom: 16 }}>
      <strong>{ready ? publicationSummary(published, draft) : "กำลังตรวจสถานะบทความ…"}</strong>
      <p>สถานะตรวจสอบ: {reviewLabels[review?.status || ""] || "ยังไม่ได้ระบุ"}</p>
      <p>{published ? "ฉบับเดิมยังอยู่บนเว็บไซต์ การแก้ไขจะไม่เปลี่ยน Live จนกว่าจะยืนยันเผยแพร่" : "การบันทึกฉบับร่างยังไม่ใช่การเผยแพร่บนเว็บไซต์"}</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        {id && slug && categoryId ? <ArticleDraftPreview id={id} slug={slug} categoryId={categoryId} /> : <span>ระบุ URL และหมวดหมู่ก่อนดูตัวอย่าง</span>}
        <button type="button" onClick={() => props.onPathFocus(["review", "status"])} style={{ padding: "10px 16px", cursor: "pointer" }}>{published ? "อนุมัติก่อนอัปเดต" : "อนุมัติก่อนเผยแพร่"}</button>
      </div>
      <p>ดูตัวอย่าง → กด {published ? "อนุมัติก่อนอัปเดต" : "อนุมัติก่อนเผยแพร่"} แล้วเลือก อนุมัติเนื้อหาแล้ว → กด {published ? "อัปเดตบทความ" : "เผยแพร่บทความ"} ที่แถบด้านล่าง</p>
      {projectId === "ccb9lnw5" && dataset === "uat" && <small>ใน UAT ทดสอบการแก้ไขและตัวอย่างได้ แต่ปุ่มเผยแพร่ถูกปิดตามนโยบาย</small>}
    </section>
    {props.renderDefault(props)}
  </>;
}

export const ArticleLiveBadge: DocumentBadgeComponent = ({ published, draft }) => ({
  label: publicationSummary(published, draft), color: published ? draft ? "warning" : "success" : "primary",
  title: "สถานะเว็บไซต์แยกจากสถานะตรวจเนื้อหา",
});

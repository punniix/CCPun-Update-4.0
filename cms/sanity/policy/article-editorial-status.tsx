"use client";

import { useEditState, type ObjectInputProps, type DocumentBadgeComponent } from "sanity";
import { publicationSummary, reviewLabels } from "./article-publication";

export function ArticleEditorialInput(props: ObjectInputProps) {
  const id = String(props.value?._id || "").replace(/^drafts\./, "");
  const { published, draft, ready } = useEditState(id, "article");
  const review = (draft || published)?.review as { status?: string } | undefined;
  return <>
    <section aria-label="สถานะบทความ" style={{ border: "1px solid var(--card-border-color)", padding: 16, marginBottom: 16 }}>
      <strong>{ready ? publicationSummary(published, draft) : "กำลังตรวจสถานะบทความ…"}</strong>
      <p>สถานะตรวจสอบ: {reviewLabels[review?.status || ""] || "ยังไม่ได้ระบุ"}</p>
      <p>{published ? "ฉบับเดิมยังอยู่บนเว็บไซต์ การแก้ไขจะไม่เปลี่ยน Live จนกว่าจะยืนยันเผยแพร่" : "การบันทึกฉบับร่างยังไม่ใช่การเผยแพร่บนเว็บไซต์"}</p>
      <p>1. แก้ฉบับร่าง → 2. ตรวจในแท็บตัวอย่างเว็บไซต์ → 3. ไปที่ ตัวอย่าง / สถานะเผยแพร่ แล้วเลือก อนุมัติเนื้อหาแล้ว → 4. ยืนยันอนุมัติและเผยแพร่</p>
      <small>ใน UAT ทดสอบการแก้ไขและตัวอย่างได้ แต่ปุ่มเผยแพร่ถูกปิดตามนโยบาย</small>
    </section>
    {props.renderDefault(props)}
  </>;
}

export const ArticleLiveBadge: DocumentBadgeComponent = ({ published, draft }) => ({
  label: publicationSummary(published, draft), color: published ? draft ? "warning" : "success" : "primary",
  title: "สถานะเว็บไซต์แยกจากสถานะตรวจเนื้อหา",
});

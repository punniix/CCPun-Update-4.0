"use client";

import { useEffect, useRef, useState } from "react";
import { PatchEvent, set, useEditState, useSyncState, useWorkspace, type ObjectInputProps, type DocumentBadgeComponent } from "sanity";
import { IntentLink } from "sanity/router";
import { requestArticleLineCopy, type ArticleLineCopyResult } from "./article-line-copy-action";
import { publicationSummary, reviewLabels } from "./article-publication";

type ArticleLineCopyDocument = {
  _rev?: string;
  lineTitle?: string;
  lineDescription?: string;
};

function ArticleLineCopyGenerator({
  id,
  draft,
  published,
  syncing,
  onApply,
  onFocus,
}: {
  id: string;
  draft: ArticleLineCopyDocument | null;
  published: ArticleLineCopyDocument | null;
  syncing: boolean;
  onApply: (result: ArticleLineCopyResult) => void;
  onFocus: () => void;
}) {
  const source = draft ?? published;
  const existingTitle = source?.lineTitle?.trim() ?? "";
  const existingDescription = source?.lineDescription?.trim() ?? "";
  const complete = Boolean(existingTitle && existingDescription);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!busy) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1_000);
    return () => window.clearInterval(timer);
  }, [busy]);

  const missing = [
    !existingTitle ? "หัวข้อ" : null,
    !existingDescription ? "คำโปรย" : null,
  ].filter(Boolean).join(" + ");
  const disabled = busy || syncing || complete || !id || !source?._rev;

  async function generate() {
    if (inFlight.current || disabled || !source?._rev) return;
    inFlight.current = true;
    setElapsed(0);
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const result = await requestArticleLineCopy(id, source._rev);
      onApply(result);
      setMessage(result.status === "skipped-existing"
        ? "ข้อความ LINE มีครบแล้ว จึงไม่ได้เขียนทับ"
        : `สร้าง${missing || "ข้อความ LINE"}แล้ว และบันทึกไว้ใน Draft`);
      onFocus();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ยังสร้างข้อความ LINE ไม่สำเร็จ");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section aria-label="สร้างข้อความสำหรับ LINE Card" style={{ border: "1px solid var(--card-border-color)", padding: 16, marginBottom: 16 }}>
      <strong>ข้อความสำหรับ LINE Card</strong>
      <p style={{ marginBottom: 12 }}>
        สร้างหัวข้อและคำโปรยจากเนื้อหาบทความด้วย Local AI ผ่าน n8n โดยไม่เปลี่ยนชื่อบทความ เนื้อหา หรือ SEO
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={disabled}
          style={{ padding: "10px 16px", cursor: disabled ? "not-allowed" : "pointer" }}
        >
          {busy ? `กำลังสร้างข้อความ LINE… ${elapsed} วินาที` : complete ? "ข้อความ LINE พร้อมแล้ว" : "สร้างข้อความ LINE ด้วย AI"}
        </button>
        <span>
          {complete
            ? "หัวข้อและคำโปรยครบแล้ว"
            : source?._rev
              ? `ยังขาด: ${missing || "ข้อความ LINE"}`
              : "บันทึกบทความอย่างน้อย 1 ครั้งก่อน"}
        </span>
      </div>
      <p style={{ marginBottom: 0 }}>
        {draft
          ? "ระบบจะเติมเฉพาะช่องที่ยังว่างและไม่เขียนทับข้อความเดิม"
          : published
            ? "บทความ Live ที่ยังไม่มี Draft จะถูกสร้าง Draft ให้ก่อน หน้า Live จะไม่เปลี่ยนจนกว่าคุณจะยืนยันเผยแพร่"
            : "ใช้ได้กับบทความทุกสถานะหลังมี revision แรก"}
      </p>
      {message ? <p role="status" style={{ marginBottom: 0 }}>{message}</p> : null}
      {error ? <p role="alert" style={{ marginBottom: 0 }}>{error}</p> : null}
    </section>
  );
}

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
  const sync = useSyncState(id, "article");
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
    <ArticleLineCopyGenerator
      id={id}
      draft={draft as ArticleLineCopyDocument | null}
      published={published as ArticleLineCopyDocument | null}
      syncing={sync.isSyncing}
      onApply={(result) => {
        const patches = [];
        if (result.lineTitle) patches.push(set(result.lineTitle, ["lineTitle"]));
        if (result.lineDescription) patches.push(set(result.lineDescription, ["lineDescription"]));
        if (patches.length > 0) props.onChange(PatchEvent.from(patches));
      }}
      onFocus={() => props.onPathFocus(["lineTitle"])}
    />
    {props.renderDefault(props)}
  </>;
}

export const ArticleLiveBadge: DocumentBadgeComponent = ({ published, draft }) => ({
  label: publicationSummary(published, draft), color: published ? draft ? "warning" : "success" : "primary",
  title: "สถานะเว็บไซต์แยกจากสถานะตรวจเนื้อหา",
});

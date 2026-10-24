"use client";

import { useEffect, useRef, useState } from "react";
import { useSyncState, type DocumentActionComponent } from "sanity";

import type { AdminEnvironment } from "../../../lib/admin/environment";
import type { PublishableArticle } from "./article-publication";
import { LINE_TITLE_DEFAULT_INSTRUCTIONS, LINE_DESCRIPTION_DEFAULT_INSTRUCTIONS, lineEditorialInstructionsSchema, type LineEditorialInstructions } from "../../../lib/local-ai/editorial-instructions";

type LineArticle = PublishableArticle & {
  lineTitle?: string;
  lineDescription?: string;
};

const errorMessages: Record<string, string> = {
  "line-copy-draft-required": "ต้องมีฉบับร่างก่อนจึงจะสร้างข้อความ LINE ได้",
  "line-copy-conflict": "บทความเปลี่ยนไประหว่างทำรายการ กรุณาโหลดฉบับล่าสุดแล้วลองใหม่",
  "line-copy-published-required": "บทความนี้ยังไม่เคยเผยแพร่ จึงยังใช้การเผยแพร่เฉพาะ LINE ไม่ได้",
  "line-copy-published-line-required": "ต้องมี LINE Title และ LINE Description ที่เผยแพร่แล้วก่อนจึงจะปรับปรุงได้",
  "line-copy-invalid-result": "ผลจาก Local AI ยังไม่ผ่านกติกา LINE จึงไม่ได้บันทึกลงบทความ",
  "line-copy-orchestrator-unavailable": "n8n / Local AI ยังไม่พร้อม ระบบจึงไม่ได้แก้บทความ",
  "line-copy-orchestrator-timeout": "Local AI ใช้เวลานานเกินกำหนด ระบบจึงไม่ได้แก้บทความ",
  "line-copy-orchestrator-failed": "n8n ยังทำรายการไม่สำเร็จ ระบบจึงไม่ได้แก้บทความ",
  "line-copy-generation-failed": "Local AI ยังสร้างข้อความที่ผ่านกติกาไม่ได้ ระบบจึงไม่ได้แก้บทความ",
  "line-copy-unavailable": "ระบบ LINE copy ยังไม่พร้อม กรุณาลองใหม่ภายหลัง",
  "invalid-input": "ข้อมูลบทความเปลี่ยนไปหรือไม่ครบ กรุณาโหลดฉบับล่าสุดแล้วลองใหม่",
  "invalid-origin": "เซสชันนี้ไม่สามารถทำรายการได้ กรุณาโหลด Studio ใหม่",
  "forbidden": "บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้",
};

async function readError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return errorMessages[payload?.error ?? ""] ?? "ระบบยังทำรายการนี้ไม่สำเร็จ และยังไม่ได้แก้บทความ";
}

function logicalId(value: string) {
  return value.replace(/^drafts\./, "");
}

export type ArticleLineCopyResult = {
  status?: string;
  lineTitle?: string;
  lineDescription?: string;
  appliedFields?: string[];
  revision?: string;
};

export async function requestArticleLineCopy(id: string, sourceRevision: string, editorialInstructions?: LineEditorialInstructions) {
  if (!lineEditorialInstructionsSchema.optional().safeParse(editorialInstructions).success) throw new Error("คำแนะนำแต่ละช่องต้องมี 1–200 ตัวอักษร และไม่เกิน 600 ไบต์ กรุณาย่อข้อความแล้วลองใหม่");
  const endpoint = `/api/admin/content/${encodeURIComponent(logicalId(id))}/line-copy/generate/`;
  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sourceRevision, requestId: crypto.randomUUID(), ...(editorialInstructions === undefined ? {} : { editorialInstructions }) }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const result = await response.json() as ArticleLineCopyResult;
  if (!["applied", "skipped-existing"].includes(result.status ?? "")) {
    throw new Error("ระบบตอบผล LINE copy ไม่ครบ");
  }
  return result;
}

export function LineEditorialFields({ title, description, showTitle = true, showDescription = true, busy, onTitle, onDescription }: {
  title: string; description: string; showTitle?: boolean; showDescription?: boolean; busy: boolean; onTitle: (value: string) => void; onDescription: (value: string) => void;
}) {
  return <div style={{ display: "grid", gap: 16 }}>
    <p>ปรับแนวทางการเขียนก่อนสร้างได้ ใช้เพื่อกำหนดน้ำเสียงและสิ่งที่อยากเน้น ข้อมูลอ้างอิงและกติกาความปลอดภัยยังยึดจากบทความ</p>
    {showTitle && <div><label style={{ display: "grid", gap: 8 }}>คำแนะนำสำหรับ LINE Title<textarea value={title} disabled={busy} onChange={event => onTitle(event.currentTarget.value)} rows={3} style={{ font: "inherit", width: "100%" }} /></label><p>ผลลัพธ์: 24–60 ตัวอักษรตามการนับของระบบ</p><button type="button" disabled={busy} onClick={() => onTitle(LINE_TITLE_DEFAULT_INSTRUCTIONS)}>คืนค่าเริ่มต้นของ Title</button></div>}
    {showDescription && <div><label style={{ display: "grid", gap: 8 }}>คำแนะนำสำหรับ LINE Description<textarea value={description} disabled={busy} onChange={event => onDescription(event.currentTarget.value)} rows={3} style={{ font: "inherit", width: "100%" }} /></label><p>ผลลัพธ์: 50–90 ตัวอักษรตามการนับของระบบ</p><button type="button" disabled={busy} onClick={() => onDescription(LINE_DESCRIPTION_DEFAULT_INSTRUCTIONS)}>คืนค่าเริ่มต้นของ Description</button></div>}
    <p>คำแนะนำแต่ละช่อง: 1–200 ตัวอักษร และไม่เกิน 600 ไบต์ ไม่ได้บันทึกเป็นเนื้อหาบทความ</p>
  </div>;
}

export function createGenerateArticleLineCopyAction(): DocumentActionComponent {
  const GenerateArticleLineCopyAction: DocumentActionComponent = (props) => {
    const draft = props.draft as LineArticle | null;
    const published = props.published as LineArticle | null;
    const sync = useSyncState(props.id, props.type);
    const [busy, setBusy] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [customize, setCustomize] = useState(false);
    const [titleInstructions, setTitleInstructions] = useState(LINE_TITLE_DEFAULT_INSTRUCTIONS);
    const [descriptionInstructions, setDescriptionInstructions] = useState(LINE_DESCRIPTION_DEFAULT_INSTRUCTIONS);
    const inFlight = useRef(false);

    useEffect(() => {
      if (!busy) {
        setElapsed(0);
        return;
      }
      const startedAt = Date.now();
      const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1_000);
      return () => window.clearInterval(timer);
    }, [busy]);

    const source = draft ?? published;
    const existingTitle = source?.lineTitle?.trim() ?? "";
    const existingDescription = source?.lineDescription?.trim() ?? "";
    const complete = Boolean(existingTitle && existingDescription);
    const disabled = Boolean(busy || sync.isSyncing || complete || !source?._rev || props.version || props.liveEdit);

    async function generate() {
      if (inFlight.current || disabled || !source?._rev) return;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      try {
        await requestArticleLineCopy(props.id, source._rev, { ...(!existingTitle ? { lineTitle: titleInstructions } : {}), ...(!existingDescription ? { lineDescription: descriptionInstructions } : {}) });
        setCustomize(false);
        props.onComplete();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "ระบบยังทำรายการนี้ไม่สำเร็จ และยังไม่ได้แก้บทความ");
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    }

    return {
      label: busy ? `กำลังสร้างข้อความ LINE… ${elapsed} วินาที` : complete ? "LINE พร้อมแล้ว" : "สร้างข้อความ LINE",
      title: complete
        ? "บทความนี้มีหัวข้อและคำโปรย LINE ครบแล้ว ระบบจะไม่สร้างซ้ำหรือเขียนทับ"
        : draft
          ? "สร้างเฉพาะหัวข้อหรือคำโปรย LINE ที่ยังว่างด้วย Local AI ผ่าน n8n"
          : published
            ? "สร้าง Draft จากฉบับ Live แล้วเติมเฉพาะหัวข้อหรือคำโปรย LINE ที่ยังว่าง"
            : "บันทึกบทความก่อน แล้วจึงสร้างข้อความ LINE ได้",
      disabled,
      onHandle: () => { setError(null); setCustomize(true); },
      dialog: customize ? {
        type: "dialog",
        header: "ปรับคำแนะนำก่อนสร้างข้อความ LINE",
        content: <div><LineEditorialFields title={titleInstructions} description={descriptionInstructions} showTitle={!existingTitle} showDescription={!existingDescription} busy={busy} onTitle={setTitleInstructions} onDescription={setDescriptionInstructions} />{error && <p role="alert">{error}</p>}<button type="button" disabled={disabled} onClick={() => void generate()}>{busy ? `กำลังสร้างข้อความ LINE… ${elapsed} วินาที` : "สร้างข้อความ LINE"}</button></div>,
        onClose: () => { if (!busy) setCustomize(false); },
      } : null,
    };
  };
  GenerateArticleLineCopyAction.displayName = "CCPunGenerateArticleLineCopyAction";
  return GenerateArticleLineCopyAction;
}

export function createPublishArticleLineOnlyAction(): DocumentActionComponent {
  const PublishArticleLineOnlyAction: DocumentActionComponent = (props) => {
    const draft = props.draft as LineArticle | null;
    const published = props.published as LineArticle | null;
    const sync = useSyncState(props.id, props.type);
    const [busy, setBusy] = useState(false);
    const [confirm, setConfirm] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inFlight = useRef(false);

    if (!published || !draft) return null;
    const currentDraft = draft;
    const currentPublished = published;

    const draftTitle = currentDraft.lineTitle?.trim() ?? "";
    const draftDescription = currentDraft.lineDescription?.trim() ?? "";
    const publishedTitle = currentPublished.lineTitle?.trim() ?? "";
    const publishedDescription = currentPublished.lineDescription?.trim() ?? "";
    const changed = Boolean(
      (draftTitle && draftTitle !== publishedTitle) ||
      (draftDescription && draftDescription !== publishedDescription),
    );
    const disabled = Boolean(busy || sync.isSyncing || !changed || !currentDraft._rev || !currentPublished._rev || props.version || props.liveEdit);
    const endpoint = `/api/admin/content/${encodeURIComponent(logicalId(props.id))}/line-copy/publish/`;

    async function publishLineOnly() {
      if (inFlight.current || disabled || !currentDraft._rev || !currentPublished._rev) return;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ draftRevision: currentDraft._rev, publishedRevision: currentPublished._rev }),
        });
        if (!response.ok) throw new Error(await readError(response));
        const result = await response.json() as { status?: string };
        if (!["published-line-only", "already-current"].includes(result.status ?? "")) throw new Error("ระบบตอบผล Publish LINE ไม่ครบ");
        props.onComplete();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "ระบบยังทำรายการนี้ไม่สำเร็จ และยังไม่ได้เปลี่ยนหน้า Live");
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    }

    return {
      label: busy ? "กำลังเผยแพร่ LINE…" : changed ? "เผยแพร่เฉพาะข้อความ LINE" : "LINE บน Live เป็นปัจจุบันแล้ว",
      title: "เผยแพร่เฉพาะ LINE Title / LINE Description จาก Draft โดยไม่แตะเนื้อหา SEO, Body, FAQ หรือฟิลด์อื่น",
      disabled,
      onHandle: () => setConfirm(true),
      dialog: error ? {
        type: "dialog",
        header: "ยัง Publish LINE ไม่สำเร็จ",
        content: <p role="alert">{error}</p>,
        onClose: () => setError(null),
      } : confirm ? {
        type: "confirm",
        message: "เผยแพร่เฉพาะ LINE Title / LINE Description ไปที่ Live ใช่ไหม? เนื้อหาและงาน SEO อื่นใน Draft จะยังไม่ถูกเผยแพร่",
        confirmButtonText: "เผยแพร่เฉพาะข้อความ LINE",
        cancelButtonText: "ยกเลิก",
        onCancel: () => setConfirm(false),
        onConfirm: () => {
          setConfirm(false);
          void publishLineOnly();
        },
      } : null,
    };
  };
  PublishArticleLineOnlyAction.displayName = "CCPunPublishArticleLineOnlyAction";
  return PublishArticleLineOnlyAction;
}

type LineCopyProposal = {
  draftRevision: string;
  publishedRevision: string;
  currentLineTitle: string;
  currentLineDescription: string;
  draftLineTitle: string | null;
  draftLineDescription: string | null;
  lineTitle: string;
  lineDescription: string;
  proposalToken: string;
};

export function createImproveArticleLineCopyAction(): DocumentActionComponent {
  const ImproveArticleLineCopyAction: DocumentActionComponent = (props) => {
    const draft = props.draft as LineArticle | null;
    const published = props.published as LineArticle | null;
    const sync = useSyncState(props.id, props.type);
    const [busy, setBusy] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [proposal, setProposal] = useState<LineCopyProposal | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [customize, setCustomize] = useState(false);
    const [titleInstructions, setTitleInstructions] = useState(LINE_TITLE_DEFAULT_INSTRUCTIONS);
    const [descriptionInstructions, setDescriptionInstructions] = useState(LINE_DESCRIPTION_DEFAULT_INSTRUCTIONS);
    const inFlight = useRef(false);

    useEffect(() => {
      if (!busy) {
        setElapsed(0);
        return;
      }
      const startedAt = Date.now();
      const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1_000);
      return () => window.clearInterval(timer);
    }, [busy]);

    if (!published?.lineTitle?.trim() || !published.lineDescription?.trim()) return null;
    const disabled = Boolean(busy || sync.isSyncing || !draft?._rev || !published._rev || props.version || props.liveEdit);
    const endpoint = `/api/admin/content/${encodeURIComponent(logicalId(props.id))}/line-copy/improve/`;

    async function improve() {
      if (inFlight.current || disabled || !draft?._rev || !published?._rev) return;
      const editorialInstructions = { lineTitle: titleInstructions, lineDescription: descriptionInstructions };
      if (!lineEditorialInstructionsSchema.safeParse(editorialInstructions).success) { setError("คำแนะนำแต่ละช่องต้องมี 1–200 ตัวอักษร และไม่เกิน 600 ไบต์ กรุณาย่อข้อความแล้วลองใหม่"); return; }
      inFlight.current = true;
      setBusy(true);
      setError(null);
      setProposal(null);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "propose", draftRevision: draft._rev, publishedRevision: published._rev, requestId: crypto.randomUUID(), editorialInstructions }),
        });
        if (!response.ok) throw new Error(await readError(response));
        const result = await response.json() as LineCopyProposal & { status?: string };
        if (result.status !== "proposed" || !result.lineTitle || !result.lineDescription || !result.draftRevision || !result.publishedRevision || !result.proposalToken) {
          throw new Error("ระบบตอบข้อเสนอ LINE copy ไม่ครบ");
        }
        setProposal(result);
        setCustomize(false);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "ระบบยังสร้างข้อเสนอ LINE copy ไม่สำเร็จ");
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    }

    async function accept() {
      if (inFlight.current || !proposal) return;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "accept",
            draftRevision: proposal.draftRevision,
            publishedRevision: proposal.publishedRevision,
            lineTitle: proposal.lineTitle,
            lineDescription: proposal.lineDescription,
            proposalToken: proposal.proposalToken,
          }),
        });
        if (!response.ok) throw new Error(await readError(response));
        const result = await response.json() as { status?: string };
        if (!["applied", "already-current"].includes(result.status ?? "")) throw new Error("ระบบตอบผล LINE copy ไม่ครบ");
        setProposal(null);
        props.onComplete();
      } catch (caught) {
        setProposal(null);
        setError(caught instanceof Error ? caught.message : "ยังไม่ได้บันทึกข้อเสนอใน Draft");
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    }

    return {
      label: busy ? `กำลังปรับปรุง LINE… ${elapsed} วินาที` : "ปรับข้อความ LINE ด้วย AI",
      title: "ปรับปรุงจาก LINE Title / Description ที่เผยแพร่แล้ว โดยไม่ส่งเนื้อหาบทความให้ Local AI",
      disabled,
      onHandle: () => { setError(null); setCustomize(true); },
      dialog: customize ? {
        type: "dialog",
        header: "ปรับคำแนะนำก่อนให้ AI ปรับข้อความ LINE",
        content: <div><LineEditorialFields title={titleInstructions} description={descriptionInstructions} busy={busy} onTitle={setTitleInstructions} onDescription={setDescriptionInstructions} />{error && <p role="alert">{error}</p>}<button type="button" disabled={disabled} onClick={() => void improve()}>{busy ? `กำลังปรับปรุง LINE… ${elapsed} วินาที` : "สร้างข้อเสนอ LINE copy"}</button></div>,
        onClose: () => { if (!busy) setCustomize(false); },
      } : error ? {
        type: "dialog",
        header: "ยังปรับปรุง LINE copy ไม่สำเร็จ",
        content: <p role="alert">{error}</p>,
        onClose: () => setError(null),
      } : proposal ? {
        type: "dialog",
        header: "ตรวจข้อเสนอ LINE copy ก่อนบันทึก Draft",
        content: <div>
          <p><strong>LINE Title ปัจจุบัน:</strong> {proposal.currentLineTitle}</p>
          <p><strong>ข้อเสนอ:</strong> {proposal.lineTitle}</p>
          <p><strong>LINE Description ปัจจุบัน:</strong> {proposal.currentLineDescription}</p>
          <p><strong>ข้อเสนอ:</strong> {proposal.lineDescription}</p>
          {(proposal.draftLineTitle?.trim() !== proposal.currentLineTitle || proposal.draftLineDescription?.trim() !== proposal.currentLineDescription) &&
            <p role="alert">Draft มี LINE copy ต่างจาก Live การยอมรับจะเขียนทับ LINE Title และ Description ใน Draft เท่านั้น</p>}
          <p>ตรวจแล้วกดบันทึก Draft จากนั้นใช้ “เผยแพร่เฉพาะข้อความ LINE” แยกต่างหากเมื่อพร้อมเผยแพร่</p>
          <button type="button" disabled={busy} onClick={() => void accept()}>ยอมรับและบันทึกใน Draft</button>
        </div>,
        onClose: () => setProposal(null),
      } : null,
    };
  };
  ImproveArticleLineCopyAction.displayName = "CCPunImproveArticleLineCopyAction";
  return ImproveArticleLineCopyAction;
}

export function appendArticleLineCopyActions(
  actions: DocumentActionComponent[],
  environment: AdminEnvironment,
  schemaType?: string,
) {
  if (!["production-admin", "admin-uat", "local-uat"].includes(environment) || schemaType !== "article") return actions;
  return [
    ...actions,
    createGenerateArticleLineCopyAction(),
    createImproveArticleLineCopyAction(),
    createPublishArticleLineOnlyAction(),
  ];
}

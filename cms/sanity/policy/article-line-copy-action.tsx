"use client";

import { useEffect, useRef, useState } from "react";
import { useSyncState, type DocumentActionComponent } from "sanity";

import type { AdminEnvironment } from "../../../lib/admin/environment";
import type { PublishableArticle } from "./article-publication";

type LineArticle = PublishableArticle & {
  lineTitle?: string;
  lineDescription?: string;
};

const errorMessages: Record<string, string> = {
  "line-copy-draft-required": "ต้องมีฉบับร่างก่อนจึงจะสร้างข้อความ LINE ได้",
  "line-copy-conflict": "บทความเปลี่ยนไประหว่างทำรายการ กรุณาโหลดฉบับล่าสุดแล้วลองใหม่",
  "line-copy-published-required": "บทความนี้ยังไม่เคยเผยแพร่ จึงยังใช้การเผยแพร่เฉพาะ LINE ไม่ได้",
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

export function createGenerateArticleLineCopyAction(): DocumentActionComponent {
  const GenerateArticleLineCopyAction: DocumentActionComponent = (props) => {
    const draft = props.draft as LineArticle | null;
    const sync = useSyncState(props.id, props.type);
    const [busy, setBusy] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [error, setError] = useState<string | null>(null);
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

    const existingTitle = draft?.lineTitle?.trim() ?? "";
    const existingDescription = draft?.lineDescription?.trim() ?? "";
    const complete = Boolean(existingTitle && existingDescription);
    const disabled = Boolean(busy || sync.isSyncing || complete || !draft?._rev || props.version || props.liveEdit);
    const endpoint = `/api/admin/content/${encodeURIComponent(logicalId(props.id))}/line-copy/generate/`;

    async function generate() {
      if (inFlight.current || disabled || !draft?._rev) return;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ draftRevision: draft._rev, requestId: crypto.randomUUID() }),
        });
        if (!response.ok) throw new Error(await readError(response));
        const result = await response.json() as { status?: string };
        if (!["applied", "skipped-existing"].includes(result.status ?? "")) throw new Error("ระบบตอบผล LINE copy ไม่ครบ");
        props.onComplete();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "ระบบยังทำรายการนี้ไม่สำเร็จ และยังไม่ได้แก้บทความ");
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    }

    return {
      label: busy ? `กำลังสร้าง LINE… ${elapsed} วินาที` : complete ? "LINE พร้อมแล้ว" : "Generate LINE copy",
      title: complete
        ? "บทความนี้มี LINE Title และ LINE Description ครบแล้ว ระบบจะไม่สร้างซ้ำหรือเขียนทับ"
        : draft
          ? "สร้างเฉพาะ LINE Title / Description ที่ยังว่างด้วย Local AI ผ่าน n8n"
          : "ต้องมีฉบับร่างก่อนจึงจะสร้างข้อความ LINE ได้",
      disabled,
      onHandle: () => void generate(),
      dialog: error ? {
        type: "dialog",
        header: "ยังสร้าง LINE copy ไม่สำเร็จ",
        content: <p role="alert">{error}</p>,
        onClose: () => setError(null),
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
      label: busy ? "กำลังเผยแพร่ LINE…" : changed ? "Publish LINE only" : "LINE บน Live เป็นปัจจุบันแล้ว",
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
        confirmButtonText: "Publish LINE only",
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

export function appendArticleLineCopyActions(
  actions: DocumentActionComponent[],
  environment: AdminEnvironment,
  schemaType?: string,
) {
  if (!["production-admin", "admin-uat", "local-uat"].includes(environment) || schemaType !== "article") return actions;
  return [
    ...actions,
    createGenerateArticleLineCopyAction(),
    createPublishArticleLineOnlyAction(),
  ];
}

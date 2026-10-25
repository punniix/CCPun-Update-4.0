"use client";

import { useRef, useState } from "react";
import { useClient, useSyncState, useValidationStatus, type DocumentActionComponent } from "sanity";
import type { AdminEnvironment } from "../../../lib/admin/environment";
import { articlePublishBlock, hasArticleContentChanges, publishApprovedArticle, type PublishableArticle } from "./article-publication";

// Publication stays authoritative; the VPS sweeper recovers a missed callback.
async function queuePostPublishSeo(articleId: string) {
  if (process.env.NEXT_PUBLIC_CCPUN_POST_PUBLISH_SEO_ENABLED !== "1") return;
  try {
    const queued = await fetch("/api/admin/seo/post-publish/", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId }),
    });
    if (!queued.ok || queued.status !== 202) {
      console.warn("SEO_POST_PUBLISH_QUEUE_PENDING_RECONCILIATION");
    }
  } catch {
    console.warn("SEO_POST_PUBLISH_QUEUE_PENDING_RECONCILIATION");
  }
}

export function createGoogleSafeArticlePublishAction(originalAction: DocumentActionComponent): DocumentActionComponent {
  const GoogleSafeArticlePublishAction: DocumentActionComponent = (props) => {
    const result = originalAction(props);
    const client = useClient({ apiVersion: "2025-02-19" });
    const sync = useSyncState(props.id, props.type);
    const validation = useValidationStatus(props.draft?._id || props.id, props.type, true);
    const [confirmation, setConfirmation] = useState<{ draft: string; published?: string; optimization: boolean } | null>(null);
    const [isPublishing, setIsPublishing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inFlight = useRef(false);
    const draft = props.draft as PublishableArticle | null;
    const published = props.published as PublishableArticle | null;
    const blocked = articlePublishBlock(draft, published);
    const disabled = Boolean(result?.disabled || sync.isSyncing || validation.isValidating || validation.validation.some((item) => item.level === "error") || blocked || isPublishing || props.version || props.liveEdit);
    if (!result) return null;

    return {
      ...result,
      disabled,
      label: isPublishing ? "กำลังเผยแพร่…" : blocked || (published ? "อัปเดตบทความ" : "เผยแพร่บทความ"),
      title: "ตรวจตัวอย่างและเลือก อนุมัติเนื้อหาแล้ว ในแท็บ ตัวอย่าง / สถานะเผยแพร่ จากนั้นยืนยันเผยแพร่ฉบับนี้",
      onHandle: () => {
        if (disabled || !draft) return;
        setConfirmation({ draft: draft._rev, published: published?._rev, optimization: false });
      },
      dialog: error ? {
        type: "dialog",
        header: "ยังยืนยันการเผยแพร่ไม่ได้",
        content: <p role="alert">{error} หากขาดการเชื่อมต่อ ให้ตรวจสถานะ Live ก่อนลองใหม่ ฉบับร่างและวันที่จะเปลี่ยนพร้อมกันเมื่อธุรกรรมสำเร็จเท่านั้น</p>,
        onClose: () => setError(null),
      } : confirmation ? {
        type: "confirm",
        message: <div><p>{published
          ? "คุณตรวจตัวอย่าง ตรวจเนื้อหาและข้อเท็จจริง และอนุมัติฉบับนี้แล้วใช่ไหม? เมื่อยืนยัน ฉบับแก้ไขนี้จะแทนฉบับ Live โดยคงวันเผยแพร่ครั้งแรกและ URL เดิม"
          : "คุณตรวจตัวอย่าง ตรวจเนื้อหาและข้อเท็จจริง และอนุมัติฉบับนี้แล้วใช่ไหม? เมื่อยืนยัน บทความนี้จะเผยแพร่บนเว็บไซต์"}</p>
          {hasArticleContentChanges(draft, published) && <label>
            <input type="checkbox" checked={confirmation.optimization}
              onChange={(event) => setConfirmation({ ...confirmation, optimization: event.currentTarget.checked })} />
            ยืนยันว่าฉบับนี้ปรับปรุงข้อมูลบทความแล้ว
          </label>}
        </div>,
        confirmButtonText: published ? "ยืนยันอัปเดตบทความ" : "ยืนยันเผยแพร่บทความ",
        cancelButtonText: "กลับไปตรวจอีกครั้ง",
        onCancel: () => setConfirmation(null),
        onConfirm: async () => {
          if (inFlight.current) return;
          setConfirmation(null);
          if (disabled || !draft || draft._rev !== confirmation.draft || published?._rev !== confirmation.published) {
            setError("ข้อมูลหรือสถานะตรวจสอบเปลี่ยนไป กรุณาตรวจฉบับล่าสุดแล้วอนุมัติอีกครั้ง");
            return;
          }
          inFlight.current = true;
          setIsPublishing(true);
          try {
            await publishApprovedArticle(client, draft, published, undefined, confirmation.optimization);
            await queuePostPublishSeo(draft._id.slice(7));
            props.onComplete();
          } catch {
            setError("ไม่สามารถยืนยันผลได้ อาจมีผู้อื่นแก้ไขบทความหรือสิทธิ์ไม่เพียงพอ");
          } finally {
            inFlight.current = false;
            setIsPublishing(false);
          }
        },
      } : null,
    };
  };
  GoogleSafeArticlePublishAction.action = "publish";
  GoogleSafeArticlePublishAction.displayName = "CCPunGoogleSafeArticlePublishAction";
  return GoogleSafeArticlePublishAction;
}

/**
 * Owner decision A3 (2026-10-25): one "อนุมัติและเผยแพร่" button with a confirm
 * dialog. It is offered only while the Draft is not yet approved; the normal
 * publish action above stays disabled until approval, exactly as before. On
 * confirmation the approved snapshot (review.status = "approved") is published
 * through the same publishApprovedArticle() transaction, so every existing guard
 * (articlePublishBlock, revision checks, validation, URL locks, indexable Live
 * document, "Published documents require review status Approved") still applies
 * and the persisted review states are unchanged.
 */
export function createApproveAndPublishArticleAction(): DocumentActionComponent {
  const ApproveAndPublishArticleAction: DocumentActionComponent = (props) => {
    const client = useClient({ apiVersion: "2025-02-19" });
    const sync = useSyncState(props.id, props.type);
    const validation = useValidationStatus(props.draft?._id || props.id, props.type, true);
    const [confirmation, setConfirmation] = useState<{ draft: string; published?: string; optimization: boolean } | null>(null);
    const [isPublishing, setIsPublishing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inFlight = useRef(false);
    const draft = props.draft as PublishableArticle | null;
    const published = props.published as PublishableArticle | null;
    if (!draft || draft.review?.status === "approved") return null;
    const approvedDraft: PublishableArticle = { ...draft, review: { ...(draft.review ?? {}), status: "approved" } };
    const blocked = articlePublishBlock(approvedDraft, published);
    const disabled = Boolean(sync.isSyncing || validation.isValidating || validation.validation.some((item) => item.level === "error") || blocked || isPublishing || props.version || props.liveEdit);

    return {
      label: isPublishing ? "กำลังเผยแพร่…" : "อนุมัติและเผยแพร่",
      title: blocked || "ตรวจตัวอย่างแล้วกดเพื่ออนุมัติและเผยแพร่ฉบับนี้ในขั้นตอนเดียว",
      tone: "positive",
      disabled,
      onHandle: () => {
        if (disabled) return;
        setConfirmation({ draft: draft._rev, published: published?._rev, optimization: false });
      },
      dialog: error ? {
        type: "dialog",
        header: "ยังอนุมัติและเผยแพร่ไม่ได้",
        content: <p role="alert">{error} หากขาดการเชื่อมต่อ ให้ตรวจสถานะ Live ก่อนลองใหม่ ระบบบันทึกการอนุมัติพร้อมการเผยแพร่ในธุรกรรมเดียว จึงไม่มีการเปลี่ยนแปลงใดค้างไว้ครึ่งทาง</p>,
        onClose: () => setError(null),
      } : confirmation ? {
        type: "confirm",
        message: <div><p>{published
          ? "คุณตรวจตัวอย่าง เนื้อหาและข้อเท็จจริงแล้ว และอนุมัติให้ฉบับนี้แทนฉบับ Live ใช่ไหม? ระบบจะบันทึกสถานะ อนุมัติเนื้อหาแล้ว และอัปเดตบทความในขั้นตอนเดียว โดยคงวันเผยแพร่ครั้งแรกและ URL เดิม"
          : "คุณตรวจตัวอย่าง เนื้อหาและข้อเท็จจริงแล้ว และอนุมัติให้เผยแพร่ฉบับนี้ใช่ไหม? ระบบจะบันทึกสถานะ อนุมัติเนื้อหาแล้ว และเผยแพร่บทความบนเว็บไซต์ในขั้นตอนเดียว"}</p>
          {hasArticleContentChanges(draft, published) && <label>
            <input type="checkbox" checked={confirmation.optimization}
              onChange={(event) => setConfirmation({ ...confirmation, optimization: event.currentTarget.checked })} />
            ยืนยันว่าฉบับนี้ปรับปรุงข้อมูลบทความแล้ว
          </label>}
        </div>,
        confirmButtonText: "ยืนยันอนุมัติและเผยแพร่",
        cancelButtonText: "กลับไปตรวจอีกครั้ง",
        onCancel: () => setConfirmation(null),
        onConfirm: async () => {
          if (inFlight.current) return;
          setConfirmation(null);
          if (disabled || draft._rev !== confirmation.draft || published?._rev !== confirmation.published) {
            setError("ข้อมูลเปลี่ยนไประหว่างรอยืนยัน กรุณาตรวจฉบับล่าสุดแล้วกดอีกครั้ง");
            return;
          }
          inFlight.current = true;
          setIsPublishing(true);
          try {
            await publishApprovedArticle(client, approvedDraft, published, undefined, confirmation.optimization);
            await queuePostPublishSeo(draft._id.slice(7));
            props.onComplete();
          } catch {
            setError("ไม่สามารถยืนยันผลได้ อาจมีผู้อื่นแก้ไขบทความหรือสิทธิ์ไม่เพียงพอ");
          } finally {
            inFlight.current = false;
            setIsPublishing(false);
          }
        },
      } : null,
    };
  };
  ApproveAndPublishArticleAction.displayName = "CCPunApproveAndPublishArticleAction";
  return ApproveAndPublishArticleAction;
}

export function wrapGoogleSafeArticlePublishActions(actions: DocumentActionComponent[], environment: AdminEnvironment, schemaType?: string): DocumentActionComponent[] {
  if ((environment !== "local-production" && environment !== "production-admin") || schemaType !== "article") return actions;
  // The approve-and-publish button sits first (primary) while the Draft awaits approval.
  return actions.flatMap((action) => action.action === "publish" ? [createApproveAndPublishArticleAction(), createGoogleSafeArticlePublishAction(action)] : [action]);
}

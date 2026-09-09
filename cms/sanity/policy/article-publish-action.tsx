"use client";

import { useRef, useState } from "react";
import { useClient, useSyncState, useValidationStatus, type DocumentActionComponent } from "sanity";
import type { AdminEnvironment } from "../../../lib/admin/environment";
import { articlePublishBlock, publishApprovedArticle, type PublishableArticle } from "./article-publication";

export function createGoogleSafeArticlePublishAction(originalAction: DocumentActionComponent): DocumentActionComponent {
  const GoogleSafeArticlePublishAction: DocumentActionComponent = (props) => {
    const result = originalAction(props);
    const client = useClient({ apiVersion: "2025-02-19" });
    const sync = useSyncState(props.id, props.type);
    const validation = useValidationStatus(props.draft?._id || props.id, props.type, true);
    const [confirmation, setConfirmation] = useState<{ draft: string; published?: string } | null>(null);
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
        setConfirmation({ draft: draft._rev, published: published?._rev });
      },
      dialog: error ? {
        type: "dialog",
        header: "ยังยืนยันการเผยแพร่ไม่ได้",
        content: <p role="alert">{error} หากขาดการเชื่อมต่อ ให้ตรวจสถานะ Live ก่อนลองใหม่ ฉบับร่างและวันที่จะเปลี่ยนพร้อมกันเมื่อธุรกรรมสำเร็จเท่านั้น</p>,
        onClose: () => setError(null),
      } : confirmation ? {
        type: "confirm",
        message: published
          ? "คุณตรวจตัวอย่าง ตรวจเนื้อหาและข้อเท็จจริง และอนุมัติฉบับนี้แล้วใช่ไหม? เมื่อยืนยัน ฉบับแก้ไขนี้จะแทนฉบับ Live โดยคงวันเผยแพร่ครั้งแรกและ URL เดิม"
          : "คุณตรวจตัวอย่าง ตรวจเนื้อหาและข้อเท็จจริง และอนุมัติฉบับนี้แล้วใช่ไหม? เมื่อยืนยัน บทความนี้จะเผยแพร่บนเว็บไซต์",
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
            await publishApprovedArticle(client, draft, published);
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

export function wrapGoogleSafeArticlePublishActions(actions: DocumentActionComponent[], environment: AdminEnvironment, schemaType?: string): DocumentActionComponent[] {
  if ((environment !== "local-production" && environment !== "production-admin") || schemaType !== "article") return actions;
  return actions.map((action) => action.action === "publish" ? createGoogleSafeArticlePublishAction(action) : action);
}

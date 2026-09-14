"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InstagramMobileHandoff } from "@/features/admin/social/InstagramMobileHandoff";
import {
  loadSocialWorkspace,
  openGoogleDrivePicker,
  requestGoogleDriveMemorySession,
  verifyGoogleDrivePickerFiles,
  type ApprovedVariantApi,
  type GoogleDriveMemorySession,
  type SocialDraftApiItem,
  type SocialCommentSeriesItem,
  type SocialMasterContentChoice,
  type SocialMediaReference,
  type VerifiedGoogleDriveFile,
} from "@/features/admin/social/social-workspace-client";
import {
  FACEBOOK_AUTHORING_FORMATS,
  buildSocialMediaReferences,
  facebookMediaRequirement,
  instagramMediaRequirement,
  isGoogleDriveAuthorizationUsable,
  normalizeFacebookFormat,
  validateFacebookMedia,
  validateInstagramMedia,
} from "@/features/admin/social/social-workspace-media";

type SocialPlatform = "facebook" | "instagram" | "youtube" | "tiktok" | "facebook-group";
type ItemSource = "draft-api" | "approved-api" | "new";

export type SocialPostWorkspaceItem = {
  id: string;
  revision: string | null;
  version: number;
  masterContentId: string;
  title: string;
  platform: SocialPlatform;
  format: string;
  publishingMode: string;
  reviewStatus: string;
  publicationStatus: string | null;
  scheduledAt: string;
  caption: string;
  linkUrl: string;
  mediaAssetId: string;
  mediaReferences: SocialMediaReference[];
  commentSeriesMode: "top-level" | "threaded";
  commentSeries: SocialCommentSeriesItem[];
  planReason: string;
  source: ItemSource;
  approvalRecorded: boolean;
  publicationId: string | null;
  publicationJobVersion: number | null;
};

type SocialPostMedia = {
  id: string;
  filename: string;
  kind: "image" | "video" | "caption";
  dimensions: string;
  downloadUrl: string | null;
  sizeBytes: number | null;
};

const driveOAuthClientId = process.env.NEXT_PUBLIC_CCPUN_GOOGLE_DRIVE_OAUTH_CLIENT_ID?.trim() ?? "";
const drivePickerApiKey = process.env.NEXT_PUBLIC_CCPUN_GOOGLE_DRIVE_PICKER_API_KEY?.trim() ?? "";
const drivePickerAppId = process.env.NEXT_PUBLIC_CCPUN_GOOGLE_DRIVE_APP_ID?.trim() ?? "";
const drivePickerConfigured = Boolean(driveOAuthClientId && drivePickerApiKey && /^[1-9]\d+$/.test(drivePickerAppId));

const platformLabel: Record<SocialPlatform, string> = {
  facebook: "Facebook", instagram: "Instagram", youtube: "YouTube", tiktok: "TikTok", "facebook-group": "Facebook Group",
};

const statusLabel: Record<string, string> = {
  drafting: "กำลังร่าง", "content-review": "รอตรวจเนื้อหา", "fact-check": "รอตรวจข้อเท็จจริง",
  "compliance-review": "รอตรวจ Compliance", "ready-for-coo": "พร้อมให้ COO ตรวจ", draft: "ฉบับร่าง",
  approved: "อนุมัติแล้ว", queued: "รอส่ง", "native-scheduled": "นัดหมายในแพลตฟอร์ม",
  "awaiting-native-finish": "รอทำต่อในแอป", processing: "กำลังดำเนินการ", published: "เผยแพร่แล้ว",
  failed: "ไม่สำเร็จ", cancelled: "ยกเลิก", superseded: "มีรุ่นใหม่แทน",
};

const formatLabel: Record<string, string> = {
  "text-post": "ข้อความ", "link-post": "ลิงก์", "image-post": "ภาพเดี่ยว", album: "อัลบั้ม", carousel: "คารูเซล",
  reel: "Reel", video: "วิดีโอ", short: "Short", "photo-post": "Photo post", live: "Live",
};

const statuses = Object.keys(statusLabel);

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function formatScheduledAt(value: string) {
  if (!value) return "ยังไม่กำหนด";
  const parsed = new Date(`${value}:00+07:00`);
  if (!Number.isFinite(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(parsed);
}

function hasFutureSchedule(value: string) {
  if (!value) return false;
  const date = new Date(`${value}:00+07:00`);
  return Number.isFinite(date.getTime()) && date.getTime() > Date.now();
}

function isHttpsLinkUrl(value: string) {
  try {
    return new URL(value.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

function primaryAsset(references: SocialMediaReference[]) {
  return references.find((asset) => asset.role === "primary") ?? references[0] ?? null;
}

function mediaFromReferences(references: SocialMediaReference[]): SocialPostMedia[] {
  return references.map((asset) => ({
    id: asset.assetId,
    filename: asset.assetId,
    kind: asset.mimeType?.startsWith("video/") ? "video" : asset.mimeType === "text/vtt" ? "caption" : "image",
    dimensions: asset.widthPx && asset.heightPx
      ? `${asset.widthPx.toLocaleString("th-TH")} × ${asset.heightPx.toLocaleString("th-TH")} px${asset.durationMs ? ` · ${(asset.durationMs / 1000).toLocaleString("th-TH", { maximumFractionDigits: 1 })} วินาที` : ""}`
      : asset.durationMs ? `${(asset.durationMs / 1000).toLocaleString("th-TH", { maximumFractionDigits: 1 })} วินาที` : asset.mimeType ?? "metadata เท่านั้น",
    downloadUrl: null,
    sizeBytes: null,
  }));
}

function itemFromApproved(variant: ApprovedVariantApi): SocialPostWorkspaceItem {
  return {
    id: variant.variantId, revision: variant.revision, version: variant.version, masterContentId: variant.masterContentId,
    title: variant.title, platform: variant.platform, format: variant.format, publishingMode: variant.publishingMode,
    reviewStatus: variant.reviewStatus, publicationStatus: variant.publication?.status ?? null,
    scheduledAt: toLocalDateTime(variant.publication?.scheduledAt ?? null), caption: variant.caption ?? "", linkUrl: variant.linkUrl ?? "",
    mediaAssetId: primaryAsset(variant.mediaMetadata)?.assetId ?? "", mediaReferences: variant.mediaMetadata,
    commentSeriesMode: variant.commentSeriesMode, commentSeries: variant.commentSeries,
    planReason: variant.publication?.executionTarget ? `Execution target: ${variant.publication.executionTarget}` : "ผ่าน Human Review แล้ว แต่ยังไม่มี publication record",
    source: "approved-api", approvalRecorded: Boolean(variant.publication),
    publicationId: variant.publication?.publicationId ?? null,
    publicationJobVersion: variant.publication?.jobVersion ?? null,
  };
}

function itemFromDraft(draft: SocialDraftApiItem, approved?: ApprovedVariantApi): SocialPostWorkspaceItem {
  return {
    id: draft.variantId, revision: draft.revision, version: draft.version, masterContentId: draft.masterContentId,
    title: draft.title, platform: draft.channel, format: draft.format, publishingMode: draft.publishingMode,
    reviewStatus: draft.reviewStatus, publicationStatus: approved?.publication?.status ?? null,
    scheduledAt: toLocalDateTime(approved?.publication?.scheduledAt ?? null), caption: draft.caption, linkUrl: draft.linkUrl ?? "",
    mediaAssetId: primaryAsset(draft.mediaReferences)?.assetId ?? "", mediaReferences: draft.mediaReferences,
    commentSeriesMode: draft.commentSeriesMode, commentSeries: draft.commentSeries,
    planReason: approved?.publication?.executionTarget ? `Execution target: ${approved.publication.executionTarget}` : "Sanity Draft จริง · การแก้ไขจะสร้าง revision ใหม่และไม่อนุมัติอัตโนมัติ",
    source: "draft-api", approvalRecorded: Boolean(approved?.publication),
    publicationId: approved?.publication?.publicationId ?? null,
    publicationJobVersion: approved?.publication?.jobVersion ?? null,
  };
}

function emptyDraft(masterContentId = ""): SocialPostWorkspaceItem {
  return {
    id: "new-social-draft", revision: null, version: 1, masterContentId, title: "", platform: "facebook",
    format: "text-post", publishingMode: "native-scheduled", reviewStatus: "drafting", publicationStatus: null,
    scheduledAt: "", caption: "", linkUrl: "", mediaAssetId: "", mediaReferences: [],
    commentSeriesMode: "threaded", commentSeries: [],
    planReason: "ชิ้นงานใหม่จะถูกสร้างเป็น Sanity Draft สถานะ drafting", source: "new", approvalRecorded: false,
    publicationId: null, publicationJobVersion: null,
  };
}

function displayStatus(item: SocialPostWorkspaceItem) {
  return item.publicationStatus ?? item.reviewStatus;
}

function editorialFields(item: SocialPostWorkspaceItem) {
  return JSON.stringify({
    masterContentId: item.masterContentId, title: item.title, platform: item.platform, format: item.format,
    publishingMode: item.publishingMode, caption: item.caption, linkUrl: item.linkUrl, mediaReferences: item.mediaReferences,
    commentSeriesMode: item.commentSeriesMode, commentSeries: item.commentSeries,
  });
}

function exactMediaBinding(references: readonly SocialMediaReference[]) {
  return JSON.stringify(references.map((reference) => ({
    assetId: reference.assetId,
    role: reference.role,
    order: reference.order,
    mimeType: reference.mimeType,
    widthPx: reference.widthPx,
    heightPx: reference.heightPx,
    durationMs: reference.durationMs,
    sha256Checksum: reference.sha256Checksum,
  })));
}

function facebookScheduleState(item: SocialPostWorkspaceItem) {
  if (item.platform !== "facebook") return null;
  if (item.publicationStatus === "native-scheduled") return "นัดหมายใน Meta แล้ว";
  if (item.scheduledAt) return "กำหนดเวลาสำหรับ approval แล้ว · ยังไม่มี Provider write";
  if (item.reviewStatus === "approved") return "ผ่าน Human Review แล้ว · รอกำหนดเวลา";
  return "ยังรอ Human Review ก่อนอนุมัติแผนเผยแพร่";
}

export default function SocialPostsWorkspace({ approvalEnabled }: { approvalEnabled: boolean }) {
  const [items, setItems] = useState<SocialPostWorkspaceItem[]>([]);
  const [availableMedia, setAvailableMedia] = useState<SocialPostMedia[]>([]);
  const [masterChoices, setMasterChoices] = useState<SocialMasterContentChoice[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const selectedIdRef = useRef("");
  const [form, setForm] = useState<SocialPostWorkspaceItem>(emptyDraft());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [notice, setNotice] = useState("");
  const [approvalState, setApprovalState] = useState<"idle" | "running">("idle");
  const [draftSaveState, setDraftSaveState] = useState<"idle" | "running">("idle");
  const [drivePickerState, setDrivePickerState] = useState<"idle" | "running" | "ready" | "failed">("idle");
  const [executionState, setExecutionState] = useState<"idle" | "running">("idle");
  const [verifiedDriveFiles, setVerifiedDriveFiles] = useState<VerifiedGoogleDriveFile[]>([]);
  const driveSessionRef = useRef<GoogleDriveMemorySession | null>(null);
  const [draftApiState, setDraftApiState] = useState<"loading" | "ready" | "failed">("loading");
  const [publicationApiState, setPublicationApiState] = useState<"loading" | "ready" | "failed">("loading");

  const applyWorkspace = useCallback((result: Awaited<ReturnType<typeof loadSocialWorkspace>>, preferredId?: string) => {
    const approvedById = new Map(result.publications.map((item) => [item.variantId, item]));
    const draftItems = result.drafts.map((draft) => itemFromDraft(draft, approvedById.get(draft.variantId)));
    const draftIds = new Set(draftItems.map((item) => item.id));
    const approvedOnly = result.publications.filter((item) => !draftIds.has(item.variantId)).map(itemFromApproved);
    const nextItems = [...draftItems, ...approvedOnly];

    setDraftApiState(result.draftError ? "failed" : "ready");
    setPublicationApiState(result.publicationError ? "failed" : "ready");
    setMasterChoices(result.masterContentChoices);
    setItems(nextItems);
    setAvailableMedia(() => {
      const next = new Map<string, SocialPostMedia>();
      [...result.drafts.flatMap((item) => item.mediaReferences), ...result.publications.flatMap((item) => item.mediaMetadata)]
        .flatMap((reference) => mediaFromReferences([reference])).forEach((asset) => next.set(asset.id, asset));
      return [...next.values()];
    });
    const targetId = preferredId ?? selectedIdRef.current;
    const target = nextItems.find((item) => item.id === targetId) ?? nextItems[0] ?? emptyDraft(result.masterContentChoices[0]?.id);
    selectedIdRef.current = target.source === "new" ? "" : target.id;
    setSelectedId(target.source === "new" ? "" : target.id);
    setForm(target);
    return target;
  }, []);

  const refreshWorkspace = useCallback(async (preferredId?: string) => {
    const result = await loadSocialWorkspace();
    return applyWorkspace(result, preferredId);
  }, [applyWorkspace]);

  useEffect(() => {
    const controller = new AbortController();
    void loadSocialWorkspace(controller.signal).then((result) => {
      if (!controller.signal.aborted) applyWorkspace(result);
    });
    return () => controller.abort();
  }, [applyWorkspace]);

  const mediaById = useMemo(() => new Map(availableMedia.map((asset) => [asset.id, asset])), [availableMedia]);
  const verifiedDriveFilesById = useMemo(() => new Map(verifiedDriveFiles.map((file) => [file.assetId, file])), [verifiedDriveFiles]);
  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("th-TH");
    return items.filter((item) => {
      const matchesStatus = statusFilter === "all" || displayStatus(item) === statusFilter || item.reviewStatus === statusFilter;
      const haystack = [item.title, item.caption, item.linkUrl, ...item.commentSeries.map((comment) => comment.text), item.platform, item.format].join(" ").toLocaleLowerCase("th-TH");
      return matchesStatus && (!keyword || haystack.includes(keyword));
    });
  }, [items, search, statusFilter]);

  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  const editorialDirty = Boolean(selectedItem && editorialFields(selectedItem) !== editorialFields(form));
  const editorEnabled = form.source === "draft-api" || form.source === "new";
  const supportedApproval = form.platform === "facebook" || form.platform === "instagram";
  const scheduleReady = form.platform !== "facebook" || form.publishingMode !== "native-scheduled" || hasFutureSchedule(form.scheduledAt);
  const linkReady = form.format !== "link-post" || (form.platform === "facebook" && isHttpsLinkUrl(form.linkUrl));
  const mediaValidation = form.platform === "instagram"
    ? validateInstagramMedia(form.format, form.mediaReferences)
    : validateFacebookMedia(form.format, form.mediaReferences);
  const instagramHandoffReady = form.platform !== "instagram" || form.publishingMode === "native-finish";
  const commentSeriesReady = form.platform !== "facebook" || form.commentSeries.length === 0
    || (form.commentSeries.length <= 20 && form.commentSeries.every((comment, index) => comment.position === index + 1
      && Boolean(comment.text.trim()) && comment.text.length <= 2_000));
  const driveMediaReady = form.mediaReferences.length === 0 || form.mediaReferences.every((reference) => {
    const file = verifiedDriveFilesById.get(reference.assetId);
    return file && file.mimeType === reference.mimeType && file.sha256Checksum === reference.sha256Checksum
      && Number.isSafeInteger(file.sizeBytes) && file.sizeBytes > 0;
  });
  const driveAuthorizationReady = form.mediaReferences.length === 0
    || drivePickerState === "ready";
  const visibleFormats = form.platform === "facebook"
    ? [...FACEBOOK_AUTHORING_FORMATS]
    : ["image-post", "album", "reel"];
  const canApprove = approvalEnabled && publicationApiState === "ready" && Boolean(form.revision)
    && supportedApproval && form.reviewStatus === "approved" && scheduleReady && linkReady && mediaValidation.ok && commentSeriesReady
    && instagramHandoffReady && !editorialDirty && !form.approvalRecorded;
  const canSaveDraft = draftApiState === "ready" && editorEnabled && Boolean(form.masterContentId)
    && Boolean(form.title.trim()) && supportedApproval && linkReady && mediaValidation.ok && commentSeriesReady
    && instagramHandoffReady && draftSaveState !== "running";
  const canExecute = form.platform === "facebook" && Boolean(form.publicationId && form.publicationJobVersion)
    && ["approved", "queued", "failed"].includes(form.publicationStatus ?? "")
    && mediaValidation.ok && commentSeriesReady && driveMediaReady && driveAuthorizationReady && executionState !== "running";

  function selectItem(item: SocialPostWorkspaceItem) {
    selectedIdRef.current = item.id; setSelectedId(item.id); setForm(item); setVerifiedDriveFiles([]); setNotice("");
  }
  function startNewDraft() {
    selectedIdRef.current = ""; setSelectedId(""); setForm(emptyDraft(masterChoices[0]?.id)); setVerifiedDriveFiles([]); setNotice("");
  }
  function update<K extends keyof SocialPostWorkspaceItem>(key: K, value: SocialPostWorkspaceItem[K]) { setForm((current) => ({ ...current, [key]: value })); setNotice(""); }
  function updatePlatform(platform: SocialPlatform) {
    setForm((current) => ({
      ...current,
      platform,
      publishingMode: platform === "instagram" ? "native-finish" : "native-scheduled",
      format: platform === "facebook" ? normalizeFacebookFormat(current.format) ?? "text-post" : "image-post",
      linkUrl: "",
      mediaAssetId: "",
      mediaReferences: [],
      commentSeries: platform === "facebook" ? current.commentSeries : [],
    }));
    setVerifiedDriveFiles([]);
    setNotice("");
  }
  function updateFormat(format: string) {
    setForm((current) => ({
      ...current,
      format,
      linkUrl: format === "link-post" ? current.linkUrl : "",
      mediaAssetId: "",
      mediaReferences: [],
    }));
    setVerifiedDriveFiles([]);
    setNotice("");
  }

  function toggleCommentSeries(enabled: boolean) {
    update("commentSeries", enabled
      ? Array.from({ length: 4 }, (_, index) => ({ position: index + 1, text: "" }))
      : []);
  }
  function updateComment(position: number, text: string) {
    update("commentSeries", form.commentSeries.map((comment) => comment.position === position ? { ...comment, text } : comment));
  }
  function addComment() {
    if (form.commentSeries.length >= 20) return;
    update("commentSeries", [...form.commentSeries, { position: form.commentSeries.length + 1, text: "" }]);
  }
  function removeComment(position: number) {
    update("commentSeries", form.commentSeries.filter((comment) => comment.position !== position)
      .map((comment, index) => ({ ...comment, position: index + 1 })));
  }

  async function chooseDriveMedia() {
    if (!drivePickerConfigured || !["facebook", "instagram"].includes(form.platform)) {
      setNotice("Google Drive Picker ยังไม่พร้อม: ต้องมี OAuth client ID, Picker API key และ Cloud project number");
      return;
    }
    const normalized = normalizeFacebookFormat(form.format);
    if (!normalized || normalized === "text-post" || normalized === "link-post") {
      setNotice("รูปแบบนี้ไม่ใช้สื่อ จึงไม่เปิด Google Drive Picker");
      return;
    }
    setDrivePickerState("running"); setNotice("");
    try {
      let session = driveSessionRef.current;
      if (!session || !isGoogleDriveAuthorizationUsable(session.authorization)) {
        session = await requestGoogleDriveMemorySession(driveOAuthClientId);
        driveSessionRef.current = session;
      }
      const picked = await openGoogleDrivePicker({ appId: drivePickerAppId, apiKey: drivePickerApiKey, session });
      if (picked.length === 0) { setDrivePickerState("idle"); setNotice("ยกเลิกการเลือกสื่อ และไม่มีข้อมูลถูกเปลี่ยน"); return; }
      const verified = await verifyGoogleDrivePickerFiles({ files: picked, session });
      const references = buildSocialMediaReferences(normalized, verified);
      const validation = form.platform === "instagram"
        ? validateInstagramMedia(normalized, references)
        : validateFacebookMedia(normalized, references);
      if (!validation.ok) throw new Error(validation.reason);
      if (form.publicationId && exactMediaBinding(references) !== exactMediaBinding(form.mediaReferences)) {
        throw new Error("approved-media-binding-mismatch");
      }
      setVerifiedDriveFiles(verified);
      setAvailableMedia((current) => {
        const next = new Map(current.map((asset) => [asset.id, asset]));
        for (const file of verified) next.set(file.assetId, {
          id: file.assetId,
          filename: file.name,
          kind: file.mimeType === "video/mp4" ? "video" : "image",
          dimensions: file.widthPx && file.heightPx
            ? `${file.widthPx.toLocaleString("th-TH")} × ${file.heightPx.toLocaleString("th-TH")} px${file.durationMs ? ` · ${(file.durationMs / 1000).toLocaleString("th-TH", { maximumFractionDigits: 1 })} วินาที` : ""}`
            : `${(file.sizeBytes / 1_000_000).toLocaleString("th-TH", { maximumFractionDigits: 2 })} MB`,
          downloadUrl: null,
          sizeBytes: file.sizeBytes,
        });
        return [...next.values()];
      });
      if (!form.publicationId) {
        setForm((current) => ({
          ...current,
          mediaAssetId: references[0]?.assetId ?? "",
          mediaReferences: references,
        }));
      }
      setDrivePickerState("ready");
      setNotice("ตรวจ approved-root, MIME, size และ SHA-256 ผ่านแล้ว · token อยู่ในหน่วยความจำของหน้านี้เท่านั้น");
    } catch (error) {
      driveSessionRef.current = null;
      setVerifiedDriveFiles([]);
      setDrivePickerState("failed");
      const code = error instanceof Error ? error.message : "drive-picker-failed";
      const messages: Record<string, string> = {
        "drive-roots-not-configured": "Server ยังไม่ได้กำหนด approved Google Drive roots",
        "selected-file-denied": "ไฟล์อยู่นอก approved Google Drive roots หรือไม่ผ่าน policy",
        "manual-authorization-required": "สิทธิ์ Google Drive หมดอายุ กรุณาเลือกสื่อใหม่และอนุญาตอีกครั้ง",
        "size-unavailable": "Picker ไม่ส่งขนาดไฟล์ จึงไม่สามารถบันทึกหรือ Execute ได้",
        "drive-file-verification-mismatch": "Server ไม่คืน MIME หรือ SHA-256 ที่ยืนยันได้ จึงไม่บันทึกสื่อ",
        "drive-file-metadata-mismatch": "ข้อมูลขนาดหรือ checksum จาก Google Drive ไม่ตรงกับไฟล์ที่ Server ตรวจ จึงไม่บันทึกสื่อ",
        "reel-metadata-unavailable": "Google Drive ยังไม่คืนความกว้าง ความสูง หรือระยะเวลาของ Reel จึงยังบันทึกไม่ได้ ลองใหม่หลัง Drive ประมวลผลวิดีโอเสร็จ",
        "reel-vertical-required": "Reel ต้องเป็นวิดีโอแนวตั้ง โดยความสูงต้องมากกว่าความกว้าง",
        "approved-media-binding-mismatch": "ไฟล์ที่เลือกไม่ตรง media IDs, order, MIME และ SHA-256 ของ revision ที่อนุมัติ",
      };
      setNotice(messages[code] ?? "เลือกหรือตรวจสื่อจาก Google Drive ไม่สำเร็จ และไม่มี media reference ถูกบันทึก");
    }
  }

  async function saveDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSaveDraft || (form.source === "draft-api" && !form.revision)) return;
    setDraftSaveState("running"); setNotice("");
    const body = {
      action: form.source === "draft-api" ? "update" : "create",
      ...(form.source === "draft-api" ? { variantId: form.id, expectedRevision: form.revision } : {}),
      masterContentId: form.masterContentId, title: form.title.trim(), caption: form.caption, linkUrl: form.linkUrl.trim() || null,
      channel: form.platform, format: form.format, publishingMode: form.publishingMode, mediaReferences: form.mediaReferences,
      commentSeriesMode: form.commentSeriesMode, commentSeries: form.commentSeries,
    };
    try {
      const response = await fetch("/api/admin/social/drafts/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const errors: Record<string, string> = {
          "revision-conflict": "Draft เปลี่ยนหลังจากเปิดหน้านี้ ระบบไม่เขียนทับ กรุณาโหลดใหม่แล้วตรวจอีกครั้ง",
          "master-content-not-approved": "Master Content นี้ยังไม่ผ่าน Human Review จึงสร้าง Draft ไม่ได้",
          "sanity-write-not-configured": "Sanity write ยังไม่พร้อม", forbidden: "เฉพาะ Owner เท่านั้นที่สร้างหรือแก้ Social Draft ได้",
          "invalid-request": "ข้อมูล Draft ไม่ผ่าน contract กรุณาตรวจแพลตฟอร์ม รูปแบบ publishing mode และ HTTPS Link URL",
        };
        setNotice(errors[payload?.error] ?? "บันทึก Sanity Draft ไม่สำเร็จและไม่มีข้อมูลถูกเขียน"); return;
      }
      const variantId = typeof payload?.draft?.variantId === "string" ? payload.draft.variantId : form.id;
      await refreshWorkspace(variantId);
      setNotice("บันทึก Sanity Draft แล้วและโหลด revision ล่าสุดกลับมา · สถานะยังไม่ถูกอนุมัติอัตโนมัติ");
    } catch { setNotice("เชื่อมต่อ Draft API ไม่สำเร็จและไม่มีข้อมูลถูกเขียน"); }
    finally { setDraftSaveState("idle"); }
  }

  async function approveRevision() {
    if (!canApprove || !form.revision || approvalState === "running") return;
    setApprovalState("running"); setNotice("");
    const scheduledAt = form.platform === "facebook" && form.publishingMode === "native-scheduled" && form.scheduledAt
      ? new Date(`${form.scheduledAt}:00+07:00`).toISOString() : null;
    try {
      const response = await fetch("/api/admin/social/publications/", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: form.id, expectedRevision: form.revision, expectedVersion: form.version, scheduledAt }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const errors: Record<string, string> = {
          "revision-conflict": "เนื้อหาเปลี่ยนหลังจากเปิดหน้านี้ กรุณาโหลดข้อมูลใหม่แล้วตรวจอีกครั้ง",
          "variant-not-approved-or-unsupported": "ชิ้นงานยังไม่ผ่าน Human Review หรือรูปแบบนี้ยังไม่รองรับ",
          "database-not-ready": "ฐานข้อมูลยังไม่พร้อมรับการอนุมัติ", "sanity-read-not-configured": "ยังอ่าน revision จาก Sanity ไม่ได้",
          forbidden: "บัญชีนี้ไม่มีสิทธิ์ Owner สำหรับอนุมัติ",
        };
        setNotice(errors[payload?.error] ?? "อนุมัติไม่สำเร็จและไม่มีการส่งโพสต์"); return;
      }
      await refreshWorkspace(form.id);
      setNotice(payload?.publication?.executionTarget === "instagram-mobile-handoff"
        ? "อนุมัติ revision นี้แล้ว และเตรียม Instagram mobile handoff โดยไม่สร้าง Native Draft"
        : "อนุมัติ revision นี้และสร้างแผนเผยแพร่แล้ว · การส่งจริงยังต้องผ่าน Provider safety gate");
    } catch { setNotice("เชื่อมต่อ approval API ไม่สำเร็จและไม่มีการส่งโพสต์"); }
    finally { setApprovalState("idle"); }
  }

  async function executePublication() {
    if (!canExecute || !form.publicationId || !form.publicationJobVersion) return;
    const session = driveSessionRef.current;
    if (form.mediaReferences.length > 0 && (!session || !isGoogleDriveAuthorizationUsable(session.authorization))) {
      setNotice("Google Drive token หมดอายุ กรุณาเลือกและตรวจสื่อใหม่ก่อน Execute");
      return;
    }
    const files = form.mediaReferences.map((reference) => verifiedDriveFilesById.get(reference.assetId) ?? null);
    if (form.mediaReferences.length > 0 && files.some((file) => !file)) {
      setNotice("ไม่มี MIME, size หรือ SHA-256 ของไฟล์ครบในหน่วยความจำ กรุณาเลือกสื่อใหม่ก่อน Execute");
      return;
    }
    setExecutionState("running"); setNotice("");
    try {
      const body = {
        publicationId: form.publicationId,
        expectedJobVersion: form.publicationJobVersion,
        ...(session && files.length > 0 ? {
          driveMedia: {
            accessToken: session.accessToken,
            authorization: session.authorization,
            files: files.map((file) => ({
              assetId: file!.assetId,
              expectedMimeType: file!.mimeType,
              expectedByteSize: file!.sizeBytes,
              expectedSha256: file!.sha256Checksum,
            })),
          },
        } : {}),
      };
      const response = await fetch("/api/admin/social/publications/execute", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const errors: Record<string, string> = {
          "job-version-conflict": "Job เปลี่ยนแล้ว กรุณาโหลดสถานะใหม่ก่อน Execute",
          "execution-in-progress": "มีการ Execute งานนี้อยู่แล้ว",
          "provider-auth-required": "Meta authorization ยังไม่พร้อม",
          "manual-reconciliation-required": "Provider อาจรับข้อมูลแล้ว ต้องตรวจสอบด้วยตนเองก่อนลองใหม่",
          "execution-not-allowed": "Revision, media checksum หรือ execution contract ไม่ตรง จึงไม่ส่ง Provider",
        };
        setNotice(errors[payload?.error] ?? "Execute ไม่สำเร็จ และระบบไม่ลองซ้ำอัตโนมัติ");
        return;
      }
      await refreshWorkspace(form.id);
      setNotice(payload?.result?.state === "scheduled"
        ? "Execute สำเร็จ: Meta รับรายการนัดหมายแล้ว"
        : "Execute สำเร็จ: Provider ยืนยันผลแล้ว");
    } catch {
      setNotice("เชื่อมต่อ Execute API ไม่สำเร็จ และระบบไม่ลองซ้ำอัตโนมัติ");
    } finally {
      setExecutionState("idle");
    }
  }

  return (
    <div className="mt-7 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
      <section aria-labelledby="social-post-list-title" className="min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="social-post-list-title" className="text-xl font-semibold">โพสต์และฉบับร่าง</h2>
            <p className="mt-1 text-sm text-white/65">Sanity Draft และ publication state ปัจจุบันจาก API</p>
            <p aria-live="polite" className="mt-1 text-xs text-white/55">Drafts: {draftApiState === "loading" ? "กำลังโหลด" : draftApiState === "ready" ? "พร้อมบันทึก" : "โหลดไม่ได้/ไม่มีสิทธิ์"}{" · "}Publications: {publicationApiState === "loading" ? "กำลังโหลด" : publicationApiState === "ready" ? "พร้อมอ่าน" : "โหลดไม่ได้"}</p>
          </div>
          <button type="button" onClick={startNewDraft} disabled={draftApiState !== "ready" || masterChoices.length === 0} className="min-h-11 rounded-xl bg-[#e0c985] px-4 py-2.5 text-sm font-semibold text-[#17191d] hover:bg-[#ecd99b] focus:outline-none focus:ring-2 focus:ring-[#f4df9b] disabled:cursor-not-allowed disabled:opacity-40">สร้าง Draft ใหม่</button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <label className="text-xs text-white/70">ค้นหา<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ชื่อหรือแคปชัน" className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-white/15 bg-black/20 px-3 text-sm text-white placeholder:text-white/40 focus:border-[#e0c985] focus:outline-none" /></label>
          <label className="text-xs text-white/70">สถานะ<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-[#151a20] px-3 text-sm text-white focus:border-[#e0c985] focus:outline-none"><option value="all">ทั้งหมด</option>{statuses.map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}</select></label>
        </div>
        <div className="mt-4 space-y-3">
          {filteredItems.map((item) => {
            const asset = item.mediaAssetId ? mediaById.get(item.mediaAssetId) : null;
            const selected = item.id === selectedId;
            return <button key={item.id} type="button" onClick={() => selectItem(item)} aria-pressed={selected} className={`w-full rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-[#e0c985] focus:ring-offset-2 focus:ring-offset-[#11151a] ${selected ? "border-[#e0c985]/60 bg-[#e0c985]/[0.08]" : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.05]"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="text-xs font-semibold text-[#f4df9b]">{platformLabel[item.platform]} · {formatLabel[item.format] ?? item.format}</div><h3 className="mt-1 break-words font-semibold text-white/95">{item.title}</h3></div><span className="shrink-0 rounded-full border border-white/15 px-2.5 py-1 text-xs text-white/80">{statusLabel[displayStatus(item)] ?? displayStatus(item)}</span></div>
              <p className="mt-2 text-xs text-white/50">{item.source === "draft-api" ? "Sanity Draft" : "Approved variant · read-only"}</p>
              <dl className="mt-3 grid gap-2 text-xs text-white/70 sm:grid-cols-2"><div><dt className="text-white/55">วันและเวลา</dt><dd className="mt-0.5">{formatScheduledAt(item.scheduledAt)}</dd></div><div><dt className="text-white/55">สื่อ</dt><dd className="mt-0.5 break-all">{asset?.filename ?? "ยังไม่ได้เลือกสื่อ"}</dd></div></dl>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/70">{item.caption || "ยังไม่มีแคปชันในข้อมูลชุดนี้"}</p>{facebookScheduleState(item) ? <p className="mt-2 text-xs font-medium text-amber-100">Facebook: {facebookScheduleState(item)}</p> : null}
            </button>;
          })}
          {filteredItems.length === 0 ? <p className="rounded-2xl border border-white/10 p-5 text-sm text-white/65">ไม่พบชิ้นงานตามตัวกรอง</p> : null}
        </div>
      </section>

      <section aria-labelledby="social-post-editor-title" className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.035] p-5 xl:sticky xl:top-5 xl:self-start">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-[0.1em] text-[#e0c985]">SANITY DRAFT</p><h2 id="social-post-editor-title" className="mt-1 text-xl font-semibold">{form.source === "new" ? "สร้างโพสต์" : "รายละเอียดโพสต์"}</h2></div><span className={`rounded-full border px-3 py-1 text-xs ${editorEnabled ? "border-emerald-200/25 bg-emerald-200/[0.06] text-emerald-100" : "border-white/15 text-white/60"}`}>{editorEnabled ? "บันทึก Draft ได้" : "อ่านอย่างเดียว"}</span></div>
        <form onSubmit={saveDraft} className="mt-5 space-y-4">
          <label className="block text-sm text-white/75">Approved Master Content<select required disabled={!editorEnabled} value={form.masterContentId} onChange={(event) => update("masterContentId", event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-white/15 bg-[#151a20] px-3 text-white focus:border-[#e0c985] focus:outline-none disabled:opacity-60"><option value="">เลือก Master Content</option>{masterChoices.map((choice) => <option key={choice.id} value={choice.id}>{choice.title}</option>)}</select></label>
          <label className="block text-sm text-white/75">ชื่อชิ้นงาน<input required disabled={!editorEnabled} value={form.title} onChange={(event) => update("title", event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-white/15 bg-black/20 px-3 text-white focus:border-[#e0c985] focus:outline-none disabled:opacity-60" /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-white/75">แพลตฟอร์ม<select disabled={!editorEnabled} value={form.platform} onChange={(event) => updatePlatform(event.target.value as SocialPlatform)} className="mt-1.5 min-h-11 w-full rounded-xl border border-white/15 bg-[#151a20] px-3 text-white focus:border-[#e0c985] focus:outline-none disabled:opacity-60"><option value="facebook">Facebook</option><option value="instagram">Instagram</option></select></label>
            <label className="text-sm text-white/75">รูปแบบ<select disabled={!editorEnabled} value={form.format} onChange={(event) => updateFormat(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-white/15 bg-[#151a20] px-3 text-white focus:border-[#e0c985] focus:outline-none disabled:opacity-60">{!visibleFormats.some((format) => format === form.format) ? <option value={form.format}>{formatLabel[form.format] ?? form.format} · ยังไม่รองรับ</option> : null}{visibleFormats.map((format) => <option key={format} value={format}>{formatLabel[format]}</option>)}</select></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-white/75">Publishing mode<select disabled={!editorEnabled} value={form.publishingMode} onChange={(event) => update("publishingMode", event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-white/15 bg-[#151a20] px-3 text-white focus:border-[#e0c985] focus:outline-none disabled:opacity-60">{form.platform === "instagram" ? <>{form.publishingMode !== "native-finish" ? <option value={form.publishingMode} disabled>{form.publishingMode} · ปิดใช้งาน</option> : null}<option value="native-finish">Mobile handoff</option></> : <><option value="native-scheduled">Native scheduled</option><option value="direct">Direct plan</option></>}</select></label>
            <label className="text-sm text-white/75">วันและเวลาอนุมัติแผน<input type="datetime-local" disabled={form.platform !== "facebook" || form.publishingMode !== "native-scheduled"} value={form.scheduledAt} onChange={(event) => update("scheduledAt", event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-white/15 bg-[#151a20] px-3 text-white [color-scheme:dark] focus:border-[#e0c985] focus:outline-none disabled:opacity-60" /></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2"><div className="text-sm text-white/75">Human Review<div className="mt-1.5 flex min-h-11 items-center rounded-xl border border-white/15 bg-white/[0.03] px-3 font-medium text-white/90">{statusLabel[form.reviewStatus] ?? form.reviewStatus}</div></div><div className="text-sm text-white/75">Publication<div className="mt-1.5 flex min-h-11 items-center rounded-xl border border-white/15 bg-white/[0.03] px-3 font-medium text-white/90">{form.publicationStatus ? statusLabel[form.publicationStatus] ?? form.publicationStatus : "ยังไม่มี record"}</div></div></div>
          <p className="text-xs leading-5 text-white/55">สถานะทั้งสองเป็น read-only การบันทึก Draft ไม่อนุมัติ และการอนุมัติต้องตรวจ revision/version แยกต่างหาก</p>
          {form.format === "link-post" ? <label className="block text-sm text-white/75">HTTPS Link URL<input required type="url" inputMode="url" disabled={!editorEnabled} value={form.linkUrl} onChange={(event) => update("linkUrl", event.target.value)} placeholder="https://example.com/page" className="mt-1.5 min-h-11 w-full rounded-xl border border-white/15 bg-black/20 px-3 text-white placeholder:text-white/40 focus:border-[#e0c985] focus:outline-none disabled:opacity-60" /><span className="mt-1 block text-xs text-white/55">กรอกลิงก์ปลายทางในช่องนี้โดยตรง ระบบไม่อ่านลิงก์จากแคปชัน</span>{form.linkUrl && !isHttpsLinkUrl(form.linkUrl) ? <span className="mt-1 block text-xs text-amber-100">ลิงก์ต้องเป็น HTTPS URL ที่ถูกต้อง</span> : null}</label> : null}
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-sm font-medium text-white/90">Google Drive media</div><p className="mt-1 text-xs leading-5 text-white/55">{form.platform === "facebook" ? facebookMediaRequirement(form.format) : instagramMediaRequirement(form.format)}</p></div>{normalizeFacebookFormat(form.format) && !["text-post", "link-post"].includes(normalizeFacebookFormat(form.format)!) ? <button type="button" onClick={chooseDriveMedia} disabled={(!editorEnabled && !form.publicationId) || !drivePickerConfigured || drivePickerState === "running"} className="min-h-11 rounded-xl border border-[#e0c985]/50 px-4 py-2.5 text-sm font-semibold text-[#f4df9b] hover:bg-[#e0c985]/10 disabled:cursor-not-allowed disabled:opacity-40">{drivePickerState === "running" ? "กำลังตรวจสื่อ…" : form.publicationId ? "ยืนยันไฟล์ที่อนุมัติ" : "เลือกจาก Google Drive"}</button> : null}</div>{!drivePickerConfigured ? <p className="mt-2 text-xs leading-5 text-amber-100/80">ยังไม่มี OAuth client ID, Picker API key หรือ Cloud project number จึงปิดการเลือกสื่อ</p> : null}<ol className="mt-3 space-y-2">{form.mediaReferences.map((reference, index) => { const asset = mediaById.get(reference.assetId); return <li key={`${reference.assetId}:${reference.order ?? index}`} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/70"><span className="font-medium text-white/85">{reference.order ?? index + 1}. {asset?.filename ?? reference.assetId}</span><span className="mt-1 block break-all text-white/50">{reference.mimeType ?? "MIME ไม่พร้อม"} · {asset?.dimensions ?? "size อยู่ใน React memory เท่านั้น"} · {reference.sha256Checksum ? `SHA-256 ${reference.sha256Checksum.slice(0, 12)}…` : "SHA-256 ไม่พร้อม"}</span></li>; })}</ol>{form.mediaReferences.length > 0 && !mediaValidation.ok ? <p className="mt-2 text-xs leading-5 text-amber-100/80">สื่อยังไม่ผ่าน contract: {form.platform === "facebook" ? facebookMediaRequirement(form.format) : instagramMediaRequirement(form.format)}</p> : null}</div>
          <label className="block text-sm text-white/75">แคปชัน<textarea disabled={!editorEnabled} value={form.caption} onChange={(event) => update("caption", event.target.value)} rows={7} placeholder="เขียนแคปชันสำหรับโพสต์นี้" className="mt-1.5 w-full resize-y rounded-xl border border-white/15 bg-black/20 px-3 py-3 leading-6 text-white placeholder:text-white/40 focus:border-[#e0c985] focus:outline-none disabled:opacity-60" /><span className="mt-1 block text-right text-xs text-white/55">{form.caption.length.toLocaleString("th-TH")} ตัวอักษร</span></label>
          {form.platform === "facebook" ? <fieldset className="rounded-2xl border border-white/10 bg-black/10 p-4"><legend className="px-1 text-sm font-medium text-white/90">Comment Series</legend><label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-white/80"><input type="checkbox" disabled={!editorEnabled} checked={form.commentSeries.length > 0} onChange={(event) => toggleCommentSeries(event.target.checked)} className="h-5 w-5 accent-[#e0c985]" /><span>ต่อ Main Text ด้วย Text Card หลายคอมเมนต์</span></label>{form.commentSeries.length > 0 ? <><label className="mt-3 block text-xs text-white/65">รูปแบบการต่อ<select disabled={!editorEnabled} value={form.commentSeriesMode} onChange={(event) => update("commentSeriesMode", event.target.value as "top-level" | "threaded")} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-[#151a20] px-3 text-sm text-white disabled:opacity-60"><option value="threaded">ต่อเป็น Thread</option><option value="top-level">แยกเป็นคอมเมนต์หลัก</option></select></label><ol className="mt-3 space-y-3">{form.commentSeries.map((comment) => <li key={comment.position} className="rounded-xl border border-white/10 bg-white/[0.025] p-3"><div className="flex items-center justify-between gap-3"><label htmlFor={`comment-series-${comment.position}`} className="text-sm font-medium text-[#f4df9b]">Text Card {comment.position}</label><button type="button" disabled={!editorEnabled || form.commentSeries.length === 1} onClick={() => removeComment(comment.position)} className="min-h-10 rounded-lg border border-white/10 px-3 text-xs text-white/65 hover:bg-white/5 disabled:opacity-35">ลบ</button></div><textarea id={`comment-series-${comment.position}`} disabled={!editorEnabled} required value={comment.text} maxLength={2_000} onChange={(event) => updateComment(comment.position, event.target.value)} rows={4} placeholder={`ข้อความคอมเมนต์ลำดับ ${comment.position}`} className="mt-2 w-full resize-y rounded-xl border border-white/15 bg-black/20 px-3 py-3 text-sm leading-6 text-white placeholder:text-white/35 disabled:opacity-60" /><span className="mt-1 block text-right text-xs text-white/50">{comment.text.length.toLocaleString("th-TH")}/2,000</span></li>)}</ol><button type="button" disabled={!editorEnabled || form.commentSeries.length >= 20} onClick={addComment} className="mt-3 min-h-11 w-full rounded-xl border border-white/15 px-4 text-sm text-white/75 hover:bg-white/5 disabled:opacity-35">เพิ่ม Text Card</button></> : <p className="mt-2 text-xs leading-5 text-white/50">เปิดแล้วระบบจะสร้าง 4 Text Cards เริ่มต้น และผูกทั้งหมดกับ revision ที่อนุมัติ</p>}{!commentSeriesReady ? <p className="mt-2 text-xs text-amber-100">กรอกทุก Text Card ให้ครบก่อนบันทึกหรืออนุมัติ</p> : null}</fieldset> : null}
          {editorEnabled ? <button type="submit" disabled={!canSaveDraft} className="min-h-11 w-full rounded-xl bg-[#e0c985] px-4 py-2.5 text-sm font-semibold text-[#17191d] hover:bg-[#ecd99b] focus:outline-none focus:ring-2 focus:ring-[#f4df9b] disabled:cursor-not-allowed disabled:opacity-40">{draftSaveState === "running" ? "กำลังบันทึก…" : form.source === "new" ? "สร้าง Sanity Draft" : "บันทึก Sanity Draft"}</button> : null}
          {draftApiState === "failed" ? <p role="alert" className="rounded-xl border border-rose-200/20 bg-rose-200/[0.05] px-3 py-2 text-xs leading-5 text-rose-100">Draft API ใช้ไม่ได้หรือบัญชีนี้ไม่ใช่ Owner จึงปิดการสร้างและแก้ไข โดยไม่ fallback ไปบันทึกใน browser</p> : null}
          {supportedApproval ? <div className="rounded-2xl border border-white/10 bg-black/10 p-4"><div className="text-sm font-medium text-white/90">Human approval</div><dl className="mt-2 grid gap-2 text-xs text-white/65 sm:grid-cols-2"><div><dt>Revision</dt><dd className="mt-0.5 break-all text-white/80">{form.revision ?? "ยังไม่มี"}</dd></div><div><dt>Version</dt><dd className="mt-0.5 text-white/80">{form.version.toLocaleString("th-TH")}</dd></div></dl><button type="button" onClick={approveRevision} disabled={!canApprove || approvalState === "running"} className="mt-3 min-h-11 w-full rounded-xl border border-[#e0c985]/50 px-4 py-2.5 text-sm font-semibold text-[#f4df9b] hover:bg-[#e0c985]/10 focus:outline-none focus:ring-2 focus:ring-[#e0c985] disabled:cursor-not-allowed disabled:opacity-40">{approvalState === "running" ? "กำลังตรวจ revision…" : "ยืนยันอนุมัติ revision นี้"}</button>{!approvalEnabled ? <p className="mt-2 text-xs leading-5 text-amber-100/80">Approval API ยังปิดใน environment นี้</p> : null}{form.reviewStatus !== "approved" ? <p className="mt-2 text-xs leading-5 text-amber-100/80">Draft ต้องผ่าน Human Review จนเป็น approved ก่อน</p> : null}{editorialDirty ? <p className="mt-2 text-xs leading-5 text-amber-100/80">มีข้อมูลที่ยังไม่บันทึก ต้องบันทึกและโหลด revision ใหม่ก่อนอนุมัติ</p> : null}{!scheduleReady ? <p className="mt-2 text-xs leading-5 text-amber-100/80">Facebook native scheduling ต้องกำหนดเวลาในอนาคตก่อนอนุมัติ</p> : null}{!linkReady ? <p className="mt-2 text-xs leading-5 text-amber-100/80">Link Post ต้องมี HTTPS Link URL แยกจากแคปชันก่อนอนุมัติ</p> : null}{form.approvalRecorded ? <p className="mt-2 text-xs leading-5 text-emerald-100/80">revision นี้มี publication record แล้ว จึงไม่สร้างคำขอซ้ำ</p> : null}</div> : null}
          {!mediaValidation.ok ? <p className="rounded-xl border border-amber-200/20 bg-amber-200/[0.05] px-3 py-2 text-xs leading-5 text-amber-100">Save และ Approve ถูกปิดจน media IDs, MIME, order และ SHA-256 ตรงตาม revision</p> : null}
          {!instagramHandoffReady ? <p className="rounded-xl border border-amber-200/20 bg-amber-200/[0.05] px-3 py-2 text-xs leading-5 text-amber-100">Instagram Direct ยังปิดอยู่ กรุณาเปลี่ยน Publishing mode เป็น Mobile handoff</p> : null}
          {form.platform === "facebook" && form.publicationId ? <div className="rounded-2xl border border-white/10 bg-black/10 p-4"><div className="text-sm font-medium text-white/90">Manual Execute</div><p className="mt-1 text-xs leading-5 text-white/55">แยกจาก Approve และทำงานเฉพาะเมื่อกดปุ่มนี้ ไม่มี auto-execute หรือ background retry จาก UI</p><button type="button" onClick={executePublication} disabled={!canExecute} className="mt-3 min-h-11 w-full rounded-xl bg-rose-200/90 px-4 py-2.5 text-sm font-semibold text-[#281416] hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-35">{executionState === "running" ? "กำลัง Execute…" : "Execute ที่ Provider"}</button>{form.publicationJobVersion === null ? <p className="mt-2 text-xs leading-5 text-amber-100/80">Backend ส่ง publicationId แล้ว แต่ยังไม่ส่ง jobVersion จึงปิด Execute และไม่เดา expectedJobVersion</p> : null}{form.mediaReferences.length > 0 && !driveMediaReady ? <p className="mt-2 text-xs leading-5 text-amber-100/80">กรุณาเลือกสื่อใหม่เพื่อให้ size และ SHA-256 อยู่ใน React memory ครบก่อน Execute</p> : null}{form.mediaReferences.length > 0 && !driveAuthorizationReady ? <p className="mt-2 text-xs leading-5 text-amber-100/80">Google Drive token ไม่มีหรือหมดอายุ กรุณาเลือกสื่อใหม่</p> : null}</div> : null}
        </form>
        {notice ? <p aria-live="polite" className="mt-3 text-sm leading-6 text-emerald-100">{notice}</p> : null}
        {form.platform === "facebook" ? <section className="mt-5 border-t border-white/10 pt-5" aria-labelledby="facebook-scheduling-title"><h3 id="facebook-scheduling-title" className="font-semibold">Facebook scheduling</h3><p className="mt-2 text-sm leading-6 text-white/70">{facebookScheduleState(form)} การบันทึกและ Approve ไม่เรียก Provider; เรียกได้เฉพาะปุ่ม Execute แยกด้านบน</p><a href="https://business.facebook.com/latest/home" target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">เปิด Meta Business Suite</a></section> : null}
        {form.platform === "instagram" ? <InstagramMobileHandoff variantId={form.id} revision={form.revision} version={form.version} approvalRecorded={form.approvalRecorded} caption={form.caption} format={form.format} mediaReferences={form.mediaReferences} driveOAuthClientId={driveOAuthClientId} /> : null}
        <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-white/60">{form.planReason}</p>
      </section>
    </div>
  );
}

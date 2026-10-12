import type { ApprovedVariantApi, SocialDraftApiItem, SocialMediaReference, SocialCommentSeriesItem } from "./social-workspace-client";

export type SocialPlatform = "facebook" | "instagram" | "youtube" | "tiktok" | "facebook-group";

export type ItemSource = "draft-api" | "approved-api" | "new";

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

export type SocialPostMedia = {
  id: string;
  filename: string;
  kind: "image" | "video" | "caption";
  dimensions: string;
  downloadUrl: string | null;
  sizeBytes: number | null;
};

export function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function formatScheduledAt(value: string) {
  if (!value) return "ยังไม่กำหนด";
  const parsed = new Date(`${value}:00+07:00`);
  if (!Number.isFinite(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(parsed);
}

export function hasFutureSchedule(value: string) {
  if (!value) return false;
  const date = new Date(`${value}:00+07:00`);
  return Number.isFinite(date.getTime()) && date.getTime() > Date.now();
}

export function isHttpsLinkUrl(value: string) {
  try {
    return new URL(value.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

export function primaryAsset(references: SocialMediaReference[]) {
  return references.find((asset) => asset.role === "primary") ?? references[0] ?? null;
}

export function mediaFromReferences(references: SocialMediaReference[]): SocialPostMedia[] {
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

export function itemFromApproved(variant: ApprovedVariantApi): SocialPostWorkspaceItem {
  return {
    id: variant.variantId, revision: variant.revision, version: variant.version, masterContentId: variant.masterContentId,
    title: variant.title, platform: variant.platform, format: variant.format, publishingMode: variant.publishingMode,
    reviewStatus: variant.reviewStatus, publicationStatus: variant.publication?.status ?? null,
    scheduledAt: toLocalDateTime(variant.publication?.scheduledAt ?? null), caption: variant.caption ?? "", linkUrl: variant.linkUrl ?? "",
    mediaAssetId: primaryAsset(variant.mediaMetadata)?.assetId ?? "", mediaReferences: variant.mediaMetadata,
    commentSeriesMode: variant.commentSeriesMode, commentSeries: variant.commentSeries,
    planReason: variant.publication?.executionTarget ? "เตรียมวิธีส่งโพสต์ไว้แล้ว" : "ผ่านการตรวจแล้ว แต่ยังไม่มีแผนส่งโพสต์",
    source: "approved-api", approvalRecorded: Boolean(variant.publication),
    publicationId: variant.publication?.publicationId ?? null,
    publicationJobVersion: variant.publication?.jobVersion ?? null,
  };
}

export function itemFromDraft(draft: SocialDraftApiItem, approved?: ApprovedVariantApi): SocialPostWorkspaceItem {
  return {
    id: draft.variantId, revision: draft.revision, version: draft.version, masterContentId: draft.masterContentId,
    title: draft.title, platform: draft.channel, format: draft.format, publishingMode: draft.publishingMode,
    reviewStatus: draft.reviewStatus, publicationStatus: approved?.publication?.status ?? null,
    scheduledAt: toLocalDateTime(approved?.publication?.scheduledAt ?? null), caption: draft.caption, linkUrl: draft.linkUrl ?? "",
    mediaAssetId: primaryAsset(draft.mediaReferences)?.assetId ?? "", mediaReferences: draft.mediaReferences,
    commentSeriesMode: draft.commentSeriesMode, commentSeries: draft.commentSeries,
    planReason: approved?.publication?.executionTarget ? "เตรียมวิธีส่งโพสต์ไว้แล้ว" : "เมื่อแก้ไขฉบับร่าง จะต้องตรวจและอนุมัติอีกครั้ง",
    source: "draft-api", approvalRecorded: Boolean(approved?.publication),
    publicationId: approved?.publication?.publicationId ?? null,
    publicationJobVersion: approved?.publication?.jobVersion ?? null,
  };
}

export function emptyDraft(masterContentId = ""): SocialPostWorkspaceItem {
  return {
    id: "new-social-draft", revision: null, version: 1, masterContentId, title: "", platform: "facebook",
    format: "text-post", publishingMode: "native-scheduled", reviewStatus: "drafting", publicationStatus: null,
    scheduledAt: "", caption: "", linkUrl: "", mediaAssetId: "", mediaReferences: [],
    commentSeriesMode: "threaded", commentSeries: [],
    planReason: "ชิ้นงานใหม่จะถูกบันทึกเป็นฉบับร่าง", source: "new", approvalRecorded: false,
    publicationId: null, publicationJobVersion: null,
  };
}

export function displayStatus(item: SocialPostWorkspaceItem) {
  return item.publicationStatus ?? item.reviewStatus;
}

export function editorialFields(item: SocialPostWorkspaceItem) {
  return JSON.stringify({
    masterContentId: item.masterContentId, title: item.title, platform: item.platform, format: item.format,
    publishingMode: item.publishingMode, caption: item.caption, linkUrl: item.linkUrl, mediaReferences: item.mediaReferences,
    commentSeriesMode: item.commentSeriesMode, commentSeries: item.commentSeries,
  });
}

export function exactMediaBinding(references: readonly SocialMediaReference[]) {
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

export function facebookScheduleState(item: SocialPostWorkspaceItem) {
  if (item.platform !== "facebook") return null;
  if (item.publicationStatus === "native-scheduled") return "นัดหมายใน Meta แล้ว";
  if (item.scheduledAt) return "กำหนดเวลาไว้แล้ว · ยังไม่ได้ส่งไป Meta";
  if (item.reviewStatus === "approved") return "ผ่านการตรวจแล้ว · รอกำหนดเวลา";
  return "รอผู้มีสิทธิ์ตรวจและอนุมัติ";
}

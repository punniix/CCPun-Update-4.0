export const GOOGLE_DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file" as const;
export const GOOGLE_DRIVE_MAX_FILE_BYTES = 1_000_000_000;

export const FACEBOOK_AUTHORING_FORMATS = [
  "text-post",
  "link-post",
  "image-post",
  "album",
  "video",
  "reel",
] as const;

export type FacebookAuthoringFormat = (typeof FACEBOOK_AUTHORING_FORMATS)[number];
export type SocialMediaReference = {
  assetId: string;
  role: "primary" | "carousel-item" | "cover" | "thumbnail" | "caption";
  order: number | null;
  mimeType: string | null;
  widthPx: number | null;
  heightPx: number | null;
  durationMs: number | null;
  sha256Checksum: string | null;
  altText?: string | null;
  thumbnailTimestampMs?: number | null;
};

export type GoogleDrivePickerFile = {
  assetId: string;
  name: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "video/mp4";
  sizeBytes: number;
  widthPx: number | null;
  heightPx: number | null;
  durationMs: number | null;
};

export type VerifiedGoogleDriveFile = GoogleDrivePickerFile & {
  sha256Checksum: string;
};

export type GoogleDriveAuthorization = {
  scope: typeof GOOGLE_DRIVE_FILE_SCOPE;
  mode: "owner-interactive";
  tokenPersistence: "memory-only";
  refreshTokenPersistence: "forbidden";
  issuedAtMs: number;
  expiresAtMs: number;
};

const aliases: Record<string, FacebookAuthoringFormat> = {
  "text-post": "text-post",
  text: "text-post",
  "link-post": "link-post",
  link: "link-post",
  "image-post": "image-post",
  "photo-post": "image-post",
  "single-image": "image-post",
  album: "album",
  carousel: "album",
  "multi-image": "album",
  video: "video",
  "video-post": "video",
  reel: "reel",
  "facebook-reel": "reel",
};

const imageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function normalizeFacebookFormat(value: string): FacebookAuthoringFormat | null {
  return aliases[value] ?? null;
}

export function facebookMediaRequirement(value: string) {
  const format = normalizeFacebookFormat(value);
  if (format === "text-post" || format === "link-post") return "ไม่ใช้สื่อ";
  if (format === "image-post") return "ภาพ JPEG, PNG หรือ WebP จำนวน 1 ไฟล์";
  if (format === "album") return "ภาพเรียงลำดับ 2–10 ไฟล์";
  if (format === "video") return "วิดีโอ MP4 จำนวน 1 ไฟล์";
  if (format === "reel") return "วิดีโอ MP4 แนวตั้ง 1 ไฟล์ พร้อมข้อมูลความกว้าง ความสูง และระยะเวลาจาก Google Drive";
  return "รูปแบบนี้ยังไม่รองรับการเผยแพร่";
}

export function instagramMediaRequirement(value: string) {
  const format = normalizeFacebookFormat(value);
  if (format === "image-post") return "ภาพ JPEG, PNG หรือ WebP จำนวน 1 ไฟล์สำหรับ Mobile handoff";
  if (format === "album") return "ภาพเรียงลำดับ 2–10 ไฟล์สำหรับ Mobile handoff";
  if (format === "reel") return "วิดีโอ MP4 แนวตั้ง 1 ไฟล์ พร้อมข้อมูลความกว้าง ความสูง และระยะเวลาจาก Google Drive";
  return "รูปแบบนี้ยังไม่รองรับ Instagram Mobile handoff";
}

function validateReelMedia(media: readonly SocialMediaReference[]) {
  if (media.length !== 1 || media[0]?.mimeType !== "video/mp4" || !/^[a-f0-9]{64}$/.test(media[0]?.sha256Checksum ?? "")) {
    return { ok: false as const, reason: "single-mp4-required" as const };
  }
  const [reel] = media;
  if (!Number.isSafeInteger(reel.widthPx) || !Number.isSafeInteger(reel.heightPx)
    || !Number.isSafeInteger(reel.durationMs) || (reel.widthPx ?? 0) < 1 || (reel.heightPx ?? 0) < 1
    || (reel.durationMs ?? 0) < 1 || (reel.durationMs ?? 0) > 86_400_000) {
    return { ok: false as const, reason: "reel-metadata-unavailable" as const };
  }
  if (reel.thumbnailTimestampMs != null && reel.thumbnailTimestampMs >= reel.durationMs!) {
    return { ok: false as const, reason: "thumbnail-timestamp-out-of-range" as const };
  }
  return reel.heightPx! > reel.widthPx!
    ? { ok: true as const, reason: "media-ready" as const }
    : { ok: false as const, reason: "reel-vertical-required" as const };
}

export function validateFacebookMedia(value: string, media: readonly SocialMediaReference[]) {
  const format = normalizeFacebookFormat(value);
  if (!format) return { ok: false as const, reason: "unsupported-format" as const };
  if (format === "text-post" || format === "link-post") {
    return media.length === 0
      ? { ok: true as const, reason: "media-ready" as const }
      : { ok: false as const, reason: "media-not-allowed" as const };
  }
  if (format === "image-post") {
    return media.length === 1 && imageMimeTypes.has(media[0]?.mimeType ?? "") && /^[a-f0-9]{64}$/.test(media[0]?.sha256Checksum ?? "")
      ? { ok: true as const, reason: "media-ready" as const }
      : { ok: false as const, reason: "single-image-required" as const };
  }
  if (format === "album") {
    if (media.length < 2 || media.length > 10 || media.some((item) => !imageMimeTypes.has(item.mimeType ?? "") || !/^[a-f0-9]{64}$/.test(item.sha256Checksum ?? ""))) {
      return { ok: false as const, reason: "album-images-required" as const };
    }
    const orders = media.map((item) => item.order);
    const ordered = orders.every((order, index) => order === index + 1) && new Set(orders).size === media.length;
    return ordered
      ? { ok: true as const, reason: "media-ready" as const }
      : { ok: false as const, reason: "album-order-invalid" as const };
  }
  if (format === "reel") return validateReelMedia(media);
  return media.length === 1 && media[0]?.mimeType === "video/mp4" && /^[a-f0-9]{64}$/.test(media[0]?.sha256Checksum ?? "")
    ? { ok: true as const, reason: "media-ready" as const }
    : { ok: false as const, reason: "single-mp4-required" as const };
}

export function validateInstagramMedia(value: string, media: readonly SocialMediaReference[]) {
  const format = normalizeFacebookFormat(value);
  if (format === "image-post" || format === "album" || format === "reel") {
    return validateFacebookMedia(format, media);
  }
  return { ok: false as const, reason: "unsupported-format" as const };
}

export function buildSocialMediaReferences(value: string, files: readonly VerifiedGoogleDriveFile[]): SocialMediaReference[] {
  const format = normalizeFacebookFormat(value);
  if (!format || format === "text-post" || format === "link-post") return [];
  return files.map((file, index) => ({
    assetId: file.assetId,
    role: format === "album" ? "carousel-item" as const : "primary" as const,
    order: format === "album" ? index + 1 : null,
    mimeType: file.mimeType,
    widthPx: file.widthPx,
    heightPx: file.heightPx,
    durationMs: file.durationMs,
    sha256Checksum: file.sha256Checksum,
    altText: null,
    thumbnailTimestampMs: null,
  }));
}

function positiveInteger(value: unknown, maximum: number) {
  const parsed = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return Number.isSafeInteger(parsed) && Number(parsed) >= 1 && Number(parsed) <= maximum ? Number(parsed) : null;
}

export function parseGoogleDriveMediaMetadata(value: unknown, expected: VerifiedGoogleDriveFile) {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (item.id !== expected.assetId || item.mimeType !== expected.mimeType
    || positiveInteger(item.size, GOOGLE_DRIVE_MAX_FILE_BYTES) !== expected.sizeBytes
    || item.sha256Checksum !== expected.sha256Checksum) return null;

  const image = item.imageMediaMetadata && typeof item.imageMediaMetadata === "object"
    ? item.imageMediaMetadata as Record<string, unknown> : null;
  const video = item.videoMediaMetadata && typeof item.videoMediaMetadata === "object"
    ? item.videoMediaMetadata as Record<string, unknown> : null;
  return {
    widthPx: positiveInteger((expected.mimeType === "video/mp4" ? video : image)?.width, 32_768),
    heightPx: positiveInteger((expected.mimeType === "video/mp4" ? video : image)?.height, 32_768),
    durationMs: expected.mimeType === "video/mp4" ? positiveInteger(video?.durationMillis, 86_400_000) : null,
  };
}

export function parseGoogleDrivePickerDocuments(value: unknown):
  | { ok: true; files: GoogleDrivePickerFile[] }
  | { ok: false; reason: "invalid-selection" | "unsupported-file" | "size-unavailable" | "too-many-files" } {
  if (!Array.isArray(value) || value.length === 0) return { ok: false, reason: "invalid-selection" };
  if (value.length > 10) return { ok: false, reason: "too-many-files" };
  const files: GoogleDrivePickerFile[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") return { ok: false, reason: "invalid-selection" };
    const item = candidate as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const mimeType = typeof item.mimeType === "string" ? item.mimeType : "";
    const rawSize = typeof item.sizeBytes === "string" ? Number(item.sizeBytes) : item.sizeBytes;
    if (!id || !name || !/^[A-Za-z0-9_-]{10,200}$/.test(id)) return { ok: false, reason: "invalid-selection" };
    if (!imageMimeTypes.has(mimeType) && mimeType !== "video/mp4") return { ok: false, reason: "unsupported-file" };
    if (!Number.isSafeInteger(rawSize) || Number(rawSize) < 1 || Number(rawSize) > GOOGLE_DRIVE_MAX_FILE_BYTES) {
      return { ok: false, reason: "size-unavailable" };
    }
    files.push({
      assetId: id,
      name,
      mimeType: mimeType as GoogleDrivePickerFile["mimeType"],
      sizeBytes: Number(rawSize),
      widthPx: null,
      heightPx: null,
      durationMs: null,
    });
  }
  if (new Set(files.map((file) => file.assetId)).size !== files.length) return { ok: false, reason: "invalid-selection" };
  return { ok: true, files };
}

export function isGoogleDriveAuthorizationUsable(authorization: GoogleDriveAuthorization, nowMs = Date.now()) {
  return authorization.scope === GOOGLE_DRIVE_FILE_SCOPE
    && authorization.mode === "owner-interactive"
    && authorization.tokenPersistence === "memory-only"
    && authorization.refreshTokenPersistence === "forbidden"
    && authorization.issuedAtMs <= nowMs
    && authorization.expiresAtMs > nowMs
    && authorization.expiresAtMs - authorization.issuedAtMs <= 60 * 60 * 1_000;
}

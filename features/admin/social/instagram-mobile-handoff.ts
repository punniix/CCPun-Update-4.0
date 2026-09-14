import {
  GOOGLE_DRIVE_MAX_FILE_BYTES,
  isGoogleDriveAuthorizationUsable,
  type GoogleDriveAuthorization,
  type SocialMediaReference,
} from "@/features/admin/social/social-workspace-media";

export type InstagramHandoffDriveSession = {
  accessToken: string;
  authorization: GoogleDriveAuthorization;
};

export type InstagramHandoffAsset = {
  assetId: string;
  name: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "video/mp4";
  sizeBytes: number;
  sha256Checksum: string;
  order: number;
};

export type InstagramAudioOption = {
  audioId: string;
  audioType: "music" | "original_sound";
  title: string;
  artist: string | null;
  durationMs: number;
  previewUrl: string | null;
};

const allowedMimeTypes = new Set<InstagramHandoffAsset["mimeType"]>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function safeHttpsUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeInstagramHandoffDriveMetadata(
  reference: SocialMediaReference,
  value: unknown,
): InstagramHandoffAsset {
  const item = record(value);
  const sizeBytes = typeof item?.size === "string" && /^[1-9]\d*$/.test(item.size)
    ? Number(item.size)
    : Number.NaN;
  const mimeType = item?.mimeType;
  if (
    !item
    || item.id !== reference.assetId
    || typeof item.name !== "string"
    || !item.name.trim()
    || item.name.length > 255
    || /[\u0000-\u001F\u007F-\u009F]/u.test(item.name)
    || typeof mimeType !== "string"
    || !allowedMimeTypes.has(mimeType as InstagramHandoffAsset["mimeType"])
    || mimeType !== reference.mimeType
    || !Number.isSafeInteger(sizeBytes)
    || sizeBytes < 1
    || sizeBytes > GOOGLE_DRIVE_MAX_FILE_BYTES
    || typeof item.sha256Checksum !== "string"
    || !/^[0-9a-f]{64}$/.test(item.sha256Checksum)
    || item.sha256Checksum !== reference.sha256Checksum
  ) {
    throw new Error("drive-approved-media-mismatch");
  }
  return {
    assetId: reference.assetId,
    name: item.name,
    mimeType: mimeType as InstagramHandoffAsset["mimeType"],
    sizeBytes,
    sha256Checksum: item.sha256Checksum,
    order: reference.order ?? 1,
  };
}

export async function prepareInstagramHandoffAssets(input: {
  references: readonly SocialMediaReference[];
  session: InstagramHandoffDriveSession;
  signal?: AbortSignal;
}): Promise<InstagramHandoffAsset[]> {
  if (!isGoogleDriveAuthorizationUsable(input.session.authorization)) {
    throw new Error("drive-authorization-expired");
  }
  const references = [...input.references].sort((left, right) => (left.order ?? 1) - (right.order ?? 1));
  if (references.length < 1 || references.length > 10) throw new Error("instagram-media-required");

  return Promise.all(references.map(async (reference) => {
    if (!/^[A-Za-z0-9_-]{10,200}$/.test(reference.assetId)) throw new Error("drive-approved-media-mismatch");
    const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(reference.assetId)}`);
    url.searchParams.set("fields", "id,name,mimeType,size,sha256Checksum");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${input.session.accessToken}` },
      cache: "no-store",
      redirect: "error",
      signal: input.signal,
    });
    if (!response.ok) throw new Error("drive-provider-unavailable");
    return normalizeInstagramHandoffDriveMetadata(reference, await response.json().catch(() => null));
  }));
}

export function submitInstagramHandoffMedia(input: {
  asset: InstagramHandoffAsset;
  session: InstagramHandoffDriveSession;
  mode: "inline" | "attachment";
  approvedVariant: { variantId: string; revision: string; version: number };
}) {
  if (!isGoogleDriveAuthorizationUsable(input.session.authorization)) throw new Error("drive-authorization-expired");
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/admin/social/providers/meta/handoff";
  form.target = "_blank";
  form.hidden = true;
  const fields = {
    selectedFileId: input.asset.assetId,
    accessToken: input.session.accessToken,
    authorization: JSON.stringify(input.session.authorization),
    expectedMimeType: input.asset.mimeType,
    expectedByteSize: String(input.asset.sizeBytes),
    expectedSha256Checksum: input.asset.sha256Checksum,
    disposition: input.mode,
    variantId: input.approvedVariant.variantId,
    approvedRevision: input.approvedVariant.revision,
    approvedVersion: String(input.approvedVariant.version),
  };
  for (const [name, value] of Object.entries(fields)) {
    const field = document.createElement("input");
    field.type = "hidden";
    field.name = name;
    field.value = value;
    form.append(field);
  }
  document.body.append(form);
  form.submit();
  form.remove();
}

export async function copyHandoffText(value: string) {
  if (!value.trim()) throw new Error("empty-copy-value");
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const field = document.createElement("textarea");
  field.value = value;
  field.readOnly = true;
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  if (!copied) throw new Error("clipboard-unavailable");
}

export function normalizeInstagramAudioOptions(value: unknown): InstagramAudioOption[] {
  const payload = record(value);
  if (!Array.isArray(payload?.audio)) return [];
  return payload.audio.flatMap((candidate) => {
    const item = record(candidate);
    if (!item || typeof item.audio_id !== "string" || !/^[A-Za-z0-9_.:-]{1,120}$/.test(item.audio_id)
      || (item.audio_type !== "music" && item.audio_type !== "original_sound")
      || typeof item.title !== "string" || !item.title.trim() || item.title.length > 500
      || typeof item.duration_in_ms !== "number" || !Number.isSafeInteger(item.duration_in_ms) || item.duration_in_ms < 0) return [];
    return [{
      audioId: item.audio_id,
      audioType: item.audio_type,
      title: item.title,
      artist: typeof item.display_artist === "string" && item.display_artist.trim() ? item.display_artist : null,
      durationMs: item.duration_in_ms,
      previewUrl: safeHttpsUrl(item.on_platform_audio_preview_link),
    }];
  });
}

export async function searchInstagramAudioOptions(input: {
  audioType: "music" | "original_sound";
  searchQuery: string;
  signal?: AbortSignal;
}) {
  const response = await fetch("/api/admin/social/providers/meta/audio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ audioType: input.audioType, searchQuery: input.searchQuery.trim() || undefined }),
    signal: input.signal,
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = record(payload)?.error;
    throw new Error(typeof code === "string" ? code : "instagram-audio-unavailable");
  }
  return normalizeInstagramAudioOptions(payload);
}

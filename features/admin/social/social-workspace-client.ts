import {
  GOOGLE_DRIVE_FILE_SCOPE,
  isGoogleDriveAuthorizationUsable,
  normalizeFacebookFormat,
  parseGoogleDrivePickerDocuments,
  parseGoogleDriveMediaMetadata,
  type GoogleDriveAuthorization,
  type GoogleDrivePickerFile,
  type SocialMediaReference,
  type VerifiedGoogleDriveFile,
} from "@/features/admin/social/social-workspace-media";

export type { GoogleDriveAuthorization, GoogleDrivePickerFile, SocialMediaReference, VerifiedGoogleDriveFile } from "@/features/admin/social/social-workspace-media";
export type SocialChannel = "facebook" | "instagram";
export type SocialCommentSeriesItem = { position: number; text: string };

export type SocialDraftApiItem = {
  variantId: string;
  revision: string;
  version: number;
  masterContentId: string;
  title: string;
  caption: string;
  linkUrl: string | null;
  channel: SocialChannel;
  format: string;
  publishingMode: string;
  reviewStatus: string;
  mediaReferences: SocialMediaReference[];
  commentSeriesMode: "top-level" | "threaded";
  commentSeries: SocialCommentSeriesItem[];
};

export type SocialMasterContentChoice = {
  id: string;
  title: string;
  summary: string;
};

export type ApprovedVariantApi = {
  variantId: string;
  revision: string;
  version: number;
  masterContentId: string;
  platform: SocialChannel;
  format: string;
  publishingMode: string;
  reviewStatus: "approved";
  title: string;
  caption: string | null;
  linkUrl: string | null;
  mediaMetadata: SocialMediaReference[];
  commentSeriesMode: "top-level" | "threaded";
  commentSeries: SocialCommentSeriesItem[];
  publication: null | {
    publicationId: string;
    status: string;
    executionTarget: string | null;
    scheduledAt: string | null;
    approvedRevision: string | null;
    approvedVersion: number | null;
    jobVersion: number | null;
  };
};

export type GoogleDriveMemorySession = {
  accessToken: string;
  authorization: GoogleDriveAuthorization;
};

type WorkspaceResult = {
  drafts: SocialDraftApiItem[];
  masterContentChoices: SocialMasterContentChoice[];
  publications: ApprovedVariantApi[];
  draftError: string | null;
  publicationError: string | null;
};

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function httpsLinkUrl(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

function mediaReference(value: unknown): SocialMediaReference | null {
  const item = object(value);
  if (!item || typeof item.assetId !== "string" || typeof item.role !== "string") return null;
  if (!["primary", "carousel-item", "cover", "thumbnail", "caption"].includes(item.role)) return null;
  return {
    assetId: item.assetId,
    role: item.role as SocialMediaReference["role"],
    order: typeof item.order === "number" ? item.order : null,
    mimeType: typeof item.mimeType === "string" ? item.mimeType : null,
    widthPx: typeof item.widthPx === "number" ? item.widthPx : null,
    heightPx: typeof item.heightPx === "number" ? item.heightPx : null,
    durationMs: typeof item.durationMs === "number" ? item.durationMs : null,
    sha256Checksum: typeof item.sha256Checksum === "string" && /^[a-f0-9]{64}$/.test(item.sha256Checksum)
      ? item.sha256Checksum : null,
  };
}

function normalizedFormat(platform: SocialChannel, value: string) {
  return platform === "facebook" ? normalizeFacebookFormat(value) ?? value : value;
}

function commentSeries(value: unknown): SocialCommentSeriesItem[] {
  if (!Array.isArray(value)) return [];
  const comments: SocialCommentSeriesItem[] = [];
  for (const entry of value) {
    const item = object(entry);
    if (item && typeof item.position === "number" && Number.isInteger(item.position)
      && item.position >= 1 && item.position <= 20 && typeof item.text === "string" && item.text.length <= 2_000) {
      comments.push({ position: item.position, text: item.text });
    }
  }
  return comments.sort((left, right) => left.position - right.position);
}

function draft(value: unknown): SocialDraftApiItem | null {
  const item = object(value);
  if (!item || typeof item.variantId !== "string" || typeof item.revision !== "string"
    || typeof item.version !== "number" || typeof item.masterContentId !== "string"
    || typeof item.title !== "string" || typeof item.caption !== "string"
    || (item.channel !== "facebook" && item.channel !== "instagram")
    || typeof item.format !== "string" || typeof item.publishingMode !== "string"
    || typeof item.reviewStatus !== "string" || !Array.isArray(item.mediaReferences)) return null;
  return {
    variantId: item.variantId,
    revision: item.revision,
    version: item.version,
    masterContentId: item.masterContentId,
    title: item.title,
    caption: item.caption,
    linkUrl: item.format === "link-post" ? httpsLinkUrl(item.linkUrl) : null,
    channel: item.channel,
    format: normalizedFormat(item.channel, item.format),
    publishingMode: item.publishingMode,
    reviewStatus: item.reviewStatus,
    mediaReferences: item.mediaReferences.map(mediaReference).filter((entry): entry is SocialMediaReference => Boolean(entry)),
    commentSeriesMode: item.commentSeriesMode === "threaded" ? "threaded" : "top-level",
    commentSeries: item.channel === "facebook" ? commentSeries(item.commentSeries) : [],
  };
}

function masterChoice(value: unknown): SocialMasterContentChoice | null {
  const item = object(value);
  return item && typeof item.id === "string" && typeof item.title === "string" && typeof item.summary === "string"
    ? { id: item.id, title: item.title, summary: item.summary }
    : null;
}

function approvedVariant(value: unknown): ApprovedVariantApi | null {
  const item = object(value);
  if (!item || typeof item.variantId !== "string" || typeof item.revision !== "string"
    || typeof item.version !== "number" || typeof item.masterContentId !== "string"
    || (item.platform !== "facebook" && item.platform !== "instagram")
    || typeof item.format !== "string" || typeof item.publishingMode !== "string"
    || item.reviewStatus !== "approved" || typeof item.title !== "string"
    || (item.caption !== null && typeof item.caption !== "string") || !Array.isArray(item.mediaMetadata)) return null;
  const publication = object(item.publication);
  return {
    variantId: item.variantId,
    revision: item.revision,
    version: item.version,
    masterContentId: item.masterContentId,
    platform: item.platform,
    format: normalizedFormat(item.platform, item.format),
    publishingMode: item.publishingMode,
    reviewStatus: "approved",
    title: item.title,
    caption: item.caption,
    linkUrl: item.format === "link-post" ? httpsLinkUrl(item.linkUrl) : null,
    mediaMetadata: item.mediaMetadata.map(mediaReference).filter((entry): entry is SocialMediaReference => Boolean(entry)),
    commentSeriesMode: item.commentSeriesMode === "threaded" ? "threaded" : "top-level",
    commentSeries: item.platform === "facebook" ? commentSeries(item.commentSeries) : [],
    publication: publication && typeof publication.publicationId === "string" && typeof publication.status === "string" ? {
      publicationId: publication.publicationId,
      status: publication.status,
      executionTarget: typeof publication.executionTarget === "string" ? publication.executionTarget : null,
      scheduledAt: typeof publication.scheduledAt === "string" ? publication.scheduledAt : null,
      approvedRevision: typeof publication.approvedRevision === "string" ? publication.approvedRevision : null,
      approvedVersion: typeof publication.approvedVersion === "number" ? publication.approvedVersion : null,
      jobVersion: typeof publication.jobVersion === "number" && Number.isInteger(publication.jobVersion) && publication.jobVersion > 0
        ? publication.jobVersion : null,
    } : null,
  };
}

async function readJson(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { cache: "no-store", signal });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = object(payload)?.error;
    throw new Error(typeof code === "string" ? code : "request-failed");
  }
  return payload;
}

export async function loadSocialWorkspace(signal?: AbortSignal): Promise<WorkspaceResult> {
  const [draftResult, publicationResult] = await Promise.allSettled([
    readJson("/api/admin/social/drafts/", signal),
    readJson("/api/admin/social/publications/", signal),
  ]);
  const draftPayload = draftResult.status === "fulfilled" ? object(draftResult.value) : null;
  const publicationPayload = publicationResult.status === "fulfilled" ? object(publicationResult.value) : null;
  return {
    drafts: Array.isArray(draftPayload?.drafts) ? draftPayload.drafts.map(draft).filter((item): item is SocialDraftApiItem => Boolean(item)) : [],
    masterContentChoices: Array.isArray(draftPayload?.masterContentChoices)
      ? draftPayload.masterContentChoices.map(masterChoice).filter((item): item is SocialMasterContentChoice => Boolean(item))
      : [],
    publications: Array.isArray(publicationPayload?.variants)
      ? publicationPayload.variants.map(approvedVariant).filter((item): item is ApprovedVariantApi => Boolean(item))
      : [],
    draftError: draftResult.status === "rejected" ? draftResult.reason instanceof Error ? draftResult.reason.message : "request-failed" : null,
    publicationError: publicationResult.status === "rejected" ? publicationResult.reason instanceof Error ? publicationResult.reason.message : "request-failed" : null,
  };
}

type GoogleDriveBrowser = Window & {
  google?: {
    accounts?: { oauth2?: { initTokenClient?: (options: {
      client_id: string;
      scope: string;
      callback: (response: Record<string, unknown>) => void;
      error_callback?: (error: unknown) => void;
    }) => { requestAccessToken: (options?: { prompt?: string }) => void } } };
    picker?: {
      Action: { PICKED: string; CANCEL: string };
      Feature: { MULTISELECT_ENABLED: string };
      DocsView: new () => { setIncludeFolders: (value: boolean) => unknown; setMimeTypes: (value: string) => unknown };
      PickerBuilder: new () => {
        addView: (view: unknown) => unknown;
        enableFeature: (feature: string) => unknown;
        setAppId: (appId: string) => unknown;
        setOAuthToken: (token: string) => unknown;
        setDeveloperKey: (key: string) => unknown;
        setOrigin: (origin: string) => unknown;
        setCallback: (callback: (data: Record<string, unknown>) => void) => unknown;
        build: () => { setVisible: (value: boolean) => void };
      };
    };
  };
  gapi?: { load: (name: string, options: { callback: () => void; onerror: () => void }) => void };
};

const loadedScripts = new Map<string, Promise<void>>();

function loadBrowserScript(id: string, src: string) {
  if (typeof document === "undefined") return Promise.reject(new Error("browser-required"));
  const existing = loadedScripts.get(id);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const present = document.getElementById(id) as HTMLScriptElement | null;
    if (present?.dataset.loaded === "true") { resolve(); return; }
    const script = present ?? document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => { script.dataset.loaded = "true"; resolve(); }, { once: true });
    script.addEventListener("error", () => reject(new Error("google-script-unavailable")), { once: true });
    if (!present) document.head.appendChild(script);
  });
  loadedScripts.set(id, promise);
  return promise;
}

export async function requestGoogleDriveMemorySession(clientId: string): Promise<GoogleDriveMemorySession> {
  if (!clientId.trim()) throw new Error("drive-oauth-config-missing");
  let browser = window as GoogleDriveBrowser;
  if (!browser.google?.accounts?.oauth2?.initTokenClient) {
    await loadBrowserScript("ccpun-google-identity-services", "https://accounts.google.com/gsi/client");
    browser = window as GoogleDriveBrowser;
  }
  const initTokenClient = browser.google?.accounts?.oauth2?.initTokenClient;
  if (!initTokenClient) throw new Error("drive-oauth-unavailable");
  return new Promise<GoogleDriveMemorySession>((resolve, reject) => {
    const issuedAtMs = Date.now();
    const tokenClient = initTokenClient({
      client_id: clientId.trim(),
      scope: GOOGLE_DRIVE_FILE_SCOPE,
      callback: (response) => {
        const accessToken = typeof response.access_token === "string" ? response.access_token.trim() : "";
        const scopes = typeof response.scope === "string" ? response.scope.split(/\s+/) : [];
        const expiresIn = typeof response.expires_in === "number" ? response.expires_in : Number(response.expires_in);
        if (!accessToken || !scopes.includes(GOOGLE_DRIVE_FILE_SCOPE) || !Number.isFinite(expiresIn) || expiresIn <= 0) {
          reject(new Error(typeof response.error === "string" ? response.error : "drive-authorization-denied"));
          return;
        }
        const authorization: GoogleDriveAuthorization = {
          scope: GOOGLE_DRIVE_FILE_SCOPE,
          mode: "owner-interactive",
          tokenPersistence: "memory-only",
          refreshTokenPersistence: "forbidden",
          issuedAtMs,
          expiresAtMs: issuedAtMs + Math.min(Math.floor(expiresIn * 1_000), 60 * 60 * 1_000),
        };
        if (!isGoogleDriveAuthorizationUsable(authorization, issuedAtMs)) {
          reject(new Error("drive-authorization-invalid"));
          return;
        }
        resolve({ accessToken, authorization });
      },
      error_callback: () => reject(new Error("drive-authorization-failed")),
    });
    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

export async function openGoogleDrivePicker(input: {
  appId: string;
  apiKey: string;
  session: GoogleDriveMemorySession;
}): Promise<GoogleDrivePickerFile[]> {
  if (!/^[1-9]\d+$/.test(input.appId.trim())) throw new Error("drive-picker-app-id-invalid");
  if (!input.apiKey.trim()) throw new Error("drive-picker-config-missing");
  if (!isGoogleDriveAuthorizationUsable(input.session.authorization)) throw new Error("drive-authorization-expired");
  let browser = window as GoogleDriveBrowser;
  if (!browser.gapi?.load) {
    await loadBrowserScript("ccpun-google-api-loader", "https://apis.google.com/js/api.js");
    browser = window as GoogleDriveBrowser;
  }
  await new Promise<void>((resolve, reject) => {
    if (!browser.gapi?.load) { reject(new Error("drive-picker-unavailable")); return; }
    browser.gapi.load("picker", { callback: resolve, onerror: () => reject(new Error("drive-picker-unavailable")) });
  });
  const picker = browser.google?.picker;
  if (!picker) throw new Error("drive-picker-unavailable");
  return new Promise<GoogleDrivePickerFile[]>((resolve, reject) => {
    const view = new picker.DocsView();
    view.setIncludeFolders(false);
    view.setMimeTypes("image/jpeg,image/png,image/webp,video/mp4");
    const builder = new picker.PickerBuilder();
    builder.addView(view);
    builder.enableFeature(picker.Feature.MULTISELECT_ENABLED);
    builder.setAppId(input.appId.trim());
    builder.setOAuthToken(input.session.accessToken);
    builder.setDeveloperKey(input.apiKey.trim());
    builder.setOrigin(window.location.origin);
    builder.setCallback((data) => {
      if (data.action === picker.Action.CANCEL) { resolve([]); return; }
      if (data.action !== picker.Action.PICKED) return;
      const parsed = parseGoogleDrivePickerDocuments(data.docs);
      if (!parsed.ok) { reject(new Error(parsed.reason)); return; }
      resolve(parsed.files);
    });
    builder.build().setVisible(true);
  });
}

export async function verifyGoogleDrivePickerFiles(input: {
  files: readonly GoogleDrivePickerFile[];
  session: GoogleDriveMemorySession;
  signal?: AbortSignal;
}): Promise<VerifiedGoogleDriveFile[]> {
  if (!isGoogleDriveAuthorizationUsable(input.session.authorization)) throw new Error("drive-authorization-expired");
  return Promise.all(input.files.map(async (file) => {
    const body = JSON.stringify({
      selectedFileId: file.assetId,
      accessToken: input.session.accessToken,
      authorization: input.session.authorization,
    });
    const response = await fetch("/api/admin/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body,
      signal: input.signal,
    });
    const payload = object(await response.json().catch(() => null));
    if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : "drive-file-verification-failed");
    const item = object(payload?.item);
    if (!item || item.id !== file.assetId || item.mimeType !== file.mimeType || typeof item.name !== "string"
      || typeof item.sha256Checksum !== "string" || !/^[a-f0-9]{64}$/.test(item.sha256Checksum)) {
      throw new Error("drive-file-verification-mismatch");
    }
    const verified = { ...file, name: item.name, sha256Checksum: item.sha256Checksum };
    const metadataUrl = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.assetId)}`);
    metadataUrl.searchParams.set(
      "fields",
      "id,mimeType,size,sha256Checksum,imageMediaMetadata(width,height),videoMediaMetadata(width,height,durationMillis)",
    );
    try {
      const metadataResponse = await fetch(metadataUrl, {
        headers: { Authorization: `Bearer ${input.session.accessToken}` },
        cache: "no-store",
        redirect: "error",
        signal: input.signal,
      });
      if (!metadataResponse.ok) {
        await metadataResponse.body?.cancel();
        return verified;
      }
      const metadata = parseGoogleDriveMediaMetadata(await metadataResponse.json().catch(() => null), verified);
      if (!metadata) throw new Error("drive-file-metadata-mismatch");
      return { ...verified, ...metadata };
    } catch (error) {
      if (error instanceof Error && error.message === "drive-file-metadata-mismatch") throw error;
      return verified;
    }
  }));
}

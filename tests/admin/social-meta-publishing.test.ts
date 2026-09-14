import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createInstagramReelContainer,
  discoverInstagramPublishingUser,
  publishFacebookPageComment,
  publishFacebookPagePost,
  publishFacebookPageContent,
  publishInstagramMedia,
  readInstagramAudio,
  scheduleFacebookPagePost,
  searchInstagramAudio,
} from "../../lib/admin/social/providers/meta/publishing";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const env = {
  CCPUN_META_ACCESS_TOKEN: "meta-secret",
  CCPUN_META_GRAPH_VERSION: "v26.0",
  CCPUN_META_GRANTED_SCOPES: "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish",
  CCPUN_SOCIAL_PROVIDER_WRITES_ENABLED: "1",
  CCPUN_SOCIAL_OPERATIONS_ENABLED: "1",
  CCPUN_APP_ENV: "admin-uat",
  VERCEL_PROJECT_ID: "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN",
  VERCEL_GIT_COMMIT_REF: "codex/website-42-social-analytics-ingestion-20260831",
  NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5",
  NEXT_PUBLIC_SANITY_DATASET: "uat",
  CCPUN_SOCIAL_DATABASE_URL: "postgresql://ccpun_social_runtime:secret@ep-mute-frost-aztvz394-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb",
};
const authorized = { providerWriteAllowed: true as const };
const approvedMedia = (assetId: string, order: number, mimeType: "image/jpeg" | "video/mp4") => ({
  source: "ccpun-approved-drive-binary" as const,
  assetId,
  driveFileId: assetId,
  approvedRevision: "rev-1",
  approvedVersion: 1,
  fileName: `${assetId}.${mimeType === "video/mp4" ? "mp4" : "jpg"}`,
  byteSize: 1,
  checksumSha256: "a".repeat(64),
  body: new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array([1])); controller.close(); } }),
  mimeType,
  order,
});

test("Final Meta write boundary rejects a caller-constructible authorization when the exact UAT write gate is off", async () => {
  let called = false;
  await assert.rejects(publishFacebookPagePost(
    { message: "Must stay off", authorization: authorized },
    { ...env, CCPUN_SOCIAL_PROVIDER_WRITES_ENABLED: "0" },
    async () => { called = true; return new Response(); },
  ), /META_PROVIDER_WRITES_DISABLED/);
  await assert.rejects(createInstagramReelContainer({
    instagramUserId: "ig-1",
    videoUrl: "https://trusted-media.example/reel.mp4",
    audio: { audioId: "audio-1" },
    authorization: authorized,
  }, { ...env, VERCEL_GIT_COMMIT_REF: "main" }, async () => { called = true; return new Response(); }), /META_PROVIDER_WRITES_DISABLED/);
  assert.equal(called, false);
});

test("Facebook publishing uses bearer auth and native schedule fields without token URLs", async () => {
  const requests: Array<{ url: string; authorization: string; body: URLSearchParams }> = [];
  let postCount = 0;
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    requests.push({
      url,
      authorization: new Headers(init?.headers).get("authorization") ?? "",
      body: new URLSearchParams(typeof init?.body === "string" ? init.body : ""),
    });
    if (url.includes("/me/accounts")) return new Response(JSON.stringify({ data: [
      { id: "page-1", access_token: "page-secret" },
    ] }));
    postCount += 1;
    return new Response(JSON.stringify({ id: `post-${postCount}` }));
  };
  const published = await publishFacebookPagePost({ pageId: "page-1", message: "Publish", authorization: authorized }, env, fetcher);
  const scheduled = await scheduleFacebookPagePost({
    pageId: "page-1",
    message: "Schedule",
    scheduledAt: "2026-09-02T01:00:00.000Z",
    now: "2026-09-01T00:00:00.000Z",
    authorization: authorized,
  }, env, fetcher);

  assert.deepEqual(published, { platformObjectId: "post-1", scheduled: false });
  assert.deepEqual(scheduled, { platformObjectId: "post-2", scheduled: true, scheduledPublishTime: "1788310800" });
  assert.deepEqual(requests.map((request) => request.authorization), [
    "Bearer meta-secret", "Bearer page-secret", "Bearer meta-secret", "Bearer page-secret",
  ]);
  assert.equal(requests.every((request) => !request.url.includes("meta-secret") && !request.url.includes("page-secret")), true);
  assert.deepEqual(Object.fromEntries(requests[1]!.body), { message: "Publish", published: "true" });
  assert.deepEqual(Object.fromEntries(requests[3]!.body), {
    message: "Schedule",
    published: "false",
    scheduled_publish_time: "1788310800",
  });
});

test("Facebook comments use the selected Page token in a bearer header and never in the URL", async () => {
  const requests: Array<{ url: string; authorization: string; body: URLSearchParams }> = [];
  const result = await publishFacebookPageComment({
    pageId: "page-1",
    parentObjectId: "main-post-1",
    message: "รายละเอียดต่อจากโพสต์หลัก",
    authorization: authorized,
  }, env, async (input, init) => {
    const url = String(input);
    requests.push({
      url,
      authorization: new Headers(init?.headers).get("authorization") ?? "",
      body: new URLSearchParams(typeof init?.body === "string" ? init.body : ""),
    });
    if (url.includes("/me/accounts")) {
      return new Response(JSON.stringify({ data: [{ id: "page-1", access_token: "page-secret" }] }));
    }
    return new Response(JSON.stringify({ id: "comment-1" }));
  });
  assert.deepEqual(result, { platformCommentId: "comment-1" });
  assert.equal(requests[1]!.url.endsWith("/main-post-1/comments"), true);
  assert.equal(requests[1]!.authorization, "Bearer page-secret");
  assert.equal(requests[1]!.body.get("message"), "รายละเอียดต่อจากโพสต์หลัก");
  assert.equal(requests.every((request) => !request.url.includes("secret")), true);
});

test("Facebook native scheduling rejects times outside Meta's 10-minute to 75-day window", async () => {
  let called = false;
  const fetcher = async () => {
    called = true;
    return new Response(JSON.stringify({ id: "unexpected" }));
  };
  const base = { pageId: "page-1", message: "Schedule", now: "2026-09-01T00:00:00.000Z", authorization: authorized };
  await assert.rejects(scheduleFacebookPagePost({ ...base, scheduledAt: "2026-09-01T00:09:59.000Z" }, env, fetcher));
  await assert.rejects(scheduleFacebookPagePost({ ...base, scheduledAt: "2026-11-15T00:00:01.000Z" }, env, fetcher));
  assert.equal(called, false);
});

test("Facebook publishing fails closed when Meta does not return the selected Page access token", async () => {
  let calls = 0;
  await assert.rejects(publishFacebookPagePost(
    { pageId: "page-1", message: "No Page token", authorization: authorized },
    env,
    async () => {
      calls += 1;
      return new Response(JSON.stringify({ data: [{ id: "page-1" }] }));
    },
  ), /META_PAGE_ACCESS_TOKEN_REQUIRED/);
  assert.equal(calls, 1);
});

test("Facebook publishing auto-selects only one managed Page and requires an explicit selection for multiple Pages", async () => {
  let calls = 0;
  await assert.rejects(publishFacebookPagePost(
    { message: "Ambiguous Page", authorization: authorized },
    env,
    async () => {
      calls += 1;
      return new Response(JSON.stringify({ data: [
        { id: "page-1", access_token: "page-secret-1" },
        { id: "page-2", access_token: "page-secret-2" },
      ] }));
    },
  ), /META_PAGE_SELECTION_REQUIRED/);
  assert.equal(calls, 1);
});

test("Facebook adapter retains link, binary image, ordered album, binary video and Reel request contracts", async () => {
  const requests: Array<{ url: string; authorization: string; body: URLSearchParams; fileSize: string; contentType: string; redirect: RequestRedirect | undefined }> = [];
  let photo = 0;
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const body = new URLSearchParams(typeof init?.body === "string" ? init.body : "");
    requests.push({
      url,
      authorization: new Headers(init?.headers).get("authorization") ?? "",
      fileSize: new Headers(init?.headers).get("file_size") ?? "",
      contentType: new Headers(init?.headers).get("content-type") ?? "",
      redirect: init?.redirect,
      body,
    });
    if (url.includes("/me/accounts")) return new Response(JSON.stringify({ data: [{ id: "page-1", access_token: "page-secret" }] }));
    if (url.endsWith("/photos")) return new Response(JSON.stringify({ id: `photo-${++photo}` }));
    if (url.endsWith("/feed")) return new Response(JSON.stringify({ id: "feed-1" }));
    if (url.endsWith("/videos")) return new Response(JSON.stringify({ id: "video-1" }));
    if (url === "https://rupload.facebook.com/upload-1") return new Response(null, { status: 200 });
    if (url.endsWith("/video_reels") && body.get("upload_phase") === "start") {
      return new Response(JSON.stringify({ video_id: "reel-1", upload_url: "https://rupload.facebook.com/upload-1" }));
    }
    if (url.endsWith("/video_reels") && body.get("upload_phase") === "finish") return new Response(JSON.stringify({ success: true }));
    throw new Error(`unexpected mock URL ${url}`);
  };
  const base = { pageId: "page-1", now: "2026-09-01T00:00:00.000Z", authorization: authorized };
  await publishFacebookPageContent({ ...base, scheduledAt: "2026-09-02T00:00:00.000Z",
    content: { format: "link-post", message: "Read", linkUrl: "https://ccpun.com/read" } }, env, fetcher);
  await publishFacebookPageContent({ ...base, scheduledAt: "2026-09-02T00:00:00.000Z",
    content: { format: "image-post", message: "Image", media: approvedMedia("image-1", 1, "image/jpeg") } }, env, fetcher);
  await publishFacebookPageContent({ ...base, scheduledAt: "2026-09-02T00:00:00.000Z",
    content: { format: "album", message: "Album", media: [
      approvedMedia("image-2", 1, "image/jpeg"), approvedMedia("image-3", 2, "image/jpeg"),
    ] } }, env, fetcher);
  await publishFacebookPageContent({ ...base, scheduledAt: "2026-09-02T00:00:00.000Z",
    content: { format: "video", message: "Video", media: approvedMedia("video-1", 1, "video/mp4") } }, env, fetcher);
  await publishFacebookPageContent({ ...base, scheduledAt: "2026-09-02T00:00:00.000Z",
    content: { format: "reel", message: "Reel", media: approvedMedia("reel-1", 1, "video/mp4") } }, env, fetcher);

  const writeBodies = requests.filter((request) => !request.url.includes("/me/accounts"));
  assert.equal(writeBodies.some((request) => request.body.get("link") === "https://ccpun.com/read"), true);
  assert.equal(writeBodies.some((request) => request.url.endsWith("/photos") && request.contentType.startsWith("multipart/form-data; boundary=")), true);
  assert.equal(writeBodies.some((request) => request.body.get("attached_media[0]") === JSON.stringify({ media_fbid: "photo-2" })
    && request.body.get("attached_media[1]") === JSON.stringify({ media_fbid: "photo-3" })), true);
  assert.equal(writeBodies.some((request) => request.url.endsWith("/videos") && request.contentType.startsWith("multipart/form-data; boundary=")), true);
  assert.equal(writeBodies.some((request) => request.url === "https://rupload.facebook.com/upload-1"
    && request.fileSize === "1" && request.authorization === "OAuth page-secret"), true);
  assert.equal(writeBodies.some((request) => request.body.get("video_state") === "SCHEDULED"
    && request.body.get("scheduled_publish_time") === "1788307200"), true);
  assert.equal(requests.every((request) => !request.url.includes("secret")), true);
  assert.equal(requests.every((request) => request.redirect === "error"), true);
});

test("Album and Reel failures after a provider mutation starts require manual reconciliation", async () => {
  let albumPhoto = 0;
  await assert.rejects(publishFacebookPageContent({
    pageId: "page-1",
    now: "2026-09-01T00:00:00.000Z",
    authorization: authorized,
    content: { format: "album", media: [
      approvedMedia("image-1", 1, "image/jpeg"), approvedMedia("image-2", 2, "image/jpeg"),
    ] },
  }, env, async (input) => {
    const url = String(input);
    if (url.includes("/me/accounts")) return new Response(JSON.stringify({ data: [{ id: "page-1", access_token: "page-secret" }] }));
    if (url.endsWith("/photos") && ++albumPhoto === 1) return new Response(JSON.stringify({ id: "photo-1" }));
    return new Response(null, { status: 429 });
  }), /META_API_PARTIAL_MUTATION_RECONCILIATION_REQUIRED/);

  await assert.rejects(publishFacebookPageContent({
    pageId: "page-1",
    now: "2026-09-01T00:00:00.000Z",
    authorization: authorized,
    content: { format: "reel", media: approvedMedia("reel-1", 1, "video/mp4") },
  }, env, async (input) => {
    const url = String(input);
    if (url.includes("/me/accounts")) return new Response(JSON.stringify({ data: [{ id: "page-1", access_token: "page-secret" }] }));
    throw new DOMException("provider timeout", "TimeoutError");
  }), /META_API_PARTIAL_MUTATION_RECONCILIATION_REQUIRED/);
});

test("Instagram Reel creation validates audio volumes then publishes the returned container", async () => {
  const requests: Array<{ url: string; authorization: string; body: URLSearchParams }> = [];
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: String(input),
      authorization: new Headers(init?.headers).get("authorization") ?? "",
      body: new URLSearchParams(String(init?.body)),
    });
    return new Response(JSON.stringify({ id: requests.length === 1 ? "container-1" : "reel-1" }));
  };
  await assert.rejects(createInstagramReelContainer({
    instagramUserId: "ig-1",
    videoUrl: "https://cdn.example.com/reel.mp4",
    audio: { audioId: "audio-1", audioVolume: 101, videoVolume: 50 },
    authorization: authorized,
  }, env, fetcher));
  assert.equal(requests.length, 0);

  const container = await createInstagramReelContainer({
    instagramUserId: "ig-1",
    videoUrl: "https://cdn.example.com/reel.mp4",
    caption: "CCPun Reel",
    audio: { audioId: "audio-1", audioVolume: 80, videoVolume: 50 },
    authorization: authorized,
  }, env, fetcher);
  const published = await publishInstagramMedia({
    instagramUserId: "ig-1",
    creationId: container.creationId,
    authorization: authorized,
  }, env, fetcher);
  assert.deepEqual(published, { platformObjectId: "reel-1" });
  assert.equal(requests.every((request) => request.authorization === "Bearer meta-secret" && !request.url.includes("meta-secret")), true);
  assert.equal(requests[0]!.body.get("media_type"), "REELS");
  assert.deepEqual(JSON.parse(requests[0]!.body.get("audio_configuration") ?? ""), {
    audio_id: "audio-1",
    audio_volume: 80,
    video_volume: 50,
  });
  assert.equal(requests[1]!.body.get("creation_id"), "container-1");
});

test("Instagram audio discovery/search/read returns validated metadata without credentials in URLs", async () => {
  const requests: Array<{ url: string; authorization: string }> = [];
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, authorization: new Headers(init?.headers).get("authorization") ?? "" });
    if (url.includes("/me/accounts")) return new Response(JSON.stringify({ data: [
      { id: "page-1", instagram_business_account: { id: "ig-1" } },
    ] }));
    if (url.includes("/ig_audio?")) return new Response(JSON.stringify({ audio: [{
      audio_id: "audio-1",
      audio_type: "music",
      title: "Safe song",
      duration_in_ms: 12_345,
      display_artist: "Artist",
      download_url: "https://cdn.example.com/preview.mp3",
      is_ads_eligible: true,
    }] }));
    return new Response(JSON.stringify({
      audio_id: "audio-1",
      audio_type: "music",
      title: "Safe song",
      duration_in_ms: 12_345,
    }));
  };
  const identity = await discoverInstagramPublishingUser(env, fetcher);
  const audio = await searchInstagramAudio({ instagramUserId: identity.instagramUserId, audioType: "music", searchQuery: "safe" }, env, fetcher);
  const metadata = await readInstagramAudio({ instagramUserId: identity.instagramUserId, audioId: audio[0]!.audio_id }, env, fetcher);
  assert.deepEqual(identity, { pageId: "page-1", instagramUserId: "ig-1" });
  assert.equal(metadata.title, "Safe song");
  assert.equal(requests.every((request) => request.authorization === "Bearer meta-secret" && !request.url.includes("meta-secret")), true);
  assert.match(requests[1]!.url, /audio_type=music/);
  assert.match(requests[1]!.url, /user_id=ig-1/);
  assert.match(requests[1]!.url, /search_query=safe/);
});

test("Meta publishing requires attested scopes and logs only safe provider diagnostics", async () => {
  let called = false;
  await assert.rejects(publishFacebookPagePost(
    { pageId: "page-1", message: "No scope", authorization: authorized },
    { ...env, CCPUN_META_GRANTED_SCOPES: "pages_show_list,pages_read_engagement" },
    async () => {
      called = true;
      return new Response();
    },
  ), /META_API_SCOPE_REQUIRED/);
  assert.equal(called, false);

  const original = console.error;
  const logs: unknown[][] = [];
  console.error = (...values) => logs.push(values);
  try {
    await assert.rejects(searchInstagramAudio(
      { instagramUserId: "ig-1", audioType: "music", searchQuery: "safe" },
      env,
      async () => new Response(JSON.stringify({ error: {
        type: "OAuthException", code: 190, error_subcode: 463, message: "secret provider body",
      } }), { status: 401 }),
    ), /META_API_AUTH_REQUIRED/);
  } finally {
    console.error = original;
  }
  assert.deepEqual(logs, [["[meta-publishing]", {
    endpoint: "/v26.0/ig_audio",
    status: 401,
    graphType: "OAuthException",
    graphCode: 190,
    graphSubcode: 463,
  }]]);
  assert.equal(JSON.stringify(logs).includes("meta-secret"), false);
  assert.equal(JSON.stringify(logs).includes("secret provider body"), false);
});

test("Instagram audio route is human-only, same-origin and gated to the exact UAT provider lane", () => {
  const route = read("app/api/admin/social/providers/meta/audio/route.ts");
  assert.match(route, /identity\.actorType !== "human"/);
  assert.match(route, /hasAdminPermission\(identity\.role, "social:read"\)/);
  assert.match(route, /isSameOriginAdminMutation\(request\.url, request\.headers\.get\("origin"\)\)/);
  assert.match(route, /getSocialProviderReadiness\("meta"\)/);
  assert.match(route, /!readiness\.laneReady/);
  assert.match(route, /export async function POST\(request: Request\)/);
  assert.doesNotMatch(route, /export async function (?:PUT|PATCH|DELETE)/);
});

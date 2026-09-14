import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  normalizeInstagramAudioOptions,
  normalizeInstagramHandoffDriveMetadata,
} from "../../features/admin/social/instagram-mobile-handoff";

const checksum = "a".repeat(64);
const reference = {
  assetId: "approved_drive_file_123",
  role: "primary" as const,
  order: 1,
  mimeType: "video/mp4",
  widthPx: null,
  heightPx: null,
  durationMs: null,
  sha256Checksum: checksum,
};

test("Instagram handoff binds a mobile download to the exact approved Drive asset", () => {
  assert.deepEqual(normalizeInstagramHandoffDriveMetadata(reference, {
    id: reference.assetId,
    name: "approved-reel.mp4",
    mimeType: "video/mp4",
    size: "4000",
    sha256Checksum: checksum,
  }), {
    assetId: reference.assetId,
    name: "approved-reel.mp4",
    mimeType: "video/mp4",
    sizeBytes: 4000,
    sha256Checksum: checksum,
    order: 1,
  });
  assert.throws(() => normalizeInstagramHandoffDriveMetadata(reference, {
    id: reference.assetId,
    name: "changed-reel.mp4",
    mimeType: "video/mp4",
    size: "4000",
    sha256Checksum: "b".repeat(64),
  }), /drive-approved-media-mismatch/);
});

test("Instagram audio discovery returns safe reference metadata only", () => {
  assert.deepEqual(normalizeInstagramAudioOptions({ audio: [{
    audio_id: "audio-1",
    audio_type: "music",
    title: "Safe song",
    display_artist: "Artist",
    duration_in_ms: 12_000,
    on_platform_audio_preview_link: "https://www.instagram.com/reels/audio/1/",
    download_url: "https://cdn.example.com/audio.mp3",
  }] }), [{
    audioId: "audio-1",
    audioType: "music",
    title: "Safe song",
    artist: "Artist",
    durationMs: 12_000,
    previewUrl: "https://www.instagram.com/reels/audio/1/",
  }]);
  assert.equal(normalizeInstagramAudioOptions({ audio: [{
    audio_id: "audio-2",
    audio_type: "music",
    title: "Unsafe preview",
    duration_in_ms: 1,
    on_platform_audio_preview_link: "javascript:alert(1)",
  }] })[0]?.previewUrl, null);
});

test("mobile handoff route is read-only, human-only, same-origin and never puts Drive tokens in URLs", () => {
  const route = readFileSync(new URL("../../app/api/admin/social/providers/meta/handoff/route.ts", import.meta.url), "utf8");
  assert.match(route, /identity\.actorType !== "human"/);
  assert.match(route, /hasAdminPermission\(identity\.role, "social:read"\)/);
  assert.match(route, /isSameOriginAdminMutation\(request\.url, request\.headers\.get\("origin"\)\)/);
  assert.match(route, /fetchGoogleDriveSelectedFileBinary/);
  assert.match(route, /listApprovedSocialVariants/);
  assert.match(route, /variant\.publication\?\.status !== "awaiting-native-finish"/);
  assert.match(route, /approvedMedia\.sha256Checksum !== expected\.data\.expectedSha256Checksum/);
  assert.match(route, /Content-Disposition/);
  assert.doesNotMatch(route, /export async function (?:GET|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(route, /access_token|media_publish|pages\/feed|POST[^]*graph\.facebook/);
});

test("mobile UI states the Instagram and music handoff limitations accurately", () => {
  const component = readFileSync(new URL("../../features/admin/social/InstagramMobileHandoff.tsx", import.meta.url), "utf8");
  assert.match(component, /ไม่สร้าง Instagram Native Draft/);
  assert.match(component, /ยังไม่เปิด Direct schedule/);
  assert.match(component, /ต้องเลือกเพลงอีกครั้งในแอปก่อนโพสต์/);
  assert.match(component, /เปิดหรือดาวน์โหลดสื่อที่อนุมัติแล้ว/);
  assert.match(component, /ต้องอนุมัติ revision นี้ก่อน/);
});

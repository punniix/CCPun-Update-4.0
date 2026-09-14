import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  FACEBOOK_AUTHORING_FORMATS,
  buildSocialMediaReferences,
  normalizeFacebookFormat,
  parseGoogleDriveMediaMetadata,
  parseGoogleDrivePickerDocuments,
  validateFacebookMedia,
  validateInstagramMedia,
  type VerifiedGoogleDriveFile,
} from "../../features/admin/social/social-workspace-media";

const checksum = "a".repeat(64);
const image = (index: number): VerifiedGoogleDriveFile => ({
  assetId: `drive_file_image_${String(index).padStart(3, "0")}`,
  name: `image-${index}.jpg`,
  mimeType: "image/jpeg",
  sizeBytes: 1_024 + index,
  widthPx: 1_080,
  heightPx: 1_350,
  durationMs: null,
  sha256Checksum: checksum,
});
const video: VerifiedGoogleDriveFile = {
  assetId: "drive_file_video_001",
  name: "video.mp4",
  mimeType: "video/mp4",
  sizeBytes: 2_048,
  widthPx: 1_080,
  heightPx: 1_920,
  durationMs: 30_000,
  sha256Checksum: "b".repeat(64),
};

test("Facebook workspace exposes exactly the six accepted authoring formats and normalizes legacy aliases", () => {
  assert.deepEqual(FACEBOOK_AUTHORING_FORMATS, ["text-post", "link-post", "image-post", "album", "video", "reel"]);
  assert.equal(normalizeFacebookFormat("photo-post"), "image-post");
  assert.equal(normalizeFacebookFormat("single-image"), "image-post");
  assert.equal(normalizeFacebookFormat("carousel"), "album");
  assert.equal(normalizeFacebookFormat("multi-image"), "album");
  assert.equal(normalizeFacebookFormat("facebook-reel"), "reel");
  assert.equal(normalizeFacebookFormat("live"), null);
});

test("format media contracts require exact counts, order, MIME and approved SHA-256 metadata", () => {
  assert.equal(validateFacebookMedia("text-post", []).ok, true);
  assert.equal(validateFacebookMedia("link-post", []).ok, true);
  assert.equal(validateFacebookMedia("text-post", buildSocialMediaReferences("image-post", [image(1)])).ok, false);

  const single = buildSocialMediaReferences("image-post", [image(1)]);
  assert.equal(validateFacebookMedia("image-post", single).ok, true);
  assert.equal(validateFacebookMedia("image-post", []).ok, false);
  assert.equal(validateFacebookMedia("image-post", [{ ...single[0]!, sha256Checksum: null }]).ok, false);

  const two = buildSocialMediaReferences("album", [image(1), image(2)]);
  const ten = buildSocialMediaReferences("album", Array.from({ length: 10 }, (_, index) => image(index + 1)));
  assert.equal(validateFacebookMedia("album", two).ok, true);
  assert.equal(validateFacebookMedia("carousel", ten).ok, true);
  assert.equal(validateFacebookMedia("album", buildSocialMediaReferences("album", [image(1)])).ok, false);
  assert.equal(validateFacebookMedia("album", [...ten, { ...ten[9]!, assetId: "drive_file_image_011", order: 11 }]).ok, false);
  assert.equal(validateFacebookMedia("album", two.map((item) => ({ ...item, order: 1 }))).ok, false);

  assert.equal(validateFacebookMedia("video", buildSocialMediaReferences("video", [video])).ok, true);
  assert.equal(validateFacebookMedia("reel", buildSocialMediaReferences("reel", [video])).ok, true);
  assert.equal(validateFacebookMedia("reel", buildSocialMediaReferences("reel", [{ ...video, widthPx: null }])).reason, "reel-metadata-unavailable");
  assert.equal(validateFacebookMedia("reel", buildSocialMediaReferences("reel", [{ ...video, widthPx: 1_920, heightPx: 1_080 }])).reason, "reel-vertical-required");
  assert.equal(validateFacebookMedia("video", single).ok, false);

  assert.equal(validateInstagramMedia("image-post", single).ok, true);
  assert.equal(validateInstagramMedia("album", two).ok, true);
  assert.equal(validateInstagramMedia("reel", buildSocialMediaReferences("reel", [video])).ok, true);
  assert.equal(validateInstagramMedia("video", buildSocialMediaReferences("video", [video])).ok, false);
});

test("Drive REST metadata binds dimensions and duration to the exact verified file", () => {
  assert.deepEqual(parseGoogleDriveMediaMetadata({
    id: video.assetId,
    mimeType: video.mimeType,
    size: String(video.sizeBytes),
    sha256Checksum: video.sha256Checksum,
    videoMediaMetadata: { width: 1_080, height: 1_920, durationMillis: "30000" },
  }, video), { widthPx: 1_080, heightPx: 1_920, durationMs: 30_000 });
  assert.equal(parseGoogleDriveMediaMetadata({
    id: video.assetId,
    mimeType: video.mimeType,
    size: String(video.sizeBytes + 1),
    sha256Checksum: video.sha256Checksum,
  }, video), null);
});

test("Picker selection fails closed when size is absent and client never persists or logs tokens", () => {
  assert.equal(parseGoogleDrivePickerDocuments([{
    id: "drive_file_image_001", name: "approved.jpg", mimeType: "image/jpeg", sizeBytes: "1024",
  }]).ok, true);
  assert.deepEqual(parseGoogleDrivePickerDocuments([{
    id: "drive_file_image_001", name: "approved.jpg", mimeType: "image/jpeg",
  }]), { ok: false, reason: "size-unavailable" });

  const client = readFileSync(new URL("../../features/admin/social/social-workspace-client.ts", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../../features/admin/social/SocialPostsWorkspace.tsx", import.meta.url), "utf8");
  const publishingStore = readFileSync(new URL("../../lib/admin/social/publishing-store.ts", import.meta.url), "utf8");
  assert.match(client, /initTokenClient/);
  assert.match(client, /MULTISELECT_ENABLED/);
  assert.match(client, /setAppId\(input\.appId\.trim\(\)\)/);
  assert.match(workspace, /NEXT_PUBLIC_CCPUN_GOOGLE_DRIVE_APP_ID/);
  assert.match(workspace, /validateInstagramMedia/);
  assert.match(client, /\/api\/admin\/media/);
  assert.match(workspace, /\/api\/admin\/social\/publications\/execute/);
  assert.match(workspace, /expectedSha256: file!\.sha256Checksum/);
  assert.match(workspace, /useRef<GoogleDriveMemorySession \| null>/);
  assert.match(publishingStore, /mediaAssetIds: variant\.mediaBindings\.map\(\(media\) => media\.assetId\)/);
  assert.doesNotMatch(publishingStore, /mediaAssetIds: \[\]/);
  assert.match(publishingStore, /jobVersion: publication\.job_version/);
  for (const source of [client, workspace]) {
    assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie|console\./);
  }
});

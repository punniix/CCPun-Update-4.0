import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { LINE_RICH_MENU_V2 } from "../../line/ecosystem";

const EXPECTED_SHA256 = "90a9f83019873af466c410a36ed61c9445e7f3ec736483673b5bbff6c8e63f40";
const ASSET_PART_URLS = Array.from({ length: 7 }, (_, index) =>
  new URL(`./assets/ccpun-line-rich-menu-v2.b64.part${index}`, import.meta.url),
);
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function pngDimension(buffer: Buffer, offset: number) {
  if (buffer.length < offset + 4) return null;
  return buffer.readUInt32BE(offset);
}

export async function loadLineRichMenuV2Asset() {
  const encoded = (await Promise.all(ASSET_PART_URLS.map((part) => readFile(part, "utf8")))).join("");
  const bytes = Buffer.from(encoded.trim(), "base64");
  if (bytes.length <= 0 || bytes.length > LINE_RICH_MENU_V2.image.maxBytes) {
    throw new Error("LINE_RICH_MENU_ASSET_SIZE_INVALID");
  }
  if (!bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error("LINE_RICH_MENU_ASSET_FORMAT_INVALID");
  }
  const width = pngDimension(bytes, 16);
  const height = pngDimension(bytes, 20);
  if (width !== LINE_RICH_MENU_V2.image.width || height !== LINE_RICH_MENU_V2.image.height) {
    throw new Error("LINE_RICH_MENU_ASSET_DIMENSIONS_INVALID");
  }
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== EXPECTED_SHA256) {
    throw new Error("LINE_RICH_MENU_ASSET_DIGEST_INVALID");
  }

  return {
    blob: new Blob([bytes], { type: LINE_RICH_MENU_V2.image.format }),
    sha256: digest,
    byteSize: bytes.length,
    width,
    height,
  };
}

export const LINE_RICH_MENU_V2_ASSET_SHA256 = EXPECTED_SHA256;

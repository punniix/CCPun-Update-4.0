import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { LINE_RICH_MENU_V1 } from "../../line/ecosystem";

const EXPECTED_SHA256 = "4d8c51ff24ed0a619147a846d9d22872c67dd61c7f756c2c671393cd9b52b5a8";
const ASSET_URL = new URL("./assets/ccpun-line-rich-menu-v1.png", import.meta.url);
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function pngDimension(buffer: Buffer, offset: number) {
  if (buffer.length < offset + 4) return null;
  return buffer.readUInt32BE(offset);
}

export async function loadLineRichMenuV1Asset() {
  const bytes = await readFile(ASSET_URL);
  if (bytes.length <= 0 || bytes.length > LINE_RICH_MENU_V1.image.maxBytes) {
    throw new Error("LINE_RICH_MENU_ASSET_SIZE_INVALID");
  }
  if (!bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error("LINE_RICH_MENU_ASSET_FORMAT_INVALID");
  }
  const width = pngDimension(bytes, 16);
  const height = pngDimension(bytes, 20);
  if (width !== LINE_RICH_MENU_V1.image.width || height !== LINE_RICH_MENU_V1.image.height) {
    throw new Error("LINE_RICH_MENU_ASSET_DIMENSIONS_INVALID");
  }
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== EXPECTED_SHA256) {
    throw new Error("LINE_RICH_MENU_ASSET_DIGEST_INVALID");
  }

  return {
    blob: new Blob([bytes], { type: LINE_RICH_MENU_V1.image.format }),
    sha256: digest,
    byteSize: bytes.length,
    width,
    height,
  };
}

export const LINE_RICH_MENU_V1_ASSET_SHA256 = EXPECTED_SHA256;

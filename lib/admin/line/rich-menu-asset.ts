import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

import { LINE_RICH_MENU_V2 } from "../../line/ecosystem";

const SOURCE_V1_SHA256 = "4d8c51ff24ed0a619147a846d9d22872c67dd61c7f756c2c671393cd9b52b5a8";
const SOURCE_V1_URL = new URL("./assets/ccpun-line-rich-menu-v1.png", import.meta.url);
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const LABELS = [
  { x: 0, y: 0, w: 833, label: "เรื่องน่ารู้", fontSize: 84, fill: "#352727" },
  { x: 833, y: 0, w: 833, label: "ลองเช็ก", fontSize: 94, fill: "#302222" },
  { x: 1666, y: 0, w: 834, label: "ประกันชีวิต", fontSize: 84, fill: "#352727" },
  { x: 0, y: 843, w: 833, label: "เรื่องลงทุน", fontSize: 84, fill: "#302222" },
  { x: 833, y: 843, w: 833, label: "ประกันรถ", fontSize: 92, fill: "#352727" },
  { x: 1666, y: 843, w: 834, label: "คุยกับปั้น", fontSize: 84, fill: "#302222" },
] as const;

function pngDimension(buffer: Buffer, offset: number) {
  if (buffer.length < offset + 4) return null;
  return buffer.readUInt32BE(offset);
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function labelOverlaySvg() {
  const body = LABELS.map((cell) => {
    const cx = cell.x + cell.w / 2;
    return `<g>
      <rect x="${cell.x + 20}" y="${cell.y + 540}" width="${cell.w - 40}" height="225" fill="${cell.fill}"/>
      <text x="${cx}" y="${cell.y + 650}" text-anchor="middle" fill="#faf9f9"
        font-size="${cell.fontSize}" font-weight="600"
        font-family="Kanit, Noto Sans Thai, Thonburi, Arial, sans-serif">${escapeXml(cell.label)}</text>
      <circle cx="${cx}" cy="${cell.y + 730}" r="7" fill="#e0c985"/>
    </g>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="2500" height="1686" viewBox="0 0 2500 1686">${body}</svg>`;
}

export async function loadLineRichMenuV2Asset() {
  const source = await readFile(SOURCE_V1_URL);
  const sourceDigest = createHash("sha256").update(source).digest("hex");
  if (sourceDigest !== SOURCE_V1_SHA256) {
    throw new Error("LINE_RICH_MENU_SOURCE_ASSET_DIGEST_INVALID");
  }

  const bytes = await sharp(source)
    .composite([{ input: Buffer.from(labelOverlaySvg()) }])
    .png({ compressionLevel: 9, palette: true, colours: 64 })
    .toBuffer();

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
  return {
    blob: new Blob([bytes], { type: LINE_RICH_MENU_V2.image.format }),
    sha256: digest,
    byteSize: bytes.length,
    width,
    height,
  };
}

export const LINE_RICH_MENU_V2_SOURCE_SHA256 = SOURCE_V1_SHA256;

import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

import { LINE_RICH_MENU_V2, LINE_RICH_MENU_V3 } from "../../line/ecosystem";

const SOURCE_V1_SHA256 = "4d8c51ff24ed0a619147a846d9d22872c67dd61c7f756c2c671393cd9b52b5a8";
const SOURCE_V1_URL = new URL("./assets/ccpun-line-rich-menu-v1.png", import.meta.url);
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const V2_LABELS = [
  { x: 0, y: 0, w: 833, label: "เรื่องน่ารู้", fontSize: 84, fill: "#352727" },
  { x: 833, y: 0, w: 833, label: "ลองเช็ก", fontSize: 94, fill: "#302222" },
  { x: 1666, y: 0, w: 834, label: "ประกันชีวิต", fontSize: 84, fill: "#352727" },
  { x: 0, y: 843, w: 833, label: "เรื่องลงทุน", fontSize: 84, fill: "#302222" },
  { x: 833, y: 843, w: 833, label: "ประกันรถ", fontSize: 92, fill: "#352727" },
  { x: 1666, y: 843, w: 834, label: "คุยกับปั้น", fontSize: 84, fill: "#302222" },
] as const;

const V3_CELLS = [
  { x: 0, y: 0, w: 1250, h: 843, label: "ประกันชีวิต", icon: "shield", fill: "#352727" },
  { x: 1250, y: 0, w: 1250, h: 843, label: "ประกันรถ", icon: "car", fill: "#302222" },
  { x: 0, y: 843, w: 1250, h: 843, label: "เรื่องลงทุน", icon: "chart", fill: "#302222" },
  { x: 1250, y: 843, w: 1250, h: 843, label: "คุยกับปั้น", icon: "chat", fill: "#352727" },
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

function v2LabelOverlaySvg() {
  const body = V2_LABELS.map((cell) => {
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

function v3Icon(type: string, cx: number, cy: number) {
  const stroke = "#E0C985";
  const sw = 18;
  if (type === "shield") {
    return `<g fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">
      <path d="M${cx} ${cy-120} l110 40 v85 q0 110-110 170 q-110-60-110-170 v-85 z"/>
      <path d="M${cx-45} ${cy+5} l35 35 70-80"/>
    </g>`;
  }
  if (type === "car") {
    return `<g fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">
      <path d="M${cx-140} ${cy+40} v-35 l32-78 q12-35 52-35 h112 q40 0 52 35 l32 78 v35"/>
      <path d="M${cx-140} ${cy+40} h280 v68 h-34"/>
      <circle cx="${cx-78}" cy="${cy+70}" r="29"/><circle cx="${cx+78}" cy="${cy+70}" r="29"/>
      <path d="M${cx-96} ${cy-48} h192"/>
    </g>`;
  }
  if (type === "chart") {
    return `<g fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">
      <path d="M${cx-135} ${cy+105} v-220 M${cx-135} ${cy+105} h270"/>
      <path d="M${cx-95} ${cy+52} l72-76 60 38 92-124"/>
      <path d="M${cx+84} ${cy-110} h45 v45"/>
    </g>`;
  }
  return `<g fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M${cx-135} ${cy-90} h175 q58 0 58 58 v62 q0 58-58 58 h-55 l-62 58 14-58 h-92 q-58 0-58-58 v-62 q0-58 58-58 z"/>
    <path d="M${cx+35} ${cy+28} h82 q58 0 58 58 v38 q0 58-58 58 h-28 l38 48-76-48 h-38"/>
  </g>`;
}

function v3Svg() {
  const cells = V3_CELLS.map((cell) => {
    const cx = cell.x + cell.w / 2;
    const cy = cell.y + 320;
    return `<g>
      <rect x="${cell.x + 10}" y="${cell.y + 10}" width="${cell.w - 20}" height="${cell.h - 20}" rx="38"
        fill="${cell.fill}" stroke="#5B4848" stroke-width="4"/>
      <text x="${cell.x + 58}" y="${cell.y + 84}" fill="#E0C985" font-size="36" font-weight="700"
        font-family="Kanit, Noto Sans Thai, Thonburi, Arial, sans-serif">CCPun</text>
      ${v3Icon(cell.icon, cx, cy)}
      <text x="${cx}" y="${cell.y + 662}" text-anchor="middle" fill="#FAF9F9" font-size="104" font-weight="600"
        font-family="Kanit, Noto Sans Thai, Thonburi, Arial, sans-serif">${escapeXml(cell.label)}</text>
      <circle cx="${cx}" cy="${cell.y + 748}" r="7" fill="#E0C985"/>
    </g>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="2500" height="1686" viewBox="0 0 2500 1686">
    <rect width="2500" height="1686" fill="#251818"/>
    ${cells}
  </svg>`;
}

async function validateRichMenuAsset(bytes: Buffer, expected: typeof LINE_RICH_MENU_V2 | typeof LINE_RICH_MENU_V3) {
  if (bytes.length <= 0 || bytes.length > expected.image.maxBytes) {
    throw new Error("LINE_RICH_MENU_ASSET_SIZE_INVALID");
  }
  if (!bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error("LINE_RICH_MENU_ASSET_FORMAT_INVALID");
  }
  const width = pngDimension(bytes, 16);
  const height = pngDimension(bytes, 20);
  if (width !== expected.image.width || height !== expected.image.height) {
    throw new Error("LINE_RICH_MENU_ASSET_DIMENSIONS_INVALID");
  }
  return {
    blob: new Blob([Uint8Array.from(bytes)], { type: expected.image.format }),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    byteSize: bytes.length,
    width,
    height,
  };
}

export async function loadLineRichMenuV2Asset() {
  const source = await readFile(SOURCE_V1_URL);
  const sourceDigest = createHash("sha256").update(source).digest("hex");
  if (sourceDigest !== SOURCE_V1_SHA256) {
    throw new Error("LINE_RICH_MENU_SOURCE_ASSET_DIGEST_INVALID");
  }

  const bytes = await sharp(source)
    .composite([{ input: Buffer.from(v2LabelOverlaySvg()) }])
    .png({ compressionLevel: 9, palette: true, colours: 64 })
    .toBuffer();

  return validateRichMenuAsset(bytes, LINE_RICH_MENU_V2);
}

export async function loadLineRichMenuV3Asset() {
  const bytes = await sharp(Buffer.from(v3Svg()))
    .png({ compressionLevel: 9, palette: true, colours: 64 })
    .toBuffer();
  return validateRichMenuAsset(bytes, LINE_RICH_MENU_V3);
}

export const LINE_RICH_MENU_V2_SOURCE_SHA256 = SOURCE_V1_SHA256;

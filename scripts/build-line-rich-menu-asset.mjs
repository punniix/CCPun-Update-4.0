import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const WIDTH = 2500;
const HEIGHT = 1686;
const ROW = 843;
const cells = [
  { x: 0, y: 0, w: 833, h: ROW, label: "หาเรื่องอ่าน", icon: "book" },
  { x: 833, y: 0, w: 833, h: ROW, label: "เครื่องมือ", icon: "tools" },
  { x: 1666, y: 0, w: 834, h: ROW, label: "ประกัน", icon: "shield" },
  { x: 0, y: ROW, w: 833, h: ROW, label: "ลงทุน", icon: "chart" },
  { x: 833, y: ROW, w: 833, h: ROW, label: "รถ", icon: "car" },
  { x: 1666, y: ROW, w: 834, h: ROW, label: "คุยกับปัน", icon: "chat" },
];

function esc(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function icon(type, cx, cy) {
  const stroke = "#e0c985";
  const sw = 18;
  if (type === "book") {
    return `<g fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">
      <path d="M${cx-115} ${cy-85} h85 q55 0 55 45 v150 q0-45-55-45 h-85 z"/>
      <path d="M${cx+115} ${cy-85} h-85 q-55 0-55 45 v150 q0-45 55-45 h85 z"/>
      <path d="M${cx} ${cy-40} v150"/>
    </g>`;
  }
  if (type === "tools") {
    return `<g fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round">
      <path d="M${cx-120} ${cy-75} h240"/><circle cx="${cx-45}" cy="${cy-75}" r="24" fill="#352727"/>
      <path d="M${cx-120} ${cy} h240"/><circle cx="${cx+55}" cy="${cy}" r="24" fill="#352727"/>
      <path d="M${cx-120} ${cy+75} h240"/><circle cx="${cx-10}" cy="${cy+75}" r="24" fill="#352727"/>
    </g>`;
  }
  if (type === "shield") {
    return `<g fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">
      <path d="M${cx} ${cy-120} l110 40 v85 q0 110-110 170 q-110-60-110-170 v-85 z"/>
      <path d="M${cx-45} ${cy+5} l35 35 70-80"/>
    </g>`;
  }
  if (type === "chart") {
    return `<g fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">
      <path d="M${cx-120} ${cy+105} v-210 M${cx-120} ${cy+105} h240"/>
      <path d="M${cx-85} ${cy+55} l65-70 55 35 85-115"/>
      <path d="M${cx+78} ${cy-95} h42 v42"/>
    </g>`;
  }
  if (type === "car") {
    return `<g fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">
      <path d="M${cx-130} ${cy+45} v-35 l30-75 q12-35 50-35 h100 q38 0 50 35 l30 75 v35"/>
      <path d="M${cx-130} ${cy+45} h260 v65 h-30"/>
      <path d="M${cx-100} ${cy+110} h-30 M${cx+100} ${cy+110} h30"/>
      <circle cx="${cx-75}" cy="${cy+70}" r="28"/><circle cx="${cx+75}" cy="${cy+70}" r="28"/>
      <path d="M${cx-92} ${cy-45} h184"/>
    </g>`;
  }
  return `<g fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M${cx-120} ${cy-85} h155 q55 0 55 55 v55 q0 55-55 55 h-50 l-55 55 12-55 h-82 q-55 0-55-55 v-55 q0-55 55-55 z"/>
    <path d="M${cx+25} ${cy+25} h75 q55 0 55 55 v35 q0 55-55 55 h-25 l35 45-70-45 h-35"/>
  </g>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#251818"/>
  ${cells.map((cell, index) => {
    const cx = cell.x + cell.w/2;
    const cy = cell.y + cell.h/2 - 80;
    const fill = index % 2 === 0 ? "#352727" : "#302222";
    return `<g>
      <rect x="${cell.x+8}" y="${cell.y+8}" width="${cell.w-16}" height="${cell.h-16}" rx="34" fill="${fill}" stroke="#5b4848" stroke-width="4"/>
      <text x="${cell.x+52}" y="${cell.y+76}" fill="#e0c985" font-size="34" font-weight="700" font-family="Kanit, Thonburi, Arial, sans-serif" letter-spacing="1.5">CCPun</text>
      ${icon(cell.icon, cx, cy)}
      <text x="${cx}" y="${cell.y+650}" text-anchor="middle" fill="#faf9f9" font-size="94" font-weight="600" font-family="Kanit, Thonburi, Arial, sans-serif">${esc(cell.label)}</text>
      <circle cx="${cx}" cy="${cell.y+730}" r="7" fill="#e0c985"/>
    </g>`;
  }).join("")}
</svg>`;

const outDir = path.resolve("lib/admin/line/assets");
await mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, "ccpun-line-rich-menu-v1.png");
const png = await sharp(Buffer.from(svg))
  .png({ compressionLevel: 9, palette: true, colours: 64 })
  .toBuffer();
if (png.byteLength > 1_000_000) throw new Error(`Rich Menu PNG too large: ${png.byteLength}`);
const metadata = await sharp(png).metadata();
if (metadata.width !== WIDTH || metadata.height !== HEIGHT) {
  throw new Error(`Unexpected dimensions: ${metadata.width}x${metadata.height}`);
}
await writeFile(outPath, png);
console.log(JSON.stringify({ outPath, bytes: png.byteLength, width: metadata.width, height: metadata.height }));

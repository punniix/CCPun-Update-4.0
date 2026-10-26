import qrcode from "qrcode-generator";

export type QrMatrix = { size: number; modules: boolean[][] };

/** Loaded only after a desktop topic selection; the pinned MIT encoder performs no network calls. */
export function encodeQr(text: string, ecc: 0 | 1 | 2 | 3 = 0): QrMatrix {
  const qr = qrcode(0, (["L", "M", "Q", "H"] as const)[ecc]);
  // Byte mode receives UTF-8 bytes, including when the caller supplies literal Thai rather than a URL.
  qr.addData(Array.from(new TextEncoder().encode(text), byte => String.fromCharCode(byte)).join(""), "Byte");
  qr.make();
  const size = qr.getModuleCount();
  return { size, modules: Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => qr.isDark(y, x))) };
}

/** One SVG path, including the standard four-module quiet zone. */
export function qrSvgPath({ size, modules }: QrMatrix, quiet = 4): { viewBox: string; path: string } {
  let path = "";
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (modules[y][x]) path += `M${x + quiet} ${y + quiet}h1v1h-1z`;
  const extent = size + quiet * 2;
  return { viewBox: `0 0 ${extent} ${extent}`, path };
}

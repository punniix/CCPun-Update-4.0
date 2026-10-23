// Per-text font size chosen in Sanity. A value travels with its text inside the
// existing copy string map, after a private-use separator, so every page that
// already receives copy also receives its size without new plumbing.
//
// Order of precedence: advanced px (per breakpoint) > size preset > page CSS.

export const COPY_STYLE_SEPARATOR = "";

export const COPY_SIZE_PRESETS = {
  xs: { title: "เล็กมาก", mobile: 12, desktop: 12 },
  sm: { title: "เล็ก", mobile: 14, desktop: 14 },
  md: { title: "ปกติ", mobile: 16, desktop: 17 },
  lg: { title: "ใหญ่", mobile: 18, desktop: 20 },
  xl: { title: "ใหญ่มาก", mobile: 22, desktop: 26 },
  "2xl": { title: "หัวข้อ", mobile: 26, desktop: 34 },
  "3xl": { title: "หัวข้อใหญ่", mobile: 32, desktop: 44 },
  "4xl": { title: "หัวข้อใหญ่พิเศษ", mobile: 38, desktop: 56 },
} as const;
export type CopySizePreset = keyof typeof COPY_SIZE_PRESETS;

// Bounds keep advanced sizes readable on a 320px phone and stop accidental 0/999.
export const COPY_SIZE_LIMITS = { mobile: { min: 10, max: 72 }, desktop: { min: 10, max: 120 } } as const;

export type CopyStyle = { size?: CopySizePreset; mobilePx?: number; desktopPx?: number };
export type CopyEntryStyleFields = { size?: unknown; sizeMobile?: unknown; sizeDesktop?: unknown };

const isPreset = (value: unknown): value is CopySizePreset => typeof value === "string" && Object.hasOwn(COPY_SIZE_PRESETS, value);
const inRange = (value: unknown, limits: { min: number; max: number }) => typeof value === "number" && Number.isFinite(value) && value >= limits.min && value <= limits.max;

/** Validates Sanity entry fields. Returns null when the entry keeps page CSS. Throws on invalid input. */
export function copyStyleFromEntry(entry: CopyEntryStyleFields): CopyStyle | null {
  const style: CopyStyle = {};
  if (entry.size !== undefined && entry.size !== null && entry.size !== "") {
    if (!isPreset(entry.size)) throw new Error("PUBLIC_COPY_SIZE_INVALID");
    style.size = entry.size;
  }
  for (const [field, target, limits] of [["sizeMobile", "mobilePx", COPY_SIZE_LIMITS.mobile], ["sizeDesktop", "desktopPx", COPY_SIZE_LIMITS.desktop]] as const) {
    const value = entry[field];
    if (value === undefined || value === null) continue;
    if (!inRange(value, limits)) throw new Error("PUBLIC_COPY_SIZE_INVALID");
    style[target] = Math.round(value as number);
  }
  return Object.keys(style).length ? style : null;
}

export function encodeCopyValue(text: string, style: CopyStyle | null) {
  if (!style) return text;
  const parts = [style.size ? `s=${style.size}` : "", style.mobilePx ? `m=${style.mobilePx}` : "", style.desktopPx ? `d=${style.desktopPx}` : ""].filter(Boolean);
  return `${text}${COPY_STYLE_SEPARATOR}${parts.join(";")}`;
}

export function splitCopyValue(value: string): { text: string; style: CopyStyle | null } {
  const index = value.indexOf(COPY_STYLE_SEPARATOR);
  if (index === -1) return { text: value, style: null };
  const style: CopyStyle = {};
  for (const part of value.slice(index + 1).split(";")) {
    const [name, raw] = part.split("=");
    if (name === "s" && isPreset(raw)) style.size = raw;
    if (name === "m" && inRange(Number(raw), COPY_SIZE_LIMITS.mobile)) style.mobilePx = Number(raw);
    if (name === "d" && inRange(Number(raw), COPY_SIZE_LIMITS.desktop)) style.desktopPx = Number(raw);
  }
  return { text: value.slice(0, index), style: Object.keys(style).length ? style : null };
}

/** Resolved px per breakpoint, or null when the text keeps page CSS. */
export function resolveCopySize(style: CopyStyle | null): { mobile: number; desktop: number } | null {
  if (!style) return null;
  const preset = style.size ? COPY_SIZE_PRESETS[style.size] : null;
  const mobile = style.mobilePx ?? preset?.mobile ?? style.desktopPx;
  const desktop = style.desktopPx ?? preset?.desktop ?? style.mobilePx;
  return mobile && desktop ? { mobile, desktop } : null;
}

import { createElement, type ReactNode } from "react";
import { resolveCopySize, splitCopyValue } from "./public-copy-style";

/**
 * `text(key)` returns plain text for attributes, ARIA, metadata and logic.
 * `text.node(key)` is for visible JSX children: it applies the size an editor
 * chose in Sanity, and returns the same plain string when no size is set.
 */
export type CopyText<K extends string = string> = ((key: K) => string) & { node: (key: K) => ReactNode };

// Draft preview appends zero-width edit markers (Sanity Visual Editing stega) so
// a click on visible text opens its field. Plain text must never carry them.
const EDIT_MARKERS = /[\u200B-\u200D\u2060-\u2064\uFEFF\u{1D173}-\u{1D17A}]{4,}/gu;
export function cleanCopyText(value: string) { return value.replace(EDIT_MARKERS, ""); }

// Inline so no stylesheet changes: mobile size on phones, desktop size from
// 1280px, scaling smoothly between. Inline style also beats rules like `.card span`.
export function fluidFontSize(mobile: number, desktop: number) {
  if (mobile === desktop) return `${mobile}px`;
  const [min, max] = mobile < desktop ? [mobile, desktop] : [desktop, mobile];
  return `clamp(${min}px, calc(${mobile}px + ${desktop - mobile} * ((100vw - 375px) / 905)), ${max}px)`;
}

export function createCopyText<K extends string>(lookup: (key: K) => string): CopyText<K> {
  const text = ((key: K) => cleanCopyText(splitCopyValue(lookup(key)).text)) as CopyText<K>;
  text.node = (key: K) => {
    const { text: value, style } = splitCopyValue(lookup(key));
    const size = resolveCopySize(style);
    return size ? createElement("span", { "data-cms-copy": key, style: { fontSize: fluidFontSize(size.mobile, size.desktop), lineHeight: size.desktop >= 24 ? 1.3 : 1.5 } }, value) : value;
  };
  return text;
}

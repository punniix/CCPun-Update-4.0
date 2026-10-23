import { createElement, type ReactNode } from "react";
import { copySizeVariables, splitCopyValue } from "./public-copy-style";

/**
 * `text(key)` returns plain text for attributes, ARIA, metadata and logic.
 * `text.node(key)` is for visible JSX children: it applies the size an editor
 * chose in Sanity, and returns the same plain string when no size is set.
 */
export type CopyText<K extends string = string> = ((key: K) => string) & { node: (key: K) => ReactNode };

// Draft preview appends invisible edit markers (Sanity Visual Editing stega) so
// a click on visible text opens its field. Plain text must never carry them.
const EDIT_MARKERS = /[\u200B-\u200D\u2060-\u2064\uFEFF\u{1D173}-\u{1D17A}]{4,}/gu;
export function cleanCopyText(value: string) { return value.replace(EDIT_MARKERS, ""); }

export function createCopyText<K extends string>(lookup: (key: K) => string): CopyText<K> {
  const text = ((key: K) => cleanCopyText(splitCopyValue(lookup(key)).text)) as CopyText<K>;
  text.node = (key: K) => {
    const { text: value, style } = splitCopyValue(lookup(key));
    const variables = copySizeVariables(style);
    return variables ? createElement("span", { className: "cms-copy-size", style: variables, "data-cms-copy": key }, value) : value;
  };
  return text;
}

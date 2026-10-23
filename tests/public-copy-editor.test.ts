import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidElement, type ReactElement } from "react";
import { COPY_STYLE_SEPARATOR, copyStyleFromEntry, encodeCopyValue, resolveCopySize, splitCopyValue } from "../lib/content/public-copy-style";
import { cleanCopyText, createCopyText, fluidFontSize } from "../lib/content/public-copy-text";
import { PUBLIC_COPY_SCOPES, parsePublicCopy, publicCopyDocumentId, publicCopyInitialEntries, publicCopyText } from "../lib/content/public-copy-registry";
import locations from "../lib/content/public-copy-locations.json";

test("unset size keeps page CSS: plain string, no wrapper", () => {
  const text = createCopyText<string>(() => "สวัสดี");
  assert.equal(text("x"), "สวัสดี");
  assert.equal(text.node("x"), "สวัสดี");
});

test("preset and advanced px resolve per breakpoint with px overriding preset", () => {
  assert.deepEqual(resolveCopySize({ size: "xl" }), { mobile: 22, desktop: 26 });
  assert.deepEqual(resolveCopySize({ size: "xl", desktopPx: 40 }), { mobile: 22, desktop: 40 });
  assert.deepEqual(resolveCopySize({ mobilePx: 18 }), { mobile: 18, desktop: 18 });
  assert.equal(resolveCopySize(null), null);
});

test("sized text renders a span for visible children and plain text everywhere else", () => {
  const value = encodeCopyValue("หัวข้อ", { size: "2xl", mobilePx: 30 });
  assert.ok(value.includes(COPY_STYLE_SEPARATOR));
  const text = createCopyText<string>(() => value);
  assert.equal(text("k"), "หัวข้อ");
  const node = text.node("k") as ReactElement<{ "data-cms-copy": string; style: { fontSize: string; lineHeight: number }; children: string }>;
  assert.ok(isValidElement(node));
  assert.equal(node.props["data-cms-copy"], "k");
  assert.equal(node.props.style.fontSize, "clamp(30px, calc(30px + 4 * ((100vw - 375px) / 905)), 34px)");
  assert.equal(node.props.style.lineHeight, 1.3);
  assert.equal(node.props.children, "หัวข้อ");
  assert.equal(fluidFontSize(16, 16), "16px");
  assert.equal(fluidFontSize(40, 20), "clamp(20px, calc(40px + -20 * ((100vw - 375px) / 905)), 40px)");
  assert.deepEqual(splitCopyValue(value), { text: "หัวข้อ", style: { size: "2xl", mobilePx: 30 } });
});

test("size input is validated; out-of-range or unknown values are refused", () => {
  assert.equal(copyStyleFromEntry({}), null);
  assert.equal(copyStyleFromEntry({ size: "", sizeMobile: null }), null);
  assert.deepEqual(copyStyleFromEntry({ size: "lg", sizeDesktop: 24.4 }), { size: "lg", desktopPx: 24 });
  assert.throws(() => copyStyleFromEntry({ size: "huge" }), /PUBLIC_COPY_SIZE_INVALID/);
  assert.throws(() => copyStyleFromEntry({ sizeMobile: 9 }), /PUBLIC_COPY_SIZE_INVALID/);
  assert.throws(() => copyStyleFromEntry({ sizeDesktop: 121 }), /PUBLIC_COPY_SIZE_INVALID/);
  assert.throws(() => copyStyleFromEntry({ sizeMobile: "20" }), /PUBLIC_COPY_SIZE_INVALID/);
});

test("parsePublicCopy carries sizes, keeps original wording, and refuses the style separator in text", () => {
  const entries = publicCopyInitialEntries("privacy").map(entry => entry.key === "privacy.h1" ? { ...entry, size: "3xl" } : entry);
  const doc = { _id: publicCopyDocumentId("privacy"), _type: "publicPageCopy", scope: "privacy", locale: "th", entries };
  const values = parsePublicCopy("privacy", doc) as Record<string, string>;
  const text = publicCopyText(values);
  assert.equal(text("privacy.h1"), PUBLIC_COPY_SCOPES.privacy.defaults["privacy.h1"]);
  assert.ok(isValidElement(text.node("privacy.h1")));
  assert.equal(text.node("privacy.h2"), PUBLIC_COPY_SCOPES.privacy.defaults["privacy.h2"]);
  const bad = { ...doc, entries: [{ ...entries[0], text: `x${COPY_STYLE_SEPARATOR}s=xl` }] };
  assert.throws(() => parsePublicCopy("privacy", bad), /PUBLIC_COPY_ENTRY_INVALID/);
  const badSize = { ...doc, entries: [{ ...entries[0], size: "giant" }] };
  assert.throws(() => parsePublicCopy("privacy", badSize), /PUBLIC_COPY_SIZE_INVALID/);
});

test("draft edit markers never leak into plain text", () => {
  const marker = "​​​​‌‍﻿​";
  const text = createCopyText<string>(() => `ข้อความ${marker}`);
  assert.equal(text("k"), "ข้อความ");
  assert.equal(cleanCopyText(`a${marker}`), "a");
  assert.equal(text.node("k"), `ข้อความ${marker}`);
});

test("every editable key has a page location and sections are listed in order", () => {
  const map = locations as Record<string, { sections: string[]; entries: Record<string, { section: string; kind: string; visible: boolean; order: number }> }>;
  for (const [scope, config] of Object.entries(PUBLIC_COPY_SCOPES)) {
    const scoped = map[scope];
    assert.ok(scoped, `${scope}: locations exist`);
    assert.deepEqual(Object.keys(scoped.entries).sort(), Object.keys(config.defaults).sort(), `${scope}: every key located, no stale keys`);
    for (const location of Object.values(scoped.entries)) {
      assert.ok(scoped.sections.includes(location.section));
      assert.ok(location.kind.length > 0);
    }
  }
});

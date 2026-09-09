import assert from "node:assert/strict";
import test from "node:test";
import { createElement, act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { createRequire } from "node:module";
const { JSDOM } = createRequire(import.meta.url)("jsdom");
import MigratedImagePreview, { MigratedImageBlockPreview, resolveMigratedImagePreviewUrl } from "../../cms/sanity/components/MigratedImagePreview";
import { migratedImage } from "../../cms/sanity/schema/objects/migrated-image";

test("migrated card media resolves public assets independently of Admin origin", () => {
  assert.equal(resolveMigratedImagePreviewUrl("/assets/blog/ภาพ.webp"), "https://ccpun.com/assets/blog/%E0%B8%A0%E0%B8%B2%E0%B8%9E.webp");
  assert.equal(resolveMigratedImagePreviewUrl("https://blog.ccpun.com/wp-content/uploads/image.jpg"), "https://blog.ccpun.com/wp-content/uploads/image.jpg");
  assert.equal(resolveMigratedImagePreviewUrl("https://cdn.sanity.io/images/kyfxgjnq/production/image.jpg"), "https://cdn.sanity.io/images/kyfxgjnq/production/image.jpg");
  for (const value of [undefined, "", "//evil.test/x", "https://evil.test/x", "http://ccpun.com/x", "javascript:alert(1)", "data:image/png;base64,x", "https://user:password@ccpun.com/x", "https://ccpun.com:8080/x"]) {
    assert.equal(resolveMigratedImagePreviewUrl(value), null, String(value));
  }
  const preview = migratedImage.preview!.prepare!({ alt: "ภาพจริง", caption: undefined, src: "/assets/blog/test.webp" });
  const html = renderToStaticMarkup(preview.media as ReturnType<typeof createElement>);
  assert.match(html, /<img/);
  assert.match(html, /src="https:\/\/ccpun.com\/assets\/blog\/test.webp"/);
  assert.match(html, /alt="ภาพจริง"/);
});

test("unavailable images fall back gracefully and a different source can load", async () => {
  const dom = new JSDOM('<div id="root"></div>');
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const container = dom.window.document.getElementById("root")!;
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(MigratedImagePreview, { src: "/missing.jpg", alt: "ภาพ" })));
    assert.ok(container.querySelector("img"));
    await act(async () => container.querySelector("img")!.dispatchEvent(new dom.window.Event("error")));
    assert.equal(container.querySelector("img"), null);
    assert.ok(container.querySelector('[aria-label="ไม่สามารถแสดงตัวอย่างรูปภาพ"]'));
    await act(async () => root.render(createElement(MigratedImagePreview, { src: "/new.jpg" })));
    assert.ok(container.querySelector('img[src="https://ccpun.com/new.jpg"]'));
  } finally {
    await act(async () => root.unmount());
    Object.assign(globalThis, { window: previousWindow, document: previousDocument, IS_REACT_ACT_ENVIRONMENT: false });
    dom.window.close();
  }
});

test("Portable Text images are large with captions while list previews stay native", () => {
  const media = createElement(MigratedImagePreview, { src: "/assets/body.jpg", alt: "ภาพในบทความ" });
  const renderDefault = () => createElement("span", { "data-native-preview": true }, "ชื่อภาพ");
  const block = renderToStaticMarkup(createElement(MigratedImageBlockPreview, { layout: "block", media, description: "คำบรรยายภาพ", renderDefault }));
  assert.equal((block.match(/<img/g) || []).length, 1);
  assert.match(block, /max-height:320px/);
  assert.match(block, /width:100%;height:auto/);
  assert.match(block, /คำบรรยายภาพ/);
  assert.match(block, /data-native-preview/);
  const list = renderToStaticMarkup(createElement(MigratedImageBlockPreview, { layout: "default", media, renderDefault }));
  assert.doesNotMatch(list, /<img|max-height/);
  assert.match(list, /data-native-preview/);
});

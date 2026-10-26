import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import jsQR from "jsqr";
import { encodeQr, qrSvgPath } from "../../components/layout/v5/qr-code";
import { LINE_CHAT_DEFAULTS, resolveChatPanel } from "../../lib/line/chat-panel";

const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom");
const React = require("react");
const { createRoot } = require("react-dom/client");
const { loadFixtureModule } = require("../../qa/phase1-fixture-loader.mjs");
const { websiteV5CopyPredecessor } = require("../../qa/website-v5-phase-a-proof.mjs");

test("C3 dependency admission accepts only the exact encoder/decoder additions and preserves unrelated drift", () => {
  const source = readFileSync(new URL("../../package.json", import.meta.url), "utf8");
  const restored = websiteV5CopyPredecessor("package.json", source);
  assert.notEqual(restored, source);
  assert.doesNotMatch(restored, /"(?:qrcode-generator|jsqr)"/);
  for (const [before, after] of [['"qrcode-generator": "2.0.4"', '"qrcode-generator": "2.0.5"'], ['"jsqr": "1.4.0"', '"jsqr": "1.4.1"']]) {
    const changed = source.replace(before, after);
    assert.notEqual(changed, source);
    assert.equal(websiteV5CopyPredecessor("package.json", changed), changed, "unreviewed versions cannot reach the frozen predecessor");
  }
  const unrelated = source.replace('"private": true', '"private": false');
  assert.match(websiteV5CopyPredecessor("package.json", unrelated), /"private": false/, "the admission never erases unrelated changes");
  const lock = readFileSync(new URL("../../package-lock.json", import.meta.url), "utf8");
  const predecessor = websiteV5CopyPredecessor("package-lock.json", lock);
  assert.notEqual(predecessor, lock);
  assert.doesNotMatch(predecessor, /"(?:node_modules\/)?(?:qrcode-generator|jsqr)"/);
  const tampered = lock.replace('"license": "Apache-2.0"\n    },\n    "node_modules/jsx-ast-utils"', '"license": "MIT"\n    },\n    "node_modules/jsx-ast-utils"');
  assert.notEqual(tampered, lock);
  assert.equal(websiteV5CopyPredecessor("package-lock.json", tampered), tampered, "unreviewed decoder metadata is not admitted");
  for (const file of ["package.json", "package-lock.json"]) {
    const original = file === "package.json" ? source : lock;
    for (const [name, from, to] of [["jsqr", "devDependencies", "dependencies"], ["qrcode-generator", "dependencies", "devDependencies"]]) {
      const moved = JSON.parse(original);
      const owner = file === "package.json" ? moved : moved.packages[""];
      owner[to][name] = owner[from][name];
      delete owner[from][name];
      const changed = JSON.stringify(moved, null, 2) + "\n";
      assert.equal(websiteV5CopyPredecessor(file, changed), changed, `${file}: moving ${name} out of its approved section is rejected`);
    }
  }
});

function decoded(text: string) {
  const matrix = encodeQr(text);
  const size = (matrix.size + 8) * 5;
  const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < matrix.size; y++) for (let x = 0; x < matrix.size; x++) if (matrix.modules[y][x]) {
    for (let dy = 0; dy < 5; dy++) for (let dx = 0; dx < 5; dx++) {
      const offset = (((y + 4) * 5 + dy) * size + (x + 4) * 5 + dx) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 0;
    }
  }
  return jsQR(pixels, size, size)?.data;
}

test("pinned local encoder round-trips exact topic URLs and UTF-8 with a four-module quiet zone", () => {
  const panel = resolveChatPanel({ pageGroup: "home", config: LINE_CHAT_DEFAULTS, now: new Date("2026-10-26"), consentGiven: false });
  assert.equal(panel.mode, "panel");
  if (panel.mode !== "panel") return;
  for (const topic of panel.topics) assert.equal(decoded(topic.href), topic.href);
  assert.equal(decoded("สวัสดีครับ มีเรื่องอยากถาม"), "สวัสดีครับ มีเรื่องอยากถาม");
  const qr = encodeQr(panel.topics[0].href);
  assert.equal(qrSvgPath(qr).viewBox, `0 0 ${qr.size + 8} ${qr.size + 8}`);
  assert.throws(() => encodeQr("a".repeat(4000)), "an oversized QR fails, rather than silently truncating the destination");
});

test("desktop success has QR only; generation failure alone offers its exact HTTPS fallback; mobile keeps its link", async () => {
  for (const device of ["desktop", "desktop-failure", "coarse", "mobile-ua", "ipad"] as const) {
    const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/" });
    const previous = new Map(["window", "document", "navigator", "IS_REACT_ACT_ENVIRONMENT"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    Object.defineProperty(dom.window.navigator, "userAgent", { value: device === "mobile-ua" ? "Mozilla/5.0 iPhone Mobile" : "Mozilla/5.0 Desktop" });
    Object.defineProperty(dom.window.navigator, "platform", { value: device === "ipad" ? "MacIntel" : "MacIntel" });
    Object.defineProperty(dom.window.navigator, "maxTouchPoints", { value: device === "ipad" ? 5 : 0 });
    dom.window.matchMedia = (query: string) => ({ matches: query.includes("coarse") ? device === "coarse" : device !== "coarse" });
    for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
    const events: string[] = [];
    let closed = 0;
    const mocks = new Map<string, unknown>([
      ["./V5ChatDock.module.css", { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }],
      ["@/lib/analytics", { trackEvent: (name: string) => events.push(name) }],
      ["@/lib/acquisition", { getAttribution: () => undefined }],
      ["@/lib/cookie-consent", { getConsentData: () => null }],
    ]);
    if (device === "desktop-failure") mocks.set("./qr-code", { encodeQr: () => { throw new Error("injected-encoder-failure"); }, qrSvgPath });
    const Panel = loadFixtureModule("components/layout/v5/V5ChatPanel.tsx", { mocks }).default;
    const root = createRoot(dom.window.document.getElementById("root"));
    try {
      await React.act(async () => root.render(React.createElement(Panel, { config: LINE_CHAT_DEFAULTS, context: { pageGroup: "home" }, trigger: "dock", onClose: () => { closed++; } })));
      const topic = dom.window.document.querySelector("[data-chat-topic]");
      const href = topic.getAttribute("href");
      const click = new dom.window.MouseEvent("click", { bubbles: true, cancelable: true });
      await React.act(async () => { topic.dispatchEvent(click); });
      if (device === "desktop" || device === "desktop-failure") {
        assert.equal(click.defaultPrevented, true);
        assert.equal(events.filter(name => name === "line_oa_click").length, 0);
        assert.equal(dom.window.document.querySelector("[data-chat-desktop-open]"), null, "the PC-open action is removed");
        assert.doesNotMatch(dom.window.document.body.textContent, /เปิด LINE บนคอมพิวเตอร์|ลิงก์นี้เปิดหน้า LINE ในเบราว์เซอร์|และลิงก์ LINE/);
        assert.equal(dom.window.document.querySelector("#v5-chat-note").textContent, "เลือกหัวข้อเพื่อแสดง QR");
        const fallback = dom.window.document.querySelector("[data-chat-qr-fallback]");
        const image = dom.window.document.querySelector('svg[role="img"]');
        if (device === "desktop-failure") {
          assert.equal(image, null, "generation failure never displays a stale QR");
          assert.equal(fallback.getAttribute("href"), href);
          assert.equal(fallback.getAttribute("target"), "_blank");
          assert.match(fallback.closest('[role="status"]').textContent, /แสดง QR ไม่สำเร็จ/);
          fallback.focus();
          assert.equal(dom.window.document.activeElement, fallback);
          await React.act(async () => { fallback.addEventListener("click", (event: Event) => event.preventDefault()); fallback.click(); });
          assert.equal(events.filter(name => name === "line_oa_click").length, 1);
        } else {
          assert.equal(fallback, null, "successful desktop QR never offers an open link");
          assert.ok(image.getAttribute("aria-label").includes(topic.textContent));
          assert.equal(image.parentElement.textContent.trim(), "สแกนด้วยมือถือเพื่อส่งข้อความนี้ทาง LINE");
        }
      } else {
        assert.equal(click.defaultPrevented, false, device);
        assert.equal(dom.window.document.querySelector("[data-chat-desktop-open],[data-chat-qr-fallback]"), null, device);
        assert.equal(events.filter(name => name === "line_oa_click").length, 1, device);
        await new Promise(resolve => setTimeout(resolve, 5));
        assert.equal(closed, 1, device);
      }
      dom.window.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      assert.ok(closed > 0);
    } finally {
      await React.act(async () => root.unmount());
      dom.window.close();
      for (const [key, descriptor] of previous) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  }
});

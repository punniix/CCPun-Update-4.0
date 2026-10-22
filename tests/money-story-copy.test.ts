import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicCopyProvider, usePublicCopy } from "../components/ui/PublicCopyProvider";
import { MONEY_STORY_COPY_DEFAULTS, moneyStoryLabel } from "../lib/content/money-story-copy-defaults";
import { parsePublicCopy, publicCopyDocumentId, publicCopyInitialEntries, PUBLIC_COPY_SCOPES, type PublicCopyScope } from "../lib/content/public-copy-registry";
import { createGame } from "../features/money-story/engine";

function PreviewName() {
  const text = usePublicCopy(MONEY_STORY_COPY_DEFAULTS);
  return createElement("p", null, moneyStoryLabel("แก้ม", text));
}

test("nested scoped CMS copy renders character label without mutating game or shared shell", () => {
  const key = Object.keys(MONEY_STORY_COPY_DEFAULTS).find(key => MONEY_STORY_COPY_DEFAULTS[key as keyof typeof MONEY_STORY_COPY_DEFAULTS] === "แก้ม")!;
  const game = createGame("copy-contract", "gam");
  const before = JSON.stringify(game);
  const html = renderToStaticMarkup(createElement(PublicCopyProvider, { values: { "site.nav.home": "หน้าแรกจาก UAT" } }, createElement(PublicCopyProvider, { values: { [key]: "ตัวละคร UAT" } }, createElement(PreviewName))));
  assert.equal(html, "<p>ตัวละคร UAT</p>");
  assert.equal(JSON.stringify(game), before);
  assert.equal(moneyStoryLabel("unknown-id", key => MONEY_STORY_COPY_DEFAULTS[key]), "unknown-id");
});

test("every shipped scope can seed validated stable singleton entries without HTML or duplicate keys", () => {
  for (const scope of Object.keys(PUBLIC_COPY_SCOPES) as PublicCopyScope[]) {
    const entries = publicCopyInitialEntries(scope);
    assert.equal(new Set(entries.map(entry => entry._key)).size, entries.length);
    const parsed = parsePublicCopy(scope, { _id: publicCopyDocumentId(scope), _type: "publicPageCopy", scope, locale: "th", entries });
    assert.equal(Object.keys(parsed).length, entries.length);
  }
});

test("CMS editors cannot remove or invent numerical interpolation placeholders", () => {
  for (const scope of Object.keys(PUBLIC_COPY_SCOPES) as PublicCopyScope[]) {
    const entry = publicCopyInitialEntries(scope).find(entry => /\{[a-zA-Z0-9_]+\}/.test(entry.text));
    if (!entry) continue;
    const document = { _id: publicCopyDocumentId(scope), _type: "publicPageCopy", scope, locale: "th", entries: [{ ...entry, text: entry.text.replace(/\{[a-zA-Z0-9_]+\}/g, "") }] };
    assert.throws(() => parsePublicCopy(scope, document), /PLACEHOLDER/);
  }
});

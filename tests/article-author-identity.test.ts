import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import assert from "node:assert/strict";
import test from "node:test";
import { getArticleAuthorIdentity } from "../lib/content/author-identity";

test("synthetic and unknown authors cannot inherit the advisor identity, portrait or credentials", () => {
  const identity = getArticleAuthorIdentity({authorName: "ผู้เขียนทดสอบ UAT", author: {id: "uat-author", name: "ผู้เขียนทดสอบ UAT", profileRole: "ผู้เขียนทดสอบ", profileBio: "ข้อมูลจำลอง", profileAvatar: {src: "/assets/ccpun.webp", alt: "advisor", width: 96, height: 96}}});
  assert.equal(identity.canonicalAdvisor, false);
  assert.equal(identity.name, "ผู้เขียนทดสอบ UAT");
  assert.equal(identity.role, "ผู้เขียนทดสอบ");
  assert.equal(identity.bio, "ข้อมูลจำลอง");
  assert.equal(identity.avatar, undefined);
  assert.equal(identity.profileCtaUrl, undefined);
  assert.equal(getArticleAuthorIdentity({authorName: "Guest"}).name, "Guest");
});
test("only persisted canonical advisor IDs allow the legacy advisor presentation", () => {
  for (const id of ["ccpun-author-ccpun-profile", "ccpun-prod-mirror-author-ccpun"]) assert.equal(getArticleAuthorIdentity({authorName: "CCPun", author: {id, name: "CCPun"}}).canonicalAdvisor, true);
  assert.equal(getArticleAuthorIdentity({authorName: "CCPun", author: {id: "other", name: "CCPun"}}).canonicalAdvisor, false);
  assert.equal(getArticleAuthorIdentity({authorName: "Guest", author: {name: "Guest", profileCtaUrl: "javascript:alert(1)"}}).profileCtaUrl, undefined);
});

test("share destinations accept only pinned UAT or canonical Production origins", () => {
  const source = readFileSync("features/blog/website-43/ArticleShareActions.tsx", "utf8");
  const expression = source.match(/const url = ([^;]+);/)?.[1];
  assert.ok(expression);
  for (const origin of [undefined, "https://ccpun.com", "https://evil.invalid", "http://test.ccpun.com", "https://test.ccpun.com.evil.invalid", "https://test.ccpun.com"]) {
    const value = runInNewContext(expression, { origin, URL_ORIGIN: "https://ccpun.com", path: "/blog/test/" });
    assert.equal(value, (origin === "https://test.ccpun.com" ? origin : "https://ccpun.com") + "/blog/test/");
  }
});

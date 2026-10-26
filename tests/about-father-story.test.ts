import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { transformSync } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as copy from "../features/about/father-story-copy";

const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom") as { JSDOM: new (html: string) => { window: { document: Document } } };
const source = readFileSync(new URL("../features/about/page.tsx", import.meta.url), "utf8");

// Execute the complete actual page module with isolated data dependencies and the real environment flag.
// The false case is local Production-simulated SSR, never a request to Production.
async function render(review: boolean) {
  // Resolve the real deployment flag in a fresh process with no inherited credentials or data-plane IDs.
  const lane = review ? "development" : "production";
  const flag = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", 'import { IS_REVIEW_ENVIRONMENT } from "./lib/deployment-environment.ts"; process.stdout.write(JSON.stringify(IS_REVIEW_ENVIRONMENT));'], {
    cwd: new URL("../", import.meta.url), encoding: "utf8",
    env: { PATH: process.env.PATH, NODE_ENV: "test", CCPUN_APP_ENV: lane, NEXT_PUBLIC_CCPUN_APP_ENV: lane, CCPUN_DEPLOYMENT_PROVIDER: "local", CCPUN_DEPLOYMENT_ROLE: "web" },
  });
  assert.equal(flag.status, 0, flag.stderr);
  const actualReview = JSON.parse(flag.stdout) as boolean;
  assert.equal(actualReview, review, "actual deployment-environment flag");
  const pageModule = { exports: {} as { renderAboutPage: () => Promise<React.ReactNode>; metadata: { robots: unknown } } };
  const text = Object.assign(() => "existing approved copy", { node: () => "existing approved copy" });
  const css = new Proxy({}, { get: (_, key) => String(key) });
  const mockedRequire = (id: string): unknown => {
    if (id.endsWith(".css")) return { __esModule: true, default: css };
    if (id === "next/image") return { __esModule: true, default: (props: Record<string, unknown>) => React.createElement("img", props) };
    if (id === "next/link") return { __esModule: true, default: (props: Record<string, unknown>) => React.createElement("a", props) };
    if (id === "./father-story-copy") return copy;
    if (id === "@/lib/deployment-environment") return { IS_REVIEW_ENVIRONMENT: actualReview };
    if (id === "@/lib/content/public-copy") return { getPublicCopy: async () => ({}) };
    if (id === "@/lib/content/public-copy-registry") return { publicCopyText: () => text };
    if (id === "@/lib/content/sanity") return { getPrimaryAuthorProfile: async () => null };
    if (id === "@/lib/seo/structured-data/entity-ids") return { CCPUN_PERSON_ID: "https://ccpun.com/#person" };
    if (id === "@/lib/seo/structured-data/site-schema") return { personSchema: { name: "CCPun", alternateName: ["CCPun"], description: "existing approved description" } };
    if (id === "@/components/layout/v5/V5Page") return { __esModule: true, default: ({ children }: { children: React.ReactNode }) => React.createElement("main", null, children) };
    if (id === "@/components/layout/v5/V5Primitives") return { V5Breadcrumbs: () => null, v5Label: (value: string) => value };
    if (id === "@/components/layout/v5/advisor-profile") return { v5AdvisorProfile: () => ({ displayName: "CCPun", role: "advisor", qualification: null, licenceCards: [] }), v5Partners: () => [] };
    if (id === "@/components/layout/v5/V5CredentialCards") return { __esModule: true, default: () => null };
    if (id === "@/components/layout/v5/constants") return { V5_TOOLS_HUB: { href: "/tools/", label: "เครื่องมือทั้งหมด" } };
    if (id === "react/jsx-runtime") return require(id);
    throw new Error(`Unexpected page dependency: ${id}`);
  };
  const code = transformSync(source, { loader: "tsx", format: "cjs", jsx: "automatic" }).code;
  new Function("require", "module", "exports", code)(mockedRequire, pageModule, pageModule.exports);
  return { document: new JSDOM(renderToStaticMarkup(await pageModule.exports.renderAboutPage())).window.document, metadata: pageModule.exports.metadata };
}

test("C13: actual About UAT SSR renders exact paragraphs, questions, caption and semantic order", async () => {
  const { document, metadata } = await render(true);
  assert.deepEqual(metadata.robots, { index: false, follow: false });
  const story = document.querySelector('[data-uat-trial="about-father-story"]')!;
  assert.ok(story);
  assert.deepEqual(Array.from(story.children, (node) => node.tagName), ["H3", "P", "FIGURE", "DIV"]);
  assert.equal(story.querySelector("h3")!.textContent, copy.FATHER_STORY_HEADING);
  assert.deepEqual(Array.from(story.querySelectorAll("p"), (node) => node.textContent), [...copy.FATHER_STORY_PARAGRAPHS]);
  assert.deepEqual(Array.from(story.querySelectorAll("ul > li"), (node) => node.textContent), [...copy.FATHER_STORY_QUESTIONS]);
  assert.deepEqual(Array.from(story.querySelector(".fatherStoryBody")!.children, (node) => node.tagName), ["P", "P", "P", "P", "P", "UL", "P"]);
  const caption = story.querySelector("figcaption")!;
  assert.equal(caption.innerHTML.replace(/<br\s*\/?\s*>/g, "\n").replace(/<[^>]+>/g, ""), copy.FATHER_PHOTO_CAPTION);
  assert.equal(caption.querySelectorAll("br").length, 1);
  assert.equal(story.querySelectorAll(".keep").length, 2);
  for (const phrase of story.querySelectorAll(".keep")) assert.equal(phrase.textContent, copy.FATHER_STORY_KEEP);
  assert.equal(story.querySelector("img")!.getAttribute("src"), "/assets/ccpun-father-v5-colour.webp");
  assert.ok(story.closest("section")!.querySelector("h2"), "h3 stays below the existing h2");
});

test("C13: actual About Production-simulated SSR excludes the entire story, father photo and caption", async () => {
  const { document, metadata } = await render(false);
  assert.deepEqual(metadata.robots, { index: true, follow: true });
  assert.equal(document.querySelector('[data-uat-trial="about-father-story"]'), null);
  assert.equal(document.querySelector('[data-uat-placeholder="about-father-photo"]'), null);
  assert.equal(document.querySelector('img[src*="ccpun-father"]'), null);
  for (const value of [copy.FATHER_STORY_HEADING, ...copy.FATHER_STORY_PARAGRAPHS, ...copy.FATHER_STORY_QUESTIONS, ...copy.FATHER_PHOTO_CAPTION.split("\n")]) assert.ok(!document.body.textContent!.includes(value), value);
});

test("C13: copy retains owner-trial comment and uses the existing no-wrap mechanism", () => {
  assert.match(readFileSync(new URL("../features/about/father-story-copy.ts", import.meta.url), "utf8"), /UAT trial, pending owner final approval 2026-10-26/);
  assert.match(readFileSync(new URL("../components/layout/v5/V5LicenceFlip.module.css", import.meta.url), "utf8"), /\.keep \{ white-space: nowrap; \}/);
  assert.doesNotMatch(Object.values(copy).flat().join("\n"), /…|\.\.\.|[\u{1F300}-\u{1FAFF}]/u);
});

// Pins independently captured from the exact owner-supplied brief, including straight quotes/newlines.
test("C13: all owner-supplied characters are preserved verbatim", () => {
  const body = [...copy.FATHER_STORY_PARAGRAPHS.slice(0, 5), [copy.FATHER_STORY_PARAGRAPHS[5], ...copy.FATHER_STORY_QUESTIONS.map((question) => `- ${question}`)].join("\n"), copy.FATHER_STORY_PARAGRAPHS[6]].join("\n\n");
  assert.equal(createHash("sha256").update(body).digest("hex"), "494df1c4e06298e89f7bdd0a5b200bb8a9780566136287d26b43eb1db7dfa637");
  assert.equal(createHash("sha256").update(copy.FATHER_PHOTO_CAPTION).digest("hex"), "125485ac5aceec3c438ec245d15679bfbac008ee65c3259a7203bf2c368278e5");
  assert.equal(copy.FATHER_STORY_HEADING, "บทเรียนที่คุณพ่อสอน");
});

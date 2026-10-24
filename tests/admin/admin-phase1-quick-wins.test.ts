import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ADMIN_NAVIGATION_REDIRECTS, adminNavigationDestination, contextualNavigationItems, type AdminNavigationGroup } from "../../features/admin/components/admin-navigation-model";
import { AiReviewOutput } from "../../features/admin/operations/AiReviewOutput";
import { getStudioArticleEditHref, getStudioArticlePresentationHref } from "../../cms/sanity/policy/studio-policy";
import { N8N_ADMIN_STATUS_LABEL } from "../../lib/admin/n8n-integration-registry";
import { adminPhase1DomPredecessor, adminPhase1PredecessorDigest, adminPhase1QuickWinSources } from "../../qa/admin-phase1-quick-wins-proof.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const layoutFile = "apps/admin/app/(control-plane)/layout.tsx";
const controlPlane = "apps/admin/app/(control-plane)";

function navigationGroups(): AdminNavigationGroup[] {
  const source = read(layoutFile);
  const block = source.slice(source.indexOf("const NAV_ITEMS"), source.indexOf("];", source.indexOf("const NAV_ITEMS")));
  const groups: AdminNavigationGroup[] = [];
  for (const line of block.split("\n")) {
    const match = line.match(/\{ href: "([^"]+)", label: "([^"]+)"/);
    if (!match) continue;
    if (/^ {2}\{ href:/.test(line)) groups.push({ href: match[1], label: match[2], children: [] });
    else groups.at(-1)!.children!.push({ href: match[1], label: match[2] });
  }
  return groups;
}

test("Admin navigation shows each destination once while every old route keeps working", () => {
  const groups = navigationGroups();
  assert.ok(groups.length >= 7, "parsed the real NAV_ITEMS");
  for (const group of groups) {
    const destinations = contextualNavigationItems(group).map((item) => adminNavigationDestination(item.href));
    assert.equal(new Set(destinations).size, destinations.length, `duplicate destination in ${group.label}: ${destinations.join(", ")}`);
  }
  const content = contextualNavigationItems(groups.find((group) => group.href === "/content/")!);
  assert.ok(!content.some((item) => item.label === "ภาพรวม"), "Content overview duplicated the articles page");
  const operations = contextualNavigationItems(groups.find((group) => group.href === "/operations/")!);
  assert.ok(!operations.some((item) => item.label === "ภาพรวม"), "Operations overview duplicated system health");
  const dashboard = contextualNavigationItems(groups.find((group) => group.href === "/dashboard/")!);
  assert.equal(dashboard[0].href, "/dashboard/", "real overview pages keep their overview link");
  assert.doesNotMatch(read(layoutFile), /href: "\/seo\/audits\/"/);

  // Redirect map is the truth of the route files; old URLs are kept, not deleted.
  for (const [alias, destination] of Object.entries(ADMIN_NAVIGATION_REDIRECTS)) {
    const page = path.join(controlPlane, alias, "page.tsx");
    assert.ok(existsSync(path.join(root, page)), page);
    assert.match(read(page), new RegExp(`redirect\\("${destination.replaceAll("/", "\\/")}"\\)`), page);
  }
});

test("hidden Performance Marketing page is reachable from ผลลัพธ์ with a Thai label and its own permission", () => {
  const analytics = navigationGroups().find((group) => group.href === "/analytics/")!;
  assert.ok(analytics.children!.some((child) => child.href === "/analytics/performance/" && child.label === "บทความที่ได้ผล & สิ่งที่ควรทำ"));
  assert.match(read(layoutFile), /href: "\/analytics\/performance\/", label: "บทความที่ได้ผล & สิ่งที่ควรทำ", permission: "settings:read"/);
  assert.match(read(`${controlPlane}/analytics/performance/page.tsx`), /requireAdminPermission\("settings:read"\)/);
});

test("article title opens its detail page and the presentation edit keeps the logical document id", () => {
  assert.equal(
    getStudioArticlePresentationHref("drafts.article-1", "health-insurance", "aia-health-happy-describe"),
    "/studio/intent/edit/id=article-1;type=article;mode=presentation;presentation=presentation;preview=%2Fblog%2Fhealth-insurance%2Faia-health-happy-describe%2F",
  );
  assert.equal(getStudioArticlePresentationHref("drafts.article-1", null, "slug"), getStudioArticleEditHref("article-1"));
  assert.equal(getStudioArticlePresentationHref("article-1", "personal-finance", undefined), "/studio/intent/edit/id=article-1;type=article");
  assert.doesNotMatch(getStudioArticlePresentationHref("drafts.x", "a", "b"), /drafts\.|\/structure\/|projectId|dataset/);

  const list = read("features/admin/components/ContentArticlesPage.tsx");
  assert.match(list, /<Link href=\{`\/content\/articles\/\$\{encodeURIComponent\(documentId\)\}\/`\}[^>]*>\{article\.title \|\| "บทความยังไม่มีชื่อ"\}<\/Link>/);
  assert.match(list, /getStudioArticlePresentationHref\(article\.id, article\.categorySlug, article\.slug\)/);
  assert.match(list, /<Link href=\{presentationHref\}[^>]*>แก้พร้อมดูตัวอย่าง<\/Link>/);
  assert.match(read("cms/sanity/policy/article-editorial-status.tsx"), /mode: "presentation", presentation: "presentation", preview:/, "same intent shape as ArticleDraftPreview");
});

function sourceFiles(directory: string): string[] {
  return readdirSync(path.join(root, directory)).flatMap((entry) => {
    const relative = path.join(directory, entry);
    return statSync(path.join(root, relative)).isDirectory() ? sourceFiles(relative) : /\.tsx?$/.test(entry) ? [relative] : [];
  });
}

test("no Admin link into Studio opens a new tab", () => {
  const offenders: string[] = [];
  for (const file of [...sourceFiles("features/admin"), ...sourceFiles("apps/admin/app"), ...sourceFiles("lib/admin")]) {
    const source = read(file);
    for (const tag of source.matchAll(/<(?:Link|a)\b[\s\S]*?>/g)) {
      if (/href=(?:"\/studio|\{`\/studio|\{studio|\{getStudio|\{presentationHref)/.test(tag[0]) && /target=/.test(tag[0])) offenders.push(`${file}: ${tag[0].slice(0, 90)}`);
    }
    if (/target=\{opensStudio/.test(source)) offenders.push(`${file}: opensStudio new tab`);
  }
  assert.deepEqual(offenders, []);
  assert.doesNotMatch(read("features/admin/components/AdminProtectedChrome.tsx"), /href="\/studio\/" target=/);
  assert.match(read(layoutFile), /studioLabel="แก้เนื้อหา"/);
});

test("/studio renders inside the Admin shell for a signed-in user and stays bare for cross-site Sanity Dashboard", () => {
  const layout = read("apps/admin/app/studio/layout.tsx");
  assert.match(layout, /import ProtectedAdminLayout from "\.\.\/\(control-plane\)\/layout"/);
  assert.match(layout, /if \(!session\?\.user\?\.role\) return <>\{children\}<\/>;/);
  assert.match(layout, /return <ProtectedAdminLayout>\{children\}<\/ProtectedAdminLayout>;/);

  const chrome = read("features/admin/components/AdminProtectedChrome.tsx");
  const studioBranch = chrome.slice(chrome.indexOf("if (studioMode) {"), chrome.indexOf("return (\n    <div className=\"min-h-screen"));
  assert.match(studioBranch, /data-admin-shell="studio"/);
  assert.match(studioBranch, /<AdminNavigation items=\{navItems\} \/>/);
  assert.match(studioBranch, /\{header\}/);
  assert.match(studioBranch, /<main id="main-content"[^>]*>\s*\{children\}/);
  assert.doesNotMatch(studioBranch, /AdminDataRefresh/, "no router refresh on focus while editing in Studio");
  assert.match(chrome, /#sanity\{height:100%!important;max-height:100%!important\}/);
  assert.match(chrome, /pathname === "\/studio" \|\| Boolean\(pathname\?\.startsWith\("\/studio\/"\)\)/);

  // Studio guards are untouched: the page keeps its own lane/data-plane checks.
  const page = read("apps/admin/app/studio/[[...tool]]/page.tsx");
  assert.match(page, /if \(!IS_REVIEW_ENVIRONMENT\) notFound\(\);/);
  assert.match(page, /if \(!isStudioDataPlaneAllowed\(dataset, environment, undefined, undefined, projectId\)\) notFound\(\);/);
  assert.match(read("apps/admin/proxy.ts"), /if \(isDeployedAdmin && isStudioPage && \["GET", "HEAD", "OPTIONS"\]\.includes\(request\.method\)\) \{\n\s+return NextResponse\.next\(\);/);

  // Website preview pages stay chrome-less but are no longer a dead end.
  assert.match(chrome, /return <><PreviewBackLink \/>\{children\}<\/>;/);
  assert.match(chrome, /window\.self === window\.top/);
});

test("Studio navbar has a visible back link to Admin home without touching lane guards", () => {
  const config = read("sanity.config.ts");
  assert.match(config, /studio: \{ components: \{ navbar: StudioNavbarWithAdminBackLink \} \}/);
  assert.match(config, /isStudioConfigurationAllowed\(dataset, environment, projectId\)/);
  assert.match(config, /projectId && dataset && studioAllowed/);
  const link = read("cms/sanity/components/StudioAdminBackLink.tsx");
  assert.match(link, /href="\/"/);
  assert.match(link, /← กลับศูนย์จัดการ/);
  assert.match(link, /props\.renderDefault\(props\)/);
});

test("n8n status chips are short and never wrap", () => {
  for (const label of Object.values(N8N_ADMIN_STATUS_LABEL)) {
    assert.ok(label.length <= 12, label);
    assert.doesNotMatch(label, /Admin|Legacy/);
  }
  assert.deepEqual(Object.values(N8N_ADMIN_STATUS_LABEL), ["มีปุ่ม", "เบื้องหลัง", "ยังไม่มีปุ่ม", "ทดสอบ", "เลิกใช้"]);
  const settings = read(`${controlPlane}/settings/[section]/page.tsx`);
  assert.match(settings, /className=\{`inline-flex whitespace-nowrap rounded-full border px-2\.5 py-1 text-xs \$\{item\.status === "admin-trigger"/);
  assert.equal(settings.match(/inline-flex whitespace-nowrap rounded-full border border-(?:white\/10|amber-200\/20)/g)?.length, 5, "all five summary chips");
  assert.match(read("features/admin/components/ReadinessRows.tsx"), /inline-flex shrink-0 whitespace-nowrap rounded-full/);
  for (const file of ["features/admin/operations/LocalAiPage.tsx", "features/admin/operations/JobsPage.tsx", "features/admin/operations/DeploymentsPage.tsx"]) {
    assert.match(read(file), /inline-flex whitespace-nowrap rounded-full border px-2\.5 py-1 text-xs font-medium/, file);
  }
  // Thai copy must not be cut mid-word.
  assert.doesNotMatch(read("features/admin/operations/AgentRuntimeJobStatus.tsx"), /break-all/);
});

test("Google data copy says n8n collects it every day at 06:00 and manual refresh still works", () => {
  const settings = read(`${controlPlane}/settings/[section]/page.tsx`);
  assert.match(settings, /n8n เก็บข้อมูลให้อัตโนมัติทุกวันเวลา 06:00 น\. กดดึงข้อมูลล่าสุดเองได้/);
  assert.doesNotMatch(settings, /ดึงข้อมูลเมื่อผู้ใช้สั่ง และไม่แก้ข้อมูลต้นทาง/);
  assert.doesNotMatch(settings, /ฟรี/);
});

test("AI review output is readable first; raw JSON only in a collapsed block", () => {
  const page = read("features/admin/operations/LocalAiPage.tsx");
  assert.doesNotMatch(page, /JSON\.stringify\(review\.output/);
  assert.match(page, /<AiReviewOutput output=\{review\.output as Record<string, unknown>\} \/>/);
  const html = renderToStaticMarkup(createElement(AiReviewOutput, { output: {
    mode: "line-card-description",
    lineTitle: "ประกันสุขภาพเลือกอย่างไร",
    findings: [{ label: "คำค้นเพิ่มขึ้น", why: "มีคนค้นหามากขึ้น" }],
    reviewRequired: true,
  } }));
  const main = html.slice(0, html.indexOf("<details"));
  assert.match(main, /<dt[^>]*>หัวข้อการ์ด LINE<\/dt>/);
  assert.match(main, /คำโปรยการ์ด LINE/, "known mode values are labelled");
  assert.match(main, /<ul class="list-disc/);
  assert.match(main, />ใช่</);
  assert.doesNotMatch(main, /\{&quot;|"mode":/, "main view is not raw JSON");
  assert.match(html.slice(html.indexOf("<details")), /<summary[^>]*>ดูข้อมูลดิบ<\/summary><pre[^>]*>\{\n {2}&quot;mode&quot;/);
});

test("Thai Studio labels change titles only; persisted names and option values stay", () => {
  const seo = read("cms/sanity/schema/objects/seo-metadata.ts");
  for (const name of ["seoMetadata", "searchIntent", "semanticTopic", "canonical", "noindex"]) assert.match(seo, new RegExp(`name: "${name}"`));
  for (const value of ["informational", "commercial", "transactional", "navigational", "mixed"]) assert.match(seo, new RegExp(`value: "${value}"`));
  assert.doesNotMatch(seo, /title: "(?:Informational|Commercial|Transactional|Navigational|Mixed|SEO Control Center)"/);
  const article = read("cms/sanity/schema/documents/article.ts");
  assert.match(article, /name: "seo", title: "ศูนย์ตั้งค่า SEO"/);
  assert.match(article, /name: "geo", title: "การค้นหาด้วย AI \(GEO\)"/);
  assert.match(article, /review\?\.status === "approved"\n\s+\? true\n\s+: "ก่อนเผยแพร่ ต้องตั้งขั้นตรวจเนื้อหาเป็น “อนุมัติเนื้อหาแล้ว”"/);
  const actions = read("cms/sanity/policy/article-line-copy-action.tsx");
  assert.doesNotMatch(actions, /Publish LINE only|Improve LINE copy/);
});

test("Phase 1 frozen-proof admissions are exact and reject any further edit", () => {
  for (const [file, { before, after }] of Object.entries(adminPhase1QuickWinSources)) {
    const source = read(file);
    assert.equal(adminPhase1PredecessorDigest(file, source), before, `${file} is exactly the reviewed successor`);
    assert.notEqual(adminPhase1PredecessorDigest(file, source + "\n// unreviewed"), before, file);
    assert.notEqual(before, after);
  }
  assert.equal(adminPhase1PredecessorDigest("unknown.tsx", "x"), adminPhase1PredecessorDigest("other.tsx", "x"));
  // The DOM inverse only rebuilds the approved changes; unrelated markup is untouched.
  const unrelated = '<a href="/seo/" class="x">กลับหน้าตรวจ SEO</a><a href="https://example.invalid/" class="y">ลิงก์</a>';
  assert.equal(adminPhase1DomPredecessor(unrelated), unrelated);
  assert.equal(adminPhase1DomPredecessor('<a href="/studio/" class="z">เปิด Studio</a>'), '<a href="/studio/" target="_blank" rel="noopener noreferrer" class="z">เปิด Studio<span class="sr-only"> (เปิดแท็บใหม่)</span></a>');
});

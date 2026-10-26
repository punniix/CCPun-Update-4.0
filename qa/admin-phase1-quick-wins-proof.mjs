import { createHash } from 'node:crypto';
import { adminOps20261025DomPredecessor, adminOps20261025PredecessorDigest } from './admin-ops-20261025-proof.mjs';

// Owner-approved Admin v1 improvements (2026-10-24): de-duplicated navigation,
// Performance page in the menu, linked article titles with a same-tab
// "แก้พร้อมดูตัวอย่าง" Presentation edit, a Studio back link, Thai labels,
// non-wrapping status chips and the daily 06:00 GSC/GA4 copy. Studio embedded in
// the Admin shell is deferred to Admin v2 and is NOT part of this admission.
// This is an exact before -> after admission for each protected source the change
// touches, in the same style as the reviewed CMS successors: a file passes only if
// it is byte-identical to the reviewed result (or still the original). Every
// historical digest and golden stays frozen. No SEO URL, Sanity schema
// name/value, analytics, consent or lane guard changes.
const sha = value => createHash('sha256').update(value).digest('hex');

export const adminPhase1QuickWinSources = Object.freeze({
  // BEGIN reviewed sources
  "apps/admin/app/(control-plane)/dashboard/inbox/[leadId]/page.tsx": { before: "f5033f0fef2e1e0c55c274588d64ab1a212e7eb594e42972e6d5304b8d739c81", after: "bd85e0fd0535ec8c9e5a40e27a07dbbda3332f5e53fd9e1410c9d61a7414570e" },
  "apps/admin/app/(control-plane)/dashboard/inbox/page.tsx": { before: "738969d2561c8423d836c6d67d68b10f9fbd18c94ac23496b81434baa7ead397", after: "acfd3ca62e74eaad3ab8eafd95fe122608a268d0fb83bbf9d08f92db2ef8d477" },
  // Website v5 / LINE chat button (owner-approved 2026-10-25): Settings > ปุ่มแชท LINE joins the menu
  // next to การเชื่อมต่อ. The layout's reviewed successor digest moves; its predecessor stays frozen.
  "apps/admin/app/(control-plane)/layout.tsx": { before: "ccc3ab6d96dbeda609dfe71133980ac26aa1d61310fc5c63c5c929eab24555bf", after: "4b66fc82b05b981502dd25774bc2574113b76005d3463279023515a9c446a7af" },
  "apps/admin/app/(control-plane)/operations/privacy/page.tsx": { before: "88eb1fb34c49270d143f1cc2992609a510a4b3a5709fe3a3b024db68c00fb830", after: "c13b74fa6ec6590db3aff227a2a4e7dc54e0f2dd767df3931e4acc5f6b4ce5c5" },
  "apps/admin/app/(control-plane)/settings/[section]/page.tsx": { before: "77155b618c67fe777a4a0bfb545cbdb3808bfdbaf18701890e1b14d62a1e96dd", after: "93a2083155a2bf7ab35af6fe8c452882c5e5d4c090066ddc4070711f07fc5482" },
  "cms/sanity/policy/studio-policy.ts": { before: "037cdca400a76fe7c25a433b3ff49ef113a9416fa3de25103c0b9d10ecdc9211", after: "4cad6a03bc5befd47ef77937952f4c3ee50d7eb83cb0acc897dcc66518c45a7d" },
  "features/admin/components/AdminProtectedChrome.tsx": { before: "a6fcdc5f948e9ddea74ea09532dd932c1fd01427800d9321845d62c767331cbf", after: "b39179eaca866dcf3dd0c3ba0b077175c5cf27a0f30b4b2a1864a2d299a61335" },
  "features/admin/components/ContentArticlesPage.tsx": { before: "2e970b2f54f7cbaf103d41701b5f87ea1a36291093596b6cb8800011cbc08446", after: "3d82d3e2c6e25264377f746fc4f501032aa577bdea492d1f30dc32a455cdcd7a" },
  "features/admin/components/ReadinessRows.tsx": { before: "bdf70eea7a2ba08afa4b4b0c5b0c4695624378fca20602d26b3fa93d6ea0f4eb", after: "d25ec1079a8afea8547926918265b4d952bfa7bad937694a03022c9e94bf9e5f" },
  "sanity.config.ts": { before: "ca8fa14a21e771ffe17df1f8896497a7033cd0b095af6ed4b067da2a077b617a", after: "25dc55df26c71146de1a8fa6517ae4526dda23f6531ce54d272aa61c41a1a25f" },
  // END reviewed sources
});

// Returns the digest the frozen proofs should compare: the reviewed predecessor
// for an exact reviewed successor, otherwise the file's own digest (so any other
// edit still fails the original assertion).
export function adminPhase1PredecessorDigest(file, source) {
  // Later reviewed successors (qa/admin-ops-20261025-proof.mjs) chain back first.
  const digest = adminOps20261025PredecessorDigest(file, sha(source));
  const entry = Object.hasOwn(adminPhase1QuickWinSources, file) ? adminPhase1QuickWinSources[file] : null;
  return entry && digest === entry.after ? entry.before : digest;
}

// Exact rendered-DOM inverse used only by the frozen Phase 1 DOM-parity fixtures.
// It rebuilds the original markup from the reviewed candidate for these approved
// display changes and nothing else, so every other byte is still compared:
//  - article title links to its detail page and a same-tab "แก้พร้อมดูตัวอย่าง" button;
//  - navigation: no duplicate "ผลตรวจ" item, Performance page listed;
//  - Thai n8n/Google copy and non-wrapping status chips.
const PRESENTATION_BUTTON = /<a href="\/studio\/intent\/edit\/[^"]*" class="inline-flex min-h-11 items-center whitespace-nowrap rounded-xl bg-\[#e0c985\] px-3\.5 py-2 text-sm font-semibold text-\[#17191d\] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-\[#e0c985\]\/60">แก้พร้อมดูตัวอย่าง<\/a>/g;
const TITLE_LINK = /<a href="\/content\/articles\/[^"]*\/" class="font-medium text-white\/85 underline-offset-4 hover:text-\[#f4df9b\] hover:underline focus:outline-none focus:ring-2 focus:ring-\[#e0c985\]\/60">(.*?)<\/a>/g;
const quote = '&quot;';
const navChild = (href, label) => `{${quote}href${quote}:${quote}${href}${quote},${quote}label${quote}:${quote}${label}${quote}}`;
const GOOGLE_DAILY = 'n8n เก็บข้อมูลให้อัตโนมัติทุกวันเวลา 06:00 น. ผ่านตัวเชื่อม Google แบบอ่านอย่างเดียว ไม่แก้ข้อมูลต้นทาง และยังกดดึงข้อมูลล่าสุดเองได้';

const exactPairs = [
  // Environment chip (AdminProtectedChrome)
  ['<span class="inline-flex whitespace-nowrap rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-white/70">', '<span class="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-white/70">'],
  // Navigation items passed to AdminNavigation
  [navChild('/analytics/performance/', 'ผลการตลาด &amp; สิ่งที่ควรทำ') + ',', ''],
  // LINE chat button settings (owner-approved 2026-10-25).
  [',' + navChild('/settings/line-chat/', 'ปุ่มแชท LINE'), ''],
  [navChild('/seo/opportunities/', 'โอกาสพัฒนา'), navChild('/seo/opportunities/', 'โอกาสพัฒนา') + ',' + navChild('/seo/audits/', 'ผลตรวจ')],
  // Article list action cell
  ['<div class="flex flex-wrap items-center gap-3">', '<div class="flex flex-wrap gap-3">'],
  // Settings → การเชื่อมต่อ
  [GOOGLE_DAILY, 'ดึงข้อมูลเมื่อผู้ใช้สั่ง และไม่แก้ข้อมูลต้นทาง'],
  ['<span class="inline-flex shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ', '<span class="rounded-full border px-2.5 py-1 text-xs font-medium '],
  ['<h2 class="text-lg font-semibold">งานอัตโนมัติใน n8n</h2>', '<h2 class="text-lg font-semibold">n8n Workflow Integration</h2>'],
  ['ดูว่า Workflow ไหนมีปุ่มให้กดในศูนย์จัดการแล้ว Workflow ไหนทำงานเบื้องหลัง หรือยังไม่ได้เชื่อม รายการนี้มาจากข้อตกลงการเชื่อมต่อในระบบ ยังไม่ใช่สถานะเปิดหรือปิดล่าสุดจาก n8n', 'ดูว่า Workflow ไหนมีปุ่มให้กดใน Admin แล้ว Workflow ไหนทำงานแบบ Background หรือยังไม่ได้เชื่อม รายการนี้อ้างอิง Integration contract และยังไม่ใช่สถานะ Active/Inactive ล่าสุดจาก n8n'],
  ['<span class="inline-flex whitespace-nowrap rounded-full border border-white/10 px-2.5 py-1">มีปุ่ม ', '<span class="rounded-full border border-white/10 px-2.5 py-1">มีปุ่ม '],
  ['<span class="inline-flex whitespace-nowrap rounded-full border border-amber-200/20 bg-amber-200/5 px-2.5 py-1 text-amber-50">ยังไม่มีปุ่ม ', '<span class="rounded-full border border-amber-200/20 bg-amber-200/5 px-2.5 py-1 text-amber-50">ยังไม่มีปุ่ม '],
  ['<span class="inline-flex whitespace-nowrap rounded-full border border-white/10 px-2.5 py-1">เบื้องหลัง ', '<span class="rounded-full border border-white/10 px-2.5 py-1">Background '],
  ['<span class="inline-flex whitespace-nowrap rounded-full border border-white/10 px-2.5 py-1">ทดสอบ ', '<span class="rounded-full border border-white/10 px-2.5 py-1">Test only '],
  ['<span class="inline-flex whitespace-nowrap rounded-full border border-white/10 px-2.5 py-1">รอตัดสินใจ ', '<span class="rounded-full border border-white/10 px-2.5 py-1">Legacy '],
  ['<span class="inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs ', '<span class="rounded-full border px-2.5 py-1 text-xs '],
];

// The n8n status labels are shared by both renders (one registry), so only the
// markup around them is inverted. Labels in this list are the reviewed short ones.
export const ADMIN_PHASE1_SHORT_N8N_LABELS = Object.freeze(['มีปุ่ม', 'เบื้องหลัง', 'ยังไม่มีปุ่ม', 'ทดสอบ', 'รอตัดสินใจ']);

export function adminPhase1DomPredecessor(html) {
  if (typeof html !== 'string') return html;
  let result = adminOps20261025DomPredecessor(html).replace(PRESENTATION_BUTTON, '').replace(TITLE_LINK, '<div class="font-medium text-white/85">$1</div>');
  for (const [candidate, original] of exactPairs) result = result.split(candidate).join(original);
  return result;
}

import { createHash } from 'node:crypto';

// Owner-approved Admin Phase 1 quick wins (2026-10-24): clearer navigation,
// one-click Presentation edit, Studio inside the Admin shell, Thai labels and
// non-wrapping status chips. This is an exact before -> after admission for each
// protected source the change touches, in the same style as the reviewed CMS
// successors: a file passes only if it is byte-identical to the reviewed result
// (or still the original). Every historical digest and golden stays frozen.
// No SEO URL, Sanity schema name/value, analytics, consent or lane guard changes.
const sha = value => createHash('sha256').update(value).digest('hex');

export const adminPhase1QuickWinSources = Object.freeze({
  // BEGIN reviewed sources
  "apps/admin/app/(control-plane)/analytics/page.tsx": { before: "f01831858ee4e9f60bab614f534059ae6fd5b597c3a31de44539e4b25ca7e9eb", after: "52e06f0ac8abc8676c21115347f7bb626b07347bda2f7b250c82cc6be7e26d97" },
  "apps/admin/app/(control-plane)/dashboard/inbox/[leadId]/page.tsx": { before: "f5033f0fef2e1e0c55c274588d64ab1a212e7eb594e42972e6d5304b8d739c81", after: "bd85e0fd0535ec8c9e5a40e27a07dbbda3332f5e53fd9e1410c9d61a7414570e" },
  "apps/admin/app/(control-plane)/dashboard/inbox/page.tsx": { before: "738969d2561c8423d836c6d67d68b10f9fbd18c94ac23496b81434baa7ead397", after: "acfd3ca62e74eaad3ab8eafd95fe122608a268d0fb83bbf9d08f92db2ef8d477" },
  "apps/admin/app/(control-plane)/dashboard/page.tsx": { before: "eaa296594245505d868adf4d771f56485ba2edcaf20590f0a1da1e084de6d624", after: "8b180fe59fd33e1f1d38dc7d80911429945d3b774fee1f27a69c2d0b1fe1c82e" },
  "apps/admin/app/(control-plane)/layout.tsx": { before: "ccc3ab6d96dbeda609dfe71133980ac26aa1d61310fc5c63c5c929eab24555bf", after: "8bd8c58049805397a0e9fe55b0e68d563f60d9271a7c9de6be3259a53f4bbccf" },
  "apps/admin/app/(control-plane)/operations/privacy/page.tsx": { before: "88eb1fb34c49270d143f1cc2992609a510a4b3a5709fe3a3b024db68c00fb830", after: "c13b74fa6ec6590db3aff227a2a4e7dc54e0f2dd767df3931e4acc5f6b4ce5c5" },
  "apps/admin/app/(control-plane)/settings/[section]/page.tsx": { before: "77155b618c67fe777a4a0bfb545cbdb3808bfdbaf18701890e1b14d62a1e96dd", after: "7027034d496ede6a00c05ee7096a8935eedff6c6687ffe892fe7f1e3da3ecc47" },
  "cms/sanity/policy/studio-policy.ts": { before: "037cdca400a76fe7c25a433b3ff49ef113a9416fa3de25103c0b9d10ecdc9211", after: "4cad6a03bc5befd47ef77937952f4c3ee50d7eb83cb0acc897dcc66518c45a7d" },
  "features/admin/components/AdminProtectedChrome.tsx": { before: "a6fcdc5f948e9ddea74ea09532dd932c1fd01427800d9321845d62c767331cbf", after: "ef54c18dd8b09468bd15f85026ae2aaf20fcc3073c0f39b1c2316cf35d6af10f" },
  "features/admin/components/ArticleDetailPage.tsx": { before: "0aaa3aa0e99a4327072b82fbf7007686ff81e216938b9fb1f7b3bf79697ede4b", after: "678fba6bf91844261143aac3a7ab93f6c635a60406a4bcf0931246d793114264" },
  "features/admin/components/ContentArticlesPage.tsx": { before: "2e970b2f54f7cbaf103d41701b5f87ea1a36291093596b6cb8800011cbc08446", after: "6f3ca58e5ba213452a24228559784d65f1c6315cafcbe1034f8963a4edc59081" },
  "features/admin/components/ReadinessRows.tsx": { before: "bdf70eea7a2ba08afa4b4b0c5b0c4695624378fca20602d26b3fa93d6ea0f4eb", after: "d25ec1079a8afea8547926918265b4d952bfa7bad937694a03022c9e94bf9e5f" },
  "features/admin/components/SeoAuditDetailPage.tsx": { before: "2aa51e43e58bd9163e61322891bf1741d0e5dc738d51ea2a6d7558439060a4dd", after: "6a465b59bfa7bb020b1fc42d1dd3458fb2cac0c3a05421d9f5767dd2db7541b5" },
  "features/admin/components/SeoOverviewPage.tsx": { before: "a5e1224db4db346ba38728535d4131a472f011c628ded09568a5f31db25d9c25", after: "7d2cc0e29c50dedaedf83d9f68d670ffca11eaff3fc86cc090f4e8b74f29601f" },
  "features/admin/components/SeoReviewInboxPage.tsx": { before: "b32b2b0ae382122ec3595990298c28e0854b2777fdbed56e5aba867fa7010dc7", after: "273c80f4643872186a7120412d541f540c872259369c29fb78113f593cadbb9b" },
  "sanity.config.ts": { before: "ca8fa14a21e771ffe17df1f8896497a7033cd0b095af6ed4b067da2a077b617a", after: "25dc55df26c71146de1a8fa6517ae4526dda23f6531ce54d272aa61c41a1a25f" },
  // END reviewed sources
});

// Returns the digest the frozen proofs should compare: the reviewed predecessor
// for an exact reviewed successor, otherwise the file's own digest (so any other
// edit still fails the original assertion).
export function adminPhase1PredecessorDigest(file, source) {
  const digest = sha(source);
  const entry = Object.hasOwn(adminPhase1QuickWinSources, file) ? adminPhase1QuickWinSources[file] : null;
  return entry && digest === entry.after ? entry.before : digest;
}

// Exact rendered-DOM inverse used only by the frozen Phase 1 DOM-parity fixtures.
// It rebuilds the original markup from the reviewed candidate for these approved
// display changes and nothing else, so every other byte is still compared:
//  - Admin links into Studio open in the same tab (the Admin shell hosts Studio);
//  - article title links to its detail page and a "แก้พร้อมดูตัวอย่าง" button;
//  - navigation: no duplicate "ผลตรวจ" item, Performance page listed;
//  - Thai top-bar/n8n/Google copy and non-wrapping status chips.
const NEW_TAB_ATTRIBUTES = ' target="_blank" rel="noopener noreferrer"';
const NEW_TAB_HINT = '<span class="sr-only"> (เปิดแท็บใหม่)</span>';
const PRESENTATION_BUTTON = /<a href="\/studio\/[^"]*" class="inline-flex min-h-11 items-center whitespace-nowrap rounded-xl bg-\[#e0c985\] px-3\.5 py-2 text-sm font-semibold text-\[#17191d\] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-\[#e0c985\]\/60">แก้พร้อมดูตัวอย่าง<\/a>/g;
const TITLE_LINK = /<a href="\/content\/articles\/[^"]*\/" class="font-medium text-white\/85 underline-offset-4 hover:text-\[#f4df9b\] hover:underline focus:outline-none focus:ring-2 focus:ring-\[#e0c985\]\/60">(.*?)<\/a>/g;
// The Admin layout now passes "แก้เนื้อหา" (was "Sanity Studio"); the legacy root layout keeps its own label.
const STUDIO_TOP_BAR = /<a href="\/studio\/" class="inline-flex min-h-11 items-center whitespace-nowrap rounded-xl border px-3\.5 py-2 text-xs font-medium text-\[#f4df9b\] transition hover:bg-\[#e0c985\]\/10 border-\[#e0c985\]\/30">([^<]*)<\/a>/g;
const studioTopBarOriginal = (_, label) => '<a href="/studio/" target="_blank" rel="noopener noreferrer" class="inline-flex min-h-11 items-center rounded-xl border border-[#e0c985]/30 px-3.5 py-2 text-xs font-medium text-[#f4df9b] transition hover:bg-[#e0c985]/10">' + (label === 'แก้เนื้อหา' ? 'Sanity Studio' : label) + NEW_TAB_HINT + '</a>';
const quote = '&quot;';
const navChild = (href, label) => `{${quote}href${quote}:${quote}${href}${quote},${quote}label${quote}:${quote}${label}${quote}}`;
const GOOGLE_DAILY = 'n8n เก็บข้อมูลให้อัตโนมัติทุกวันเวลา 06:00 น. กดดึงข้อมูลล่าสุดเองได้ และไม่แก้ข้อมูลต้นทาง';

const exactPairs = [
  // Top bar and environment chip (AdminProtectedChrome)
  ['<span class="inline-flex whitespace-nowrap rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-white/70">', '<span class="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-white/70">'],
  // Navigation items passed to AdminNavigation
  [navChild('/analytics/performance/', 'บทความที่ได้ผล &amp; สิ่งที่ควรทำ') + ',', ''],
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
  ['<span class="inline-flex whitespace-nowrap rounded-full border border-white/10 px-2.5 py-1">เลิกใช้ ', '<span class="rounded-full border border-white/10 px-2.5 py-1">Legacy '],
  ['<span class="inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs ', '<span class="rounded-full border px-2.5 py-1 text-xs '],
];

// The n8n status labels are shared by both renders (one registry), so only the
// markup around them is inverted. Labels in this list are the reviewed short ones.
export const ADMIN_PHASE1_SHORT_N8N_LABELS = Object.freeze(['มีปุ่ม', 'เบื้องหลัง', 'ยังไม่มีปุ่ม', 'ทดสอบ', 'เลิกใช้']);

export function adminPhase1DomPredecessor(html) {
  if (typeof html !== 'string') return html;
  let result = html.replace(PRESENTATION_BUTTON, '').replace(TITLE_LINK, '<div class="font-medium text-white/85">$1</div>').replace(STUDIO_TOP_BAR, studioTopBarOriginal);
  for (const [candidate, original] of exactPairs) result = result.split(candidate).join(original);
  // Same-tab Studio links: restore the original new-tab attributes and hint.
  result = result.replace(/<a href="(\/studio\/[^"]*)"((?: [a-z-]+="[^"]*")*)>(.*?)<\/a>/g, (match, href, attributes, inner) => {
    if (attributes.includes(' target=')) return match;
    const restored = inner.includes('</h3>') ? inner.replace('</h3>', NEW_TAB_HINT + '</h3>') : inner + NEW_TAB_HINT;
    return `<a href="${href}"${NEW_TAB_ATTRIBUTES}${attributes}>${restored}</a>`;
  });
  return result;
}

// Exact source inverse for frozen sources whose tests rebuild an older original
// by string transitions (DeploymentsPage). Each transition must occur once.
const sourceInverses = {
  'features/admin/operations/DeploymentsPage.tsx': [
    ['return <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${good', 'return <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${good'],
    ['<h2 className="text-xl font-semibold">ผลตรวจอัตโนมัติบน GitHub ของเวอร์ชันนี้</h2>', '<h2 className="text-xl font-semibold">GitHub Actions ของ SHA ปัจจุบัน</h2>'],
    ['แสดงเฉพาะผลตรวจที่อ่านได้ของเวอร์ชันนี้ รายการอาจไม่ครบ และยังไม่ใช่หลักฐานว่าผลตรวจที่จำเป็นหรือการนำขึ้น Hostinger ผ่านทั้งหมด', 'แสดงเฉพาะ checks ที่อ่านได้ของ SHA นี้ รายการอาจไม่ครบและยังไม่ใช่หลักฐานว่า required checks หรือการนำขึ้น Hostinger ผ่านทั้งหมด'],
  ],
};

export function adminPhase1SourcePredecessor(file, source) {
  for (const [current, original] of sourceInverses[file] ?? []) {
    if (source.split(current).length !== 2) throw new Error(`${file}: reviewed Admin Phase 1 transition must occur exactly once`);
    source = source.replace(current, original);
  }
  return source;
}

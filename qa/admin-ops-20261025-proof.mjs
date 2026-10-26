import { seoPublishTriggerPredecessorDigest, seoPublishTriggerDomPredecessor } from './seo-publish-trigger-20261026-proof.mjs';
import { createHash } from 'node:crypto';

// Owner-approved Admin ops improvements (2026-10-25, decisions A2-A9 and the
// Supabase data split): Studio opens in the same tab, one "อนุมัติและเผยแพร่"
// Studio action (existing review/publish guards unchanged), the manual GSC/GA4
// page folded into "ดึงใหม่ตอนนี้" on the morning report (old route redirects),
// 06:00 failure banner + disabled-by-default email notifier, first Local AI jobs,
// 390px fixes on ภาพรวม/ลูกค้า LINE and a collapsed "สำหรับทีมเทคนิค" section.
//
// Same mechanism as qa/admin-phase1-quick-wins-proof.mjs: an exact before -> after
// admission per protected source this change touches. A file passes only when it
// is byte-identical to the reviewed result; its digest then maps to the reviewed
// predecessor and every older frozen proof keeps comparing the original bytes.
// No SEO URL, Sanity schema name/value, analytics, consent or lane guard changes.
const sha = value => createHash('sha256').update(value).digest('hex');

export const adminOps20261025Sources = Object.freeze({
  // BEGIN reviewed sources
  "apps/admin/app/(control-plane)/analytics/page.tsx": { before: "f01831858ee4e9f60bab614f534059ae6fd5b597c3a31de44539e4b25ca7e9eb", after: "bed7d2cfce64f646556e9a69adc0a7367cd932a20645706901b9ef0adfae064b" },
  "apps/admin/app/(control-plane)/analytics/search/page.tsx": { before: "64c1ae77512d77c6b35d5be8e7af07900f35f84e7d19cfb60ca1d4d5bb1162c4", after: "98850e59813db6931118135c78d3c9ff0039a1774a72acd2b4a528aecd553b94" },
  "apps/admin/app/(control-plane)/dashboard/inbox/page.tsx": { before: "acfd3ca62e74eaad3ab8eafd95fe122608a268d0fb83bbf9d08f92db2ef8d477", after: "90a5af4e19c4131a12f09c8f9caf0797656c79323e69fa46abeda6f0375bbf0e" },
  "apps/admin/app/(control-plane)/dashboard/page.tsx": { before: "eaa296594245505d868adf4d771f56485ba2edcaf20590f0a1da1e084de6d624", after: "1f9a7a1ace99efb7d2913907ff5daa1f5108c30c880724a7c6a7627d05d0f27a" },
  "apps/admin/app/(control-plane)/layout.tsx": { before: "6f75781df7ddd1712b39169cb0e99eaa23c7ae8ee155c7d9b2af39a422bde693", after: "dce37f737833142e5f77019c0a4faf118ba7c7b260e07c4282a8e5725ab18c82" },
  "apps/admin/app/(control-plane)/operations/health/page.tsx": { before: "4d0045767bdbfdf9ed410e0b1d1cb31b1969d07f74ea0fac02f62c26e447bcce", after: "42363fbd8dcfca51db20a1d741c4a945950653314657e3f71c7b87474b2b82a3" },
  "apps/admin/app/(control-plane)/seo/[section]/page.tsx": { before: "1b0ca5a8d9cad964f3cabf0d5f22cdf590929b53862e215453afa03022c567c2", after: "95fc67df51eb5b1318b6880a7816051be76384ae4deae8a75fe70bf2d28d0744" },
  "apps/admin/app/(control-plane)/seo/opportunities/page.tsx": { before: "35dd4ddf79cfbd8067ec76f244c01a2e25aae9798fe0ba42f6abde3ce54068de", after: "c51142a1b445a6c91c12dd16a268917e98724f118ac9d0404b2cee9635c1a2f7" },
  "apps/admin/app/(control-plane)/settings/[section]/page.tsx": { before: "93a2083155a2bf7ab35af6fe8c452882c5e5d4c090066ddc4070711f07fc5482", after: "6bb318e71077cb613bbcbf69712d4bc4ed72392c5acca70b478cb323e25f356d" },
  "cms/sanity/policy/article-editorial-status.tsx": { before: "a335ca0b415b189612b36d24008f02753c05b4592037d58e622a4291eed49fb0", after: "24eed5525076f98aefca7fd75e2d0f4b574fbcce4b14c980faf88bfa98a964e4" },
  "cms/sanity/policy/article-publish-action.tsx": { before: "045c84dd3309216f3bad97ee8e4696c0a5f2f1d353dc18f31507a7c6aa05a826", after: "2991d2622c0d24557eb58a2a740179baf8d2d8b3daab3f9f7a0ee70892246999" },
  "features/admin/analytics/StoredAnalyticsDashboard.tsx": { before: "6400acdc6b0240a3d38f0a5e76ec4609a37b5bfbb5c924bfbe1730b2362c6b83", after: "11cc3f255803997117d8c754af7c7fa12e8185cb6632007a8475b460e2879682" },
  "features/admin/components/AdminNavigation.tsx": { before: "a394bff42e1738594bf6d96463ecbc12c521f716dcbefdd1b0516c651afc1106", after: "a85c9d5157c2c40872cc4439334f055de3016f264c93281443f009e5c8874c53" },
  "features/admin/components/AdminProtectedChrome.tsx": { before: "b39179eaca866dcf3dd0c3ba0b077175c5cf27a0f30b4b2a1864a2d299a61335", after: "ec5052f0f5fb7e910189a8d21858b4372859fc67704b7f0b41ae69dd09b521e9" },
  "features/admin/components/ArticleDetailPage.tsx": { before: "0aaa3aa0e99a4327072b82fbf7007686ff81e216938b9fb1f7b3bf79697ede4b", after: "678fba6bf91844261143aac3a7ab93f6c635a60406a4bcf0931246d793114264" },
  "features/admin/components/ContentArticlesPage.tsx": { before: "3d82d3e2c6e25264377f746fc4f501032aa577bdea492d1f30dc32a455cdcd7a", after: "6f3ca58e5ba213452a24228559784d65f1c6315cafcbe1034f8963a4edc59081" },
  "features/admin/components/SeoAuditDetailPage.tsx": { before: "2aa51e43e58bd9163e61322891bf1741d0e5dc738d51ea2a6d7558439060a4dd", after: "6a465b59bfa7bb020b1fc42d1dd3458fb2cac0c3a05421d9f5767dd2db7541b5" },
  "features/admin/components/SeoOverviewPage.tsx": { before: "a5e1224db4db346ba38728535d4131a472f011c628ded09568a5f31db25d9c25", after: "e2725c6ec6074be36199960f6fe5765906d604e8433ae900769266f4b9e1e68f" },
  "features/admin/components/SeoReviewInboxPage.tsx": { before: "b32b2b0ae382122ec3595990298c28e0854b2777fdbed56e5aba867fa7010dc7", after: "5376e9c5fd26bc186fe4256cada688f5f617d2444c3317e13a708011daf48998" },
  "features/admin/components/admin-navigation-model.ts": { before: "37fd3fd4c6f317353f1b6e2eed727e1a3a8ae56b0cc57f5a88c72af4098583ba", after: "f7ee2accc15e5fa37c4fdf5686084adc717b6ee0de17aa92bb5bc2e960c2b466" },
  "features/admin/operations/LocalAiPage.tsx": { before: "4e6e5608dcbb783d2c2006694c975df2098fdc38af82ca026bea6f4ed849bcec", after: "378490c0ae77d501fd1ac9e1936ba4a91402a11bcc5a53afb6a813bd45897361" },
  "features/admin/seo/opportunities/Ga4ManualSync.tsx": { before: "6d7b04465b871886c234b6a9e83c6519d979471ff77e659c74e57c118de97b30", after: "2901e2bbb9d637100c8d52f1c3dbb92162bbb16235f50beb46e339992a6e6488" },
  "features/admin/seo/opportunities/GscManualSync.tsx": { before: "6f6cba3bf6ea76a1afa61bbb0193a3c4a877e1b5cb3f22d237bf663ee90e533f", after: "6b3d64021226fcaa5398dd8bb494844ac06b1771cf0aa5e623558db0145e0541" },
  // END reviewed sources
});

// Codex audit follow-ups F01-F03 (2026-10-25): the ภาพรวม 06:00 card also
// names the new "stuck" (ค้างเกินเวลา) and UAT "unscheduled" states. Same exact
// mechanism: `before` is the reviewed successor admitted above, so the file
// chains back through that entry to its original reviewed predecessor. Any
// other byte still fails every frozen proof.
export const adminOpsAuditFollowUpSources = Object.freeze({
  // BEGIN reviewed follow-up sources
  "apps/admin/app/(control-plane)/dashboard/page.tsx": { before: "1f9a7a1ace99efb7d2913907ff5daa1f5108c30c880724a7c6a7627d05d0f27a", after: "07325e4407b4cbdc27c0c0ddec721458a3e7ffe42d70d271f5e7ccce7adb490d" },
  // END reviewed follow-up sources
});

// Admin cache hardening (2026-10-25, security fix on PR #492): every Admin page,
// redirect, auth and API response carries `private, no-store` plus CDN no-store
// headers, /_next/static stays cacheable, and /login/ renders per request. The
// adminProxy routing/auth decision is byte-for-byte unchanged (the cache policy
// wraps its final response in the outer proxy). `before` is the digest currently
// frozen by phase3-admin-native-boundaries (proxy) and phase1-source-ownership
// (login); next.config.ts had no prior seal and is frozen here from now on.
// Same exact mechanism: any other byte still fails every frozen proof.
export const adminCacheHardeningSources = Object.freeze({
  // BEGIN reviewed cache-hardening sources
  "apps/admin/app/(control-plane-auth)/login/page.tsx": { before: "343322f37dd70534031a38cfe4731714460f0a6ec43b335a55840d6481831b9e", after: "22177830652bc439cfa0fbd02da7a8b6776140e2e4f08244ba0b8d76f718bfca" },
  "apps/admin/next.config.ts": { before: "202e30306c29ef7ab2c6e6548892cd18df28b741313f92dd3ed4cb4e33e30dc5", after: "4e8a5020135b0644a68e9ef9431f35a90e8b022b7e2551a58ce7d2bb661b276e" },
  "apps/admin/proxy.ts": { before: "f423de344e00e1219ddb5e2699b4cadf5e6fa8b5d42ce403e371084b3081a7fc", after: "5098b24e07dc12ba94f72bf4d247bc6c770eec680637d367e4bc9f11c75a96e2" },
  // END reviewed cache-hardening sources
});

// Admin wording fixes (2026-10-25, owner FigCraft review on PR #492): owner name
// typo "รอปัน…" -> "รอปั้น…" on ลูกค้า LINE, Thai labels on the ภาพรวมธุรกิจ cards
// (same wording as /analytics/conversions/; data keys unchanged) and Thai
// display dates on the ดึงใหม่ตอนนี้ GSC/GA4 range labels (the request range
// values stay ISO). `before` is the reviewed successor currently admitted above
// (dashboard/page.tsx: the audit follow-up), so each file chains back through
// that entry. Same exact mechanism: any other byte still fails every frozen proof.
export const adminCopyFixesSources = Object.freeze({
  // BEGIN reviewed copy-fix sources
  "apps/admin/app/(control-plane)/dashboard/inbox/page.tsx": { before: "90a5af4e19c4131a12f09c8f9caf0797656c79323e69fa46abeda6f0375bbf0e", after: "ddfe194cba105ac9e5312355ab8d5caf906a92445f51faae54ff8dd39a323b9b" },
  "apps/admin/app/(control-plane)/dashboard/page.tsx": { before: "07325e4407b4cbdc27c0c0ddec721458a3e7ffe42d70d271f5e7ccce7adb490d", after: "cb513d139f472171b10d88448819342f1d95150de6e50b9f6a01bf9e5236599c" },
  "features/admin/seo/opportunities/Ga4ManualSync.tsx": { before: "2901e2bbb9d637100c8d52f1c3dbb92162bbb16235f50beb46e339992a6e6488", after: "ba1720c4b523087efc18905ed63f7e443713eed1eac3c6b5b2264f0c9ed6e42c" },
  "features/admin/seo/opportunities/GscManualSync.tsx": { before: "6b3d64021226fcaa5398dd8bb494844ac06b1771cf0aa5e623558db0145e0541", after: "c07a26f82e51947e5d46c92be96a00ca53a7719b90fa8484984869d2fbe21b95" },
  // END reviewed copy-fix sources
});

// Maps the digest of an exact copy-fix successor to the reviewed successor it
// replaced; any other digest is returned unchanged.
export function adminCopyFixesPredecessorDigest(file, digest) {
  const copy = Object.hasOwn(adminCopyFixesSources, file) ? adminCopyFixesSources[file] : null;
  return copy && digest === copy.after ? copy.before : digest;
}

// Maps the digest of an exact reviewed successor to its reviewed predecessor;
// any other digest is returned unchanged (so an unreviewed edit still fails).
export function adminOps20261025PredecessorDigest(file, digest) {
  const copyReviewed = adminCopyFixesPredecessorDigest(file, seoPublishTriggerPredecessorDigest(file, digest));
  const cache = Object.hasOwn(adminCacheHardeningSources, file) ? adminCacheHardeningSources[file] : null;
  const cacheReviewed = cache && copyReviewed === cache.after ? cache.before : copyReviewed;
  const followUp = Object.hasOwn(adminOpsAuditFollowUpSources, file) ? adminOpsAuditFollowUpSources[file] : null;
  const reviewed = followUp && cacheReviewed === followUp.after ? followUp.before : cacheReviewed;
  const entry = Object.hasOwn(adminOps20261025Sources, file) ? adminOps20261025Sources[file] : null;
  return entry && reviewed === entry.after ? entry.before : reviewed;
}

export function adminOps20261025SourceDigest(source) {
  return sha(source);
}

// Exact rendered-DOM inverse for the frozen DOM-parity fixtures: it rebuilds the
// predecessor markup for these approved display changes and nothing else. Each
// rule names one concrete element; every other byte is still compared.
const NEW_TAB = ' target="_blank" rel="noopener noreferrer"';
const NEW_TAB_HINT = '<span class="sr-only"> (เปิดแท็บใหม่)</span>';
const q = '&quot;';
const navChild = (href, label) => `{${q}href${q}:${q}${href}${q},${q}label${q}:${q}${label}${q}}`;
const studioSameTab = (hrefPattern, className, labelPattern) => [
  new RegExp(`<a href="(${hrefPattern})" class="${className.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}">(${labelPattern})</a>`, 'g'),
  (_, href, label) => `<a href="${href}"${NEW_TAB} class="${className}">${label}${NEW_TAB_HINT}</a>`,
];

const rules = [
  // A2: Studio links open in the same tab (chrome, articles, article detail, SEO pages).
  studioSameTab('/studio/', 'inline-flex min-h-11 items-center rounded-xl border border-[#e0c985]/30 px-3.5 py-2 text-xs font-medium text-[#f4df9b] transition hover:bg-[#e0c985]/10', '[^<]*'),
  studioSameTab('/studio/intent/create/type=article', 'rounded-xl bg-[#e0c985] px-4 py-2.5 text-sm font-semibold text-[#17191d] transition hover:brightness-105', 'สร้างบทความใหม่'),
  studioSameTab('/studio/', 'rounded-xl border border-[#e0c985]/40 px-4 py-2.5 text-sm font-medium text-[#f4df9b] transition hover:bg-[#e0c985]/10', 'เปิด Studio'),
  studioSameTab('/studio/intent/edit/id=[^"]*', 'font-medium text-[#e0c985] hover:underline', 'เปิดแก้ใน Studio'),
  studioSameTab('/studio/intent/edit/id=[^"]*', 'gold-button inline-flex min-h-11 items-center px-5 py-3 text-sm', '[^<]*'),
  studioSameTab('/studio/intent/edit/id=[^"]*', 'inline-flex min-h-11 items-center rounded-xl border border-[#e0c985]/30 bg-[#e0c985]/10 px-4 py-2.5 text-sm font-medium text-[#f4df9b] hover:bg-[#e0c985]/15', 'เปิดแก้ใน Studio'),
  studioSameTab('/studio/structure/article;[^"]*', 'inline-flex min-h-11 items-center rounded-xl border border-[#e0c985]/30 bg-[#e0c985]/10 px-3.5 py-2 text-sm font-medium text-[#f4df9b] hover:bg-[#e0c985]/15', 'เปิด Studio เพื่อเริ่มฉบับร่าง'),
  studioSameTab('/studio/structure/article;[^"]*', 'mt-2 inline-flex min-h-11 items-center text-sm font-medium text-[#f4df9b] underline underline-offset-4', 'เปิดตรวจด้วยตนเองใน Studio'),
  [/<a href="(\/studio\/structure\/article;[^"]*)" class="inline-flex min-h-11 items-center rounded-xl border border-\[#e0c985\]\/30 bg-\[#e0c985\]\/10 px-3\.5 py-2 text-xs font-semibold text-\[#f4df9b\] transition hover:bg-\[#e0c985\]\/15">เปิดตัวอย่างฉบับร่างใน Studio<\/a>/g,
    (_, href) => `<a href="${href}"${NEW_TAB} class="inline-flex rounded-xl border border-[#e0c985]/30 bg-[#e0c985]/10 px-3.5 py-2 text-xs font-semibold text-[#f4df9b] transition hover:bg-[#e0c985]/15">เปิดตัวอย่างฉบับร่างใน Studio${NEW_TAB_HINT}</a>`],
  // Dashboard workflow step that opens Studio.
  [/<a href="\/studio\/" class="(min-h-44 rounded-2xl border border-white\/10 bg-white\/\[0\.035\] p-5 transition hover:border-\[#e0c985\]\/30 hover:bg-white\/\[0\.05\])">(<span class="text-sm font-semibold text-\[#e0c985\]">[^<]*<\/span><h3 class="mt-3 text-lg font-semibold">[^<]*)<\/h3>/g,
    (_, className, head) => `<a href="/studio/"${NEW_TAB} class="${className}">${head}${NEW_TAB_HINT}</h3>`],
  // Chrome identity block wraps a long e-mail on a 390px screen.
  ['<div class="min-w-0 text-right"><div class="break-all text-white/80">', '<div class="text-right"><div class="text-white/80">'],
  // A4: /seo/opportunities/ left the menu (old route redirects to the morning report).
  [`{${q}href${q}:${q}/seo/${q},${q}label${q}:${q}SEO${q},${q}permission${q}:${q}seo:read${q}}`, `{${q}href${q}:${q}/seo/${q},${q}label${q}:${q}SEO${q},${q}permission${q}:${q}seo:read${q},${q}children${q}:[${navChild('/seo/opportunities/', 'โอกาสพัฒนา')}]}`],
  ['<a href="/analytics/" class="inline-flex min-h-11 items-center rounded-xl border border-[#e0c985]/30 bg-[#e0c985]/10 px-4 py-2.5 text-sm text-[#f4df9b] hover:bg-[#e0c985]/15">', '<a href="/seo/opportunities/" class="inline-flex min-h-11 items-center rounded-xl border border-[#e0c985]/30 bg-[#e0c985]/10 px-4 py-2.5 text-sm text-[#f4df9b] hover:bg-[#e0c985]/15">'],
  ['<a href="/analytics/" class="glass-button-sm inline-flex min-h-11 items-center text-sm text-white">เปิดรายงานเช้านี้</a>', '<a href="/seo/opportunities/" class="glass-button-sm inline-flex min-h-11 items-center text-sm text-white">ดูโอกาสพัฒนา SEO</a>'],
  // A9: technical menu entries carry a flag for the collapsed "สำหรับทีมเทคนิค" section.
  [`,${q}technical${q}:true}`, '}'],
  // A9: LINE key card collapsed in place on สถานะระบบ; Supabase status card added.
  [/<details class="rounded-3xl border border-white\/10 bg-white\/\[0\.02\]" data-admin-technical-section=""><summary class="[^"]*">สำหรับทีมเทคนิค · ความพร้อมของการเข้ารหัส LINE<\/summary>([\s\S]*?)<\/details>/g, '$1'],
  [/<section class="rounded-3xl border border-white\/10 bg-white\/\[0\.035\] p-5 md:p-6"><div class="flex items-start justify-between gap-4"><h2 class="text-lg font-semibold text-white\/90">บันทึกงาน n8n และรอบ 06:00<\/h2>[\s\S]*?<\/section>/g, ''],
  // A6/A8 on ภาพรวม: 06:00 card and 44px link targets.
  [/<a href="\/analytics\/" class="glass-card p-5" data-daily-job-card="[a-z]+">[\s\S]*?<\/a>/g, ''],
  ['<a href="/analytics/exports/" class="inline-flex min-h-11 items-center text-sm text-[#e0c985] hover:underline hover:underline-offset-4">', '<a href="/analytics/exports/" class="text-sm text-[#e0c985] hover:underline hover:underline-offset-4">'],
  ['class="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-3.5 py-2 text-sm text-white/70 hover:bg-white/5"', 'class="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/65 hover:bg-white/5"'],
  // BEGIN reviewed DOM pairs
  // Copy fixes (adminCopyFixesSources): Thai labels on the ภาพรวมธุรกิจ count cards.
  ['<p class="text-sm text-white/55">ผู้สนใจ</p>', '<p class="text-sm text-white/55">Lead</p>'],
  ['<p class="text-sm text-white/55">การคุยที่พร้อมให้คำแนะนำ</p>', '<p class="text-sm text-white/55">Qualified Conversation</p>'],
  ['<p class="text-sm text-white/55">สำเร็จ</p>', '<p class="text-sm text-white/55">Won</p>'],
  // END reviewed DOM pairs
];

export function adminOps20261025DomPredecessor(html) {
  if (typeof html !== 'string') return html;
  let result = seoPublishTriggerDomPredecessor(html);
  for (const [candidate, original] of rules) result = typeof candidate === 'string' ? result.split(candidate).join(original) : result.replace(candidate, original);
  return result;
}

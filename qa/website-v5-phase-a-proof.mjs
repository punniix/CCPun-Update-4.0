import { createHash } from 'node:crypto';

// Website v5 Phase A (UAT prototype, branch codex/website-v5-uat-20261025).
// The owner asked for v5 to be built for test.ccpun.com review; this is NOT a
// Production design approval. Same style as the Admin v1 admission: each protected
// source the redesign touches passes only if it is byte-identical to the reviewed
// v5 result (or still the original). Historical digests and goldens stay frozen;
// they keep proving the unchanged Website 4.3 components that Phase B pages still use.
// No SEO URL, canonical, redirect, sitemap, Sanity schema, analytics event or consent change.
const sha = value => createHash('sha256').update(value).digest('hex');

// Additive public-copy keys for new v5 UI labels (and the v5 test registration). Removing
// exactly these blocks reconstructs the frozen sources; existing keys and wording are untouched.
export const websiteV5CopyAdditions = Object.freeze({
  'lib/content/site-copy-defaults.ts': [[
    '  "site.extra.blogRecovery": "ดูบทความ",\n  "site.nav.topics": "หมวดความรู้",\n  "site.nav.allArticles": "บทความทั้งหมด",\n  "site.theme.toggle": "สลับโหมดสว่างและโหมดมืด",\n  "site.notFound.latestTitle": "บทความล่าสุด",\n',
    '  "site.extra.blogRecovery": "ดูบทความ",\n',
  ]],
  'lib/content/blog-copy-defaults.ts': [[
    '  "blog.dynamic5": "บทความ{0}",\n  "blog.startHere.title": "เริ่มอ่านที่นี่",\n  "blog.group.latest": "บทความล่าสุด",\n  "blog.group.count": "{0} บทความ",\n  "blog.group.viewAll": "ดูทั้งหมด →",\n  "blog.pager.label": "เลือกหน้าของ {0}",\n  "blog.pager.first": "« หน้าแรก",\n  "blog.pager.last": "หน้าสุดท้าย »",\n  "blog.pager.status": "หน้า {0} จาก {1}",\n  "blog.topicTools.title": "ลองเทียบความคุ้มครองที่มีอยู่กับภาระจริง",\n  "blog.topicTools.description": "เครื่องมือที่เกี่ยวกับหมวดนี้",\n  "blog.nextStep.eyebrow": "ขั้นต่อไป"\n',
    '  "blog.dynamic5": "บทความ{0}"\n',
  ]],
  // The v5 regression suite joins test:public; nothing else in the manifest changes.
  'package.json': [[
    'node --import tsx tests/analytics-component-regression.mjs && node --import tsx --test tests/website-v5-regression.test.ts",',
    'node --import tsx tests/analytics-component-regression.mjs",',
  ]],
  'lib/content/public-copy-registry.ts': [[
    'เป้าหมายทางการเงินที่ลูกค้าต้องการให้ไปถึง",\n  "home.coreGuides.title": "คู่มือหลัก",\n  "home.latest.title": "บทความล่าสุด",\n  "home.moneyStory.description": "เกมจำลองชีวิตการเงิน 12 เดือน",\n  "home.contactBand.title": "ถ้าอยากรู้ว่าตอนนี้พร้อมแค่ไหน ทักมาคุยทาง LINE ได้เลย"\n',
    'เป้าหมายทางการเงินที่ลูกค้าต้องการให้ไปถึง"\n',
  ]],
});

export const websiteV5NewCopyKeys = Object.freeze([
  'site.nav.topics', 'site.nav.allArticles', 'site.theme.toggle', 'site.notFound.latestTitle',
  'blog.startHere.title', 'blog.group.latest', 'blog.group.count', 'blog.group.viewAll', 'blog.pager.label',
  'blog.pager.first', 'blog.pager.last', 'blog.pager.status', 'blog.topicTools.title', 'blog.topicTools.description',
  'blog.nextStep.eyebrow', 'home.coreGuides.title', 'home.latest.title', 'home.moneyStory.description', 'home.contactBand.title',
]);

/** Exact inverse of the additive copy keys; any other edit is left in place and still fails the frozen digest. */
export function websiteV5CopyPredecessor(file, source) {
  const edits = Object.hasOwn(websiteV5CopyAdditions, file) ? websiteV5CopyAdditions[file] : null;
  if (!edits || typeof source !== 'string') return source;
  let result = source;
  for (const [current, original] of edits) {
    if (result.split(current).length !== 2) return source;
    result = result.replace(current, original);
  }
  return result;
}

// Route/composition sources switched to the v5 renderers. `before` is the
// v4-production (1ecc9712) digest; `after` is the reviewed v5 source.
export const websiteV5PhaseASources = Object.freeze({
  // BEGIN reviewed sources
  "apps/admin/app/(control-plane)/content/website-preview/page.tsx": { before: "0ebaa9b82cea9fe6d71239970431a9cd460b03ebbaec300596e5317201c3f256", after: "1e700237c9e32b30da8d592db7d78afe58dc07f21e76390f2c023d814dbdcf4c" },
  "apps/web/app/not-found.tsx": { before: "e2ea4b1d9cd8d95c7ceaa26d700f653256640d152c2ba68831a4321872854a55", after: "18fa1c2a55600e2ef4a9575831cfc778e19b196421b34cc26928f2b3b10c26a1" },
  "apps/web/app/page.tsx": { before: "f632926c278790246480321d2aacf80b29b10f1ada4952b2b54944e9d3f8f8c9", after: "8869beb97ac0043193080c85a88b8c2374823f80874c2afee49259c0a1c3acbc" },
  "features/blog/pages/ArticlePage.tsx": { before: "c951fa95c6b892baf46e25d3e73f50ad296177ae3aaa99497a7a0ad019192303", after: "e161a9247a0bd02b6864cc2b259f71b4324d0493fbcb77f10cbebda5bed29db1" },
  "features/blog/pages/BlogArchivePage.tsx": { before: "a5ecfe50bcb34368d7d0477f41102cb8ea70f1a4cf879e4a9f260743a114a8f7", after: "c257181241eb908c3412c2c38302eb0bb3efb6f7553dd0e4202bde9df93b33f4" },
  "features/blog/pages/BlogCategoryPage.tsx": { before: "ca7090a27fb42eea89812cb4efcccb6748e5a7c841b9f0b1a0c4e33582a8fd56", after: "a69647fc9d9a02a514031a989be3907a2af7f5ed6096e5d07e17132afb04384f" },
  // END reviewed sources
});

/** Digest the frozen proofs should compare: the reviewed predecessor for an exact v5 successor, else the file's own digest. */
export function websiteV5PredecessorDigest(file, source) {
  const restored = websiteV5CopyPredecessor(file, source);
  const digest = sha(restored);
  const entry = Object.hasOwn(websiteV5PhaseASources, file) ? websiteV5PhaseASources[file] : null;
  return entry && digest === entry.after ? entry.before : digest;
}

export function isWebsiteV5ReviewedSuccessor(file, source) {
  const entry = Object.hasOwn(websiteV5PhaseASources, file) ? websiteV5PhaseASources[file] : null;
  return Boolean(entry) && sha(source) === entry.after;
}

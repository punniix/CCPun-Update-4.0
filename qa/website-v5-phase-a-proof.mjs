import { createHash } from 'node:crypto';

// Website v5 Phase A (UAT prototype, branch codex/website-v5-uat-20261025).
// The owner asked for v5 to be built for test.ccpun.com review; this is NOT a
// Production design approval. Same style as the Admin v1 admission: each protected
// source the redesign touches passes only if it is byte-identical to the reviewed
// v5 result (or still the original). Historical digests and goldens stay frozen;
// they keep proving the unchanged Website 4.3 components that Phase B pages still use.
// Phase A/B: no SEO URL, canonical, redirect, sitemap, Sanity schema, analytics event or consent change.
// The 2026-10-25 LINE chat block below is the owner-approved exception (L5, L6, T1).
const sha = value => createHash('sha256').update(value).digest('hex');

// Additive public-copy keys for new v5 UI labels (and the v5 test registration). Removing
// exactly these blocks reconstructs the frozen sources; existing keys and wording are untouched.
export const websiteV5CopyAdditions = Object.freeze({
  'lib/content/site-copy-defaults.ts': [[
    '  "site.extra.blogRecovery": "ดูบทความ",\n  "site.nav.topics": "หมวดความรู้",\n  "site.nav.allArticles": "บทความทั้งหมด",\n  "site.theme.toggle": "สลับโหมดสว่างและโหมดมืด",\n  "site.notFound.latestTitle": "บทความล่าสุด",\n  "site.campaign.unitDays": "วัน",\n  "site.campaign.unitHours": "ชั่วโมง",\n  "site.campaign.unitMinutes": "นาที",\n  "site.campaign.unitSeconds": "วินาที",\n',
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
  // 2026-10-25 (owner-approved, audit #4): Thai countdown unit labels for the v5 placement.
  'site.campaign.unitDays', 'site.campaign.unitHours', 'site.campaign.unitMinutes', 'site.campaign.unitSeconds',
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
  "apps/web/app/not-found.tsx": { before: "e2ea4b1d9cd8d95c7ceaa26d700f653256640d152c2ba68831a4321872854a55", after: "8f337f74f2cce92b35478abd857fd9274ea785445df72ce3ea89c9e57186d3a2" },
  "apps/web/app/page.tsx": { before: "f632926c278790246480321d2aacf80b29b10f1ada4952b2b54944e9d3f8f8c9", after: "8869beb97ac0043193080c85a88b8c2374823f80874c2afee49259c0a1c3acbc" },
  "features/blog/pages/ArticlePage.tsx": { before: "c951fa95c6b892baf46e25d3e73f50ad296177ae3aaa99497a7a0ad019192303", after: "e161a9247a0bd02b6864cc2b259f71b4324d0493fbcb77f10cbebda5bed29db1" },
  "features/blog/pages/BlogArchivePage.tsx": { before: "a5ecfe50bcb34368d7d0477f41102cb8ea70f1a4cf879e4a9f260743a114a8f7", after: "c257181241eb908c3412c2c38302eb0bb3efb6f7553dd0e4202bde9df93b33f4" },
  "features/blog/pages/BlogCategoryPage.tsx": { before: "ca7090a27fb42eea89812cb4efcccb6748e5a7c841b9f0b1a0c4e33582a8fd56", after: "a69647fc9d9a02a514031a989be3907a2af7f5ed6096e5d07e17132afb04384f" },
  // 2026-10-25 (owner-approved, visual only): cookie notice skin moves to CookieConsent.module.css; consent logic,
  // storage, defaults, timing, events and copy are unchanged. `before` is the reviewed source at afc0c4c7.
  "features/analytics/components/CookieConsent.tsx": { before: "29bf6a9af3ff34d8bf867acdef1a3718f7d9c27e514591fbcf32628e7de2f0af", after: "5f84509f9b4bb4f15956142229ed4ddfaa994924f44903565594002774467815" },
  "features/analytics/components/CookieConsentPreferences.tsx": { before: "a1da91f8c246c4a59f63b94c68206826d3b28889226beb604b92c0374c81d1dd", after: "7ef7f14e891fbfe09ec67fdafbb94026588f225487fe424a0998005c3dc6558e" },
  "apps/web/app/sitemaps/core.xml/route.ts": { before: "b65773febf84cb13cc71d28b59d35b1d812db008e721f3c011eca2736c48b7ce", after: "e75e91172e46e1e38fb59c1097825056bcb14030bede4dce6862e8513a5aa48a" },
  // END reviewed sources
  // Website v5 Phase B: tool/legal render owners, root layout fonts and the shared widgets moved
  // off the 4.3 stylesheet. `before` is the Phase A + Investment Allocation merge (b6453d0a).
  // BEGIN Phase B reviewed sources
  "apps/web/app/layout.tsx": { before: "8f5386d2856faaf786df41662174beb0735cc62d9fce2cd6d82bd2a731575963", after: "9a7dceb0615ae610ecafe80a0937547b9a6c6c8b422688e443ba763970cc3ab8" },
  "features/ci-planning/page.tsx": { before: "980ff674a6fc1fc0908825cbcab844a09154b477755c50613934db08f9697458", after: "4890e76a4f868daeb7d6e2da0f1dc9adbc10226b07479b55e91eeebe8045c9d5" },
  "features/financial-health-check/page.tsx": { before: "09d336add15f70b947c0c2d31f78722881b8821ce84c77724c075c5098769fd9", after: "0da6a83befa83fad31e4f9af07a74fa0fdd1f5f2f55201ec80bf127a7d1abd7c" },
  "features/money-story/page.tsx": { before: "83f1719473106c1f47b1022e9f7bd642c4e3fc87f7b546a869e70b9108f4296d", after: "725dd62b52935c0ca9c2cde0a252ad393986db9891808141157591a9ff57f6be" },
  "features/legal/pages/PrivacyPage.tsx": { before: "4ef0f5077d3d6c6d77d3c5bdc7316c1cb7716a232bfecf0242e808973d062295", after: "abff1a76ad1bcfbfb0f03600be136339c64d13501716d68e429d9b50b6f974ca" },
  "features/legal/pages/CookiePolicyPage.tsx": { before: "6846ce5d39782c288aa5345233b6623772b9839553668a41ec7629415460411d", after: "1630a89601a4361b65b23154e2f62e172c606ffc093df696317331f0fd254652" },
  "components/ui/health-happy/HealthHappyCountdown.tsx": { before: "e332ed447c376433404b8f80958edb833671f9983083605d4433b415c32aac05", after: "9c5bc7b625a49755d3be90ef885e4cb3bade1d9bf9fb0fff2ea68f8e609d1618" },
  // Design QA 2026-10-25 (UAT): countdown labels read at 14px on phones (were 12/13px) and the frame
  // radii follow the v5 scale (16/12px); the reviewed v5 successor digest moves to this exact file.
  // 2026-10-25 UX fixes (owner-approved #4, #8): AIA red per theme, 15px buttons, tabular numerals, spacing on the 4px scale.
  // 2026-10-25 owner decision (addendum 2): countdown buttons take the site 14px button corners (var(--v5-radius-button)).
  "components/ui/health-happy/HealthHappyCountdown.module.css": { before: "c9250365f419a79b3e7221c6f9556ce8b6071464118d38ea8419ad89c9375ef2", after: "680f964d475b51ed3a2be9c092257fc17554916626d57c03668ad28ca4cad804" },
  "features/blog/website-43/ArticleShareActions.tsx": { before: "468315c7dc18c8b6030e8881bf6498fd5df2adc931dc5a0b48d9726c303135af", after: "79595cd57be1e6d2764661826516105ab39a6a16103783047c596f5377ab2058" },
  "features/blog/website-43/ArticleEngagement.tsx": { before: "941020bc1e53917b1fec02af8036ec4053b48e9cf4cc75abbcf41d477a5d3799", after: "146f49c1e9fd9bedacba9c9b602384dc4bd8a5581de901667d3d86b470cd772c" },
  "features/blog/website-43/ArticleDetailAccess.tsx": { before: "9b00002d896f86765bc9216adb1427454b2a734abb257b0505ca77d8f80976c9", after: "689e79413207218ecf12595b8aa08537f5c0e3d49298a16c5e59075aad56d0ed" },
  // D9 (owner-approved 2026-10-25): the page passes `current` so the gated nav entry is marked.
  // v5 motion round (owner-approved #1, UAT): allocation bars grow once (transform only) in the CSS below.
  "features/investment-allocation/page.tsx": { before: "3b8268994e496feb67bc99d79b908dc80f68564c727f1473cfad2d7b22689a39", after: "fc8ca4bbefbe65c1e6200b5e514c6fa6bf91b5ca8f7278a5fce047faf8cb3e98" },
  "features/investment-allocation/InvestmentAllocation.module.css": { before: "ca66e94854d773d024f4fa66284a0f3dc14b2fa72b4836fcd3f3328ad4a45543", after: "41e9e934b1283037c7c1e0ae188c77991cff93d20419024b7f7c17efeb7565e4" },
  // END Phase B reviewed sources
  // Owner-approved 2026-10-25 (UAT): LINE chat button L5/L6 (additive analytics tokens, the CI result
  // oaMessage prefill without numbers, line_oa_click now owned by the app because GTM v9 paused the
  // lin.ee click tag), the new /tools/ hub sitemap entry (T1) and Money Story joining the tools sitemap
  // (v5 only). `before` is HEAD f2b163e2.
  // BEGIN LINE chat reviewed sources
  // 2026-10-25 (owner-approved, addendum 5): additive allowlisted `panel_trigger` (dock | article_cta) on line_chat_panel_open,
  // cleared on every semantic event like the other chat dimensions. No event or mapping is renamed.
  "lib/analytics.ts": { before: "4176646b29ae2614cc044fef35d9be7cdffe8cfb303c8519f86fe71c148cd90f", after: "0a71fbf0061b12a5374a927f122450ab1a7c73e41b50346b2fdc84f0d0793055" },
  "features/analytics/components/GoogleAnalytics.tsx": { before: "6379bb9a48584a748980f1163458150776410ce32d71c782bfd3529fdb295b6a", after: "8d615a8b3fb1dc2505c1c310e1a162b66895d0c8fc5a94a7c7ae314dedb66206" },
  "features/ci-planning/calculator/constants.ts": { before: "ccdafe5526f8dfe32d129e6f74b0f574f07dbed3aa62d6fa3eb612ed44dbd9c9", after: "0228e217aa05ca1d10deb87f1806a97e6780c467fbcd82e6d77cec08ea78fbb1" },
  "features/ci-planning/components/result/CIResult.tsx": { before: "b7c793111a1d654e89dcaf1392daf6b3b0bc53f0f310569cab465bbccdc91f85", after: "7935271a76b7830b2b6003ebeb5cde6c862c228a6401333b64ed59dd7fd96dc9" },
  "apps/web/app/sitemaps/tools.xml/route.ts": { before: "d6f0a88e8e082af3045cd5a4b132241444d50164c9293ec36e647087993033f0", after: "3b01299e0789640a92a78e1d52566889db4da916b7083e4a7176182035d82851" },
  // END LINE chat reviewed sources
  // BEGIN motion reviewed sources
  // v5 motion round (owner-approved ideas #1, #2, #4, 2026-10-25, UAT only): the shared result comparison
  // animates transform/opacity once and counts the gap up while the final value stays accessible.
  // `before` is the reviewed source at d77acba8.
  "components/ui/MoneyComparison.tsx": { before: "3f0c3a9229483df806297d5ab0bf45d7d83d4e158f1a995475a4dabccead5368", after: "66b9bafb291589919893d6ea7f3ad1523f36b1dbf7e7009d9e52f515da56c6c0" },
  // END motion reviewed sources
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

// Website v5 Phase B: retained, unrouted Website 4.3 tool and legal presentations (rollback targets).
// Each is the exact pre-Phase-B render body moved out of its route owner; metadata stays with the owner.
// Literal-source tests may read them through the same CMS display substitution as their original owner,
// but only while the copy is byte-identical to the reviewed retained file.
export const websiteV5RetainedSources = Object.freeze({
  "features/ci-planning/website-43/Website43CiPlanningPage.tsx": "259701d3722be03d7459f481fe81ee8a56ab01dd3d68c4ab8dfaa039c6b172cf",
  "features/money-story/website-43/Website43MoneyStoryPage.tsx": "054752cbce80c2617f7afce558c8c94ed30722da9e2ad031195d457ea2002daa",
  "features/legal/website-43/Website43PrivacyPage.tsx": "98ac021713ff205b7915a2e41229e66fd4b7730fa64d7717494244ad1d807921",
  "features/legal/website-43/Website43CookiePolicyPage.tsx": "5963bcbfaf9d9e8a09ba2a83e411ff979d22e2e704f99100c6616a6d2b53d69f",
});

export function isWebsiteV5RetainedSource(file, source) {
  return Object.hasOwn(websiteV5RetainedSources, file) && sha(source) === websiteV5RetainedSources[file];
}

// Website v5 Phase B renderers that consume the public copy registry. Literal-source tests may read
// them with the same key -> default display substitution as the frozen owners (substitution only;
// they are new files with no frozen predecessor).
export const websiteV5RendererSources = Object.freeze([
  'features/ci-planning/v5/V5CiPlanning.tsx',
  'features/financial-health-check/v5/V5Fhc.tsx',
  'features/money-story/v5/V5MoneyStory.tsx',
  'features/legal/v5/V5Privacy.tsx',
  'features/legal/v5/V5CookiePolicy.tsx',
]);

// Website v5 Phase B render goldens for tests/production-cms-sameword.test.mjs (fixture render digests).
// `retained`: the 4.3 Home presentation (rollback target) after the countdown moved to its own v5
// stylesheet, compared after the original canonical-link inverse. `v5`: the tool/legal scopes now
// render the single v5 shell, so their b871 4.3 goldens are retired and these v5 digests take over.
export const websiteV5PhaseBRenderGoldens = Object.freeze({
  // BEGIN Phase B render goldens
  retained: { "1": "7e17f1d722bd21cfcecd08bf0e581bb91123972f9199b4dbf9694cfc9ffbe29a", "2": "82a8b9aee6ee57ace9bfb584aba0de0d70686689717df26a642fe9fc6fc8ee1a" },
  // 2026-10-25 (owner-approved, UAT): the v5 shell gains the merged LINE chat dock, the 3-state theme
  // toggle (D2) and the /tools/ hub links (T1), so the tool/legal v5 render digests move once more.
  // 2026-10-25 UX fixes (owner decisions, UAT): no eyebrows or hero kickers on the v5 tool/legal pages.
  // 2026-10-25 owner decisions (addendum, UAT): one LINE element per page (no header LINE button, the dock is a real
  // LINE link enhanced into the panel button, visible from load) and no gold closing band.
  v5: { "3": "b9d4893f6e4e0336f239e650dae4a81f5bf6262839e0440b95a1af8e64356b5e", "4": "de7ed1dadfb19f6fe05a9a0757b151f22cfeb8dfa4b3ad1f0efec5a35bdf9bd5", "8": "943dbbb2d5db0dba7987ed8d1efd95ed05ba6a3cfb60cc30c9d9c00a08293d55", "9": "83422f6f47eba8d6054b768c523897b1a7fe61ba85a06bd5c282ff03a62b943d", "10": "cb80925d40449911f7903342975591c13ad6764e885ce1f86d24ed5013561a72" },
  // END Phase B render goldens
});

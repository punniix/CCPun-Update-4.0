import {collisionCssPredecessor} from './v5-uat-collision-source-successor.mjs';
import { eyebrowPredecessor } from "./v5-eyebrow-proof.mjs";
import { createHash } from 'node:crypto';
import { qrEventPredecessor } from './v5-qr-event-proof.mjs';
import { inverseWebsiteV5C14Copy } from './website-v5-c14-successor.mjs';

// Website v5 Phase A (UAT prototype, branch codex/website-v5-uat-20261025).
// The owner asked for v5 to be built for test.ccpun.com review; this is NOT a
// Production design approval. Same style as the Admin v1 admission: each protected
// source the redesign touches passes only if it is byte-identical to the reviewed
// v5 result (or still the original). Historical digests and goldens stay frozen;
// they keep proving the unchanged Website 4.3 components that Phase B pages still use.
// Phase A/B: no SEO URL, canonical, redirect, sitemap, Sanity schema, analytics event or consent change.
// The 2026-10-25 LINE chat block below is the owner-approved exception (L5, L6, T1).
const sha = value => createHash('sha256').update(value).digest('hex');

// Owner-authorized 2026-10-28 investment CMS scope and its two regression registrations.
// Exact successor admission only; every historic source identity/golden stays frozen.
export const websiteV5InvestmentCopySuccessors = Object.freeze({
  "lib/content/public-copy-registry.ts": {
    "before": "058d180b6371c17a36a544c2d24efc0e56ed0047cbe27951fcf4cea5f377fbde",
    "after": "a66dde0f33997b85b770cf62affac3141b9384ac6edfe8a221eedc8ae1c9d981",
    "edits": [
      [
        "import { INVESTMENT_COPY_DEFAULTS } from \"./investment-copy-defaults\";\n",
        ""
      ],
      [
        "export const PUBLIC_COPY_SCOPES = { investment: { label: \"เครื่องมือกองทุน (หลักและ บลจ. เอไอเอ)\", pathname: \"/tools/investment-allocation/\", defaults: INVESTMENT_COPY_DEFAULTS }, ",
        "export const PUBLIC_COPY_SCOPES = { "
      ],
      [
        "export type PublicCopyKey = keyof typeof INVESTMENT_COPY_DEFAULTS | ",
        "export type PublicCopyKey = "
      ],
      [
        "const ALL_COPY_DEFAULTS = { ...INVESTMENT_COPY_DEFAULTS, ",
        "const ALL_COPY_DEFAULTS = { "
      ]
    ]
  },
  "package.json": {
    "before": "dc57359e3cc0090dba220a9b618d00998129493ab4efc3a2e26a49894691c2f9",
    "after": "ee01c010642677549828599e2351391b717de7ac8a7dbaabb09bdb324721c871",
    "edits": [
      [
        " tests/investment-saved-plan.test.ts",
        ""
      ],
      [
        " tests/investment-lazy-loading.test.mjs",
        ""
      ]
    ]
  },
  "lib/admin/public-copy-preview.ts": {
    "before": "9538b4faab828cf6919a573a0ae8a321a1c2ff43514117ee41ed9b465addc3f2",
    "after": "8107a83728ea3037bd01c2945e957e69b26c27caa2b41d37e1ef25471fe97494",
    "edits": [
      [
        "import \"server-only\";\nimport { INVESTMENT_ALLOCATION_ENABLED } from \"../runtime/investment-availability\";",
        "import \"server-only\";"
      ],
      [
        "  if (!Object.hasOwn(PUBLIC_COPY_SCOPES, scope)) notFound();\n  if (scope === \"investment\" && !INVESTMENT_ALLOCATION_ENABLED) notFound();",
        "  if (!Object.hasOwn(PUBLIC_COPY_SCOPES, scope)) notFound();"
      ],
      [
        "  const seoPage = getPageSeoPage(PUBLIC_COPY_SCOPES[contentScope].pathname);",
        "  const seoPage = getPageSeoPage(PUBLIC_COPY_SCOPES[contentScope].pathname)!;"
      ],
      [
        "    read(contentScope), read(\"site\"), seoPage ? sanityFetch({",
        "    read(contentScope), read(\"site\"), sanityFetch({"
      ],
      [
        "    }) : Promise.resolve({ data: null }),\n  ]);",
        "    }),\n  ]);"
      ],
      [
        "  return { copy, site, seo: seoPage ? { ...seoPage.defaults, ...Object.fromEntries(Object.entries(validatePageSeoFields(seo ?? {}, dataset)).filter(([, value]) => value)) } : null };",
        "  return { copy, site, seo: { ...seoPage.defaults, ...Object.fromEntries(Object.entries(validatePageSeoFields(seo ?? {}, dataset)).filter(([, value]) => value)) } };"
      ]
    ]
  },
  "features/investment-allocation/page.tsx": {
    "before": "2829ee263654eb3edeafaa8e1e4cb73b1a7b3b65af8476f99fc83c0065ef436b",
    "after": "0aa2a72bd590fadfd62fe1a7e9899839a05dfed871c3d0f1c170c261c94e2239",
    "edits": [
      [
        "import { publicCopyText, type PublicCopyValues } from \"@/lib/content/public-copy-registry\";",
        "import { publicCopyText } from \"@/lib/content/public-copy-registry\";"
      ],
      [
        "  const copy = await getPublicCopy(\"investment\");\n  return renderInvestmentAllocationPage(copy);\n}\n\nexport function renderInvestmentAllocationPage(copy: PublicCopyValues, siteCopy?: PublicCopyValues) {\n  if (!INVESTMENT_ALLOCATION_ENABLED) notFound();\n  const text = publicCopyText(copy);",
        "  const copy = await getPublicCopy(\"investment\");\n  const text = publicCopyText(copy);"
      ],
      [
        "    <PublicCopyProvider values={{ ...siteCopy, ...copy }}><V5Page current=\"/tools/investment-allocation/\" siteCopy={siteCopy}>",
        "    <PublicCopyProvider values={copy}><V5Page current=\"/tools/investment-allocation/\">"
      ]
    ]
  },
  "apps/admin/app/(control-plane)/content/website-preview/page.tsx": {
    "before": "1e700237c9e32b30da8d592db7d78afe58dc07f21e76390f2c023d814dbdcf4c",
    "after": "4845c4fcfc3e0fcf580404d10b3c7d605c94fda96282f884a8ff607c954b72e0",
    "edits": [
      [
        "import { renderMoneyStoryPage } from \"@/features/money-story/page\";\nimport { renderInvestmentAllocationPage } from \"@/features/investment-allocation/page\";",
        "import { renderMoneyStoryPage } from \"@/features/money-story/page\";"
      ],
      [
        "  const authorProfile = scope === \"investment\" ? null : await getPrimaryAuthorPreviewProfile();",
        "  const authorProfile = await getPrimaryAuthorPreviewProfile();"
      ],
      [
        "    case \"moneyStory\": content = await renderMoneyStoryPage(copy, site); break;\n    case \"investment\": content = renderInvestmentAllocationPage(copy, site); break;",
        "    case \"moneyStory\": content = await renderMoneyStoryPage(copy, site); break;"
      ],
      [
        "      {scope !== \"site\" && seo ? <Link href=",
        "      {scope !== \"site\" ? <Link href="
      ],
      [
        "      {seo ? <dl className=\"mt-3 space-y-2 text-sm\">",
        "      <dl className=\"mt-3 space-y-2 text-sm\">"
      ],
      [
        "</dd></div></dl> : null}",
        "</dd></div></dl>"
      ]
    ]
  },
  "cms/sanity/policy/studio-policy.ts": {
    "before": "4cad6a03bc5befd47ef77937952f4c3ee50d7eb83cb0acc897dcc66518c45a7d",
    "after": "204664c2af44789ef94b6affbb6ad884d4747964edaedf820375a7f42238ccde",
    "edits": [
      [
        "import { publicCopyDocumentId, type PublicCopyScope }",
        "import { PUBLIC_COPY_SCOPES, publicCopyDocumentId, type PublicCopyScope }"
      ],
      [
        "? [\"site\", \"home\", \"ci\", \"fhc\", \"blog\", \"privacy\", \"cookies\", \"moneyStory\"].some(scope => publicCopyDocumentId(scope as PublicCopyScope) === id)",
        "? Object.keys(PUBLIC_COPY_SCOPES).some(scope => publicCopyDocumentId(scope as PublicCopyScope) === id)"
      ]
    ]
  },
  "features/investment-allocation/InvestmentAllocation.module.css": {
    "before": "dd3a7b27c17e7e7fc1d1876a5f980c3619db44c043fc4bbba88d54dc13702724",
    "after": "05b29e203fbf4eda01a6d98d9e6986551f0ec5f3cfcccf4791faa453fb4cf995",
    "edits": [
      [
        "\n.handoffFallback{margin-top:1rem;max-width:100%;overflow-wrap:anywhere}.handoffFallback summary{cursor:pointer}.handoffFallback label{display:block;margin-top:.75rem}.handoffFallback textarea{box-sizing:border-box;width:100%;margin:.5rem 0;padding:.75rem;border:1px solid var(--w43-border);border-radius:.5rem;background:var(--w43-deep);color:inherit;font:inherit;resize:vertical}.handoffFallback textarea:focus-visible,.handoffFallback a:focus-visible{outline:2px solid currentColor;outline-offset:3px}\n",
        ""
      ]
    ]
  }
});

export function websiteV5InvestmentCopyPredecessor(file, source) {
  const entry = Object.hasOwn(websiteV5InvestmentCopySuccessors, file) ? websiteV5InvestmentCopySuccessors[file] : null;
  if (!entry || typeof source !== 'string' || sha(source) !== entry.after) return source;
  let result = source;
  for (const [current, original] of entry.edits) {
    if (result.split(current).length !== 2) return source;
    result = result.replace(current, original);
  }
  return sha(result) === entry.before ? result : source;
}

// These three frontend owners are digest-only C15 callers. Exact current-source
// admission retains their frozen pre-C15 digests without storing duplicate UI bodies.
export const websiteV5InvestmentC15DigestSuccessors = Object.freeze({
  "features/investment-allocation/aia-page.tsx": {
    "after": "7a786314b4fbbafd0db89c90a31783720391aea095e6b32ebde55c853049f570",
    "before": "8dcd774a64625d0614b73dfb4005bbf8123f9783f81186da8f6b29086e19ecca"
  },
  "features/investment-allocation/PortfolioBuilder.tsx": {
    "after": "5ca420bc6f98e557396a8801e3cdcba15f631eb4d351a887f5f02bf7138aa64d",
    "before": "4bd1e98487e3c8fe3b1d0f020582528eee4b172509633bed182074559b1c464d"
  },
  "features/investment-allocation/InvestmentAllocationTool.tsx": {
    "after": "f69688ce1f16116f80e87fe42402248b1ed5351f3b41f1be7a4bdaaffee4b194",
    "before": "576d5bcd5cb7ef30a7df81347e974bac588b8f5d0deefc81a851288aa2e912a4"
  }
});
export function websiteV5InvestmentC15Digest(file, source) {
  const entry = Object.hasOwn(websiteV5InvestmentC15DigestSuccessors, file) ? websiteV5InvestmentC15DigestSuccessors[file] : null;
  return entry && typeof source === 'string' && sha(source) === entry.after ? entry.before : null;
}

// Additive public-copy keys for new v5 UI labels (and the v5 test registration). Removing
// exactly these blocks reconstructs the frozen sources; existing keys and wording are untouched.
export const websiteV5CopyAdditions = Object.freeze({
  'lib/content/site-copy-defaults.ts': [[
    '  "site.extra.blogRecovery": "ดูบทความ",\n  "site.nav.topics": "หมวดความรู้",\n  "site.nav.allArticles": "บทความทั้งหมด",\n  "site.theme.toggle": "สลับโหมดสว่างและโหมดมืด",\n  "site.notFound.latestTitle": "บทความล่าสุด",\n  "site.campaign.unitDays": "วัน",\n  "site.campaign.unitHours": "ชั่วโมง",\n  "site.campaign.unitMinutes": "นาที",\n  "site.campaign.unitSeconds": "วินาที",\n',
    '  "site.extra.blogRecovery": "ดูบทความ",\n',
  ]],
  'lib/content/blog-copy-defaults.ts': [[
    '  "blog.dynamic5": "บทความ{0}",\n  "blog.startHere.title": "เริ่มอ่านที่นี่",\n  "blog.group.latest": "บทความล่าสุด",\n  "blog.group.count": "{0} บทความ",\n  "blog.group.viewAll": "ดูทั้งหมด →",\n  "blog.pager.label": "เลือกหน้าของ {0}",\n  "blog.pager.first": "« หน้าแรก",\n  "blog.pager.last": "หน้าสุดท้าย »",\n  "blog.pager.status": "หน้า {0} จาก {1}",\n  "blog.topicTools.title": "ลองเทียบความคุ้มครองที่มีอยู่กับภาระจริง",\n  "blog.topicTools.description": "เครื่องมือที่เกี่ยวกับหมวดนี้",\n  "blog.nextStep.eyebrow": "ขั้นต่อไป",\n  "blog.engagement.hearts": "ถูกใจ {0} ครั้ง"\n',
    '  "blog.dynamic5": "บทความ{0}"\n',
  ]],
  // The v5 regression suite joins test:public; nothing else in the manifest changes.
  'package.json': [[
    'node --import tsx tests/analytics-component-regression.mjs && node --import tsx --test tests/website-v5-regression.test.ts",',
    'node --import tsx tests/analytics-component-regression.mjs",',
  ], [
    // v5 extras (owner-approved 2026-10-25, UAT): the Coming Soon regression suite joins test:public.
    '"test:public": "node --conditions=react-server --import tsx --test tests/coming-soon-regression.test.ts && npm run audit:public-css && ',
    '"test:public": "npm run audit:public-css && ',
  ], [
    // C3 (owner brief 2026-10-26): exact pinned local encoder addition; every other dependency stays frozen.
    '    "next-sanity": "^13.3.3",\n    "qrcode-generator": "2.0.4",\n',
    '    "next-sanity": "^13.3.3",\n',
  ], [
    // The rendered-QR regression uses this exact dev-only decoder, never imported by product code.
    '    "jsdom": "^29.1.1",\n    "jsqr": "1.4.0",\n',
    '    "jsdom": "^29.1.1",\n',
  ]],
  // C3 exact lockfile additions: pinned metadata and placement, with no JSON normalisation.
  "package-lock.json": [
    ["        \"qrcode-generator\": \"2.0.4\",\n        \"react\": \"19.2.9\",\n        \"react-dom\": \"19.2.9\",\n        \"server-only\": \"0.0.1\",\n", "        \"react\": \"19.2.9\",\n        \"react-dom\": \"19.2.9\",\n        \"server-only\": \"0.0.1\",\n"],
    ["        \"qrcode-generator\": \"2.0.4\",\n        \"react\": \"19.2.9\",\n        \"react-dom\": \"19.2.9\",\n        \"sanity\": \"^6.13.1\",\n", "        \"react\": \"19.2.9\",\n        \"react-dom\": \"19.2.9\",\n        \"sanity\": \"^6.13.1\",\n"],
    ["        \"jsdom\": \"^29.1.1\",\n        \"jsqr\": \"1.4.0\",\n", "        \"jsdom\": \"^29.1.1\",\n"],
    ["    \"node_modules/jsqr\": {\n      \"version\": \"1.4.0\",\n      \"resolved\": \"https://registry.npmjs.org/jsqr/-/jsqr-1.4.0.tgz\",\n      \"integrity\": \"sha512-dxLob7q65Xg2DvstYkRpkYtmKm2sPJ9oFhrhmudT1dZvNFFTlroai3AWSpLey/w5vMcLBXRgOJsbXpdN9HzU/A==\",\n      \"dev\": true,\n      \"license\": \"Apache-2.0\"\n    },\n", ""],
    ["    \"node_modules/qrcode-generator\": {\n      \"version\": \"2.0.4\",\n      \"resolved\": \"https://registry.npmjs.org/qrcode-generator/-/qrcode-generator-2.0.4.tgz\",\n      \"integrity\": \"sha512-mZSiP6RnbHl4xL2Ap5HfkjLnmxfKcPWpWe/c+5XxCuetEenqmNFf1FH/ftXPCtFG5/TDobjsjz6sSNL0Sr8Z9g==\",\n      \"license\": \"MIT\"\n    },\n", ""],
  ],
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
  'blog.nextStep.eyebrow',
  // 2026-10-25 (owner-approved): screen-reader label for the heart count on v5 cards and the article header.
  'blog.engagement.hearts', 'home.coreGuides.title', 'home.latest.title', 'home.moneyStory.description', 'home.contactBand.title',
]);

/** Exact inverse of the additive copy keys; any other edit is left in place and still fails the frozen digest. */
export function websiteV5CopyPredecessor(file, source) {
  source = websiteV5InvestmentCopyPredecessor(file, source);
  const edits = Object.hasOwn(websiteV5CopyAdditions, file) ? websiteV5CopyAdditions[file] : null;
  if (!edits || typeof source !== 'string') return source;
  let result = inverseWebsiteV5C14Copy(file, source);
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
  // v5 motion smoothing (2026-10-26, UAT): shared motion tokens; the total bar slides with transform instead of a width
  // transition and the loading sheen moves with transform instead of background-position. The reviewed successor moves
  // from 41e9e934b1283037c7c1e0ae188c77991cff93d20419024b7f7c17efeb7565e4 to that exact file.
  "features/investment-allocation/InvestmentAllocation.module.css": { before: "ca66e94854d773d024f4fa66284a0f3dc14b2fa72b4836fcd3f3328ad4a45543", after: "3e885a27763cc7820159252395864c079a0ca4800f3372be1201ae6fbfeb8f20" },
  // END Phase B reviewed sources
  // Owner-approved 2026-10-25 (UAT): LINE chat button L5/L6 (additive analytics tokens, the CI result
  // oaMessage prefill without numbers, line_oa_click now owned by the app because GTM v9 paused the
  // lin.ee click tag), the new /tools/ hub sitemap entry (T1) and Money Story joining the tools sitemap
  // (v5 only). `before` is HEAD f2b163e2.
  // BEGIN LINE chat reviewed sources
  // 2026-10-25 (owner-approved, addendum 5): additive allowlisted `panel_trigger` (dock | article_cta) on line_chat_panel_open,
  // cleared on every semantic event like the other chat dimensions. No event or mapping is renamed.
  // Owner-approved 2026-10-25 (v5 extras, UAT): additive Coming Soon tokens (coming_soon_path, page_group coming_soon),
  // cleared in the semantic layer like every other dimension. Existing events and mappings are byte-identical.
  // v5 integration (2026-10-25): the reviewed successor is the merge of both additive sets (no other line differs).
  "lib/analytics.ts": { before: "4176646b29ae2614cc044fef35d9be7cdffe8cfb303c8519f86fe71c148cd90f", after: "534030c0144dd78e4c506a2c446d39c0746bda0cfc24ef6de1ccdb5d8be7dc67" },
  // AIA fund tool (2026-10-26, measurement decision delegated by the owner, UAT): the reviewed successor moves from
  // 8d615a8b3fb1dc2505c1c310e1a162b66895d0c8fc5a94a7c7ae314dedb66206 to the exact file whose only difference is
  // `|| path.startsWith('/tools/aia-fund-allocation')` in the existing 'tools' surface clause, so LINE clicks on
  // /tools/aia-fund-allocation/ emit the existing line_oa_click with surface_group 'tools' (no rename, consent unchanged).
  // tests/analytics-regression.ts removes exactly that clause and asserts the previous successor digest.
  "features/analytics/components/GoogleAnalytics.tsx": { before: "6379bb9a48584a748980f1163458150776410ce32d71c782bfd3529fdb295b6a", after: "ed528cd554a3a9be818ea399e65fd23ee2642e6ffe5008186e02ff01892a6a6e" },
  "features/ci-planning/calculator/constants.ts": { before: "ccdafe5526f8dfe32d129e6f74b0f574f07dbed3aa62d6fa3eb612ed44dbd9c9", after: "0228e217aa05ca1d10deb87f1806a97e6780c467fbcd82e6d77cec08ea78fbb1" },
  "features/ci-planning/components/result/CIResult.tsx": { before: "b7c793111a1d654e89dcaf1392daf6b3b0bc53f0f310569cab465bbccdc91f85", after: "7935271a76b7830b2b6003ebeb5cde6c862c228a6401333b64ed59dd7fd96dc9" },
  "apps/web/app/sitemaps/tools.xml/route.ts": { before: "d6f0a88e8e082af3045cd5a4b132241444d50164c9293ec36e647087993033f0", after: "3b01299e0789640a92a78e1d52566889db4da916b7083e4a7176182035d82851" },
  // END LINE chat reviewed sources
  // BEGIN motion reviewed sources
  // v5 motion round (owner-approved ideas #1, #2, #4, 2026-10-25, UAT only): the shared result comparison
  // animates transform/opacity once and counts the gap up while the final value stays accessible.
  // `before` is the reviewed source at d77acba8. v5 integration (2026-10-25): the gold gap uses the gold text token
  // (darker #7a5c14 in light mode, >= 3:1 against its track); the reviewed successor moves to that exact file.
  // v5 motion smoothing (2026-10-26, UAT): the figure becomes the reveal scope (a ref passed to useCountUp), so bars and
  // count wait until the comparison is on screen; no markup, copy or value changes. The reviewed successor moves from
  // 6c238ed0f748c1ce06015b82249e608d014240bbe93440f15acbef6c3b100d51 to that exact file.
  "components/ui/MoneyComparison.tsx": { before: "3f0c3a9229483df806297d5ab0bf45d7d83d4e158f1a995475a4dabccead5368", after: "84f82818c4503898b58643e111c69096ff1da26eb5ae4dc6e75c29867500ae73" },
  // END motion reviewed sources
  // C5 (owner-approved 2026-10-26): additive light-game surface/contrast and 14px captions.
  // The exact predecessor is reconstructed and mutated successors are rejected by money-story-theme.test.mjs.
  "features/money-story/MoneyStory.module.css": { before: "40b39bf243365a0888163b8a3b7dfc2d53f8a37fb92e5802f8fc12e167917a61", after: "47ae0b38b01009cc2a401813ba7b132796c621582f7f5cb53f44dfe12b1f67ca" },
});

// COO follow-up: improve only the disabled start/undo labels; retain the first C5 successor above.
export const websiteV5ReviewedSuccessors = Object.freeze({
  // 2026-10-27 owner UAT favicon fix, independently reviewed: only review icon URLs and homepage inheritance.
  // Both prior v5 pins above stay frozen; Production defaults and every other source byte are unchanged.
  "apps/web/app/layout.tsx": { before: "9a7dceb0615ae610ecafe80a0937547b9a6c6c8b422688e443ba763970cc3ab8", after: "d15ab8359a133b8ebc652128d40dc83b3b1a4c0da1b16d0c11c5cf536076afca" },
  "apps/web/app/page.tsx": { before: "8869beb97ac0043193080c85a88b8c2374823f80874c2afee49259c0a1c3acbc", after: "ef7e9e628f4f1db0666cbf282115f3b339dee8088511731d008f481bcbe1c76d" },
  "features/money-story/MoneyStory.module.css": { before: "47ae0b38b01009cc2a401813ba7b132796c621582f7f5cb53f44dfe12b1f67ca", after: "db5fd882cf020f0d5292901f4020d1445765505dd4ca63e7b15ce5a81a471b39" },
});

// C6 (owner-approved 2026-10-26): exact result-CTA successors only. Engines, exports, and all prior pins stay frozen.
export const websiteV5ResultLineSources = Object.freeze({
  "features/ci-planning/components/result/CIResult.tsx": { before: "7935271a76b7830b2b6003ebeb5cde6c862c228a6401333b64ed59dd7fd96dc9", after: "c8480aedfb87812afbd42c67d5a246b163f3c3e4f99937835f41f04d9c623de0" },
  "features/financial-health-check/components/LifeCoverageWizard.tsx": { before: "9238203d154b3d296a78e4bfefb4f3d9bb31a491b0a05ba339d4417a7df6caa1", after: "6283ac485db757f6b6f2837f8d99e517fda372a037dc3afe9c386e4c3d1d2c43" },
});

// C8 (owner-approved 2026-10-26): decorative result tick only. All C6 pins remain frozen.
export const websiteV5MotionSources = Object.freeze({
  'features/ci-planning/components/result/CIResult.tsx': { before: 'c8480aedfb87812afbd42c67d5a246b163f3c3e4f99937835f41f04d9c623de0', after: 'd52e93f39f48b7ea7a2b43d0164b7c6baa6c9e558ff14c25a245695c830a1aac' },
  'features/financial-health-check/components/LifeCoverageWizard.tsx': { before: '6283ac485db757f6b6f2837f8d99e517fda372a037dc3afe9c386e4c3d1d2c43', after: '88e6dddd92a860dbde4f00b9ad9ed127964c1a60b0d8b23ed872adc05e258814' },
});

/** Digest the frozen proofs should compare: the reviewed predecessor for an exact v5 successor, else the file's own digest. */
export function websiteV5PredecessorDigest(file, source) {
  source = websiteV5InvestmentCopyPredecessor(file, source);
  source = collisionCssPredecessor(file, source);
  const restored = websiteV5CopyPredecessor(file, qrEventPredecessor(file, eyebrowPredecessor(file, source)));
  const current = sha(restored);
  const successor = Object.hasOwn(websiteV5ReviewedSuccessors, file) ? websiteV5ReviewedSuccessors[file] : null;
  const digest = successor && current === successor.after ? successor.before : current;
  const entry = Object.hasOwn(websiteV5PhaseASources, file) ? websiteV5PhaseASources[file] : null;
  return entry && digest === entry.after ? entry.before : digest;
}

export function isWebsiteV5ReviewedSuccessor(file, source) {
  source = websiteV5InvestmentCopyPredecessor(file, source);
  source = collisionCssPredecessor(file, source);
  source = qrEventPredecessor(file, eyebrowPredecessor(file, source));
  const motion = Object.hasOwn(websiteV5MotionSources, file) ? websiteV5MotionSources[file] : null;
  if (motion && motion.before === websiteV5ResultLineSources[file]?.after && sha(source) === motion.after) return true;
  const result = Object.hasOwn(websiteV5ResultLineSources, file) ? websiteV5ResultLineSources[file] : null;
  if (result && sha(source) === result.after) return true;
  const entry = Object.hasOwn(websiteV5PhaseASources, file) ? websiteV5PhaseASources[file] : null;
  const successor = Object.hasOwn(websiteV5ReviewedSuccessors, file) ? websiteV5ReviewedSuccessors[file] : null;
  return Boolean(entry) && (sha(source) === entry.after || Boolean(successor) && successor.before === entry.after && sha(source) === successor.after);
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
  // v5 polish (UAT, 2026-10-25): FHC (4) and Money Story (10) guide cards carry the count-aware cover `sizes`
  // from components/layout/v5/card-sizes.ts; that attribute is the only render difference, so both digests move once.
  // LINE chat dock fix (owner bug 2026-10-26, UAT): the dock and its panel render inside one chat-layer wrapper
  // (<div class="layer" data-v5-chat-layer="">, display: contents) so the cookie notice's inert boundary can skip
  // it; that wrapper is the only render difference (previous digests b9d4893f, 78a2a35a, 943dbbb2, 83422f6f,
  // 65c25c36 reproduce exactly without it), so all five digests move once.
  // LINE chat per page (owner decisions 2026-10-26, UAT): the dock's no-JS LINE href loses the visible
  // "(รหัส XX01)" code and tool pages gain the natural source sentence ("ใช้เครื่องมือ...มาครับ"). That one
  // href is the only render difference: putting the previous href back reproduces 05ca798a, 4c8e845d,
  // f83f0b1a, 83edfb57 and 0271715d exactly, so all five digests move once.
  v5: { "3": "03a1a395a7cee5b3f560b8b2df290309589292931f5e735f66fbb532a025a503", "4": "1195bb0ba17c93e06a75ff2c71ea0ec42852fe66e4d01749a12284f068a4dd6f", "8": "6d13f0d686028bd55d1c07c244c595720baac42449796761e04eac202a7872a8", "9": "867ce47566f483595627e0f8feae9895d4fb99649f0f32d9af3d903c6390c902", "10": "4ac66d0de94c24351a396db99317bf0117d08d36f74ecb68ca0c7ab84d74ad58" },
  // END Phase B render goldens
});

// C11 (owner-approved 2026-10-26): the simpler mobile menu and direct theme controls change
// only the exact shared header. Keep every Phase B golden above unchanged. The inverse first
// admits a complete pinned default render, replaces one exact pinned header, then rechecks
// the complete predecessor digest. Non-default CMS renders never pass through this inverse.
export const websiteV5C11RenderSuccessors = Object.freeze({
  fixtureSha256: "bf4223a6c3bab77f8db9c79ed1c0b437c3d884e1b6f4facd4c2bfe5cf528dd7b",
  renders: Object.freeze({
    "3": Object.freeze({"before": "03a1a395a7cee5b3f560b8b2df290309589292931f5e735f66fbb532a025a503","after": "61f1a6e85d6de01def25c36d6f709ab5142bc065c2a93007d2634aba1792858b"}),
    "4": Object.freeze({"before": "1195bb0ba17c93e06a75ff2c71ea0ec42852fe66e4d01749a12284f068a4dd6f","after": "c612b43c9aec116d8427c993b68ded550655253115777f7df9f9aaa0893c2266"}),
    "8": Object.freeze({"before": "6d13f0d686028bd55d1c07c244c595720baac42449796761e04eac202a7872a8","after": "cff0f55cff146bd4800fd8e6e82c0c3926f17382c5c2dd9d2e10e6cab3ff60be"}),
    "9": Object.freeze({"before": "867ce47566f483595627e0f8feae9895d4fb99649f0f32d9af3d903c6390c902","after": "e7bda04b3c68389e400271ee67907dec911a952f1c9f3017969cd592f0fad2b5"}),
    "10": Object.freeze({"before": "4ac66d0de94c24351a396db99317bf0117d08d36f74ecb68ca0c7ab84d74ad58","after": "5a9bc4a67ff1b84deb3c70627b45031c01733cde02d303ed10e504a5f880893f"}),
  }),
});

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const sha = value => createHash('sha256').update(value).digest('hex');
// Exact authenticated text-preview bridge -> active Admin568; all historic Admin ops/planning proof identities remain frozen.
// Only complete owned successor bytes may reconstruct their predecessor. Unknown inputs remain rejecting inputs.
export const adminCmsBridgePins = Object.freeze({
  "apps/admin/app/(control-plane)/content/website-preview/page.tsx": {
    "before": "0ebaa9b82cea9fe6d71239970431a9cd460b03ebbaec300596e5317201c3f256",
    "after": "cb0673fabda0ba4f415beecb70c5bfcae0836c22201a12b7a2beedc6d60357ea",
    "edits": [
      [
        112,
        "import V5Home from \"@/features/home/v5/V5Home\";\n",
        "import Website43Home from \"@/features/home/website-43/Website43Home\";\n"
      ],
      [
        611,
        "import { renderInvestmentAllocationContent } from \"@/features/investment-allocation/page\";\nimport { renderAboutPage } from \"@/features/about/page\";\nimport { renderToolsHubPage } from \"@/features/tools-hub/page\";\n",
        ""
      ],
      [
        1039,
        "import { PUBLIC_COPY_SCOPES, publicCopyDocumentId, isPublicCopyScopeAvailable, type PublicCopyScope } from \"@/lib/content/public-copy-registry\";\n",
        "import { PUBLIC_COPY_SCOPES, publicCopyDocumentId, type PublicCopyScope } from \"@/lib/content/public-copy-registry\";\n"
      ],
      [
        1710,
        "  const { copy, site, home, dataset, seo } = await getPublicCopyPreview(scope);\n  const authorProfile = scope === \"site\" || scope === \"home\" || scope === \"about\" ? await getPrimaryAuthorPreviewProfile() : null;\n",
        "  const { copy, site, seo } = await getPublicCopyPreview(scope);\n  const authorProfile = await getPrimaryAuthorPreviewProfile();\n"
      ],
      [
        1972,
        "    case \"site\": case \"home\": content = <V5Home authorProfile={authorProfile} copy={copy} siteCopy={site} />; break;\n",
        "    case \"site\": case \"home\": content = <Website43Home authorProfile={authorProfile} copy={copy} siteCopy={site} />; break;\n"
      ],
      [
        2589,
        "    case \"investment\": content = renderInvestmentAllocationContent(copy, site); break;\n    case \"about\": content = await renderAboutPage(copy, site, home, authorProfile); break;\n    case \"toolsHub\": content = await renderToolsHubPage(copy, site, home, true); break;\n",
        ""
      ],
      [
        3223,
        "      <nav aria-label=\"เลือกหน้าตัวอย่าง\" className=\"mt-3 flex flex-wrap gap-3\">{Object.entries(PUBLIC_COPY_SCOPES).filter(([value]) => isPublicCopyScopeAvailable(value, dataset)).map(([value, config]) => <Link key={value} href={`/content/website-preview/${value}/`} aria-current={scope === value ? \"page\" : undefined} className=\"inline-flex min-h-11 items-center underline\">{config.label}</Link>)}</nav>\n",
        "      <nav aria-label=\"เลือกหน้าตัวอย่าง\" className=\"mt-3 flex flex-wrap gap-3\">{Object.entries(PUBLIC_COPY_SCOPES).map(([value, config]) => <Link key={value} href={`/content/website-preview/${value}/`} aria-current={scope === value ? \"page\" : undefined} className=\"inline-flex min-h-11 items-center underline\">{config.label}</Link>)}</nav>\n"
      ],
      [
        3774,
        "      {scope !== \"site\" && seo ? <Link href={`/content/website-preview/seo-${scope}/`} className=\"inline-flex min-h-11 items-center underline\">แก้ SEO พร้อมดูหน้าเว็บไซต์</Link> : null}\n",
        "      {scope !== \"site\" ? <Link href={`/content/website-preview/seo-${scope}/`} className=\"inline-flex min-h-11 items-center underline\">แก้ SEO พร้อมดูหน้าเว็บไซต์</Link> : null}\n"
      ],
      [
        4138,
        "      {seo ? <dl className=\"mt-3 space-y-2 text-sm\"><div><dt>SEO Title</dt><dd>{seo.seoTitle}</dd></div><div><dt>Meta Description</dt><dd>{seo.seoDescription}</dd></div><div><dt>OG Title</dt><dd>{seo.ogTitle}</dd></div><div><dt>OG Description</dt><dd>{seo.ogDescription}</dd></div></dl> : null}\n",
        "      <dl className=\"mt-3 space-y-2 text-sm\"><div><dt>SEO Title</dt><dd>{seo.seoTitle}</dd></div><div><dt>Meta Description</dt><dd>{seo.seoDescription}</dd></div><div><dt>OG Title</dt><dd>{seo.ogTitle}</dd></div><div><dt>OG Description</dt><dd>{seo.ogDescription}</dd></div></dl>\n"
      ],
      [
        4446,
        "    <PublicCopyProvider values={{ ...site, ...home, ...copy }}>{content}</PublicCopyProvider>\n",
        "    <PublicCopyProvider values={{ ...site, ...copy }}>{content}</PublicCopyProvider>\n"
      ]
    ]
  },
  "cms/sanity/config/presentation.ts": {
    "before": "0126cf3c9839119ef6c3da5ce70b54d468a97c27fe315c01581790807f92b53a",
    "after": "af63ff44c54a204880a488ff7698a6c4cdeeaf6b2a74aa6f6f1dd239c8c5e16c",
    "edits": [
      [
        73,
        "import { PUBLIC_COPY_SCOPES, publicCopyDocumentId, isPublicCopyScopeAvailable, type PublicCopyScope } from \"../../../lib/content/public-copy-registry\";\n",
        "import { PUBLIC_COPY_SCOPES, publicCopyDocumentId, type PublicCopyScope } from \"../../../lib/content/public-copy-registry\";\n"
      ],
      [
        299,
        "export function createStudioPresentationPlugin(dataset: string) {\n",
        "export function createStudioPresentationPlugin() {\n"
      ],
      [
        996,
        "          if (!isPublicCopyScopeAvailable(scope, dataset)) return undefined;\n",
        "          if (!Object.hasOwn(PUBLIC_COPY_SCOPES, scope)) return undefined;\n"
      ],
      [
        1936,
        "            const valid = typeof scope === \"string\" && isPublicCopyScopeAvailable(scope, dataset)\n",
        "            const valid = typeof scope === \"string\" && Object.hasOwn(PUBLIC_COPY_SCOPES, scope)\n"
      ],
      [
        2652,
        "            const scope = Object.entries(PUBLIC_COPY_SCOPES).find(([scope, config]) => scope !== \"site\" && isPublicCopyScopeAvailable(scope, dataset) && config.pathname === document?.pathname)?.[0];\n",
        "            const scope = Object.entries(PUBLIC_COPY_SCOPES).find(([scope, config]) => scope !== \"site\" && config.pathname === document?.pathname)?.[0];\n"
      ]
    ]
  },
  "cms/sanity/config/structure.ts": {
    "before": "f859fcdd9c57fb9b36a27a3f16084ccb38d8e2716f6065512363993f3d78f61f",
    "after": "0cd75fbf696799454bca247e2eb6a13a20f5de9403332a82aa21e20d39136c1f",
    "edits": [
      [
        0,
        "import { PUBLIC_COPY_SCOPES, publicCopyDocumentId, isPublicCopyScopeAvailable } from \"../../../lib/content/public-copy-registry\";\n",
        "import { PUBLIC_COPY_SCOPES, publicCopyDocumentId } from \"../../../lib/content/public-copy-registry\";\n"
      ],
      [
        5598,
        "function publicPagesWorkspace(S: StructureBuilder, dataset: string) {\n",
        "function publicPagesWorkspace(S: StructureBuilder) {\n"
      ],
      [
        5835,
        "      ...Object.entries(PUBLIC_COPY_SCOPES).filter(([scope]) => isPublicCopyScopeAvailable(scope, dataset)).map(([scope, config]) => S.listItem().id(`copy-${scope}`).title(config.label)\n",
        "      ...Object.entries(PUBLIC_COPY_SCOPES).map(([scope, config]) => S.listItem().id(`copy-${scope}`).title(config.label)\n"
      ],
      [
        7915,
        "          ...(hasPublicCopy ? [publicPagesWorkspace(S, context.dataset)] : []),\n",
        "          ...(hasPublicCopy ? [publicPagesWorkspace(S)] : []),\n"
      ]
    ]
  },
  "cms/sanity/policy/studio-policy.ts": {
    "before": "4cad6a03bc5befd47ef77937952f4c3ee50d7eb83cb0acc897dcc66518c45a7d",
    "after": "6b76938f6a473ebda335d14f9931aa82b3d6a505fa9735b3cd09d2f3f430c39c",
    "edits": [
      [
        55,
        "import { PRODUCTION_PUBLIC_COPY_SCOPES, publicCopyDocumentId } from \"../../../lib/content/public-copy-registry\";\n",
        "import { PUBLIC_COPY_SCOPES, publicCopyDocumentId, type PublicCopyScope } from \"../../../lib/content/public-copy-registry\";\n"
      ],
      [
        6890,
        "        ? PRODUCTION_PUBLIC_COPY_SCOPES.some(scope => publicCopyDocumentId(scope) === id)\n",
        "        ? Object.keys(PUBLIC_COPY_SCOPES).some(scope => publicCopyDocumentId(scope as PublicCopyScope) === id)\n"
      ]
    ]
  },
  "sanity.config.ts": {
    "before": "25dc55df26c71146de1a8fa6517ae4526dda23f6531ce54d272aa61c41a1a25f",
    "after": "44ae9c4ad7583e2be1a1ca94a111fdbd13d19e5c2a0cfc538ae22e5fb8c87f57",
    "edits": [
      [
        2578,
        "          createStudioPresentationPlugin(dataset),\n",
        "          createStudioPresentationPlugin(),\n"
      ]
    ]
  },
  "lib/admin/public-copy-preview.ts": {
    "before": "9538b4faab828cf6919a573a0ae8a321a1c2ff43514117ee41ed9b465addc3f2",
    "after": "08f1737857833796f02404adb8a38a671d157abc59a564fae23f4c7125c32498",
    "edits": [
      [
        266,
        "import { PUBLIC_COPY_SCOPES, isPublicCopyScopeAvailable, parsePublicCopy, publicCopyDocumentId, type PublicCopyScope } from \"../content/public-copy-registry\";\n",
        "import { PUBLIC_COPY_SCOPES, parsePublicCopy, publicCopyDocumentId, type PublicCopyScope } from \"../content/public-copy-registry\";\n"
      ],
      [
        2274,
        "  if (!isPublicCopyScopeAvailable(scope, dataset)) notFound();\n",
        "  if (!Object.hasOwn(PUBLIC_COPY_SCOPES, scope)) notFound();\n"
      ],
      [
        2813,
        "  const seoPage = getPageSeoPage(PUBLIC_COPY_SCOPES[contentScope].pathname);\n  const [copy, site, home, { data: seo }] = await Promise.all([\n    read(contentScope), read(\"site\"),\n    contentScope === \"about\" || contentScope === \"toolsHub\" ? read(\"home\") : Promise.resolve(undefined), seoPage ? sanityFetch({\n",
        "  const seoPage = getPageSeoPage(PUBLIC_COPY_SCOPES[contentScope].pathname)!;\n  const [copy, site, { data: seo }] = await Promise.all([\n    read(contentScope), read(\"site\"), sanityFetch({\n"
      ],
      [
        3356,
        "    }) : Promise.resolve({ data: null }),\n",
        "    }),\n"
      ],
      [
        3404,
        "  return { copy, site, home, dataset, seo: seoPage ? { ...seoPage.defaults, ...Object.fromEntries(Object.entries(validatePageSeoFields(seo ?? {}, dataset)).filter(([, value]) => value)) } : null };\n",
        "  return { copy, site, seo: { ...seoPage.defaults, ...Object.fromEntries(Object.entries(validatePageSeoFields(seo ?? {}, dataset)).filter(([, value]) => value)) } };\n"
      ]
    ]
  },
  "package.json": {
    "before": "693a3a91c85d03f49b0a57d30ad9c5f25581f1756c56fb8120ed1a92dc1b4ba1",
    "after": "3c218cd4e881ae396ef3c3f45ad155e542f31d4a388a812c015e2ebe60910cec",
    "edits": [
      [
        2924,
        "    \"test:foundation-contracts\": \"node tests/foundation-safety-regression.mjs && node tests/search-intent-owner-regression.mjs && node --test tests/root-runtime-owner-migration.test.mjs tests/production-code-only-parity.test.mjs tests/website43-runtime-refactor-parity.test.mjs tests/money-story-presentation-parity.test.mjs tests/public-foundation-css-parity.test.mjs tests/web-foundation-config-parity.test.mjs tests/money-story-engine-parity.test.mjs && node --test tests/phase1-source-ownership.test.mjs tests/phase1-admin-api-parity.test.mjs tests/phase1-admin-boundary-parity.test.mjs tests/phase1-source-reader.test.mjs tests/phase2-css-delivery-parity.test.mjs tests/phase3-native-provider-parity.test.mjs tests/hostinger-native-app-contract.test.mjs && node --test tests/phase3-admin-contracts.test.mjs && node --test tests/phase3-admin-native-boundaries.test.mjs && node --test tests/production-cms-sameword.test.mjs && node --test tests/v5-public-copy-pages.test.mjs\",\n",
        "    \"test:foundation-contracts\": \"node tests/foundation-safety-regression.mjs && node tests/search-intent-owner-regression.mjs && node --test tests/root-runtime-owner-migration.test.mjs tests/production-code-only-parity.test.mjs tests/website43-runtime-refactor-parity.test.mjs tests/money-story-presentation-parity.test.mjs tests/public-foundation-css-parity.test.mjs tests/web-foundation-config-parity.test.mjs tests/money-story-engine-parity.test.mjs && node --test tests/phase1-source-ownership.test.mjs tests/phase1-admin-api-parity.test.mjs tests/phase1-admin-boundary-parity.test.mjs tests/phase1-source-reader.test.mjs tests/phase2-css-delivery-parity.test.mjs tests/phase3-native-provider-parity.test.mjs tests/hostinger-native-app-contract.test.mjs && node --test tests/phase3-admin-contracts.test.mjs && node --test tests/phase3-admin-native-boundaries.test.mjs && node --test tests/production-cms-sameword.test.mjs\",\n"
      ],
      [
        9077,
        "    \"zod\": \"^4.6.6\",\n    \"qrcode-generator\": \"2.0.4\"\n",
        "    \"zod\": \"^4.6.6\"\n"
      ]
    ]
  },
  "package-lock.json": {
    "before": "59d7d468cbdec96e0f40652a9f7f630d497079336e063d9cc6f892848cc7d8cf",
    "after": "475a21316081062617e2ab6b7a9943889f5ad189f73640fe4411f3e8965c63bf",
    "edits": [
      [
        820,
        "        \"zod\": \"^4.6.6\",\n        \"qrcode-generator\": \"2.0.4\"\n",
        "        \"zod\": \"^4.6.6\"\n"
      ],
      [
        916637,
        "    },\n    \"node_modules/qrcode-generator\": {\n      \"version\": \"2.0.4\",\n      \"resolved\": \"https://registry.npmjs.org/qrcode-generator/-/qrcode-generator-2.0.4.tgz\",\n      \"integrity\": \"sha512-mZSiP6RnbHl4xL2Ap5HfkjLnmxfKcPWpWe/c+5XxCuetEenqmNFf1FH/ftXPCtFG5/TDobjsjz6sSNL0Sr8Z9g==\",\n      \"license\": \"MIT\"\n",
        ""
      ]
    ]
  },
  "components/styles/public-compat.css": {
    "before": "26df4425126d938e5b49f0d8f3345e63aabf9e60383a03dadb2f93ae71d7861b",
    "after": "de98ab1d4534a3fa45c66863e2966f9d378ea0c46fb92c460c0f87827e403909",
    "edits": [
      [
        3548,
        "",
        "\n  .section-divider {\n    @apply w-20 h-1 mx-auto rounded-full;\n    background: linear-gradient(90deg, transparent, hsl(42,50%,55%), transparent);\n  }\n"
      ]
    ]
  },
  "components/layout/website-43/Website43.module.css": {
    "before": "973eed337a31212f28ee1210327773568a8534b6d85142ade317872ac7e49b6d",
    "after": "68c527fc5fd23613dfd14a755773c91d3547d6baca3a46693ac22bf12cd28930",
    "edits": [
      [
        15524,
        "",
        ".articleReadingTime { display: flex; flex-wrap: wrap; gap: 8px 16px; color: var(--w43-muted); font-size: 14px; line-height: 22px; }\n.articleReadingTime > span { white-space: nowrap; }\n.articleReadingTime b { color: var(--w43-ink); font-weight: 500; }\n"
      ],
      [
        17033,
        "",
        "  .articleReadingEstimate { flex-basis: 100%; }\n"
      ],
      [
        21408,
        "",
        ".toolHeroReadabilityOverlay { position: absolute; z-index: 2; inset: 0; pointer-events: none; background: linear-gradient(90deg,rgba(6,11,9,.94) 0%,rgba(6,11,9,.86) 36%,rgba(6,11,9,.56) 58%,rgba(6,11,9,.12) 82%,rgba(6,11,9,0) 100%); }\n"
      ],
      [
        21865,
        "",
        ".toolTitleGold { color: var(--w43-gold); }\n"
      ],
      [
        22238,
        "",
        ".toolDisclaimer { margin: 24px 0 0; color: var(--w43-muted); font-size: 14px; line-height: 1.65; }\n.toolProjectRecognition { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--w43-border); }\n.toolProjectRecognitionCopy { margin: 0; color: var(--w43-muted); font-size: 14px; line-height: 1.6; }\n.toolProjectRecognitionLink { display: inline-flex; flex: 0 0 auto; border-radius: 10px; }\n.toolProjectRecognitionLink img { display: block; width: auto; height: 48px; }\n.toolProjectRecognitionLink:focus-visible { outline: 2px solid var(--w43-gold); outline-offset: 4px; }\n.toolInlineLink { color: var(--w43-gold) !important; text-decoration: underline !important; text-underline-offset: 4px; }\n.truthGrid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 12px; margin-top: 24px; }\n.truth { min-height: 180px; padding: 20px; border: 1px solid rgba(91,72,72,.5); border-radius: 14px; background: rgba(74,58,58,.16); }\n.truthNum { color: rgba(224,201,133,.7); font-size: 20px; font-weight: 700; }\n.truth h3 { margin: 14px 0 0; font-size: 20px; line-height: 1.4; }\n.truth p { color: var(--w43-muted); font-size: 15px; line-height: 1.6; }\n.toolMethodGrid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 16px; margin-top: 28px; }\n.toolMethodItem { padding: 20px; border: 1px solid rgba(91,72,72,.6); border-radius: 14px; background: rgba(74,58,58,.16); }\n.toolMethodItem h3 { margin: 0; color: var(--w43-ink); font-size: 20px; font-weight: 600; line-height: 1.4; }\n.toolMethodItem p { margin: 10px 0 0; color: var(--w43-muted); font-size: 15px; line-height: 1.6; }\n.methodBox { display: flex; flex-direction: column; gap: 12px; margin-top: 40px; padding: 28px; border: 1px solid var(--w43-border); border-radius: 18px; background: rgba(74,58,58,.28); }\n.methodBox h3 { margin: 8px 0 0; font-size: 26px; }\n.methodBox p { margin: 0; color: var(--w43-muted); font-size: 16px; line-height: 1.65; }\n.methodBox p + p { margin-top: 12px; }\n.toolFaq { margin-top: 48px; }\n.toolFaqStandalone { margin-top: 0; }\n.toolStorySection[aria-labelledby=\"ci-reading-title\"] .faqDetails { margin-top: 24px; }\n.faqDetails { border-block: 1px solid rgba(91,72,72,.7); }\n.faqDetails details { border-bottom: 1px solid rgba(91,72,72,.55); }\n.faqDetails details:last-child { border-bottom: 0; }\n.faqDetails summary { min-height: 64px; display: flex; align-items: center; padding: 20px 0 12px; cursor: pointer; color: var(--w43-ink); font-size: 16px; font-weight: 600; line-height: 1.5; list-style: none; }\n.faqDetails summary::-webkit-details-marker { display: none; }\n.faqDetails p { margin: 0; padding: 4px 0 30px; color: var(--w43-muted); font-size: 15px; line-height: 1.7; }\n"
      ],
      [
        22378,
        "",
        ".fhcIntroCompact { padding-bottom: 12px; }\n.fhcContextSection { padding-top: 48px; }\n"
      ],
      [
        22453,
        "",
        ".calculatorHeader { width: min(768px,100%); margin: 0 auto 28px; text-align: center; }\n.calculatorHeader h2 { margin: 8px 0 0; font-size: 30px; line-height: 1.3; text-wrap: balance; }\n.calculatorWord { white-space: nowrap; }\n.calculatorHeader p { margin: 8px 0 0; color: var(--w43-muted); font-size: 15px; }\n.calculatorStage { width: min(768px,100%); margin: 0 auto; }\n.calculatorStage :global([data-ui=\"human-centered-ci-expenses\"] .text-xs),\n.calculatorStage :global([data-ui=\"human-centered-ci-resources\"] .text-xs) { font-size: 14px; }\n.calculatorStage :global(.glass-card) { border-color: var(--w43-border); background: var(--w43-surface); box-shadow: none; }\n.calculatorStage :global(.gold-button) { border: 1px solid var(--w43-gold); border-radius: 12px; background: var(--w43-gold); background-image: none; color: var(--w43-deep); box-shadow: none; }\n.calculatorStage :global(.gold-button:hover) { background: var(--w43-gold-bright); box-shadow: none; transform: none; }\n.calculatorStage :global(.glass-button) { border: 1px solid var(--w43-gold); border-radius: 12px; background: transparent; color: var(--w43-gold); box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; }\n.calculatorStage :global(.glass-button:hover) { border-color: var(--w43-gold-bright); background: rgba(224,201,133,.06); color: var(--w43-gold-bright); box-shadow: none; transform: none; }\n.calculatorStage :global(.ccpun-calculator-result) { width: min(704px,100%); margin: 0 auto; display: flex; flex-direction: column; gap: 20px; color: var(--w43-ink); }\n.calculatorStage :global(.ccpun-calculator-result-lead) { padding: 24px; border: 1px solid var(--w43-border); border-radius: 14px; background: var(--w43-surface); }\n.calculatorStage :global(.ccpun-calculator-result-eyebrow) { margin: 0; color: var(--w43-gold); font-size: 12px; font-weight: 600; line-height: 1.45; }\n.calculatorStage :global(.ccpun-calculator-result-title) { margin: 8px 0 0; color: var(--w43-ink); font-size: 30px; font-weight: 600; line-height: 1.3; }\n.calculatorStage :global(.ccpun-calculator-result-amount) { display: block; margin-top: 12px; color: var(--w43-gold); font-size: 44px; font-weight: 600; line-height: 1.15; font-variant-numeric: tabular-nums; }\n.calculatorStage :global(.ccpun-calculator-result-amount) small { font-size: 17px; font-weight: 500; }\n.calculatorStage :global(.ccpun-calculator-result-body) { margin: 14px 0 0; color: var(--w43-muted); font-size: 14px; line-height: 1.65; }\n.calculatorStage :global(.ccpun-calculator-result-panel) { padding: 20px; border: 1px solid rgba(91,72,72,.72); border-radius: 14px; background: rgba(74,58,58,.18); }\n.calculatorStage :global(.ccpun-calculator-result-difference) { font-size: clamp(22px,5vw,30px); line-height: 1.25; }\n.calculatorStage :global(.ccpun-calculator-result-panel-title) { margin: 0; color: var(--w43-ink); font-size: 18px; font-weight: 600; line-height: 1.45; }\n.calculatorStage :global(.ccpun-calculator-result-rows) { border-block: 1px solid var(--w43-border); }\n.calculatorStage :global(.ccpun-calculator-result-breakdown) { margin: 0; border: 0; }\n.calculatorStage :global(.ccpun-calculator-result-row) { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 14px 0; border-bottom: 1px solid rgba(91,72,72,.65); }\n.calculatorStage :global(.ccpun-calculator-result-row:last-child) { border-bottom: 0; }\n.calculatorStage :global(.ccpun-calculator-result-row) dt { color: var(--w43-muted); font-size: 14px; line-height: 1.5; }\n.calculatorStage :global(.ccpun-calculator-result-row) dd { margin: 0; color: var(--w43-ink); font-size: 15px; font-weight: 500; font-variant-numeric: tabular-nums; text-align: right; }\n.calculatorStage :global(.ccpun-calculator-result-breakdown .ccpun-calculator-result-row) dd { white-space: nowrap; }\n.calculatorStage :global(.ccpun-calculator-result-notice) { padding: 16px 18px; border: 1px solid rgba(91,72,72,.65); border-radius: 12px; background: rgba(37,24,24,.34); color: var(--w43-muted); font-size: 13px; line-height: 1.65; }\n.calculatorStage :global(.ccpun-calculator-result-cta) { padding: 22px; border: 1px solid var(--w43-border); border-radius: 14px; background: var(--w43-deep); text-align: center; }\n.calculatorStage :global(.ccpun-calculator-result-cta) h3 { margin: 14px 0 0; color: var(--w43-ink); font-size: 18px; font-weight: 600; }\n.calculatorStage :global(.ccpun-calculator-result-cta) p { margin: 6px 0 0; color: var(--w43-muted); font-size: 14px; line-height: 1.6; }\n.calculatorStage :global(.ccpun-ci-result-cta) { text-align: left; }\n.calculatorStage :global(.ccpun-ci-result-cta-inner) { width: min(560px,100%); margin-inline: auto; }\n.calculatorStage :global(.ccpun-ci-result-cta) h3 { margin: 0; line-height: 1.45; }\n.calculatorStage :global(.ccpun-ci-result-cta) :global(.ccpun-ci-result-cta-copy) { margin-top: 8px; }\n.calculatorStage :global(.ccpun-ci-result-cta) :global(.ccpun-ci-result-image-actions) { margin-top: 20px; }\n.calculatorStage :global(.ccpun-ci-result-cta) :global(#ci-result-image-privacy) { margin-top: 12px; font-size: 12px; line-height: 1.55; }\n.calculatorStage :global(.ccpun-ci-result-cta) :global(#ci-result-image-status) { margin-top: 8px; font-size: 12px; line-height: 1.5; }\n.calculatorStage :global(.ccpun-ci-result-cta) :global(.ccpun-ci-result-cta-line) { margin-top: 20px; }\n.calculatorStage :global(.ccpun-calculator-result-method-grid) { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }\n.calculatorStage :global(.ccpun-calculator-result-method) { min-height: 56px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border: 1px solid var(--w43-border); border-radius: 12px; background: rgba(37,24,24,.28); cursor: pointer; }\n.calculatorStage :global(.ccpun-calculator-result-method-selected) { border-color: rgba(224,201,133,.56); background: rgba(224,201,133,.07); }\n.calculatorStage :global(.ccpun-calculator-result-details) { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--w43-border); }\n.calculatorStage :global(.ccpun-calculator-result-details) summary { cursor: pointer; color: var(--w43-ink); font-size: 14px; font-weight: 600; }\n.calculatorStage :global(.ccpun-calculator-result) :global(.money-comparison) { padding: 2px 0; }\n.calculatorStage :global(.ccpun-calculator-result) :global(.money-comparison) dl { border-color: var(--w43-border); background: rgba(37,24,24,.28); }\n.ciStoryCarouselWrap { position: relative; }\n.ciStoryViewport { position: relative; margin-top: 36px; }\n.ciStoryGrid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 16px; }\n.ciStoryGrid > :nth-child(n+4) { display: none; }\n.ciStoryCarouselControls { display: none; }\n.ciStoryCard { overflow: hidden; border: 1px solid var(--w43-border); border-radius: 16px; background: var(--w43-surface); }\n.ciStoryCard img { width: 100%; aspect-ratio: 4/3; object-fit: cover; }\n.ciStoryCard div { padding: 20px; }\n.ciStoryCard h3 { margin: 0; font-size: 20px; }\n.ciStoryCard p { margin: 10px 0 0; color: var(--w43-muted); font-size: 15px; line-height: 1.6; }\n"
      ],
      [
        22715,
        "",
        "  }\n  .calculatorHeader {\n    width: 100%;\n    margin: 8px 0 0;\n    text-align: left;\n  }\n  .calculatorHeader h2 { margin-top: 12px; }\n  .calculatorHeader p { margin-top: 14px; line-height: 1.6; }\n  .calculatorStage { width: 100%; margin: 0; }\n  .methodBox {\n    display: grid;\n    grid-template-columns: minmax(280px, .82fr) minmax(0, 1.18fr);\n    column-gap: 48px;\n    row-gap: 0;\n    align-items: start;\n"
      ],
      [
        27978,
        "",
        "\n\n  .truthGrid { grid-template-columns: repeat(2,minmax(0,1fr)); }\n  .truthGrid .truth:last-child { grid-column: 1 / -1; }\n  .truth { min-height: 0; padding: 20px; }\n  .methodBox { margin-top: 44px; padding: 26px; }\n"
      ],
      [
        28077,
        "",
        "  .ciStoryGrid { gap: 12px; }\n"
      ],
      [
        34453,
        "",
        "  .toolHeroReadabilityOverlay { background: linear-gradient(180deg,rgba(6,11,9,.92) 0px,rgba(6,11,9,.9) 244px,rgba(6,11,9,.66) 330px,rgba(6,11,9,.56) 430px,rgba(6,11,9,.74) 100%); }\n"
      ],
      [
        34775,
        "",
        "  .truthGrid { grid-template-columns: 1fr; }\n  .truth { min-height: 0; padding: 20px; border: 1px solid rgba(91,72,72,.5); }\n\n  .methodBox { gap: 16px; margin-top: 32px; padding: 20px; }\n"
      ],
      [
        34827,
        "",
        "  .toolProjectRecognition { align-items: flex-start; flex-direction: column; gap: 14px; }\n  .toolProjectRecognitionLink img { height: 44px; }\n  .fhcIntroCompact { padding-bottom: 8px; }\n  .fhcContextSection { padding-top: 32px; }\n"
      ],
      [
        34877,
        "",
        "  .calculatorHeader h2 { font-size: 26px; }\n  .faqDetails summary { padding: 22px 0 14px; }\n  .faqDetails p { padding: 6px 0 34px; }\n  .toolStorySection[aria-labelledby=\"ci-reading-title\"] .faqDetails { margin-top: 20px; }\n  .calculatorStage :global(.ccpun-calculator-result-lead) { padding: 20px; }\n  .calculatorStage :global(.ccpun-calculator-result-title) { font-size: 26px; }\n  .calculatorStage :global(.ccpun-calculator-result-amount) { font-size: 38px; }\n  .calculatorStage :global(.ccpun-calculator-result-row) { flex-direction: column; align-items: flex-start; gap: 4px; }\n  .calculatorStage :global(.ccpun-calculator-result-row) dd { text-align: left; }\n  .calculatorStage :global(.ccpun-calculator-result-breakdown .ccpun-calculator-result-row) { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: start; gap: 12px; }\n  .calculatorStage :global(.ccpun-calculator-result-breakdown .ccpun-calculator-result-row) dd { text-align: right; }\n  .calculatorStage :global(.ccpun-calculator-result-method-grid) { grid-template-columns: 1fr; }\n  .calculatorStage :global(.ccpun-calculator-result-cta) { padding: 20px; }\n  .toolMethodGrid { grid-template-columns: 1fr; gap: 12px; }\n  .ciStoryCarouselWrap { --ci-story-card-width: min(78vw, 430px); margin-inline: -24px; }\n  .ciStoryGrid { position: relative; display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; scroll-padding-inline: calc(50% - min(39vw, 215px)); padding-inline: calc(50% - min(39vw, 215px)); scrollbar-width: none; -webkit-overflow-scrolling: touch; }\n  .ciStoryGrid > :nth-child(n+4) { display: block; }\n  .ciStoryGrid::-webkit-scrollbar { display: none; }\n  .ciStoryGrid:focus-visible { outline: 2px solid var(--w43-gold); outline-offset: 2px; }\n  .ciStoryCard { flex: 0 0 var(--ci-story-card-width); scroll-snap-align: center; scroll-snap-stop: always; }\n  .ciStoryCarouselControls { position: absolute; inset: 0; display: block; pointer-events: none; }\n  .ciStoryCarouselControls button { position: absolute; top: 50%; width: 44px; height: 44px; display: grid; place-items: center; padding: 0; border: 1px solid var(--w43-border); border-radius: 999px; background: rgba(37,24,24,.82); color: var(--w43-gold); cursor: pointer; pointer-events: auto; transform: translateY(-50%); }\n  .ciStoryCarouselControls button:first-child { left: calc(50% - min(39vw, 215px) + 8px); }\n  .ciStoryCarouselControls button:last-child { right: calc(50% - min(39vw, 215px) + 8px); }\n  .ciStoryCarouselControls button:focus-visible { outline: 2px solid var(--w43-gold); outline-offset: 2px; }\n  .ciStoryCarouselControls svg { width: 18px; height: 18px; }\n"
      ],
      [
        51013,
        "",
        ".root .toolHeroFullBleed .toolHeroImage { inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center 42%; -webkit-mask-image: none; mask-image: none; }\n.root .toolHeroFullBleed .toolHeroGradient { inset: 0; width: 100%; height: 100%; background: linear-gradient(90deg,rgba(6,11,9,.98) 0%,rgba(6,11,9,.92) 30%,rgba(6,11,9,.68) 56%,rgba(6,11,9,.34) 78%,rgba(6,11,9,.16) 100%); }\n.root .toolHeroFullBleed .primaryButton { width: clamp(176px, 15.28vw, 220px); min-width: 176px; min-height: 52px; margin-top: 24px; }\n"
      ],
      [
        51043,
        "",
        "  .root .toolHeroFullBleed .primaryButton { width: 176px; min-height: 48px; }\n"
      ],
      [
        51074,
        "",
        "  .root .toolHeroFullBleed .toolHeroGradient { background: linear-gradient(180deg,rgba(6,11,9,.97) 0%,rgba(6,11,9,.92) 31%,rgba(6,11,9,.56) 50%,rgba(6,11,9,.24) 68%,rgba(6,11,9,.72) 100%); }\n  .root .toolHeroFullBleed .primaryButton { margin: 0; }\n"
      ]
    ]
  },
  "lib/line/chat-panel.ts": {
    "before": "af511adc66ef0a7056d848976776d2ae7ada92cd37f51e3115ecc8c965868990",
    "after": "25a4ad5b70f67495e166bb2b2dfbc1d8b95f278766a8a601a2ec355052127928",
    "edits": [
      [
        2395,
        "export const LINE_CHAT_RESULT_TOPICS = { ci: \"ci-result-chat\", fhc: \"fhc-result-chat\" } as const;\nexport type LineChatResultTool = keyof typeof LINE_CHAT_RESULT_TOPICS;\n",
        ""
      ],
      [
        14665,
        "  /** A result CTA passes a bounded tool token only, never calculator answers or result values. */\n  resultTool?: LineChatResultTool;\n",
        ""
      ],
      [
        24821,
        "  const resultId = input.resultTool === \"ci\" && token === \"tool_ci\" ? LINE_CHAT_RESULT_TOPICS.ci\n    : input.resultTool === \"fhc\" && token === \"tool_fhc\" ? LINE_CHAT_RESULT_TOPICS.fhc : undefined;\n  const resultTopic = resultId ? fromLibrary(resultId) : undefined;\n",
        ""
      ],
      [
        25208,
        "  let selected = [...(resultTopic ? [resultTopic] : []), ...pinned, ...base].filter((topic) => !seen.has(topic.id) && Boolean(seen.add(topic.id))).slice(0, LINE_CHAT_LIMITS.placementTopics);\n",
        "  let selected = [...pinned, ...base].filter((topic) => !seen.has(topic.id) && Boolean(seen.add(topic.id))).slice(0, LINE_CHAT_LIMITS.placementTopics);\n"
      ],
      [
        25953,
        "  // Result CTAs require their tool origin even when a generic page choice hides the source sentence.\n  const resultSource = resultTopic ? templateSentence || chatTemplateSentence(input) : templateSentence;\n",
        ""
      ],
      [
        26370,
        "      ...selected.map((topic) => topic.id === resultTopic?.id ? panelTopic(topic, resultSource) : panelTopic(topic, templateSentence, pageChoice)),\n",
        "      ...selected.map((topic) => panelTopic(topic, templateSentence, pageChoice)),\n"
      ],
      [
        27591,
        "    ...(token === \"tool_ci\" ? [LINE_CHAT_RESULT_TOPICS.ci] : token === \"tool_fhc\" ? [LINE_CHAT_RESULT_TOPICS.fhc] : []),\n",
        ""
      ],
      [
        30641,
        "/** SSR/not-yet-hydrated result fallback: approved generic intent and tool origin, never user values. */\nexport function resultChatHref(tool: LineChatResultTool): string {\n  const context = chatContextForPath(tool === \"ci\" ? \"/ci-planning/\" : \"/tools/financial-health-check/\");\n  const topic = LINE_CHAT_DEFAULTS.topics.find(topic => topic.id === LINE_CHAT_RESULT_TOPICS[tool])!;\n  return buildLineOaMessageHref(composeChatMessage(topic.prefill, chatTemplateSentence(context)));\n}\n\n",
        ""
      ]
    ]
  }
});
export function adminCmsBridgePredecessor(file, source) {
  source = adminPreviewEditorLinkPredecessor(file, source);
  const pin = Object.hasOwn(adminCmsBridgePins, file) ? adminCmsBridgePins[file] : null;
  if (!pin || typeof source !== 'string' || sha(source) !== pin.after) return source;
  for (const [offset, current, prior] of [...pin.edits].reverse()) {
    assert.equal(source.slice(offset, offset + current.length), current, 'exact owned Admin bridge bytes');
    source = source.slice(0, offset) + prior + source.slice(offset + current.length);
  }
  assert.equal(sha(source), pin.before, 'every active Admin568 predecessor byte retained');
  return source;
}

// Exact Admin-only editor link correction; persisted IDs and all prior bridge pins stay intact.
export function adminPreviewEditorLinkPredecessor(file, source) {
  if (file !== "apps/admin/app/(control-plane)/content/website-preview/page.tsx" || typeof source !== "string" || sha(source) !== "d853db357c1a33046a66e2c6c3ad92c31bdb3c436dcae0de90ef93d05abd6bf1") return source;
  source = source.replace('PUBLIC_COPY_SCOPES, isPublicCopyScopeAvailable', 'PUBLIC_COPY_SCOPES, publicCopyDocumentId, isPublicCopyScopeAvailable')
    .replace('href={`/studio/structure/public-pages;copy-${scope}`}', 'href={`/studio/intent/edit/id=${publicCopyDocumentId(scope)};type=publicPageCopy`}');
  assert.equal(sha(source), "cb0673fabda0ba4f415beecb70c5bfcae0836c22201a12b7a2beedc6d60357ea", "Exact preceding Admin preview source");
  return source;
}

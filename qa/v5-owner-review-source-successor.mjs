import { cmsCopyScopePredecessor, cmsCopyLocationsPredecessor } from "./v5-cms-copy-scope-successor.mjs";
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const sha = value => createHash('sha256').update(value).digest('hex');
// Exact owner-approved 2026-10-29 cover/404/category CSS, countdown, article TOC and additive copy source successor.
// Only these complete reviewed files can reconstruct 6456e71a; historical pins stay frozen.
export const ownerReviewSourcePins = Object.freeze({
  "components/layout/v5/V5.module.css": {
    "before": "c297679c24477de582ba1d086963bd314234c48a14f828c54a3fce724f82a88b",
    "after": "f5ac130e4627c2f141128fd6fc8517e69f81d650913e22e7141e39a34848d703",
    "edits": [
      [
        "  :is(.cardGrid, .cardGrid2) > .articleCard:only-child, :is(.cardGrid, .cardGrid2) > :only-child > .articleCard { flex-direction: row; --v5-card-meta-top: 0; }\n  :is(.cardGrid, .cardGrid2) > .articleCard:only-child > .articleCardImage, :is(.cardGrid, .cardGrid2) > :only-child > .articleCard > .articleCardImage { width: 40%; height: auto; aspect-ratio: auto; align-self: flex-start; flex: none; border-radius: var(--v5-card-image-radius) 0 0 var(--v5-card-image-radius); }\n  :is(.cardGrid, .cardGrid2) > .articleCard:only-child > .articleCardBody, :is(.cardGrid, .cardGrid2) > :only-child > .articleCard > .articleCardBody { justify-content: center; padding: 24px 32px; }\n",
        "  :is(.cardGrid, .cardGrid2) > .articleCard:only-child, :is(.cardGrid, .cardGrid2) > :only-child > .articleCard { flex-direction: row; --v5-card-meta-top: 0; }\n  :is(.cardGrid, .cardGrid2) > .articleCard:only-child > .articleCardImage, :is(.cardGrid, .cardGrid2) > :only-child > .articleCard > .articleCardImage { width: 40%; height: auto; aspect-ratio: 1200 / 630; align-self: center; flex: none; border-radius: var(--v5-card-image-radius) 0 0 var(--v5-card-image-radius); }\n  :is(.cardGrid, .cardGrid2) > .articleCard:only-child > .articleCardBody, :is(.cardGrid, .cardGrid2) > :only-child > .articleCard > .articleCardBody { justify-content: center; padding: 24px 32px; }\n"
      ],
      [
        ".articleCard:has(.articleCardTitle a:focus-visible) { outline: 3px solid var(--v5-focus); outline-offset: 3px; }\n/* Informative covers use their source dimensions, including legacy shapes with baked-in text. */\n.articleCardImage { display: block; width: 100%; height: auto; aspect-ratio: auto; object-fit: contain; object-position: top; background: var(--v5-surface); border-radius: var(--v5-card-image-radius) var(--v5-card-image-radius) 0 0; }\n.articleCardImage:not(img) { aspect-ratio: 1200 / 630; }\n.articleCardBody { display: flex; flex: 1; flex-direction: column; gap: 8px; padding: 20px 20px 20px; }\n",
        ".articleCard:has(.articleCardTitle a:focus-visible) { outline: 3px solid var(--v5-focus); outline-offset: 3px; }\n/*\n  Covers (owner request 2026-10-25): every Production cover is 1200 x 630 with baked-in text and the CCPUN logo,\n  so a cover always shows whole at 1200 / 630 and is never stretched or cropped by the card layout. object-fit\n  stays only as a safety for legacy images of another shape.\n*/\n.articleCardImage { display: block; width: 100%; height: auto; aspect-ratio: 1200 / 630; object-fit: cover; object-position: center; background: var(--v5-surface); border-radius: var(--v5-card-image-radius) var(--v5-card-image-radius) 0 0; }\n.articleCardBody { display: flex; flex: 1; flex-direction: column; gap: 8px; padding: 20px 20px 20px; }\n"
      ],
      [
        ".articleCardHorizontal { flex-direction: row; align-items: stretch; --v5-card-meta-top: 0; }\n/* Horizontal covers hug their intrinsic height and align with the start of the text column. */\n.articleCardHorizontal .articleCardImage { width: 38%; height: auto; aspect-ratio: auto; align-self: flex-start; flex: none; border-radius: var(--v5-card-image-radius) 0 0 var(--v5-card-image-radius); }\n.articleCardHorizontal .articleCardBody { justify-content: center; padding: 16px 16px; }\n",
        ".articleCardHorizontal { flex-direction: row; align-items: stretch; --v5-card-meta-top: 0; }\n/*\n  Horizontal cards (owner bug report 2026-10-26, options a + c): the whole 1200 x 630 cover keeps a fixed width at\n  its natural height and is centred in its column, so a taller text column leaves even card background above and\n  below it instead of an empty block under the cover; the text group is centred too, so the date row follows the\n  title. Where the text column would be far taller than the cover (phones and the two-up rows from 900 to 1279px)\n  the card stacks. The cover's outer corners follow the card radius.\n*/\n.articleCardHorizontal .articleCardImage { width: 38%; height: auto; aspect-ratio: 1200 / 630; align-self: center; flex: none; border-radius: var(--v5-card-image-radius) 0 0 var(--v5-card-image-radius); }\n.articleCardHorizontal .articleCardBody { justify-content: center; padding: 16px 16px; }\n"
      ],
      [
        "  .articleCardHorizontal { flex-direction: column; --v5-card-meta-top: auto; }\n  .articleCardHorizontal .articleCardImage { width: 100%; min-height: 0; aspect-ratio: auto; }\n  .articleCardHorizontal .articleCardImage { border-radius: var(--v5-card-image-radius) var(--v5-card-image-radius) 0 0; }\n",
        "  .articleCardHorizontal { flex-direction: column; --v5-card-meta-top: auto; }\n  .articleCardHorizontal .articleCardImage { width: 100%; min-height: 0; aspect-ratio: 1200 / 630; }\n  .articleCardHorizontal .articleCardImage { border-radius: var(--v5-card-image-radius) var(--v5-card-image-radius) 0 0; }\n"
      ],
      [
        "@media (min-width:1024px) { :global(#v5-blog-scope) .articleCardTitle a::after, :global(section[aria-labelledby=\"not-found-latest\"]) .articleCardTitle a::after { right:calc(248px - var(--v5-gutter)); } }\n\n/* 404 recovery controls leave the same fixed LINE corner clear as the reading surfaces. */\n.notFoundTools { padding-inline-end: max(var(--v5-gutter), 80px); }\n@media (min-width: 1024px) { .notFoundTools { padding-inline-end: max(var(--v5-gutter), 248px); } }\n",
        "@media (min-width:1024px) { :global(#v5-blog-scope) .articleCardTitle a::after, :global(section[aria-labelledby=\"not-found-latest\"]) .articleCardTitle a::after { right:calc(248px - var(--v5-gutter)); } }\n"
      ]
    ]
  },
  "features/blog/v5/V5Article.tsx": {
    "before": "5882c19a0704e82b3184524689e1c0d7e585b7259441cde3770819c260b142c5",
    "after": "0893228fb8d19ed772325f9cc0e07f101771f3d2b38cc352be8dfac0491a4db8",
    "edits": [
      [
        "import { estimateArticleReadingMinutes } from \"@/features/blog/website-43/articleReadingTime\";\nimport styles from \"./V5Blog.module.css\";\nimport Toc from \"./V5ArticleToc\";\nimport { renderV5ArticleBody } from \"./V5ArticleBody\";\nimport { resolveNextSteps } from \"./next-step\";\n",
        "import { estimateArticleReadingMinutes } from \"@/features/blog/website-43/articleReadingTime\";\nimport styles from \"./V5Blog.module.css\";\nimport { renderV5ArticleBody } from \"./V5ArticleBody\";\nimport { resolveNextSteps } from \"./next-step\";\n"
      ],
      [
        "type Heading = { index: number; id: string; label: string; level: number };\n\n\nexport default async function V5Article({ article, relatedArticles = [], allArticles = [], preview = false }: { article: Article; relatedArticles?: Article[]; allArticles?: readonly Article[]; preview?: boolean }) {\n",
        "type Heading = { index: number; id: string; label: string; level: number };\n\nfunction Toc({ groups }: { groups: Array<{ primary: Heading; children: Heading[] }> }) {\n  return (\n    <ol>\n      {groups.map(({ primary, children }) => (\n        <li key={primary.id}>\n          <a href={`#${primary.id}`}>{primary.label}</a>\n          {children.length > 0 && <ol>{children.map((child) => <li key={child.id}><a href={`#${child.id}`}>{child.label}</a></li>)}</ol>}\n        </li>\n      ))}\n    </ol>\n  );\n}\n\nexport default async function V5Article({ article, relatedArticles = [], allArticles = [], preview = false }: { article: Article; relatedArticles?: Article[]; allArticles?: readonly Article[]; preview?: boolean }) {\n"
      ]
    ]
  },
  "features/blog/v5/V5Blog.module.css": {
    "before": "b3d16a11dc6c0b61ef0a4a1879bc4124d7d23e1885cb3e83e69b55bcc3d283cb",
    "after": "1f96a110081cc38dbdb2059170187f620c3f69eecd68b31cb0deb868014d4054",
    "edits": [
      [
        ".heroLead { color: var(--v5-muted); font-size: clamp(16px, 1.6vw, 19px); margin-top: 12px; }\n.search { position: relative; }\n",
        ".heroLead { color: var(--v5-muted); font-size: clamp(16px, 1.6vw, 19px); margin-top: 12px; }\n.authorChip { display: inline-flex; align-items: center; gap: 12px; margin-top: 16px; font-size: var(--v5-text-meta); font-weight: 500; font-family: var(--v5-font-display); }\n.authorChip img { width: 36px; height: 36px; border-radius: 999px; object-fit: cover; object-position: top; background: var(--v5-surface); }\n.search { position: relative; }\n"
      ],
      [
        ".chipRow { margin-top: 24px; overflow-x: auto; scrollbar-width: none; margin-inline: calc(var(--v5-gutter) * -1); padding-inline: var(--v5-gutter); }\n.chipRow [aria-current=\"page\"] { background: var(--v5-text); border-color: var(--v5-text); color: var(--v5-bg); }\n.chipRow::-webkit-scrollbar { display: none; }\n",
        ".chipRow { margin-top: 24px; overflow-x: auto; scrollbar-width: none; margin-inline: calc(var(--v5-gutter) * -1); padding-inline: var(--v5-gutter); }\n.chipRow::-webkit-scrollbar { display: none; }\n"
      ],
      [
        ".featuredLead { flex-direction: column; }\n/* The lead card turns horizontal from 1024px (owner bug report 2026-10-26): the whole cover keeps its intrinsic height at the start of its half. */\n@media (min-width: 1024px) {\n  .featuredLead { flex-direction: row; --v5-card-meta-top: 0; }\n  .featuredLead > img { width: 50%; height: auto; aspect-ratio: auto; align-self: flex-start; flex: none; border-radius: var(--v5-card-image-radius) 0 0 var(--v5-card-image-radius); }\n  .featuredLead > div { justify-content: center; padding: 32px 36px; }\n",
        ".featuredLead { flex-direction: column; }\n/* The lead card turns horizontal from 1024px (owner bug report 2026-10-26): the whole cover is centred in its half. */\n@media (min-width: 1024px) {\n  .featuredLead { flex-direction: row; --v5-card-meta-top: 0; }\n  .featuredLead > img { width: 50%; height: auto; aspect-ratio: 1200 / 630; align-self: center; flex: none; border-radius: var(--v5-card-image-radius) 0 0 var(--v5-card-image-radius); }\n  .featuredLead > div { justify-content: center; padding: 32px 36px; }\n"
      ],
      [
        ".toc a { display: flex; align-items: center; min-height: 44px; padding: 8px; text-wrap: balance; border-radius: 10px; color: var(--v5-muted); font-size: 14px; line-height: 1.5; text-decoration: none; }\n.toc a:hover, .toc a[aria-current=\"location\"] { background: var(--v5-bg-alt); color: var(--v5-text); }\n.toc ol[hidden] { display: none; }\n.tocRow { display: flex; align-items: start; gap: 4px; }\n.tocRow > a { flex: 1; min-width: 0; }\n.tocRow > button { display: grid; place-items: center; flex: 0 0 44px; min-height: 44px; padding: 8px; border: 0; border-radius: 10px; background: transparent; color: var(--v5-muted); font: inherit; cursor: pointer; }\n.tocRow > button:hover { background: var(--v5-bg-alt); color: var(--v5-text); }\n.tocMobile { border: 1px solid var(--v5-border-soft); border-radius: var(--v5-radius-sm); background: var(--v5-card); margin-bottom: 24px; }\n",
        ".toc a { display: flex; align-items: center; min-height: 44px; padding: 8px; text-wrap: balance; border-radius: 10px; color: var(--v5-muted); font-size: 14px; line-height: 1.5; text-decoration: none; }\n.toc a:hover { background: var(--v5-bg-alt); color: var(--v5-text); }\n.tocMobile { border: 1px solid var(--v5-border-soft); border-radius: var(--v5-radius-sm); background: var(--v5-card); margin-bottom: 24px; }\n"
      ],
      [
        ".prose h3 { font-size: clamp(19px, 2vw, 22px); line-height: 1.45; margin-top: 32px; scroll-margin-top: 96px; }\n.prose h4 { font-size: 18px; font-weight: 400; line-height: 1.5; color: var(--v5-muted); margin-top: 24px; scroll-margin-top: 96px; }\n@media (min-width: 1024px) { .prose h4 { font-size: 20px; } }\n.prose a:not([class]), .imageLink { color: var(--v5-gold-text); text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }\n",
        ".prose h3 { font-size: clamp(19px, 2vw, 22px); line-height: 1.45; margin-top: 32px; scroll-margin-top: 96px; }\n.prose h4 { font-size: 18px; margin-top: 24px; scroll-margin-top: 96px; }\n.prose a:not([class]), .imageLink { color: var(--v5-gold-text); text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }\n"
      ]
    ]
  },
  "features/investment-allocation/InvestmentAllocation.module.css": {
    "before": "05b29e203fbf4eda01a6d98d9e6986551f0ec5f3cfcccf4791faa453fb4cf995",
    "after": "d2f2349dddbab2678c4d4f1dfaa07329b9f44d4a083a2e8853fce6b8220ea732",
    "edits": [
      [
        ".handoffFallback{margin-top:1rem;max-width:100%;overflow-wrap:anywhere}.handoffFallback summary{cursor:pointer}.handoffFallback label{display:block;margin-top:.75rem}.handoffFallback textarea{box-sizing:border-box;width:100%;margin:.5rem 0;padding:.75rem;border:1px solid var(--w43-border);border-radius:.5rem;background:var(--w43-deep);color:inherit;font:inherit;resize:vertical}.handoffFallback textarea:focus-visible,.handoffFallback a:focus-visible{outline:2px solid currentColor;outline-offset:3px}\n\n/* The v5 six-choice grid shares the tallest natural row; selected borders retain their reserved width. */\n:global([data-v5-header] ~ main) .categoryGrid { grid-auto-rows: 1fr; align-items: stretch; }\n:global([data-v5-header] ~ main) .categoryCard { box-sizing: border-box; width: 100%; min-width: 0; height: 100%; }\n",
        ".handoffFallback{margin-top:1rem;max-width:100%;overflow-wrap:anywhere}.handoffFallback summary{cursor:pointer}.handoffFallback label{display:block;margin-top:.75rem}.handoffFallback textarea{box-sizing:border-box;width:100%;margin:.5rem 0;padding:.75rem;border:1px solid var(--w43-border);border-radius:.5rem;background:var(--w43-deep);color:inherit;font:inherit;resize:vertical}.handoffFallback textarea:focus-visible,.handoffFallback a:focus-visible{outline:2px solid currentColor;outline-offset:3px}\n"
      ]
    ]
  },
  "lib/content/blog-copy-defaults.ts": {
    "before": "ad1a4df17d901a41180de6daaf159c11a12b440b276c06dc9c0479d8d8a4d2d6",
    "after": "a663d7ce27c12b22f466fae632d5d9a096e202eed1b4771e94542848a9bce480",
    "edits": [
      [
        "  \"blog.category.description\": \"รวมบทความและความรู้เรื่อง{title}จาก CCPun\",\n  \"blog.categoryAccounts.title\": \"เปิดบัญชีลงทุน\",\n  \"blog.categoryAccounts.phillip\": \"เปิดบัญชี Phillip\",\n  \"blog.categoryAccounts.maybank\": \"เปิดบัญชี Maybank\",\n  \"blog.category.heading\": \"ทำความเข้าใจ{title}ก่อนตัดสินใจ\",\n",
        "  \"blog.category.description\": \"รวมบทความและความรู้เรื่อง{title}จาก CCPun\",\n  \"blog.category.heading\": \"ทำความเข้าใจ{title}ก่อนตัดสินใจ\",\n"
      ]
    ]
  },
  "components/ui/health-happy/HealthHappyCountdown.tsx": {
    "before": "9c5bc7b625a49755d3be90ef885e4cb3bade1d9bf9fb0fff2ea68f8e609d1618",
    "after": "a397d1ef6b34c81cc07660b01cbc8b2860d0807497c5b4a1313cdb72f5e1fd80",
    "edits": [
      [
        "\nexport default function HealthHappyCountdown({ placement, splitDigits = false }: { placement: Placement; splitDigits?: boolean }) {\n  const text = usePublicCopy();\n",
        "\nexport default function HealthHappyCountdown({ placement }: { placement: Placement }) {\n  const text = usePublicCopy();\n"
      ],
      [
        "  return (\n    <aside ref={countdownRef} className={splitDigits ? `${styles.outside} ${styles.splitDigits}` : styles.outside} data-countdown-style={splitDigits ? \"tiles\" : undefined} aria-label={text(\"site.extra.healthHappyCountdownarialabel\")} data-campaign=\"aia-health-happy-2026\" data-campaign-placement={placement}>\n      <div className={styles.frame}>\n",
        "  return (\n    <aside ref={countdownRef} className={styles.outside} aria-label={text(\"site.extra.healthHappyCountdownarialabel\")} data-campaign=\"aia-health-happy-2026\" data-campaign-placement={placement}>\n      <div className={styles.frame}>\n"
      ],
      [
        "              <span className={styles.timeUnit}>\n                <strong className={styles.numeral}>\n                  {splitDigits ? <>\n                    <span className={styles.srOnly}>{value === undefined ? '--' : String(value).padStart(2, '0')}</span>\n                    <span className={styles.digits} aria-hidden=\"true\">{Array.from(value === undefined ? '--' : String(value).padStart(2, '0')).map((digit, index) => <span className={styles.digit} key={index}>{digit}</span>)}</span>\n                  </> : value === undefined ? '--' : String(value).padStart(2, '0')}\n                </strong>\n                <span className={styles.timeLabel}>{label}</span>\n",
        "              <span className={styles.timeUnit}>\n                <strong className={styles.numeral}>{value === undefined ? '--' : String(value).padStart(2, '0')}</strong>\n                <span className={styles.timeLabel}>{label}</span>\n"
      ]
    ]
  },
  "components/ui/health-happy/HealthHappyCountdown.module.css": {
    "before": "680f964d475b51ed3a2be9c092257fc17554916626d57c03668ad28ca4cad804",
    "after": "913c4c25b5b9ee8a0508a69854a453f2b147a66605df46dc7264df8d0ddda5da",
    "edits": [
      [
        "}\n\n/* The v5 opt-in uses static split tiles; the shared clock, actions and legacy presentation stay unchanged. */\n.splitDigits .frame { min-height: 0; align-items: center; padding-block: 24px; overflow: visible; }\n.splitDigits .info { overflow-wrap: anywhere; }\n.splitDigits .timer { padding: 12px 0; gap: 12px; border: 0; background: transparent; }\n.splitDigits .timePart:first-child { flex: 1 1 0; }\n.splitDigits .numeral { color: #faf6f0; }\n.digits { display: flex; justify-content: center; gap: 4px; }\n.digit { position: relative; display: grid; place-items: center; width: .95em; padding-block: 4px; border: 1px solid #5b4848; border-radius: 6px; background: #352727; color: #faf6f0; }\n.digit::after { content: \"\"; position: absolute; inset-inline: 0; top: 50%; border-top: 1px solid rgb(250 246 240 / 25%); }\n.srOnly { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }\n@media (max-width: 650px) {\n  .splitDigits .frame { padding: 16px; gap: 16px; }\n  .splitDigits .brandLine { gap: 8px; }\n  .splitDigits .timer { gap: 8px; padding: 0; }\n}\n",
        "}\n"
      ]
    ]
  },
  "apps/web/app/not-found.tsx": {
    "before": "8f337f74f2cce92b35478abd857fd9274ea785445df72ce3ea89c9e57186d3a2",
    "after": "ee65b97ebeb55c26615f1f549c62b9e3d4f02e0984e182045d02a07c963c37b6",
    "edits": [
      [
        "import { getPublishedArticles } from '@/components/layout/v5/shell-data';\nimport { V5_AIA_FUND_TOOL, V5_INVESTMENT_TOOL, V5_TOOL_LINKS } from \"@/components/layout/v5/constants\";\nimport { INVESTMENT_ALLOCATION_ENABLED } from \"@/lib/runtime/investment-availability\";\n\n",
        "import { getPublishedArticles } from '@/components/layout/v5/shell-data';\n\n"
      ],
      [
        "  const text = publicCopyText(await getPublicCopy(\"site\"));\n  const tools = [\n    ...V5_TOOL_LINKS.map((tool) => ({ href: tool.href, label: text(tool.nameKey) })),\n    ...(INVESTMENT_ALLOCATION_ENABLED ? [V5_INVESTMENT_TOOL, V5_AIA_FUND_TOOL] : []),\n  ];\n  // v5 404 (FigCraft 12): recovery links plus the latest articles; a CMS outage still renders the page.\n",
        "  const text = publicCopyText(await getPublicCopy(\"site\"));\n  // v5 404 (FigCraft 12): recovery links plus the latest articles; a CMS outage still renders the page.\n"
      ],
      [
        "      </section>\n      <section className={shell.section} style={{ paddingTop: 0 }} aria-labelledby=\"not-found-tools\">\n        <div className={`${shell.inner} ${shell.notFoundTools}`}>\n          <h2 id=\"not-found-tools\" className={shell.h2} style={{ marginBottom: 24 }}>{text.node(\"site.nav.tools\")}</h2>\n          <nav aria-label={text(\"site.nav.tools\")}><ul className={shell.chips}>{tools.map((tool) => <li key={tool.href}><Link className={shell.buttonOutline} href={tool.href}>{tool.label}</Link></li>)}</ul></nav>\n        </div>\n      </section>\n      {latest.length > 0 && <section className={shell.section} style={{ paddingTop: 0 }} aria-labelledby=\"not-found-latest\">\n",
        "      </section>\n      {latest.length > 0 && <section className={shell.section} style={{ paddingTop: 0 }} aria-labelledby=\"not-found-latest\">\n"
      ]
    ]
  },
  "next.config.ts": {
    "before": "4196891a2f0f1b680ba2cef07d07c1dd6db122fea09b16aa78382a9613ba39f5",
    "after": "a0c8d5d4de393babacb57972b7a92008744290b36b1e9ab1c432df3b721fce50",
    "edits": [
      [
        "  images: {\n    formats: [\"image/webp\"],\n    qualities: [75, 90],\n",
        "  images: {\n    formats: [\"image/avif\", \"image/webp\"],\n    qualities: [75, 90],\n"
      ]
    ]
  },
  "apps/web/next.config.ts": {
    "before": "0e4e2029ba44044d103da94cb10b60359e0e53f4c8ba19cf0ad338bf8be0d3aa",
    "after": "40b525e82ee76ce5ec0ea30b0b50c2032a3451d25f1e0cdce9b9edd89e8a6f4a",
    "edits": [
      [
        "  images: {\n    formats: [\"image/webp\"],\n    qualities: [75, 90],\n",
        "  images: {\n    formats: [\"image/avif\", \"image/webp\"],\n    qualities: [75, 90],\n"
      ]
    ]
  },
  "features/blog/pages/BlogCategoryPage.tsx": {
    "before": "a69647fc9d9a02a514031a989be3907a2af7f5ed6096e5d07e17132afb04384f",
    "after": "4cb067e053c534c5ac962ee985d63fa06840216fda76188dacc09cefb135296b",
    "edits": [
      [
        "        articles={relevantArticles}\n        totalArticleCount={visibleArticles.length}\n        topics={linkableTopics(registry, visibleArticles)}\n",
        "        articles={relevantArticles}\n        topics={linkableTopics(registry, visibleArticles)}\n"
      ],
      [
        "      articles={relevantArticles}\n      totalArticleCount={publishedArticles.length}\n      topics={linkableTopics(registry, publishedArticles)}\n",
        "      articles={relevantArticles}\n      topics={linkableTopics(registry, publishedArticles)}\n"
      ]
    ]
  }
});

// Exact native-approved About layout and mobile AIA text reserve; all historical CSS pins remain unchanged.
export const aboutToolsLayoutPins = Object.freeze({
  "features/about/About.module.css": {
    "before": "d0ed667b13e0434cf7d3d06682095f9a3546be580cfea51e5da7b1676421ba07",
    "after": "a3e209f3a607d98e23b8e6596e31a223224af686bcf168253b1fbd3d2ba1e33a",
    "edits": [
      [
        ".fatherStory ul { list-style: disc; padding-left: 1.4em; display: grid; gap: 12px; }\n.fatherPhrase { white-space: normal; }\n/* Keep the existing LINE corner clear while the story uses the stacked layout. */\n@media (max-width: 1279px) {\n  .fatherStory > p, .fatherStoryBody, .fatherPhoto figcaption { max-width: min(760px, 100%, calc(100vw - var(--v5-gutter) - 80px)); }\n}\n@media (min-width: 1024px) and (max-width: 1279px) {\n  .fatherStory > p, .fatherStoryBody, .fatherPhoto figcaption { max-width: min(760px, 100%, calc(100vw - var(--v5-gutter) - 248px)); }\n}\n@media (min-width: 900px) {\n",
        ".fatherStory ul { list-style: disc; padding-left: 1.4em; display: grid; gap: 12px; }\n@media (min-width: 900px) {\n"
      ],
      [
        "@media (min-width: 900px) {\n  /* The approved UAT story uses the full shared width; Production has no father trial. */\n  .split:has(.fatherStory) { grid-template-columns: minmax(0, 1fr); }\n  .split:has(.fatherStory) > .story { max-width: none; }\n  .split:has(.fatherStory) > h2,\n  .split:has(.fatherStory) > .story > :not(.fatherStory) { max-width: 760px; }\n}\n@media (min-width: 1280px) {\n  .fatherStory { grid-template-columns: minmax(0, 5fr) minmax(0, 3fr); gap: 20px 64px; padding-block: 20px; align-items: start; }\n  .fatherStory h3 { grid-column: 1; grid-row: 1; }\n  .fatherStory > p { grid-column: 1; grid-row: 2; }\n  .fatherPhoto { grid-column: 2; grid-row: 1 / 4; max-width: none; }\n  .fatherPhoto figcaption { max-width: min(280px, calc(100% - max(0px, calc(248px - var(--v5-gutter))))); }\n  .fatherStoryBody { grid-column: 1; grid-row: 3; }\n}\n",
        "@media (min-width: 900px) {\n  .fatherStory { grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); align-items: start; }\n  .fatherStory h3 { grid-column: 1 / -1; }\n  .fatherStory > p { grid-column: 2; grid-row: 2; }\n  .fatherPhoto { grid-column: 1; grid-row: 2 / 4; }\n  .fatherStoryBody { grid-column: 2; }\n}\n"
      ]
    ]
  },
  "features/tools-hub/ToolsHub.module.css": {
    "before": "83c1feee22ea57e01d6213ef019057dcb8e5a0c2c0b360a141df85cd0a80ae1a",
    "after": "1c8997d0e9fcd537db2e570d06b32b0ace9738fc7238810201d59c4911906f82",
    "edits": [
      [
        "@media (max-width:1023px) { .card h2 a::after { right:calc(80px - var(--v5-gutter)); } }\n@media (max-width:479px) {\n  .card:has(h2 a[href=\"/tools/financial-health-check/\"]) > p,\n  .card:has(h2 a[href=\"/tools/aia-fund-allocation/\"]) > p { padding-right:40px; }\n}\n@media (min-width:1024px) { .card h2 a::after { right:calc(248px - var(--v5-gutter)); } }\n",
        "@media (max-width:1023px) { .card h2 a::after { right:calc(80px - var(--v5-gutter)); } }\n@media (max-width:479px) { .card:has(h2 a[href=\"/tools/financial-health-check/\"]) > p { padding-right:40px; } }\n@media (min-width:1024px) { .card h2 a::after { right:calc(248px - var(--v5-gutter)); } }\n"
      ]
    ]
  },
  "features/about/page.tsx": {
    "before": "6cd93cd1349a38cbe53641619880e7cc5c60e3a9bb7908e2651a0c77bdd3f140",
    "after": "d2070ede6bcaec4dcc56cb39e71aa7fcb11a8ef41973b85bb3bc87425cd92a23",
    "edits": [
      [
        "    <figure className={styles.fatherPhoto} data-uat-placeholder=\"about-father-photo\">\n      <Image src=\"/assets/ccpun-father-v5-colour.webp\" alt={text(\"about.father.photoAlt\")} width={1086} height={1448} sizes=\"(max-width: 1279px) min(420px, calc(100vw - 40px)), (max-width: 1439px) calc(37.5vw - 84px), 456px\" />\n      <figcaption>{typeof caption === \"string\" ? caption.split(\"\\n\").map((line, index) => <span key={line}>{index > 0 ? <br /> : null}{keepFatherPhrase(line)}</span>) : caption}</figcaption>\n",
        "    <figure className={styles.fatherPhoto} data-uat-placeholder=\"about-father-photo\">\n      <Image src=\"/assets/ccpun-father-v5-colour.webp\" alt={text(\"about.father.photoAlt\")} width={1086} height={1448} sizes=\"(max-width: 899px) calc(100vw - 40px), 280px\" />\n      <figcaption>{typeof caption === \"string\" ? caption.split(\"\\n\").map((line, index) => <span key={line}>{index > 0 ? <br /> : null}{keepFatherPhrase(line)}</span>) : caption}</figcaption>\n"
      ],
      [
        "/** Match the existing licence-card `keep` mechanism without changing the plain text. */\nfunction keepFatherPhrase(value: ReactNode, wrapTerms = false) {\n  if (typeof value !== \"string\") return value;\n",
        "/** Match the existing licence-card `keep` mechanism without changing the plain text. */\nfunction keepFatherPhrase(value: ReactNode) {\n  if (typeof value !== \"string\") return value;\n"
      ],
      [
        "  if (at < 0) return value;\n  const phrase = wrapTerms ? <span className={styles.fatherPhrase}>{FATHER_STORY_KEEP.split(\" \").flatMap((term, index) => [\n    index ? \" \" : null, <span className={flipStyles.keep} key={term}>{term}</span>,\n  ])}</span> : <span className={flipStyles.keep}>{FATHER_STORY_KEEP}</span>;\n  return <>{value.slice(0, at)}{phrase}{value.slice(at + FATHER_STORY_KEEP.length)}</>;\n}\n",
        "  if (at < 0) return value;\n  return <>{value.slice(0, at)}<span className={flipStyles.keep}>{FATHER_STORY_KEEP}</span>{value.slice(at + FATHER_STORY_KEEP.length)}</>;\n}\n"
      ],
      [
        "      <h3>{text.node(\"about.father.heading\")}</h3>\n      <p>{keepFatherPhrase(text.node(\"about.father.paragraph1\"), true)}</p>\n      <FatherPhotoSlot text={text} />\n",
        "      <h3>{text.node(\"about.father.heading\")}</h3>\n      <p>{keepFatherPhrase(text.node(\"about.father.paragraph1\"))}</p>\n      <FatherPhotoSlot text={text} />\n"
      ]
    ]
  }
});
export function aboutToolsLayoutPredecessor(file, source) {
  const pin = Object.hasOwn(aboutToolsLayoutPins, file) ? aboutToolsLayoutPins[file] : null;
  if (!pin || sha(source) !== pin.after) return source;
  for (const [current, prior] of pin.edits) {
    assert.equal(source.split(current).length, 2, 'Exactly one complete approved layout fragment');
    source = source.replace(current, prior);
  }
  assert.equal(sha(source), pin.before, 'Every original layout byte reconstructed');
  return source;
}

export function ownerReviewSourcePredecessor(file, source) {
  source = aboutToolsLayoutPredecessor(file, source);
  source = cmsCopyScopePredecessor(file, source);
  source = fullCountdownSourcePredecessor(file, source);
  const pin = Object.hasOwn(ownerReviewSourcePins, file) ? ownerReviewSourcePins[file] : null;
  if (!pin || sha(source) !== pin.after) return source;
  for (const [current, prior] of pin.edits) {
    assert.equal(source.split(current).length, 2, 'Exactly one complete reviewed source fragment');
    source = source.replace(current, prior);
  }
  assert.equal(sha(source), pin.before, 'Every original source byte reconstructed');
  return source;
}

// Only the complete default article fixture gains TOC row wrappers; body/anchors/dates remain literal.
export function ownerReviewHtmlPredecessor(html, key) {
  if ((key === 'about:true:false' || key === 'about:true:true') && sha(html) === '3b0cb4e5ab93c1f9e0008d35b9a4fcfe06ca85421a824fba0cea61e1cd9d5d9c') {
    const current = "<span class=\"fatherPhrase\"><span class=\"keep\">บริหารเวลา</span> <span class=\"keep\">บริหารเงิน</span> <span class=\"keep\">บริหารชีวิต</span></span>";
    assert.equal(html.split(current).length, 2, 'Only one complete paragraph quote wrapper');
    let prior = html.replace(current, "<span class=\"keep\">บริหารเวลา บริหารเงิน บริหารชีวิต</span>");
    const imageHint = '(max-width: 1279px) min(420px, calc(100vw - 40px)), (max-width: 1439px) calc(37.5vw - 84px), 456px';
    assert.equal(prior.split(imageHint).length, 3, 'One father image hint in img and React preload metadata only');
    prior = prior.replaceAll(imageHint, '(max-width: 899px) calc(100vw - 40px), 280px');
    assert.equal(sha(prior), '2e759121f0b0941c2c52f763fe663fdf290a68f90b99f3e195ea8e9c0d9817af', 'Every prior default About byte, including caption markup, retained');
    return prior;
  }

  if (key !== 'v5Article' || sha(html) !== 'c4f55c6eb7dba38573575c2d55cc73c885a96e6181f2ddac1d79787928158765') return html;
  let count = 0;
  const prior = html.replace(/<div class="tocRow">(<a href="[^"]+">[^<>]+<\/a>)<\/div>/g, (_, link) => { count++; return link; });
  assert.equal(count, 2, 'One original heading anchor in each desktop/mobile TOC');
  assert.equal(sha(prior), '1cac44d3f282dd8c6d84908a56ad457b7aa108bf54c8e9821899b0a92afaa906', 'Every prior integrated article byte restored');
  return prior;
}

// Exact generated metadata successor: move the five reviewed entries back; never copy a whole map.
export function ownerReviewLocationsPredecessor(source) {
  // Exactly eight About-only copy additions; preserve every historical pin and other scope.
  if (sha(source) === "7cfa3100a07771cb4e3c946c25a651ad57b7653b76f0c795990273af9eadaa30") {
    const locations = JSON.parse(source);
    for (const key of ["about.storyV2.photoAlt.scbs", "about.storyV2.photoAlt.phillip", "about.storyV2.photoAlt.bitkub", "about.storyV2.verify.tfpa", "about.storyV2.verify.sec", "about.storyV2.verify.oic", "about.storyV2.verify.back", "about.storyV2.verify.help"]) delete locations.about.entries[key];
    Object.values(locations.about.entries).forEach((entry, order) => { entry.order = order; });
    locations.about.entries["about.father.photoAlt"].section = "บทเรียนที่คุณพ่อสอน · ฉบับทดลอง UAT";
    locations.about.sections = locations.about.sections.filter(section => section !== "คุณวุฒิและใบอนุญาต");
    source = JSON.stringify(locations) + "\n";
    assert.equal(sha(source), "272e0188c1a6201076dcf38560574669320d85e209d74579b4c99244d4e0634f", "Exact preceding About metadata; no other scope changed");
  }
  // Story V2 UAT-only 40 field metadata successor. Only exact reviewed map
  // may be reduced to the preceding 15 About fields; all other scopes remain byte identical.
  if (sha(source) === "272e0188c1a6201076dcf38560574669320d85e209d74579b4c99244d4e0634f") {
    const locations = JSON.parse(source);
    const oldKeys = ["about.breadcrumb.home", "about.father.heading", "about.father.paragraph1", "about.father.photoAlt", "about.father.caption", "about.father.paragraph2", "about.father.paragraph3", "about.father.paragraph4", "about.father.paragraph5", "about.father.paragraph6", "about.father.question1", "about.father.question2", "about.father.question3", "about.father.paragraph7", "about.next.tools"];
    const oldSections = ["ส่วนหัวและเส้นทาง", "บทเรียนที่คุณพ่อสอน · ฉบับทดลอง UAT", "อ่านและใช้เครื่องมือต่อ"];
    assert.equal(Object.keys(locations.about.entries).length, 55);
    locations.about.entries = Object.fromEntries(oldKeys.map((key, order) => {
      assert.ok(locations.about.entries[key], key);
      return [key, { ...locations.about.entries[key], order }];
    }));
    locations.about.sections = oldSections;
    source = JSON.stringify(locations) + "\n";
    assert.equal(sha(source), "754138b4ed2ebeae0f2a995804aa0e5dde07ff7b0b986473722ac2a43668f043", "exact pre-V2 map retained");
  }
  // The unchanged generator reorders only six existing Home locations after the About helper grows.
  if (sha(source) === '754138b4ed2ebeae0f2a995804aa0e5dde07ff7b0b986473722ac2a43668f043') {
    const locations = JSON.parse(source);
    const orders = {"home.blockquote2": 78, "home.cite2": 79, "home.toolCtaAction": 80, "home.p6": 81, "home.p5": 82, "home.moneyStory.description": 83};
    for (const [key, order] of Object.entries(orders)) locations.home.entries[key].order = order;
    locations.home.entries = Object.fromEntries(Object.entries(locations.home.entries).sort((a, b) => a[1].order - b[1].order));
    source = JSON.stringify(locations) + '\n';
    assert.equal(sha(source), 'f417f769d7b3a12ab7e5cb55da4af5db822916c044f6e2e3e7691f1b2089b94b', 'Every prior generated map byte retained');
  }
  source = cmsCopyLocationsPredecessor(source);
  if (sha(source) !== 'f1f110371ce02eb8dfb9e20360b71795d2c55e105c1603c5d95d1f637f6a6e79') return source;
  const locations = JSON.parse(source);
  const site = locations.site, blog = locations.blog;
  for (const key of ['blog.categoryAccounts.title','blog.categoryAccounts.phillip','blog.categoryAccounts.maybank']) delete blog.entries[key];
  site.sections = site.sections.filter(section => section !== 'เครื่องมือ');
  blog.sections = blog.sections.filter(section => section !== 'ข้อความที่ระบบเลือกแสดงตามสถานการณ์');
  site.entries['site.nav.tools'].section = 'สำรวจ';
  blog.entries['blog.topicTools.title'].section = '… บทความ';
  blog.entries['blog.topicTools.title'].kind = 'หัวข้อส่วน';
  blog.entries['blog.topicTools.description'].section = '… บทความ';
  blog.entries['blog.topicTools.description'].kind = 'ย่อหน้า';
  for (const key of ['blog.lead','blog.faqCta']) blog.entries[key].section = 'อยากจัดลำดับแผนให้เหมาะกับชีวิตคุณ?';
  for (const [scope, moves] of [[site, [['site.nav.tools',10]]], [blog, [['blog.topicTools.title',20],['blog.topicTools.description',21],['blog.lead',58],['blog.faqCta',59]]]]) {
    const moved = new Map(moves.map(([key]) => [key, scope.entries[key]]));
    const entries = Object.entries(scope.entries).filter(([key]) => !moved.has(key));
    for (const [key, index] of moves) entries.splice(index,0,[key,moved.get(key)]);
    scope.entries = Object.fromEntries(entries.map(([key, value], order) => [key, { ...value, order }]));
  }
  const prior = JSON.stringify(locations) + '\n';
  assert.equal(sha(prior), '41ac751407cc2c2d5556db517d40ba7243363b81d02ac56eed73ae345ab96bc0', 'Every original generated map byte reconstructed');
  return prior;
}

// Owner 2026-10-29: show every existing countdown action; retain all older source admissions.
export function fullCountdownSourcePredecessor(file, source) {
  source = oneRowCountdownSourcePredecessor(file, source);
  if (file === 'components/ui/health-happy/HealthHappyCountdown.module.css' && sha(source) === 'bdf0ab886e7c3076913299ab605db68f9e11abd9838482ce26ea5149c9983fda') {
    assert.equal(source.split(".splitDigits .timer { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 12px 0; gap: 12px; border: 0; background: transparent; }").length, 2);
    source = source.replace(".splitDigits .timer { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 12px 0; gap: 12px; border: 0; background: transparent; }", ".splitDigits .timer { padding: 12px 0; gap: 12px; border: 0; background: transparent; }");
    assert.equal(source.split("  .splitDigits .timer { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 0; }").length, 2);
    source = source.replace("  .splitDigits .timer { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 0; }", "  .splitDigits .timer { gap: 8px; padding: 0; }");
    assert.equal(sha(source), ownerReviewSourcePins[file].after, 'Only the responsive full-size timer grid is restored');
    return source;
  }
  if (file !== 'components/layout/v5/V5.module.css' || sha(source) !== '3cbe59379e46a41539d41622e270d466a5fc651d612c7f48f39f19c06bc317fd') return source;
  const clearance = "/* Full campaign actions in Blog/Article keep the existing fixed LINE corner clear; Home owns its frame. */\n.countdownSlot:has(:global([data-campaign-placement=\"blog\"])), .countdownSlot:has(:global([data-campaign-placement=\"article\"])) { padding-inline-end: max(0px, calc(80px - var(--v5-gutter))); }\n@media (min-width: 1024px) { .countdownSlot:has(:global([data-campaign-placement=\"blog\"])), .countdownSlot:has(:global([data-campaign-placement=\"article\"])) { padding-inline-end: max(0px, calc(248px - var(--v5-gutter))); } }\n";
  assert.equal(source.split(clearance).length, 2);
  source = source.replace(clearance, '');
  const anchor = ':global(html[data-v5-countdown-ended]) .countdownSlot { display: none; }\n';
  assert.equal(source.split(anchor).length, 2);
  const prior = source.replace(anchor, anchor + "/* One LINE OA button per page (owner decision 2026-10-25): the dock is it, so the countdown's own\n   LINE action is not rendered in v5; its \"read details\" action and its analytics stay unchanged. */\n.countdownSlot :global([data-campaign-action=\"line\"]) { display: none; }\n");
  assert.equal(sha(prior), 'f5ac130e4627c2f141128fd6fc8517e69f81d650913e22e7141e39a34848d703', 'Only the old campaign LINE hide block is restored for historic proofs');
  return prior;
}

// Owner correction: all four units stay in one horizontal row. The rejected two-row bytes are proof history only.
export function oneRowCountdownSourcePredecessor(file, source) {
  if (file !== 'components/ui/health-happy/HealthHappyCountdown.module.css' || sha(source) !== '05b5e5726c6227036dbf0a18b63cc8a05420a51ec32464be4e0b713c9647e14c') return source;
  const current = "  .splitDigits .timer { gap: 4px; padding: 0; }\n  .splitDigits .numeral { font-size: clamp(18px, 6vw, 24px); }\n";
  assert.equal(source.split(current).length, 2);
  const prior = source.replace(current, "  .splitDigits .timer { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 0; }\n");
  assert.equal(sha(prior), 'bdf0ab886e7c3076913299ab605db68f9e11abd9838482ce26ea5149c9983fda', 'Only mobile numeral sizing and spacing change; every earlier byte stays frozen');
  return prior;
}

// Owner-approved Story V2 UAT renderer and CSS are additive strict successors.
// Reconstruct the original protected source bytes before historical layout tests.
const ownerStoryV2PageEdits = [
  [
    "import OwnerStoryV2 from \"./OwnerStoryV2\";\n",
    ""
  ],
  [
    "              {IS_REVIEW_ENVIRONMENT ? <p className={styles.ownerHeroIntro}>{text.node(\"about.storyV2.heroIntro\")}</p> : null}\n              {!IS_REVIEW_ENVIRONMENT ? <V5CredentialCards className={styles.credentials} qualification={qualification} licenceCards={licenceCards} /> : null}\n",
    "              <OwnerCopySlot slot=\"about-hero-sentence\" note=\"ประโยคแนะนำตัวของปั้นหนึ่งประโยค (รอข้อความจากเจ้าของ)\" />\n              <V5CredentialCards className={styles.credentials} qualification={qualification} licenceCards={licenceCards} />\n"
  ],
  [
    "      {IS_REVIEW_ENVIRONMENT ? (\n        <section className={shell.section} aria-label=\"ประวัติและแนวทางการวางแผนการเงิน\">\n          <div className={shell.inner}>\n            <OwnerStoryV2 text={text} qualification={qualification} licenceCards={licenceCards} />\n",
    "      <section className={shell.section} aria-labelledby=\"about-story\">\n        <div className={`${shell.inner} ${styles.split}`}>\n          <h2 id=\"about-story\" className={shell.h2}>{home.node(\"home.h2\")}</h2>\n          <div className={styles.story}>\n            <OwnerCopySlot slot=\"about-start-years\" note=\"ปีที่เริ่มงานการเงินและการลงทุน และปีที่เริ่มเป็นที่ปรึกษา (รอข้อมูลจากเจ้าของ)\" />\n            <p>{home.node(\"home.p\")}</p>\n            <FatherStory text={text} />\n            <p>{home.node(\"home.p2\")}</p>\n            <p>{home.node(\"home.p3\")}</p>\n"
  ],
  [
    "        </section>\n      ) : (\n        <section className={shell.section} aria-labelledby=\"about-story\">\n          <div className={`${shell.inner} ${styles.split}`}>\n            <h2 id=\"about-story\" className={shell.h2}>{home.node(\"home.h2\")}</h2>\n            <div className={styles.story}>\n              <OwnerCopySlot slot=\"about-start-years\" note=\"ปีที่เริ่มงานการเงินและการลงทุน และปีที่เริ่มเป็นที่ปรึกษา (รอข้อมูลจากเจ้าของ)\" />\n              <p>{home.node(\"home.p\")}</p>\n              <FatherStory text={text} />\n              <p>{home.node(\"home.p2\")}</p>\n              <p>{home.node(\"home.p3\")}</p>\n            </div>\n          </div>\n        </section>\n      )}\n",
    "        </div>\n      </section>\n"
  ]
];
export function ownerReviewStoryV2SourcePredecessor(file, source) {
  source = ownerReviewAboutWordsPredecessor(file, source);
  if (file === 'features/about/page.tsx' && sha(source) === '82c6d9416b4c3c633e90fc2c463dd4cfdd25ec39e1125a8590165f7c1162e463') {
    for (const [current, previous] of ownerStoryV2PageEdits) {
      assert.equal(source.split(current).length, 2, file + ': only one reviewed source edit');
      source = source.replace(current, previous);
    }
    assert.equal(sha(source), 'd2070ede6bcaec4dcc56cb39e71aa7fcb11a8ef41973b85bb3bc87425cd92a23', 'Exact historical About page restored');
    return source;
  }
  if (file === 'features/about/About.module.css' && sha(source) === 'dd4c912f5ca4f0f22c1b983f70f1f3e60cd550447c498c3073712db83951ce58') {
    const marker = '\n/* Owner-approved four-chapter story: FigCraft Responsive v2';
    assert.equal(source.split(marker).length, 2);
    source = source.slice(0, source.indexOf(marker));
    assert.equal(sha(source), 'a3e209f3a607d98e23b8e6596e31a223224af686bcf168253b1fbd3d2ba1e33a', 'Exact historical About CSS restored');
    return source;
  }
  return source;
}

// Admit only the exact About word-markup and descendant-selector corrections.
export function ownerReviewAboutWordsPredecessor(file, source) {
  if (file === "features/about/page.tsx" && sha(source) === "f1540c85d551a708b02254e56383a4f4b67571264afb21e3bae0b958014ee9c0") {
    source = source.replace('import OwnerStoryV2, { keepWords } from "./OwnerStoryV2";', 'import OwnerStoryV2 from "./OwnerStoryV2";')
      .replace('  const aboutWords = (value: ReactNode) => IS_REVIEW_ENVIRONMENT ? keepWords(value) : value;\n', '')
      .replace(/aboutWords\(((?:home|text)\.node\("[^"]+"\)|displayName|role|partner\.name|partner\.role)\)/g, '$1');
    assert.equal(sha(source), "82c6d9416b4c3c633e90fc2c463dd4cfdd25ec39e1125a8590165f7c1162e463", "Exact preceding About renderer");
  }
  if (file === "features/about/About.module.css" && sha(source) === "cf9c85e787b5e5ae7f0a696f4ca428002c8fa7478737c77605b0c64e69424fe4") {
    source = source.replace('.credentials > li:last-child:has(button)', '.credentials > li:last-child:has(> button)');
    assert.equal(sha(source), "dd4c912f5ca4f0f22c1b983f70f1f3e60cd550447c498c3073712db83951ce58", "Exact preceding About CSS; LINE reserve retained");
  }
  return source;
}
